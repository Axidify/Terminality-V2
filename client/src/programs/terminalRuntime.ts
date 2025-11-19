import { createMailEngineState, ensureMailDelivered, hydrateMailState, type MailEngineState, type SerializedMailState, serializeMailState } from './mailSystem'
import {
  createQuestEngineState,
  getQuestDefinitionById,
  hydrateQuestState,
  type QuestEngineState,
  type SerializedQuestState,
  serializeQuestState
} from './questSystem'
import type { QuestDefinition } from './terminalQuests/types'
import type { HostRuntime } from './terminalHosts'

export type TerminalLine = { role: 'system' | 'user'; text: string }
export type TerminalContext = 'local' | 'remote'

export interface TerminalRemoteSession {
  hostIp: string
  username: string
  cwd: string
  runtime: HostRuntime
}

export type TerminalSnapshotSession = Omit<TerminalRemoteSession, 'runtime'>

export interface TraceMeterState {
  current: number
  max: number
  nervousThreshold: number
  panicThreshold: number
  status: 'calm' | 'nervous' | 'panic'
}

export type TraceAction = 'scan' | 'connect' | 'delete' | 'disconnect' | 'idle'

const DEFAULT_TRACE_LIMIT = 100
const DEFAULT_NERVOUS_THRESHOLD = 60
const DEFAULT_PANIC_THRESHOLD = 85

const TRACE_COSTS: Record<TraceAction, number> = {
  scan: 4,
  connect: 7,
  delete: 12,
  disconnect: -10,
  idle: -2
}

const resolveTraceStatus = (value: number, nervousThreshold: number, panicThreshold: number): TraceMeterState['status'] => {
  if (value >= panicThreshold) return 'panic'
  if (value >= nervousThreshold) return 'nervous'
  return 'calm'
}

export const createTraceMeterState = (overrides?: Partial<TraceMeterState>): TraceMeterState => {
  const max = overrides?.max && overrides.max > 0 ? overrides.max : DEFAULT_TRACE_LIMIT
  const nervousThreshold = overrides?.nervousThreshold && overrides.nervousThreshold < max
    ? overrides.nervousThreshold
    : DEFAULT_NERVOUS_THRESHOLD
  const panicThreshold = overrides?.panicThreshold && overrides.panicThreshold <= max && overrides.panicThreshold > nervousThreshold
    ? overrides.panicThreshold
    : DEFAULT_PANIC_THRESHOLD
  const boundedCurrent = Math.min(max, Math.max(0, overrides?.current ?? 0))
  return {
    current: boundedCurrent,
    max,
    nervousThreshold,
    panicThreshold,
    status: overrides?.status ?? resolveTraceStatus(boundedCurrent, nervousThreshold, panicThreshold)
  }
}

export interface TraceUpdateResult {
  state: TraceMeterState
  statusChanged?: TraceMeterState['status']
}

export const applyTraceCost = (state: TraceMeterState, action: TraceAction): TraceUpdateResult => {
  const delta = TRACE_COSTS[action] ?? 0
  const nextValue = Math.min(state.max, Math.max(0, state.current + delta))
  const nextStatus = resolveTraceStatus(nextValue, state.nervousThreshold, state.panicThreshold)
  const statusChanged = nextStatus === state.status ? undefined : nextStatus
  return {
    state: {
      ...state,
      current: nextValue,
      status: nextStatus
    },
    statusChanged
  }
}

export interface TerminalSessionState {
  lines: TerminalLine[]
  buffer: string
  questState: QuestEngineState
  mailState: MailEngineState
  remoteSession: TerminalRemoteSession | null
  trace: TraceMeterState
}

export interface TerminalSnapshot {
  lines?: TerminalLine[]
  buffer?: string
  questState?: SerializedQuestState | null
  mailState?: SerializedMailState | null
  traceState?: TraceMeterState
  session?: TerminalSnapshotSession
  savedAt?: string
}

export const TERMINAL_HISTORY_LIMIT = 400

export const clampTerminalLines = (lines: TerminalLine[], limit = TERMINAL_HISTORY_LIMIT): TerminalLine[] => (
  lines.length > limit ? lines.slice(lines.length - limit) : lines
)

export const createTerminalSessionState = (init?: Partial<TerminalSessionState>): TerminalSessionState => {
  const questState = init?.questState ?? createQuestEngineState()
  const mailState = init?.mailState ?? createMailEngineState()
  const trace = init?.trace ? createTraceMeterState(init.trace) : createTraceMeterState()
  return {
    lines: init?.lines && init.lines.length ? init.lines : [{ role: 'system', text: 'Terminal ready. Type help.' }],
    buffer: init?.buffer ?? '',
    questState,
    mailState,
    remoteSession: init?.remoteSession ?? null,
    trace
  }
}

export const hydrateTerminalSessionState = (
  snapshot?: TerminalSnapshot | null,
  overrides?: Partial<TerminalSessionState>
): TerminalSessionState => {
  if (!snapshot) {
    return createTerminalSessionState(overrides)
  }
  const questState = overrides?.questState ?? (snapshot.questState ? hydrateQuestState(snapshot.questState) : createQuestEngineState())
  const mailState = overrides?.mailState ?? (snapshot.mailState ? hydrateMailState(snapshot.mailState) : createMailEngineState())
  return createTerminalSessionState({
    ...overrides,
    lines: overrides?.lines ?? (snapshot.lines && snapshot.lines.length ? snapshot.lines : undefined),
    buffer: overrides?.buffer ?? (snapshot.buffer ?? ''),
    questState,
    mailState,
    trace: overrides?.trace ?? (snapshot.traceState ? snapshot.traceState : undefined)
  })
}

export const snapshotTerminalSessionState = (
  state: TerminalSessionState,
  options?: { lineLimit?: number }
): TerminalSnapshot => ({
  lines: clampTerminalLines(state.lines, options?.lineLimit ?? TERMINAL_HISTORY_LIMIT),
  buffer: state.buffer,
  questState: serializeQuestState(state.questState),
  mailState: serializeMailState(state.mailState),
  traceState: state.trace,
  session: state.remoteSession
    ? { hostIp: state.remoteSession.hostIp, username: state.remoteSession.username, cwd: state.remoteSession.cwd }
    : undefined,
  savedAt: new Date().toISOString()
})

export type QuestMailPhase = 'accept' | 'complete'

const collectQuestMailIds = (quest: QuestDefinition, phase: QuestMailPhase): string[] => {
  const ids = new Set<string>()
  const mail = quest.mail
  if (!mail) return []
  if (phase === 'accept') {
    if (mail.briefingMailId) ids.add(mail.briefingMailId)
    mail.autoDeliverOnAccept?.forEach((id: string) => ids.add(id))
  } else {
    if (mail.completionMailId) ids.add(mail.completionMailId)
    mail.autoDeliverOnComplete?.forEach((id: string) => ids.add(id))
  }
  return Array.from(ids)
}

export const deliverQuestMailPhase = (state: MailEngineState, questId: string, phase: QuestMailPhase): MailEngineState => {
  if (!questId) return state
  const quest = getQuestDefinitionById(questId)
  if (!quest) return state
  const ids = collectQuestMailIds(quest, phase)
  if (!ids.length) return state
  return ensureMailDelivered(state, ids)
}
