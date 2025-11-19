import React, { useCallback, useEffect, useId, useRef, useState } from 'react'

import './TerminalApp.css'
import type { QuestDefinition } from '../types/quest'
import {
  clampTerminalLines,
  createTerminalLine,
  createTerminalSessionState,
  handleTerminalCommand,
  hydrateTerminalSessionState,
  snapshotTerminalSessionState,
  startQuestSession,
  type CommandResult,
  type TerminalCommandContext,
  type TerminalLine,
  type TerminalSessionState,
  type TerminalSnapshot
} from './terminalRuntime'

type TraceBadgeTone = 'calm' | 'nervous' | 'panic'

type TerminalAppProps = {
  state?: TerminalSessionState
  quest?: QuestDefinition | null
  snapshot?: TerminalSnapshot | null
  onStateChange?: (nextState: TerminalSessionState) => void
  onQuestCompleted?: (quest: QuestDefinition, finalState: TerminalSessionState) => void
  onSnapshotChange?: (snapshot: TerminalSnapshot) => void
  onCloseRequest?: () => void
  commandContext?: TerminalCommandContext
}

const MAX_HISTORY = 50

const makeSnapshotKey = (snapshot: TerminalSnapshot | null | undefined) => (
  snapshot ? `${snapshot.schemaVersion}:${snapshot.savedAt}` : null
)

const formatPrompt = (state: TerminalSessionState) => (
  state.connectedIp ? `${state.connectedIp}:${state.currentPath}` : '>'
)

const traceToneLabel: Record<TraceBadgeTone, string> = {
  calm: 'Calm',
  nervous: 'Nervous',
  panic: 'Panic'
}

const clampHistory = (history: string[]): string[] => (
  history.length > MAX_HISTORY ? history.slice(history.length - MAX_HISTORY) : history
)

export const TerminalApp: React.FC<TerminalAppProps> = ({
  state: controlledState,
  quest = null,
  snapshot = null,
  onStateChange,
  onQuestCompleted,
  onSnapshotChange,
  onCloseRequest,
  commandContext
}) => {
  const createInitialSession = () => {
    if (controlledState) return controlledState
    if (snapshot) return hydrateTerminalSessionState(snapshot)
    if (quest) return startQuestSession(quest)
    return createTerminalSessionState()
  }
  const [uncontrolledSession, setUncontrolledSession] = useState<TerminalSessionState>(() => createInitialSession())
  const session = controlledState ?? uncontrolledSession
  const isControlled = Boolean(controlledState && onStateChange)
  const [buffer, setBuffer] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const questIdRef = useRef<string | null>(session.quest?.id ?? quest?.id ?? null)
  const snapshotKeyRef = useRef<string | null>(makeSnapshotKey(snapshot))
  const snapshotTimerRef = useRef<number | null>(null)
  const sessionRef = useRef<TerminalSessionState>(session)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  const applySession = useCallback((updater: (prev: TerminalSessionState) => TerminalSessionState) => {
    const next = updater(sessionRef.current)
    sessionRef.current = next
    if (isControlled && onStateChange) {
      onStateChange(next)
    } else {
      setUncontrolledSession(next)
    }
    return next
  }, [isControlled, onStateChange, setUncontrolledSession])

  const focusInput = () => inputRef.current?.focus()

  useEffect(() => { focusInput() }, [])

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [session.lines])

  useEffect(() => {
    if (!snapshot || isControlled) return
    const key = makeSnapshotKey(snapshot)
    if (!key || snapshotKeyRef.current === key) return
    const hydrated = hydrateTerminalSessionState(snapshot)
    snapshotKeyRef.current = key
    questIdRef.current = hydrated.quest?.id ?? null
    applySession(() => hydrated)
    setBuffer('')
    setHistory([])
    setHistoryIndex(null)
  }, [snapshot, isControlled, applySession])

  useEffect(() => {
    if (snapshot || isControlled) return
    if (quest && quest.id !== questIdRef.current) {
      const next = startQuestSession(quest)
      questIdRef.current = quest.id
      snapshotKeyRef.current = null
      applySession(() => next)
      setBuffer('')
      setHistory([])
      setHistoryIndex(null)
      return
    }
    if (!quest && questIdRef.current) {
      questIdRef.current = null
      snapshotKeyRef.current = null
      const next = createTerminalSessionState()
      applySession(() => next)
      setBuffer('')
      setHistory([])
      setHistoryIndex(null)
    }
  }, [quest, snapshot, isControlled, applySession])

  useEffect(() => {
    if (!onSnapshotChange) return
    if (snapshotTimerRef.current) {
      window.clearTimeout(snapshotTimerRef.current)
    }
    snapshotTimerRef.current = window.setTimeout(() => {
      snapshotKeyRef.current = null
      onSnapshotChange(snapshotTerminalSessionState(session))
    }, 400)
    return () => {
      if (snapshotTimerRef.current) {
        window.clearTimeout(snapshotTimerRef.current)
        snapshotTimerRef.current = null
      }
    }
  }, [session, onSnapshotChange])

  const runCommand = useCallback(async (raw: string) => {
    const command = raw.trim()
    if (!command) return
    const promptLabel = formatPrompt(sessionRef.current)
    const userLine = createTerminalLine(`${promptLabel} ${command}`, 'user')
    let completedQuest: QuestDefinition | null = null
    let result: CommandResult | null = null
    try {
      result = await handleTerminalCommand(command, sessionRef.current, commandContext)
    } catch (error) {
      console.error('Terminal command failed', error)
      result = {
        nextState: sessionRef.current,
        newLines: [createTerminalLine('Command failed. See console for details.')]
      }
    }
    const commandResult = result
    const nextState = applySession((prev: TerminalSessionState) => {
      const lines = clampTerminalLines([...prev.lines, userLine, ...commandResult!.newLines])
      let updated: TerminalSessionState = { ...commandResult!.nextState, lines }
      if (commandResult!.questCompleted && updated.quest) {
        const completionLine = createTerminalLine(`Quest complete: ${updated.quest.title}`)
        const mailNotice = createTerminalLine('Debrief mail received in INBOX.')
        completedQuest = updated.quest
        updated = { ...updated, lines: clampTerminalLines([...lines, completionLine, mailNotice]) }
      }
      return updated
    })
    if (completedQuest) {
      onQuestCompleted?.(completedQuest, nextState)
    }
    setHistory(prev => clampHistory([...prev, command]))
    setHistoryIndex(null)
    setBuffer('')
  }, [applySession, commandContext, onQuestCompleted])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void runCommand(buffer)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!history.length) return
      setHistoryIndex(prev => {
        const nextIndex = prev == null ? history.length - 1 : Math.max(0, prev - 1)
        setBuffer(history[nextIndex] ?? '')
        return nextIndex
      })
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!history.length) return
      setHistoryIndex(prev => {
        if (prev == null) return null
        const nextIndex = prev + 1
        if (nextIndex >= history.length) {
          setBuffer('')
          return null
        }
        setBuffer(history[nextIndex])
        return nextIndex
      })
    }
  }

  const traceTone: TraceBadgeTone = session.trace.status
  const tracePercent = session.trace.max > 0 ? Math.min(100, Math.round((session.trace.current / session.trace.max) * 100)) : 0
  const prompt = formatPrompt(session)
  const questTitle = session.quest?.title || quest?.title || 'No quest loaded'
  const isRemoteSession = Boolean(session.connectedIp)

  return (
    <div className="terminal-container" onClick={focusInput}>
      <div className="terminal-frame">
        <header className="terminal-header">
          <div>
            <p className="terminal-title">Atlas Terminal</p>
            <small>{questTitle}</small>
          </div>
          <div className="terminal-header-actions">
            {onCloseRequest && (
              <button type="button" className="terminal-exit" onClick={onCloseRequest}>Exit</button>
            )}
          </div>
        </header>

        <div className="terminal-status-row">
          <div className="terminal-session-tags">
            <span className={`session-chip ${isRemoteSession ? 'session-chip-remote' : 'session-chip-local'}`}>
              {isRemoteSession ? `Remote ${session.connectedIp}` : 'Local Session'}
            </span>
            <span className="session-chip">
              {session.system ? `${session.system.label} · ${session.system.ip}` : 'Awaiting quest system'}
            </span>
          </div>
          <div className="trace-meter" role="group" aria-label="Trace status">
            <span className="trace-meter-label">Trace {tracePercent}% · {traceToneLabel[traceTone]}</span>
            <div className={`trace-meter-bar ${traceTone}`}>
              <div className="trace-meter-progress" style={{ width: `${tracePercent}%` }} />
            </div>
          </div>
        </div>

        <div className="terminal-body">
          <div className="terminal-log" ref={scrollRef} role="log" aria-live="polite">
            {session.lines.map((line: TerminalLine) => (
              <div key={line.id} className={`terminal-line ${line.role}`}>
                {line.text}
              </div>
            ))}
          </div>
          <div className="terminal-input-row">
            <label htmlFor={inputId} className="terminal-prompt">{prompt}</label>
            <input
              id={inputId}
              ref={inputRef}
              aria-label="Terminal command input"
              className="terminal-input-field"
              value={buffer}
              onChange={event => setBuffer(event.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>

        <footer className="terminal-footer">
          <span>{session.questProgress?.status === 'completed' ? 'Quest complete' : 'Quest active'}</span>
          <span className="terminal-footer-hint">Press Enter to execute · ↑↓ to scroll history</span>
        </footer>
      </div>
    </div>
  )
}
