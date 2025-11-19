import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import './TerminalApp.css'
import {
  buildMailList,
  countUnreadMail,
  createMailEngineState,
  ensureMailDelivered,
  formatMailDateLabel,
  formatMailTimestamp,
  MailFilterOptions,
  MailListEntry,
  MailEngineState,
  markMailRead,
  serializeMailState,
  SerializedMailState,
  setMailDefinitions
} from './mailSystem'
import {
  createQuestEngineState,
  processQuestEvent,
  getQuestDefinitionById,
  QuestEngineState,
  QuestEvent,
  QuestEventResult,
  QuestEventType,
  SerializedQuestState,
  serializeQuestState,
  setQuestDefinitions,
  offerQuestFromMail
} from './questSystem'
import {
  changeDirectory,
  createHostRuntime,
  getHostByIp,
  HostRuntime,
  listDirectory,
  readFile,
  removeFile,
  RemoteNode,
  setSystemDefinitions
} from './terminalHosts'
import { getCachedDesktop, hydrateFromServer, saveDesktopState } from '../services/saveService'
import { listPublishedTerminalMail } from '../services/terminalMail'
import { listTerminalQuests } from '../services/terminalQuests'
import { listSystemDefinitions } from '../systemDefinitions/service'
import {
  applyTraceCost,
  clampTerminalLines,
  createTerminalSessionState,
  deliverQuestMailPhase,
  hydrateTerminalSessionState,
  snapshotTerminalSessionState,
  type TerminalContext,
  type TerminalLine,
  type TerminalRemoteSession,
  type TerminalSnapshotSession,
  type TerminalSnapshot,
  type TraceAction,
  type TraceMeterState
} from './terminalRuntime'

interface CommandDescriptor {
  name: string
  description: string
}

type InboxListOptions = MailFilterOptions & {
  page: number
  pageSize: number
}

const PLAYER_ID = 'player-1'
const MAIL_PAGE_SIZE = 7

const LOCAL_COMMANDS: CommandDescriptor[] = [
  { name: 'help', description: 'Show locally available commands' },
  { name: 'inbox [filters]', description: 'View secure email inbox' },
  { name: 'mail <index>', description: 'Open a mail item by number' },
  { name: 'open <index>', description: 'Open from the last inbox view' },
  { name: 'scan <ip>', description: 'Probe a host for reachability' },
  { name: 'connect <ip>', description: 'Open a remote shell' },
  { name: 'quest_debug', description: 'Dump quest engine debug info' },
  { name: 'exit', description: 'Close the terminal session' }
]

const REMOTE_COMMANDS: CommandDescriptor[] = [
  { name: 'help', description: 'Show remote commands' },
  { name: 'ls', description: 'List directory contents' },
  { name: 'cd <path>', description: 'Change working directory' },
  { name: 'cat <file>', description: 'Print a file' },
  { name: 'rm <file>', description: 'Delete a file' },
  { name: 'disconnect', description: 'Close the current connection' }
]

const formatCommandList = (commands: CommandDescriptor[]) => (
  ['Available commands:'].concat(commands.map(entry => `${entry.name.padEnd(18, ' ')}${entry.description}`)).join('\n')
)

const QUEST_DEBUG_ENABLED = typeof import.meta !== 'undefined' && !!import.meta.env?.DEV

const logQuestDebugInfo = (event: QuestEvent, result: QuestEventResult) => {
  if (!QUEST_DEBUG_ENABLED) return
  const activeSummary = result.state.active.map(instance => ({
    questId: instance.quest.id,
    step: `${Math.min(instance.currentStepIndex + 1, instance.quest.steps.length)}/${instance.quest.steps.length || 0}`,
    completed: instance.completed
  }))
  const groupLabel = `[quest-debug] ${event.type}`
  if (typeof console.groupCollapsed === 'function') {
    console.groupCollapsed(groupLabel)
    console.debug('event', event)
    console.debug('active', activeSummary)
    console.debug('completedIds', result.state.completedIds)
    if (result.notifications.length) {
      console.debug('notifications', result.notifications)
    }
    console.groupEnd?.()
    return
  }
  console.debug(groupLabel, {
    event,
    active: activeSummary,
    completedIds: result.state.completedIds,
    notifications: result.notifications
  })
}

export const TerminalApp: React.FC = () => {
  const initialSession = useMemo(() => createTerminalSessionState(), [])
  const [questState, setQuestState] = useState<QuestEngineState>(initialSession.questState)
  const [mailState, setMailState] = useState<MailEngineState>(initialSession.mailState)
  const [lines, setLines] = useState<TerminalLine[]>(initialSession.lines)
  const [buffer, setBuffer] = useState(initialSession.buffer)
  const [session, setSession] = useState<TerminalRemoteSession | null>(initialSession.remoteSession)
  const [trace, setTrace] = useState<TraceMeterState>(initialSession.trace)
  const [systemsReady, setSystemsReady] = useState(false)
  const [definitionsReady, setDefinitionsReady] = useState(false)
  const [mailDefinitionsReady, setMailDefinitionsReady] = useState(false)
  const [hydrationComplete, setHydrationComplete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const pendingSnapshotRef = useRef<TerminalSnapshot | null>(null)
  const questStateInitializedRef = useRef(false)
  const mailStateInitializedRef = useRef(false)
  const lastNotificationRef = useRef<string | null>(null)
  const lastMailNoticeRef = useRef<string | null>(null)
  const inboxListingRef = useRef<Record<number, string> | null>(null)
  const lastQuestResultRef = useRef<QuestEventResult | null>(null)
  const sessionRef = useRef<TerminalRemoteSession | null>(session)
  const persistenceReady = definitionsReady && hydrationComplete && mailDefinitionsReady

  const context: TerminalContext = session ? 'remote' : 'local'
  const prompt = session ? `${session.hostIp}:${session.cwd}$` : '>'

  const print = useCallback((text: string, role: TerminalLine['role'] = 'system') => {
    setLines(prev => clampTerminalLines([...prev, { role, text }]))
  }, [])

  const syncQuestMailPhase = useCallback((questIds: string[] | undefined, phase: 'accept' | 'complete') => {
    if (!questIds?.length || !mailDefinitionsReady) return
    setMailState((prev: MailEngineState) => questIds.reduce((state, questId) => deliverQuestMailPhase(state, questId, phase), prev))
  }, [mailDefinitionsReady])

  const buildSessionFromSnapshot = useCallback((snapshotSession?: TerminalSnapshotSession | null): TerminalRemoteSession | null => {
    if (!snapshotSession) return null
    const host = getHostByIp(snapshotSession.hostIp)
    if (!host || !host.online) return null
    const runtime = createHostRuntime(host)
    return {
      hostIp: host.ip,
      username: snapshotSession.username || host.username,
      cwd: snapshotSession.cwd || host.startingPath || '/',
      runtime
    }
  }, [])

  const handleQuestEvent = useCallback((type: QuestEventType, payload: { target_ip?: string; file_path?: string } = {}) => {
    lastQuestResultRef.current = null
    setQuestState(prev => {
      const event = { type, payload: { playerId: PLAYER_ID, ...payload } }
      const result = processQuestEvent(prev, event)
      lastQuestResultRef.current = result
      logQuestDebugInfo(event, result)
      result.notifications.forEach(note => {
        const key = `${event.type}:${event.payload.target_ip || 'local'}:${note}`
        if (lastNotificationRef.current === key) return
        lastNotificationRef.current = key
        console.debug?.('[quest-notify]', key)
        print(`[quest] ${note}`)
      })
      return result.state
    })
    const questResult = lastQuestResultRef.current as QuestEventResult | null
    if (!questResult) return
    if (questResult.acceptedQuestIds?.length) {
      syncQuestMailPhase(questResult.acceptedQuestIds, 'accept')
    }
    if (questResult.completedQuestIds?.length) {
      syncQuestMailPhase(questResult.completedQuestIds, 'complete')
    }
  }, [print, syncQuestMailPhase])

  const applyTraceAction = useCallback((action: TraceAction) => {
    let statusChanged: TraceMeterState['status'] | undefined
    setTrace(prev => {
      const { state: next, statusChanged: nextStatus } = applyTraceCost(prev, action)
      statusChanged = nextStatus
      return next
    })
    if (!statusChanged) return
    if (statusChanged === 'nervous') {
      print('[trace] Signal noise rising. Stay subtle.')
      return
    }
    if (statusChanged === 'panic') {
      print('[trace] Trace maxed out! Connections unstable.')
      const activeSession = sessionRef.current
      if (activeSession) {
        setSession(null)
        print(`[disconnect] ${activeSession.hostIp} severed the link.`)
        handleQuestEvent('SESSION_DISCONNECTED', { target_ip: activeSession.hostIp })
      }
      return
    }
    print('[trace] Signal stabilized.')
  }, [handleQuestEvent, print])

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const target = outputRef.current
    if (!target || typeof target.scrollTo !== 'function') return
    target.scrollTo({ top: target.scrollHeight, behavior: 'smooth' })
  }, [lines])

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    let cancelled = false
    const loadSystems = async () => {
      try {
        const payload = await listSystemDefinitions()
        if (cancelled) return
        setSystemDefinitions(payload.systems || [])
      } catch (err) {
        console.warn('[terminal] failed to load system profiles, using fallback', err)
        setSystemDefinitions(undefined)
      } finally {
        if (!cancelled) {
          setSystemsReady(true)
        }
      }
    }
    void loadSystems()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false

    const cached = getCachedDesktop()
    if (cached?.terminalState) {
      pendingSnapshotRef.current = cached.terminalState
    }

    const hydrate = async () => {
      try {
        const unified = await hydrateFromServer()
        if (!cancelled) {
          const snapshot = (unified.desktop?.terminalState as TerminalSnapshot | undefined) || null
          if (snapshot) {
            pendingSnapshotRef.current = snapshot
          }
        }
      } finally {
        if (!cancelled) {
          setHydrationComplete(true)
        }
      }
    }

    void hydrate()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!definitionsReady || !hydrationComplete) return
    const snapshot = pendingSnapshotRef.current
    if (snapshot) {
      pendingSnapshotRef.current = null
      const hydrated = hydrateTerminalSessionState(snapshot)
      setQuestState(hydrated.questState)
      setMailState(hydrated.mailState)
      setLines(hydrated.lines)
      setBuffer(hydrated.buffer)
      setTrace(hydrated.trace)
      const restoredSession = buildSessionFromSnapshot(snapshot.session)
      setSession(restoredSession)
      questStateInitializedRef.current = true
      mailStateInitializedRef.current = true
      return
    }
    if (!questStateInitializedRef.current) {
      setQuestState(createQuestEngineState())
      questStateInitializedRef.current = true
    }
    if (!mailStateInitializedRef.current) {
      setMailState(createMailEngineState())
      mailStateInitializedRef.current = true
    }
  }, [buildSessionFromSnapshot, definitionsReady, hydrationComplete])

  useEffect(() => {
    let cancelled = false

    const loadDefinitions = async (markReady = false) => {
      try {
        const defs = await listTerminalQuests()
        if (cancelled) return
        const published = defs.filter(def => def.status !== 'draft')
        setQuestDefinitions(published)
      } catch (err) {
        console.warn('[terminal] failed to load quest definitions, using fallback', err)
        setQuestDefinitions([])
      } finally {
        if (markReady && !cancelled) {
          setDefinitionsReady(true)
        }
      }
    }

    void loadDefinitions(true)

    if (typeof window !== 'undefined') {
      const handler = () => { void loadDefinitions() }
      window.addEventListener('terminalQuestsUpdated', handler)
      return () => {
        cancelled = true
        window.removeEventListener('terminalQuestsUpdated', handler)
      }
    }

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadMail = async () => {
      try {
        const messages = await listPublishedTerminalMail()
        if (cancelled) return
        setMailDefinitions(messages)
      } catch (err) {
        console.warn('[terminal] failed to load mail definitions, using fallback', err)
        setMailDefinitions([])
      } finally {
        if (!cancelled) {
          setMailDefinitionsReady(true)
        }
      }
    }
    void loadMail()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!mailDefinitionsReady) return
    setMailState((prev: MailEngineState) => ensureMailDelivered(prev))
  }, [mailDefinitionsReady])

  const persistTerminalState = useCallback(() => {
    saveDesktopState({
      terminalState: snapshotTerminalSessionState({
        lines,
        buffer,
        questState,
        mailState,
        remoteSession: session,
        trace
      })
    }).catch(err => console.warn('[terminal] failed to persist terminal state', err))
  }, [lines, buffer, questState, mailState, session, trace])

  useEffect(() => {
    if (!persistenceReady) return
    if (typeof window === 'undefined') return

    const timer = window.setTimeout(() => {
      persistTerminalState()
    }, 400)

    return () => {
      window.clearTimeout(timer)
    }
  }, [persistTerminalState, persistenceReady, questState, mailState])

  useEffect(() => {
    return () => {
      persistTerminalState()
    }
  }, [persistTerminalState])

  useEffect(() => {
    if (!mailDefinitionsReady || !hydrationComplete || !mailStateInitializedRef.current) return
    const unreadCount = countUnreadMail(mailState)
    const notice = unreadCount > 0
      ? `[mail] You have ${unreadCount} unread ${unreadCount === 1 ? 'message' : 'messages'}. Type "inbox" to view.`
      : '[mail] Inbox empty. Type "inbox" to view all messages.'
    if (lastMailNoticeRef.current === notice) return
    lastMailNoticeRef.current = notice
    print(notice)
  }, [mailDefinitionsReady, hydrationComplete, mailState])

  const tokenizeArgs = (input: string): string[] => input.match(/"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|\S+/g) || []
  const stripQuotes = (value: string): string => value.replace(/^['"]|['"]$/g, '').trim()

  const parseInboxArgs = (rawArgs: string): InboxListOptions => {
    const options: InboxListOptions = { page: 1, pageSize: MAIL_PAGE_SIZE }
    const tokens = tokenizeArgs(rawArgs.trim())
    for (let idx = 0; idx < tokens.length; idx += 1) {
      const token = tokens[idx]
      const normalized = token.toLowerCase()
      if (['inbox', 'mail', 'list'].includes(normalized)) {
        continue
      }
      if (normalized === 'unread') {
        options.unreadOnly = true
        continue
      }
      if (normalized === 'from') {
        const next = tokens[idx + 1]
        if (next) {
          options.sender = stripQuotes(next)
          idx += 1
        }
        continue
      }
      if (normalized === 'search') {
        const next = tokens[idx + 1]
        if (next) {
          options.search = stripQuotes(next)
          idx += 1
        }
        continue
      }
      const pageMatch = normalized.match(/^(?:-?p|--page|page)(?:=)?(\d+)?$/)
      if (pageMatch) {
        if (pageMatch[1]) {
          options.page = Math.max(1, parseInt(pageMatch[1], 10) || 1)
        } else if (tokens[idx + 1]) {
          options.page = Math.max(1, parseInt(tokens[idx + 1], 10) || 1)
          idx += 1
        }
        continue
      }
    }
    return options
  }

  const formatColumn = (value: string, width: number) => {
    const safe = value.length > width
      ? `${value.slice(0, Math.max(0, width - 3))}...`
      : value
    return safe.padEnd(width, ' ')
  }

  const renderInbox = (rawArgs: string) => {
    const options = parseInboxArgs(rawArgs)
    const { page, pageSize, ...filters } = options
    const entries = buildMailList(mailState, filters)
    if (!entries.length) {
      print(filters.unreadOnly || filters.sender || filters.search
        ? '[mail] No messages match that filter.'
        : '[mail] Inbox empty.')
      inboxListingRef.current = null
      return
    }
    const totalPages = Math.max(1, Math.ceil(entries.length / pageSize))
    const safePage = Math.min(Math.max(1, page), totalPages)
    const startIndex = (safePage - 1) * pageSize
    const visible = entries.slice(startIndex, startIndex + pageSize)
    const unreadCount = countUnreadMail(mailState)
    const indexMap: Record<number, string> = {}

    print(`INBOX (${unreadCount} unread)`)
    print('#  From               Subject                               Date        Unread')
    print('-------------------------------------------------------------------------------')
    visible.forEach((entry: MailListEntry, idx: number) => {
      const absoluteIndex = startIndex + idx + 1
      indexMap[absoluteIndex] = entry.id
      const row = `${String(absoluteIndex).padEnd(3)}${formatColumn(entry.fromName, 18)}${formatColumn(entry.subject, 37)}${formatColumn(formatMailDateLabel(entry.inUniverseDate), 12)}   ${entry.read ? ' ' : '*'}`
      print(row)
    })
    inboxListingRef.current = indexMap
    if (totalPages > 1) {
      if (safePage !== page) {
        print(`[mail] Page ${page} unavailable. Showing page ${safePage} of ${totalPages}.`)
      }
      print(`Page ${safePage}/${totalPages}. Use "inbox page <n>" to navigate.`)
    }
  }

  const openMailEntry = (entry: MailListEntry) => {
    const recipientName = 'You'
    const recipientEmail = 'operator@atlasnet'
    const wasUnread = !entry.read
    print(`From: ${entry.fromName} <${entry.fromAddress}>`)
    print(`To: ${recipientName} <${recipientEmail}>`)
    print(`Date: ${formatMailTimestamp(entry.inUniverseDate)}`)
    print(`Subject: ${entry.subject}`)
    print('')
    entry.body.split(/\r?\n/).forEach((line: string) => {
      print(line || '\u00a0')
    })
    setMailState((prev: MailEngineState) => markMailRead(prev, entry.id))
    if (wasUnread && entry.linkedQuestId) {
      let questOfferResult: QuestEventResult | null = null
      setQuestState(prev => {
        const questResult = offerQuestFromMail(prev, entry.linkedQuestId)
        questOfferResult = questResult
        if (questResult.notifications.length) {
          questResult.notifications.forEach((note: string) => print(`[quest] ${note}`))
        }
        return questResult.state
      })
      const pendingOffer = questOfferResult as QuestEventResult | null
      if (pendingOffer?.acceptedQuestIds?.length) {
        syncQuestMailPhase(pendingOffer.acceptedQuestIds, 'accept')
      }
    }
  }

  const openMailById = (id: string) => {
    if (!id) {
      print('[mail] Specify which message to open.')
      return
    }
    const entries = buildMailList(mailState, { includeArchived: true })
    const target = entries.find((entry: MailListEntry) => entry.id === id)
    if (!target) {
      print(`[mail] Message ${id} not found.`)
      return
    }
    openMailEntry(target)
  }

  const openMailFromListingIndex = (index: number) => {
    if (!index || index < 1) {
      print('Usage: open <index>')
      return
    }
    const mapping = inboxListingRef.current
    if (!mapping) {
      print('[mail] Run "inbox" before opening by index.')
      return
    }
    const id = mapping[index]
    if (!id) {
      print(`[mail] No message ${index} on the last inbox view.`)
      return
    }
    openMailById(id)
  }

  const openMailByGlobalIndex = (index: number) => {
    if (!index || index < 1) {
      print('Usage: mail <index>')
      return
    }
    const entries = buildMailList(mailState)
    if (!entries.length) {
      print('[mail] Inbox empty.')
      return
    }
    const target = entries[index - 1]
    if (!target) {
      print(`[mail] No message ${index} found. Try "inbox" for the latest list.`)
      return
    }
    openMailEntry(target)
  }

  const handleMailCommand = (args: string) => {
    const trimmed = args.trim()
    if (!trimmed) {
      renderInbox('')
      return
    }
    const lower = trimmed.toLowerCase()
    if (lower.startsWith('inbox')) {
      renderInbox(trimmed.slice(5).trim())
      return
    }
    if (lower.startsWith('open ')) {
      const idx = parseInt(trimmed.slice(5).trim(), 10)
      if (Number.isNaN(idx)) {
        print('Usage: mail open <index>')
        return
      }
      openMailByGlobalIndex(idx)
      return
    }
    const numeric = parseInt(trimmed, 10)
    if (!Number.isNaN(numeric) && `${numeric}` === trimmed) {
      openMailByGlobalIndex(numeric)
      return
    }
    renderInbox(trimmed)
  }

  const handleOpenCommand = (args: string) => {
    if (!args) {
      print('Usage: open <index>')
      return
    }
    const target = parseInt(args.trim(), 10)
    if (Number.isNaN(target)) {
      print('Usage: open <index>')
      return
    }
    openMailFromListingIndex(target)
  }

  const printQuestDebug = () => {
    print('[quest-debug]')
    const activeQuests = questState.active
    print('Active:')
    if (!activeQuests.length) {
      print('- (none)')
    } else {
      activeQuests.forEach(instance => {
        const totalSteps = instance.quest.steps.length
        const safeIndex = totalSteps > 0 ? Math.min(instance.currentStepIndex, totalSteps - 1) : 0
        const stepNumber = totalSteps > 0 ? Math.min(instance.currentStepIndex + 1, totalSteps) : 0
        const stepType = instance.quest.steps[safeIndex]?.type || 'N/A'
        const titlePart = instance.quest.title ? ` • ${instance.quest.title}` : ''
        print(`- ${instance.quest.id}${titlePart}: step ${stepNumber}/${totalSteps || 0} (${stepType})`)
      })
    }
    print('Completed:')
    if (!questState.completedIds.length) {
      print('- (none)')
    } else {
      questState.completedIds.forEach(id => {
        print(`- ${id}`)
      })
    }
  }

  const handleLocalCommand = async (command: string, args: string): Promise<boolean> => {
    let traceApplied = false
    switch (command) {
      case 'help':
        print(formatCommandList(LOCAL_COMMANDS))
        break
      case 'inbox':
        renderInbox(args)
        break
      case 'mail':
        handleMailCommand(args)
        break
      case 'open':
        handleOpenCommand(args)
        break
      case 'scan': {
        if (!args) {
          print('Usage: scan <ip>')
          return false
        }
        if (!systemsReady) {
          print('[scan] Ops database still syncing. Try again in a moment.')
          return false
        }
        const host = getHostByIp(args)
        if (!host) {
          print(`[scan] ${args} not found in ops database.`)
          return false
        }
        if (!host.online) {
          print(`[scan] ${host.ip} appears offline.`)
          return false
        }
        print(`[scan] ${host.ip} is online`)
        print(`       open ports: ${host.openPorts.join(', ')}`)
        handleQuestEvent('SCAN_COMPLETED', { target_ip: host.ip })
        applyTraceAction('scan')
        traceApplied = true
        break
      }
      case 'connect': {
        if (!args) {
          print('Usage: connect <ip>')
          return false
        }
        if (!systemsReady) {
          print('[connect] Host registry still loading, stand by...')
          return false
        }
        if (session) {
          print('Already connected. Disconnect first.')
          return false
        }
        const host = getHostByIp(args)
        if (!host || !host.online) {
          print(`[connect] Unable to reach ${args}.`)
          return false
        }
        const runtime = createHostRuntime(host)
        const nextSession: TerminalRemoteSession = {
          hostIp: host.ip,
          username: host.username,
          cwd: host.startingPath || '/',
          runtime
        }
        setSession(nextSession)
        print(`[connect] connected to ${host.ip} as '${host.username}'`)
        handleQuestEvent('SESSION_CONNECTED', { target_ip: host.ip })
        applyTraceAction('connect')
        traceApplied = true
        break
      }
      case 'quest_debug':
      case 'quest-debug':
        printQuestDebug()
        break
      case 'exit':
        print('[exit] Close the window to terminate the session.')
        break
      default:
        print(`Unknown command: ${command}`)
    }
    return traceApplied
  }

  const renderDirEntries = (runtime: HostRuntime, path: string) => {
    const entries = listDirectory(runtime, path)
    if (entries === null) {
      print('ls: not a directory')
      return
    }
    if (!entries.length) {
      print('(empty)')
      return
    }
    const rendered = entries.map((node: RemoteNode) => {
      if (node.type === 'dir') {
        const label = node.name || '/'
        return `${label}/`
      }
      return node.name
    })
    print(rendered.join('  '))
  }

  const handleRemoteCommand = async (command: string, args: string): Promise<boolean> => {
    if (!session) {
      print('No active remote session.')
      return false
    }
    const { runtime, cwd, hostIp } = session
    let traceApplied = false
    switch (command) {
      case 'help':
        print(formatCommandList(REMOTE_COMMANDS))
        break
      case 'ls':
        renderDirEntries(runtime, cwd)
        break
      case 'cd': {
        if (!args) {
          print('Usage: cd <path>')
          return false
        }
        const nextPath = changeDirectory(runtime, cwd, args)
        if (!nextPath) {
          print('cd: path not found')
          return false
        }
        setSession({ ...session, cwd: nextPath })
        break
      }
      case 'cat': {
        if (!args) {
          print('Usage: cat <file>')
          return false
        }
        const result = readFile(runtime, cwd, args)
        if (!result) {
          print('cat: file not found')
          return false
        }
        print(result.content)
        break
      }
      case 'rm': {
        if (!args) {
          print('Usage: rm <file>')
          return false
        }
        const removal = removeFile(runtime, cwd, args)
        if (!removal.success || !removal.path) {
          print('rm: file not found')
          return false
        }
        print(`[rm] deleted ${removal.path}`)
        handleQuestEvent('FILE_DELETED', { target_ip: hostIp, file_path: removal.path })
        applyTraceAction('delete')
        traceApplied = true
        break
      }
      case 'disconnect':
        setSession(null)
        print('[disconnect] Session closed.')
        handleQuestEvent('SESSION_DISCONNECTED', { target_ip: hostIp })
        applyTraceAction('disconnect')
        traceApplied = true
        break
      default:
        print(`Unknown command: ${command}`)
    }
    return traceApplied
  }

  const handleCommand = async () => {
    const input = buffer.trim()
    if (!input) return
    setBuffer('')
    print(input, 'user')
    const [command, ...rest] = input.split(/\s+/)
    const args = rest.join(' ').trim()
    const traceApplied = context === 'local'
      ? await handleLocalCommand(command, args)
      : await handleRemoteCommand(command, args)
    if (!traceApplied) {
      applyTraceAction('idle')
    }
  }

  const handleKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void handleCommand()
    }
  }

  return (
    <div className="terminal-container">
      <div
        className="terminal-frame"
        onClick={() => inputRef.current?.focus()}
        onContextMenu={(event) => {
          event.preventDefault()
        }}
      >
        <div className="terminal-header">
          <div className="terminal-title">ops console</div>
          <div className="terminal-indicators">
            <span className="indicator">mode {context}</span>
            {session && <span className="indicator">host {session.hostIp}</span>}
          </div>
        </div>
        <div className="terminal-screen" ref={outputRef} role="log" aria-live="polite">
          {lines.map((line, idx) => (
            <div key={idx} className={`terminal-line ${line.role}`}>
              {line.text}
            </div>
          ))}
          <div className="terminal-line current">
            <span className="terminal-prompt">{prompt}</span>
            <span className="terminal-buffer">
              {buffer || '\u00a0'}
              <span className="terminal-caret" />
            </span>
          </div>
        </div>
        <div className="terminal-footer">
          <div className="footer-left">
            {context === 'local' ? 'LOCAL :: inbox, scan, connect' : `REMOTE :: ${session?.cwd}`}
          </div>
          <div className="footer-right">
            {buildMailList(mailState).slice(0, 3).map((entry: MailListEntry) => entry.subject).join(' | ') || 'Awaiting directives'}
          </div>
        </div>
        <input
          ref={inputRef}
          className="terminal-hidden-input"
          value={buffer}
          onChange={e => setBuffer(e.target.value)}
          onKeyDown={handleKey}
          tabIndex={-1}
          aria-label="Terminal command input"
        />
      </div>
    </div>
  )
}
