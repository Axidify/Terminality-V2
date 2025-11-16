import React, { useCallback, useEffect, useRef, useState } from 'react'

import './TerminalApp.css'
import {
  createQuestEngineState,
  getInboxEntries,
  hydrateQuestState,
  processQuestEvent,
  QuestEngineState,
  QuestEvent,
  QuestEventResult,
  QuestEventType,
  SerializedQuestState,
  serializeQuestState,
  setQuestDefinitions
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
  setSystemProfiles,
  SystemProfile
} from './terminalHosts'
import { getCachedDesktop, hydrateFromServer, saveDesktopState } from '../services/saveService'
import { listSystemProfiles as fetchSystemProfiles, SystemProfilesResponse } from '../services/systemProfiles'
import { listTerminalQuests } from '../services/terminalQuests'

type Line = { role: 'system' | 'user'; text: string }
type TerminalContext = 'local' | 'remote'

interface RemoteSession {
  hostIp: string
  username: string
  cwd: string
  runtime: HostRuntime
}

interface TerminalSnapshot {
  lines?: Line[]
  buffer?: string
  questState?: SerializedQuestState | null
}

interface CommandDescriptor {
  name: string
  description: string
}

const PLAYER_ID = 'player-1'

const LOCAL_COMMANDS: CommandDescriptor[] = [
  { name: 'help', description: 'Show locally available commands' },
  { name: 'inbox', description: 'Review mission messages' },
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
  const [questState, setQuestState] = useState(createQuestEngineState)
  const [lines, setLines] = useState<Line[]>([{ role: 'system', text: 'Terminal ready. Type help.' }])
  const [buffer, setBuffer] = useState('')
  const [session, setSession] = useState<RemoteSession | null>(null)
  const [systemsReady, setSystemsReady] = useState(false)
  const [definitionsReady, setDefinitionsReady] = useState(false)
  const [hydrationComplete, setHydrationComplete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const questIntroPrinted = useRef(false)
  const pendingSnapshotRef = useRef<TerminalSnapshot | null>(null)
  const questStateInitializedRef = useRef(false)
  const lastNotificationRef = useRef<string | null>(null)
  const questStateRef = useRef<QuestEngineState>(questState)
  const persistenceReady = definitionsReady && hydrationComplete

  const context: TerminalContext = session ? 'remote' : 'local'
  const prompt = session ? `${session.hostIp}:${session.cwd}$` : '>'

  const print = (text: string, role: Line['role'] = 'system') => {
    setLines(prev => [...prev, { role, text }])
  }

  const emitEvent = (type: QuestEventType, payload: { target_ip?: string; file_path?: string } = {}) => {
    setQuestState(prev => {
      const event = { type, payload: { playerId: PLAYER_ID, ...payload } }
      const result = processQuestEvent(prev, event)
      logQuestDebugInfo(event, result)
      const { state, notifications } = result
      notifications.forEach(note => {
        const key = `${event.type}:${event.payload.target_ip || 'local'}:${note}`
        if (lastNotificationRef.current === key) return
        lastNotificationRef.current = key
        console.debug?.('[quest-notify]', key)
        print(`[quest] ${note}`)
      })
      return state
    })
  }

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: 'smooth' })
  }, [lines])

  useEffect(() => {
    questStateRef.current = questState
  }, [questState])

  useEffect(() => {
    let cancelled = false
    const loadSystems = async () => {
      try {
        const payload: SystemProfilesResponse = await fetchSystemProfiles()
        if (cancelled) return
        const normalized: SystemProfile[] = (payload.profiles || []).map(profile => ({
          ...profile,
          identifiers: {
            ips: profile.identifiers?.ips || [],
            hostnames: profile.identifiers?.hostnames || []
          },
          metadata: profile.metadata,
          filesystem: profile.filesystem
        }))
        setSystemProfiles(normalized)
      } catch (err) {
        console.warn('[terminal] failed to load system profiles, using fallback', err)
        setSystemProfiles(undefined)
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
    if (!definitionsReady) return
    if (pendingSnapshotRef.current) {
      const snapshot = pendingSnapshotRef.current
      pendingSnapshotRef.current = null
      if (snapshot.questState) {
        setQuestState(hydrateQuestState(snapshot.questState))
      } else {
        setQuestState(createQuestEngineState())
      }
      questStateInitializedRef.current = true
      return
    }
    if (!questStateInitializedRef.current) {
      setQuestState(createQuestEngineState())
      questStateInitializedRef.current = true
    }
  }, [definitionsReady, hydrationComplete])

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

  const persistQuestState = useCallback((state: QuestEngineState) => {
    if (!state) return
    saveDesktopState({
      terminalState: {
        questState: serializeQuestState(state),
        savedAt: new Date().toISOString()
      }
    }).catch(err => console.warn('[terminal] failed to persist quest state', err))
  }, [])

  useEffect(() => {
    if (!persistenceReady) return
    if (typeof window === 'undefined') return

    const timer = window.setTimeout(() => {
      persistQuestState(questStateRef.current)
    }, 400)

    return () => {
      window.clearTimeout(timer)
    }
  }, [persistQuestState, persistenceReady, questState])

  useEffect(() => {
    return () => {
      persistQuestState(questStateRef.current)
    }
  }, [persistQuestState])

  useEffect(() => {
    if (questIntroPrinted.current) return
    questIntroPrinted.current = true
    const inbox = getInboxEntries(questState)
    inbox.forEach(entry => {
      print(`[inbox] ${entry.title}: ${entry.description}`)
    })
  }, [questState])

  const showInbox = () => {
    const entries = getInboxEntries(questState)
    if (!entries.length) {
      print('Inbox empty. Await new directives.')
      return
    }
    entries.forEach(entry => {
      print(`[${entry.questId}] ${entry.title}`)
      print(`    ${entry.description}`)
      print(`    ${entry.progress}`)
      if (entry.hint) {
        print(`    Hint: ${entry.hint}`)
      }
    })
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

  const handleLocalCommand = async (command: string, args: string) => {
    switch (command) {
      case 'help':
        print(formatCommandList(LOCAL_COMMANDS))
        break
      case 'inbox':
        showInbox()
        break
      case 'scan': {
        if (!args) {
          print('Usage: scan <ip>')
          return
        }
        if (!systemsReady) {
          print('[scan] Ops database still syncing. Try again in a moment.')
          return
        }
        const host = getHostByIp(args)
        if (!host) {
          print(`[scan] ${args} not found in ops database.`)
          return
        }
        if (!host.online) {
          print(`[scan] ${host.ip} appears offline.`)
          return
        }
        print(`[scan] ${host.ip} is online`)
        print(`       open ports: ${host.openPorts.join(', ')}`)
        emitEvent('SCAN_COMPLETED', { target_ip: host.ip })
        break
      }
      case 'connect': {
        if (!args) {
          print('Usage: connect <ip>')
          return
        }
        if (!systemsReady) {
          print('[connect] Host registry still loading, stand by...')
          return
        }
        if (session) {
          print('Already connected. Disconnect first.')
          return
        }
        const host = getHostByIp(args)
        if (!host || !host.online) {
          print(`[connect] Unable to reach ${args}.`)
          return
        }
        const runtime = createHostRuntime(host)
        const nextSession: RemoteSession = {
          hostIp: host.ip,
          username: host.username,
          cwd: host.startingPath || '/',
          runtime
        }
        setSession(nextSession)
        print(`[connect] connected to ${host.ip} as '${host.username}'`)
        emitEvent('SESSION_CONNECTED', { target_ip: host.ip })
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

  const handleRemoteCommand = async (command: string, args: string) => {
    if (!session) {
      print('No active remote session.')
      return
    }
    const { runtime, cwd, hostIp } = session
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
          return
        }
        const nextPath = changeDirectory(runtime, cwd, args)
        if (!nextPath) {
          print('cd: path not found')
          return
        }
        setSession({ ...session, cwd: nextPath })
        break
      }
      case 'cat': {
        if (!args) {
          print('Usage: cat <file>')
          return
        }
        const result = readFile(runtime, cwd, args)
        if (!result) {
          print('cat: file not found')
          return
        }
        print(result.content)
        break
      }
      case 'rm': {
        if (!args) {
          print('Usage: rm <file>')
          return
        }
        const removal = removeFile(runtime, cwd, args)
        if (!removal.success || !removal.path) {
          print('rm: file not found')
          return
        }
        print(`[rm] deleted ${removal.path}`)
        emitEvent('FILE_DELETED', { target_ip: hostIp, file_path: removal.path })
        break
      }
      case 'disconnect':
        setSession(null)
        print('[disconnect] Session closed.')
        emitEvent('SESSION_DISCONNECTED', { target_ip: hostIp })
        break
      default:
        print(`Unknown command: ${command}`)
    }
  }

  const handleCommand = async () => {
    const input = buffer.trim()
    if (!input) return
    setBuffer('')
    print(input, 'user')
    const [command, ...rest] = input.split(/\s+/)
    const args = rest.join(' ').trim()
    if (context === 'local') {
      await handleLocalCommand(command, args)
    } else {
      await handleRemoteCommand(command, args)
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
            {getInboxEntries(questState).map(entry => entry.title).join(' | ') || 'Awaiting directives'}
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
