import { generateId } from './quest-designer/id'
import type {
  BonusObjective,
  HackingToolId,
  QuestBranchOutcome,
  QuestDefinition,
  QuestRewardsBlock,
  QuestStepDefinition,
  QuestSystemDefinition,
  QuestSystemFilesystemNode,
  QuestSystemSecurityRules,
  QuestRiskProfile,
  SystemDifficulty
} from '../types/quest'
import type { GameMail, MailFolder, MailService } from '../types/mail'
import type { QuestStorageService } from './quest-designer/storage'

export type TerminalLineRole = 'system' | 'user'

export interface TerminalLine {
  id: string
  role: TerminalLineRole
  text: string
  timestamp: string
}

export interface TerminalFilesystemNode {
  id: string
  path: string
  name: string
  type: 'folder' | 'file'
  content?: string
  tags?: QuestSystemFilesystemNode['tags']
  logOptions?: QuestSystemFilesystemNode['logOptions']
  children?: string[]
}

export type TerminalFilesystem = Record<string, TerminalFilesystemNode>

const MAIL_FOLDERS: MailFolder[] = ['inbox', 'archive', 'sent']

const MAIL_FOLDER_LABEL: Record<MailFolder, string> = {
  inbox: 'Inbox',
  archive: 'Archive',
  sent: 'Sent'
}

const isMailFolder = (folder?: string | null): folder is MailFolder => (
  folder ? MAIL_FOLDERS.includes(folder as MailFolder) : false
)

const formatMailTimestamp = (iso: string): string => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

const summarizeMailEntry = (mail: GameMail): TerminalMailListingEntry => ({
  id: mail.id,
  subject: mail.subject,
  from: mail.from,
  receivedAt: mail.receivedAt,
  read: Boolean(mail.read)
})

const formatMailListingLine = (entry: TerminalMailListingEntry, index: number): TerminalLine => {
  const status = entry.read ? ' ' : '*'
  const timestamp = formatMailTimestamp(entry.receivedAt)
  return createTerminalLine(`${index + 1}. ${status} ${entry.subject} — ${entry.from} (${timestamp})`)
}

const cloneMailListing = (listing?: TerminalMailListing | null): TerminalMailListing | null => {
  if (!listing) return null
  return {
    folder: listing.folder,
    entries: listing.entries.map(entry => ({ ...entry }))
  }
}

const cloneQuestDirectory = (directory?: TerminalQuestDirectory | null): TerminalQuestDirectory | null => {
  if (!directory) return null
  return {
    quests: directory.quests.map(quest => ({ ...quest }))
  }
}

const createLinesFromMultilineText = (text: string): TerminalLine[] => {
  if (!text) {
    return [createTerminalLine('[empty message body]')]
  }
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map(line => createTerminalLine(line || ' '))
}

const summarizeQuestDefinition = (quest: QuestDefinition): TerminalQuestSummary => ({
  id: quest.id,
  title: quest.title,
  difficulty: quest.difficulty,
  shortDescription: quest.shortDescription
})

const formatQuestSummaryLine = (quest: TerminalQuestSummary, index: number): TerminalLine => {
  const summary = quest.shortDescription ? ` — ${quest.shortDescription}` : ''
  return createTerminalLine(`${index + 1}. ${quest.title} [${quest.difficulty}] · ${quest.id}${summary}`)
}

const updateMailListingEntry = (
  listing: TerminalMailListing | null | undefined,
  index: number,
  patch: Partial<TerminalMailListingEntry>
): TerminalMailListing | null | undefined => {
  if (!listing || index < 0 || index >= listing.entries.length) {
    return listing ?? null
  }
  return {
    ...listing,
    entries: listing.entries.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry))
  }
}

const removeMailListingEntry = (
  listing: TerminalMailListing | null | undefined,
  index: number
): TerminalMailListing | null | undefined => {
  if (!listing || index < 0 || index >= listing.entries.length) {
    return listing ?? null
  }
  return {
    ...listing,
    entries: listing.entries.filter((_, entryIndex) => entryIndex !== index)
  }
}

export interface TerminalQuestProgress {
  questId: string | null
  currentStepIndex: number
  completedStepIds: string[]
  completedBonusIds: string[]
  status: 'not_started' | 'in_progress' | 'completed'
}

export interface TerminalMailListingEntry {
  id: string
  subject: string
  from: string
  receivedAt: string
  read: boolean
}

export interface TerminalMailListing {
  folder: MailFolder
  entries: TerminalMailListingEntry[]
}

export interface TerminalQuestSummary {
  id: string
  title: string
  difficulty: SystemDifficulty
  shortDescription?: string
}

export interface TerminalQuestDirectory {
  quests: TerminalQuestSummary[]
}

export interface TerminalCommandContext {
  mailService?: MailService
  questStorage?: QuestStorageService
}

export interface TraceMeterState {
  current: number
  max: number
  nervousThreshold: number
  panicThreshold: number
  status: 'calm' | 'nervous' | 'panic'
}

export type TraceAction =
  | 'scan'
  | 'deep_scan'
  | 'connect'
  | 'disconnect'
  | 'delete_file'
  | 'read_file'
  | 'clean_logs'
  | 'bruteforce'
  | 'backdoor_install'
  | 'idle'

export interface TraceUpdateResult {
  state: TraceMeterState
  statusChanged?: TraceMeterState['status']
}

type ScanSecurityGrade = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY HIGH'

interface ScanHostService {
  port: number
  protocol: string
  name?: string
  version?: string
}

interface ScanHostSummary {
  ip: string
  hostname?: string
  security: ScanSecurityGrade
  openPorts: number[]
  services: ScanHostService[]
  notes?: string[]
}

type ReconInfoLevel = 'basic' | 'deep'

export interface ScanDiscoveryEntry {
  infoLevel: ReconInfoLevel
  firstSeenAt: string
  lastScannedAt: string
}

export interface ScanDiscoveryState {
  knownHosts: Record<string, ScanDiscoveryEntry>
  lastRange?: string
}

interface ScanDiscoveryUpdateResult {
  next: ScanDiscoveryState
  newlyDiscovered: string[]
  upgraded: string[]
}

export interface TerminalSessionState {
  lines: TerminalLine[]
  connectedIp: string | null
  currentPath: string
  filesystem: TerminalFilesystem
  quest: QuestDefinition | null
  system: QuestSystemDefinition | null
  questProgress: TerminalQuestProgress | null
  trace: TraceMeterState
  securityRules?: QuestSystemSecurityRules
  maxTraceSeen: number
  trapsTriggered: string[]
  logFilesEdited: string[]
  readPaths: string[]
  deletedPaths: string[]
  mailListing?: TerminalMailListing | null
  questDirectory?: TerminalQuestDirectory | null
  scanDiscovery: ScanDiscoveryState
  toolTiers: Partial<Record<HackingToolId, number>>
}

const DEFAULT_TRACE_LIMIT = 100
const DEFAULT_NERVOUS_THRESHOLD = 60
const DEFAULT_PANIC_THRESHOLD = 85
const DEFAULT_FILESYSTEM: TerminalFilesystem = {
  '/': { id: 'fs-root', path: '/', name: '/', type: 'folder', children: [] }
}

const BASE_TRACE_COSTS: Record<TraceAction, number> = {
  scan: 3,
  deep_scan: 10,
  connect: 6,
  disconnect: -12,
  delete_file: 6,
  read_file: 0,
  clean_logs: -8,
  bruteforce: 15,
  backdoor_install: 12,
  idle: -2
}

const DEFAULT_TOOL_TIERS: Record<HackingToolId, number> = {
  scan: 1,
  deep_scan: 1,
  bruteforce: 1,
  clean_logs: 1,
  backdoor_install: 1
}

const DEFAULT_SCAN_DISCOVERY_STATE: ScanDiscoveryState = {
  knownHosts: {},
  lastRange: undefined
}

const normalizePath = (path: string): string => {
  if (!path) return '/'
  const replaced = path.replace(/\\/g, '/').replace(/\/+/, '/').trim()
  const parts = replaced.split('/').filter(part => part.length > 0)
  const stack: string[] = []
  parts.forEach(part => {
    if (part === '.' || part === '') return
    if (part === '..') {
      stack.pop()
      return
    }
    stack.push(part)
  })
  return stack.length ? `/${stack.join('/')}` : '/'
}

const resolvePath = (cwd: string, target: string): string => {
  if (!target) return cwd || '/'
  if (target.startsWith('/')) return normalizePath(target)
  const base = cwd === '/' ? '' : cwd
  return normalizePath(`${base}/${target}`)
}

export const createTerminalLine = (text: string, role: TerminalLineRole = 'system'): TerminalLine => ({
  id: generateId('term-line'),
  role,
  text,
  timestamp: new Date().toISOString()
})

const createLine = createTerminalLine

const ensureFilesystem = (filesystem?: TerminalFilesystem | null): TerminalFilesystem => {
  if (!filesystem) return { ...DEFAULT_FILESYSTEM }
  if (!filesystem['/']) {
    return { ...filesystem, '/': DEFAULT_FILESYSTEM['/'] }
  }
  return filesystem
}

const cloneFilesystem = (filesystem: TerminalFilesystem): TerminalFilesystem => {
  const clone: TerminalFilesystem = {}
  Object.entries(filesystem).forEach(([path, node]) => {
    clone[path] = {
      ...node,
      children: node.children ? [...node.children] : undefined
    }
  })
  return ensureFilesystem(clone)
}

const cloneScanDiscovery = (state?: ScanDiscoveryState): ScanDiscoveryState => {
  if (!state) return { ...DEFAULT_SCAN_DISCOVERY_STATE, knownHosts: {} }
  const knownHosts = Object.entries(state.knownHosts ?? {}).reduce<Record<string, ScanDiscoveryEntry>>((acc, [ip, entry]) => {
    acc[ip] = { ...entry }
    return acc
  }, {})
  return {
    knownHosts,
    lastRange: state.lastRange
  }
}

const walkFilesystem = (
  node: QuestSystemFilesystemNode,
  currentPath: string,
  index: TerminalFilesystem
): string => {
  const path = node.name === '/' ? '/' : currentPath === '/' ? `/${node.name}` : `${currentPath}/${node.name}`
  const entry: TerminalFilesystemNode = {
    id: node.id,
    path,
    name: node.name,
    type: node.type,
    content: node.type === 'file' ? node.content || '' : undefined,
    tags: node.tags,
    logOptions: node.logOptions
  }
  if (node.type === 'folder' && node.children?.length) {
    entry.children = node.children.map(child => walkFilesystem(child, path === '/' ? '/' : path, index))
  }
  index[path] = entry
  return path
}

const buildFilesystemFromSystem = (system?: QuestSystemFilesystemNode | null): TerminalFilesystem => {
  if (!system) return { ...DEFAULT_FILESYSTEM }
  const index: TerminalFilesystem = {}
  walkFilesystem(system, '/', index)
  if (!index['/']) {
    index['/'] = { ...DEFAULT_FILESYSTEM['/'] }
  }
  return index
}

const cloneQuestSystemDefinition = (system: QuestSystemDefinition): QuestSystemDefinition => ({
  ...system,
  doors: system.doors?.map(door => ({ ...door })) ?? [],
  securityRules: system.securityRules
    ? {
        ...system.securityRules,
        actionTraceCosts: { ...system.securityRules.actionTraceCosts }
      }
    : undefined
})

const listDirectory = (filesystem: TerminalFilesystem, path: string): TerminalFilesystemNode[] | null => {
  const node = filesystem[path]
  if (!node || node.type !== 'folder') return null
  if (!node.children?.length) return []
  return node.children.map(childPath => filesystem[childPath]).filter(Boolean)
}

const readFileNode = (
  filesystem: TerminalFilesystem,
  cwd: string,
  target: string
): { path: string; content: string } | null => {
  const path = resolvePath(cwd, target)
  const node = filesystem[path]
  if (!node || node.type !== 'file') return null
  return { path, content: node.content ?? '' }
}

const removeFileNode = (
  filesystem: TerminalFilesystem,
  cwd: string,
  target: string
): { filesystem: TerminalFilesystem; removedPath?: string } => {
  const path = resolvePath(cwd, target)
  const node = filesystem[path]
  if (!node || node.type !== 'file') return { filesystem }
  const next = cloneFilesystem(filesystem)
  delete next[path]
  const parentPath = path === '/' ? '/' : path.split('/').slice(0, -1).join('/') || '/'
  const parent = next[parentPath]
  if (parent && parent.children) {
    parent.children = parent.children.filter(child => child !== path)
    next[parentPath] = parent
  }
  return { filesystem: ensureFilesystem(next), removedPath: path }
}

const writeFileNode = (
  filesystem: TerminalFilesystem,
  cwd: string,
  target: string,
  transform: (content: string) => string
): { filesystem: TerminalFilesystem; updatedPath?: string } => {
  const path = resolvePath(cwd, target)
  const node = filesystem[path]
  if (!node || node.type !== 'file') return { filesystem }
  const next = cloneFilesystem(filesystem)
  const existing = next[path]
  if (!existing || existing.type !== 'file') {
    return { filesystem }
  }
  next[path] = {
    ...existing,
    content: transform(existing.content ?? '')
  }
  return { filesystem: ensureFilesystem(next), updatedPath: path }
}

const createQuestProgress = (quest?: QuestDefinition | null): TerminalQuestProgress | null => {
  if (!quest) return null
  const status: TerminalQuestProgress['status'] = quest.steps.length ? 'in_progress' : 'completed'
  return {
    questId: quest.id,
    currentStepIndex: quest.steps.length ? 0 : quest.steps.length,
    completedStepIds: [],
    completedBonusIds: [],
    status
  }
}

const ensureQuestProgress = (progress?: TerminalQuestProgress | null): TerminalQuestProgress | null => {
  if (!progress) return null
  return {
    ...progress,
    completedStepIds: progress.completedStepIds ? [...progress.completedStepIds] : [],
    completedBonusIds: progress.completedBonusIds ? [...progress.completedBonusIds] : []
  }
}

const normalizeStepType = (step?: QuestStepDefinition): string => step?.type?.toLowerCase().trim() || ''

const normalizeQuestPath = (input?: string): string | undefined => (input ? normalizePath(input) : undefined)

const questStepToEventType = (stepType: string): QuestEventType | null => {
  switch (stepType) {
    case 'scan':
    case 'scan_host':
      return 'scan'
    case 'deep_scan':
    case 'deep_scan_host':
      return 'deep_scan'
    case 'connect':
    case 'connect_host':
      return 'connect'
    case 'disconnect':
    case 'disconnect_host':
      return 'disconnect'
    case 'read_file':
    case 'readfile':
      return 'read_file'
    case 'delete_file':
    case 'deletefile':
      return 'delete_file'
    case 'clean_logs':
    case 'clean_log':
    case 'cleanlogs':
      return 'clean_logs'
    case 'bruteforce':
    case 'bruteforce_door':
      return 'bruteforce'
    case 'backdoor_install':
    case 'install_backdoor':
      return 'backdoor_install'
    case 'file_exfiltrated':
    case 'exfiltrate_file':
      return 'file_exfiltrated'
    case 'ack_command':
    case 'command_used':
      return 'command_used'
    default:
      return null
  }
}

type QuestEventType =
  | 'scan'
  | 'deep_scan'
  | 'connect'
  | 'disconnect'
  | 'read_file'
  | 'delete_file'
  | 'clean_logs'
  | 'bruteforce'
  | 'backdoor_install'
  | 'file_exfiltrated'
  | 'command_used'

interface QuestEventPayload {
  type: QuestEventType
  ip?: string
  path?: string
  command?: string
}

const matchesQuestStep = (step: QuestStepDefinition, event: QuestEventPayload): boolean => {
  const stepType = normalizeStepType(step)
  if (!stepType || stepType === 'custom') return false
  const expectedType = questStepToEventType(stepType)
  if (!expectedType || expectedType !== event.type) return false
  const expectedIp = step.params?.target_ip || step.params?.ip
  if (expectedIp && event.ip && expectedIp !== event.ip) return false
  const expectedPath = normalizeQuestPath(step.params?.path || step.params?.file_path)
  if (expectedPath && event.path && normalizePath(event.path) !== expectedPath) return false
  const expectedCommand = step.params?.command?.toLowerCase?.()
  if (expectedCommand && event.command?.toLowerCase() !== expectedCommand) return false
  return true
}

const advanceQuestProgress = (
  quest: QuestDefinition | null,
  progress: TerminalQuestProgress | null,
  event: QuestEventPayload | null
): { progress: TerminalQuestProgress | null; completed: boolean } => {
  if (!quest || !progress || !event) {
    return { progress, completed: false }
  }
  if (progress.status === 'completed') {
    return { progress, completed: false }
  }
  const step = quest.steps[progress.currentStepIndex]
  if (!step || !matchesQuestStep(step, event)) {
    return { progress, completed: false }
  }
  const completedStepIds = [...progress.completedStepIds, step.id]
  const nextIndex = progress.currentStepIndex + 1
  const completed = nextIndex >= quest.steps.length
  return {
    progress: {
      ...progress,
      currentStepIndex: Math.min(nextIndex, quest.steps.length),
      completedStepIds,
      status: completed ? 'completed' : 'in_progress'
    },
    completed
  }
}

export type QuestOutcomeKey = 'success' | 'stealth' | 'failure'

export interface QuestCompletionSummary {
  outcome: QuestOutcomeKey
  rewardBlock?: QuestRewardsBlock
  branchOutcome?: QuestBranchOutcome
  completedBonusIds: string[]
  failedBonusIds: string[]
  totalBonusCount: number
  maxTrace: number
}

interface BonusEvaluationResult {
  completedIds: string[]
  failedIds: string[]
  total: number
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const normalizeObjectivePath = (raw?: unknown): string | null => {
  if (typeof raw !== 'string' || !raw.trim()) return null
  return normalizePath(raw.trim())
}

const evaluateBonusObjective = (
  objective: BonusObjective,
  quest: QuestDefinition,
  state: TerminalSessionState
): boolean => {
  const normalizedParams = objective.params || {}
  switch (objective.type) {
    case 'keep_trace_below': {
      const threshold = toNumber(normalizedParams.threshold) ?? quest.riskProfile?.maxRecommendedTrace ?? null
      if (threshold == null) return state.maxTraceSeen <= 50
      return (state.maxTraceSeen ?? 0) <= threshold
    }
    case 'avoid_trace_spike': {
      const threshold = toNumber(normalizedParams.threshold) ?? quest.riskProfile?.failAboveTrace ?? null
      if (threshold == null) return (state.maxTraceSeen ?? 0) <= 75
      return (state.maxTraceSeen ?? 0) < threshold
    }
    case 'dont_delete_file': {
      const targetPath = normalizeObjectivePath(normalizedParams.path || normalizedParams.file_path)
      if (!targetPath) {
        return state.deletedPaths.length === 0
      }
      return !state.deletedPaths.includes(targetPath)
    }
    case 'exfiltrate_file':
    case 'retrieve_files': {
      const targetPath = normalizeObjectivePath(normalizedParams.path || normalizedParams.file_path)
      if (!targetPath) return false
      return state.readPaths.includes(targetPath)
    }
    case 'dont_trigger_trap': {
      return state.trapsTriggered.length === 0
    }
    case 'clean_logs':
    case 'sanitize_logs': {
      const targetPath = normalizeObjectivePath(normalizedParams.path)
      if (!targetPath) {
        return state.logFilesEdited.length > 0
      }
      return state.logFilesEdited.includes(targetPath)
    }
    case 'delete_logs': {
      const targetPath = normalizeObjectivePath(normalizedParams.path)
      if (!targetPath) return false
      return state.deletedPaths.includes(targetPath)
    }
    default:
      return false
  }
}

const evaluateBonusObjectives = (quest: QuestDefinition, state: TerminalSessionState): BonusEvaluationResult => {
  const objectives = quest.bonusObjectives ?? []
  if (!objectives.length) {
    return { completedIds: [], failedIds: [], total: 0 }
  }
  const completedIds: string[] = []
  const failedIds: string[] = []
  objectives.forEach(objective => {
    const completed = evaluateBonusObjective(objective, quest, state)
    if (completed) completedIds.push(objective.id)
    else failedIds.push(objective.id)
  })
  return { completedIds, failedIds, total: objectives.length }
}

const meetsCleanupRequirement = (risk: QuestRiskProfile | undefined, state: TerminalSessionState): boolean => {
  if (!risk?.cleanupBeforeDisconnect) return true
  return state.logFilesEdited.length > 0
}

const determineQuestOutcome = (
  quest: QuestDefinition,
  state: TerminalSessionState,
  bonus: BonusEvaluationResult
): QuestOutcomeKey => {
  const risk = quest.riskProfile
  const maxTrace = state.maxTraceSeen ?? 0
  const forcedFailure = Boolean(
    (risk?.failAboveTrace != null && maxTrace >= risk.failAboveTrace) ||
    (risk?.requiredTraceSpike != null && maxTrace < risk.requiredTraceSpike)
  )

  if (forcedFailure) {
    return 'failure'
  }

  const stealthObjectives = (quest.bonusObjectives ?? []).filter(obj => obj.category === 'stealth')
  const stealthObjectivesCompleted = stealthObjectives.length === 0
    ? true
    : stealthObjectives.every(obj => bonus.completedIds.includes(obj.id))

  const withinRecommendedTrace = risk?.maxRecommendedTrace == null || maxTrace <= risk.maxRecommendedTrace
  const noTraps = state.trapsTriggered.length === 0
  const cleanupSatisfied = meetsCleanupRequirement(risk, state)

  if (withinRecommendedTrace && stealthObjectivesCompleted && noTraps && cleanupSatisfied) {
    return 'stealth'
  }

  return 'success'
}

const pickRewardsBlock = (quest: QuestDefinition, outcome: QuestOutcomeKey): QuestRewardsBlock | undefined => {
  const rewards = quest.rewards
  if (!rewards) return undefined
  return rewards[outcome] ?? rewards.default
}

const pickBranchOutcome = (quest: QuestDefinition, outcome: QuestOutcomeKey): QuestBranchOutcome | undefined => (
  quest.branching?.[outcome]
)

export const buildQuestCompletionSummary = (
  quest: QuestDefinition,
  state: TerminalSessionState
): QuestCompletionSummary => {
  const bonus = evaluateBonusObjectives(quest, state)
  const outcome = determineQuestOutcome(quest, state, bonus)
  return {
    outcome,
    rewardBlock: pickRewardsBlock(quest, outcome),
    branchOutcome: pickBranchOutcome(quest, outcome),
    completedBonusIds: bonus.completedIds,
    failedBonusIds: bonus.failedIds,
    totalBonusCount: bonus.total,
    maxTrace: state.maxTraceSeen ?? 0
  }
}

export const TERMINAL_HISTORY_LIMIT = 400

export const clampTerminalLines = (lines: TerminalLine[], limit = TERMINAL_HISTORY_LIMIT): TerminalLine[] => (
  lines.length > limit ? lines.slice(lines.length - limit) : lines
)

export const createTraceMeterState = (overrides?: Partial<TraceMeterState>): TraceMeterState => {
  const max = overrides?.max && overrides.max > 0 ? overrides.max : DEFAULT_TRACE_LIMIT
  const nervousThreshold = overrides?.nervousThreshold && overrides.nervousThreshold < max
    ? overrides.nervousThreshold
    : DEFAULT_NERVOUS_THRESHOLD
  const panicThreshold = overrides?.panicThreshold && overrides.panicThreshold <= max && overrides.panicThreshold > nervousThreshold
    ? overrides.panicThreshold
    : DEFAULT_PANIC_THRESHOLD
  const current = Math.min(max, Math.max(0, overrides?.current ?? 0))
  const status = current >= panicThreshold ? 'panic' : current >= nervousThreshold ? 'nervous' : 'calm'
  return {
    current,
    max,
    nervousThreshold,
    panicThreshold,
    status
  }
}

const resolveTraceCost = (action: TraceAction, rules?: QuestSystemSecurityRules): number => {
  switch (action) {
    case 'scan':
      return rules?.actionTraceCosts?.scan ?? BASE_TRACE_COSTS.scan
    case 'deep_scan':
      return rules?.actionTraceCosts?.deepScan ?? BASE_TRACE_COSTS.deep_scan
    case 'bruteforce':
      return rules?.actionTraceCosts?.bruteforce ?? BASE_TRACE_COSTS.bruteforce
    case 'delete_file':
      return rules?.actionTraceCosts?.deleteSensitiveFile ?? BASE_TRACE_COSTS.delete_file
    case 'clean_logs':
      return BASE_TRACE_COSTS.clean_logs
    case 'backdoor_install':
      return BASE_TRACE_COSTS.backdoor_install
    case 'disconnect':
      return BASE_TRACE_COSTS.disconnect
    case 'connect':
      return BASE_TRACE_COSTS.connect
    case 'read_file':
      return BASE_TRACE_COSTS.read_file
    case 'idle':
    default:
      return BASE_TRACE_COSTS.idle
  }
}

export const applyTraceCost = (
  state: TraceMeterState,
  action: TraceAction,
  rules?: QuestSystemSecurityRules
): TraceUpdateResult => {
  const delta = resolveTraceCost(action, rules)
  const nextValue = Math.min(state.max, Math.max(0, state.current + delta))
  const nextStatus = nextValue >= state.panicThreshold ? 'panic' : nextValue >= state.nervousThreshold ? 'nervous' : 'calm'
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

export interface TerminalSnapshot {
  schemaVersion: number
  savedAt: string
  state: TerminalSessionState
}

export const TERMINAL_SNAPSHOT_SCHEMA_VERSION = 5

export const createTerminalSessionState = (init?: Partial<TerminalSessionState>): TerminalSessionState => {
  const quest = init?.quest ?? null
  const system = init?.system ?? null
  const filesystem = ensureFilesystem(init?.filesystem ?? (system ? buildFilesystemFromSystem(system.filesystemRoot) : DEFAULT_FILESYSTEM))
  const questProgress = ensureQuestProgress(init?.questProgress ?? createQuestProgress(quest))
  const trace = init?.trace ?? createTraceMeterState()
  const scanDiscovery = cloneScanDiscovery(init?.scanDiscovery ?? DEFAULT_SCAN_DISCOVERY_STATE)
  const toolTiers = { ...DEFAULT_TOOL_TIERS, ...(init?.toolTiers ?? {}) }
  return {
    lines: init?.lines && init.lines.length ? clampTerminalLines(init.lines) : [createTerminalLine('Terminal ready. Type help.')],
    connectedIp: init?.connectedIp ?? null,
    currentPath: init?.currentPath ?? '/',
    filesystem,
    quest,
    system,
    questProgress,
    trace,
    securityRules: init?.securityRules ?? system?.securityRules,
    maxTraceSeen: init?.maxTraceSeen ?? trace.current ?? 0,
    trapsTriggered: init?.trapsTriggered ? [...init.trapsTriggered] : [],
    logFilesEdited: init?.logFilesEdited ? [...init.logFilesEdited] : [],
    readPaths: init?.readPaths ? [...init.readPaths] : [],
    deletedPaths: init?.deletedPaths ? [...init.deletedPaths] : [],
    mailListing: cloneMailListing(init?.mailListing ?? null),
    questDirectory: cloneQuestDirectory(init?.questDirectory ?? null),
    scanDiscovery,
    toolTiers
  }
}

export const hydrateTerminalSessionState = (
  snapshot?: TerminalSnapshot | null,
  overrides?: Partial<TerminalSessionState>
): TerminalSessionState => {
  if (!snapshot || snapshot.schemaVersion !== TERMINAL_SNAPSHOT_SCHEMA_VERSION) {
    return createTerminalSessionState(overrides)
  }
  return createTerminalSessionState({
    ...snapshot.state,
    ...overrides
  })
}

export const snapshotTerminalSessionState = (
  state: TerminalSessionState,
  options?: { lineLimit?: number }
): TerminalSnapshot => ({
  schemaVersion: TERMINAL_SNAPSHOT_SCHEMA_VERSION,
  savedAt: new Date().toISOString(),
  state: {
    ...state,
    lines: clampTerminalLines(state.lines, options?.lineLimit ?? TERMINAL_HISTORY_LIMIT)
  }
})

export const startQuestSession = (quest: QuestDefinition): TerminalSessionState => {
  const system = quest.system ?? null
  const filesystem = system ? buildFilesystemFromSystem(system.filesystemRoot) : { ...DEFAULT_FILESYSTEM }
  const trace = createTraceMeterState({
    max: system?.securityRules?.maxTrace,
    nervousThreshold: system?.securityRules?.nervousThreshold,
    panicThreshold: system?.securityRules?.panicThreshold
  })
  const introLines = [
    createTerminalLine(`Quest accepted: ${quest.title}`),
    system
      ? createTerminalLine(`Target system ${system.label} (${system.ip}) online.`)
      : createTerminalLine('No system is attached to this quest yet.')
  ]
  return createTerminalSessionState({
    quest,
    system,
    filesystem,
    trace,
    securityRules: system?.securityRules,
    questProgress: createQuestProgress(quest),
    lines: introLines,
    maxTraceSeen: trace.current,
    trapsTriggered: [],
    logFilesEdited: [],
    readPaths: [],
    deletedPaths: []
  })
}

const mergeQuestStart = (
  current: TerminalSessionState,
  quest: QuestDefinition
): { next: TerminalSessionState; introLines: TerminalLine[] } => {
  const session = startQuestSession(quest)
  const introLines = session.lines
  const preservedMail = current.mailListing ?? null
  const preservedDirectory = current.questDirectory ?? null
  return {
    introLines,
    next: {
      ...session,
      lines: current.lines,
      mailListing: preservedMail,
      questDirectory: preservedDirectory
    }
  }
}

const formatDoorDescriptor = (system: QuestSystemDefinition): string => {
  if (!system.doors?.length) return 'No doors detected. Host appears sealed.'
  const parts = system.doors.map(door => `${door.port}/tcp · ${door.status}`)
  return `Detected doors: ${parts.join(', ')}`
}

const SECURITY_GRADE_BY_DIFFICULTY: Record<SystemDifficulty, ScanSecurityGrade> = {
  tutorial: 'LOW',
  easy: 'LOW',
  medium: 'MEDIUM',
  hard: 'HIGH',
  boss: 'VERY HIGH'
}

const securityGradeScore = (grade: ScanSecurityGrade): number => {
  switch (grade) {
    case 'LOW':
      return 1
    case 'MEDIUM':
      return 2
    case 'HIGH':
      return 3
    case 'VERY HIGH':
    default:
      return 4
  }
}

const buildScanHosts = (system?: QuestSystemDefinition | null): ScanHostSummary[] => {
  if (!system) return []
  const security = SECURITY_GRADE_BY_DIFFICULTY[system.difficulty] ?? 'MEDIUM'
  const openPorts = system.doors?.map(door => door.port).filter(port => typeof port === 'number') ?? []
  const services: ScanHostService[] = (system.doors ?? []).map(door => ({
    port: door.port,
    protocol: 'tcp',
    name: door.name || `door-${door.port}`,
    version: door.status
  }))
  const notes = system.personalityBlurb ? [system.personalityBlurb] : undefined
  return [{
    ip: system.ip,
    hostname: system.label,
    security,
    openPorts,
    services,
    notes
  }]
}

const formatBasicScanHostLine = (host: ScanHostSummary, index: number): string => {
  const portsPreview = host.openPorts.length ? host.openPorts.slice(0, 3).join(', ') : 'none'
  const label = host.hostname || 'unknown'
  return `[${index}] ${host.ip.padEnd(12)} ${label.padEnd(16)} security: ${host.security}     open: ${portsPreview}`
}

const formatDeepScanHostLines = (host: ScanHostSummary, index: number): string[] => {
  const lines = [`[${index}] ${host.ip}  ${host.hostname || 'unknown'}`, `    security: ${host.security}`]
  if (host.services.length) {
    lines.push('    services:')
    host.services.forEach(service => {
      const descriptor = `${service.port}/${service.protocol}`.padEnd(8)
      const name = service.name || 'service'
      const version = service.version ? `  ${service.version}` : ''
      lines.push(`      ${descriptor} ${name}${version}`)
    })
  }
  if (host.notes?.length) {
    lines.push('    notes:')
    host.notes.forEach(note => lines.push(`      - ${note}`))
  }
  return lines
}

const partitionScanArgs = (rawArgs: string[]) => {
  const positional: string[] = []
  const flags = new Set<string>()
  rawArgs.forEach(arg => {
    if (arg.startsWith('--')) {
      flags.add(arg.toLowerCase())
    } else {
      positional.push(arg)
    }
  })
  return { positional, flags }
}

const matchesAssignedRange = (input: string | undefined, ip: string): boolean => {
  if (!input) return true
  if (input === ip) return true
  if (input === `${ip}/32`) return true
  return false
}

const getToolTier = (state: TerminalSessionState, toolId: HackingToolId): number => state.toolTiers?.[toolId] ?? 1

const updateScanDiscoveryState = (
  state: ScanDiscoveryState,
  hosts: ScanHostSummary[],
  infoLevel: ReconInfoLevel,
  range: string
): ScanDiscoveryUpdateResult => {
  const next: ScanDiscoveryState = {
    knownHosts: { ...state.knownHosts },
    lastRange: range
  }
  const newlyDiscovered: string[] = []
  const upgraded: string[] = []
  const timestamp = new Date().toISOString()
  hosts.forEach(host => {
    const existing = next.knownHosts[host.ip]
    if (!existing) {
      newlyDiscovered.push(host.ip)
      next.knownHosts[host.ip] = {
        infoLevel,
        firstSeenAt: timestamp,
        lastScannedAt: timestamp
      }
      return
    }
    const nextLevel: ReconInfoLevel = existing.infoLevel === 'deep' ? 'deep' : infoLevel
    if (existing.infoLevel !== nextLevel && nextLevel === 'deep') {
      upgraded.push(host.ip)
    }
    next.knownHosts[host.ip] = {
      infoLevel: nextLevel,
      firstSeenAt: existing.firstSeenAt,
      lastScannedAt: timestamp
    }
  })
  return { next, newlyDiscovered, upgraded }
}

const computeScanTraceDelta = (
  action: TraceAction,
  state: TerminalSessionState,
  options: { hostCount: number; averageSecurity: number; deep: boolean; stealth: boolean; repeatedSweep: boolean }
): { delta: number; summary: string } => {
  const baseCost = resolveTraceCost(action, state.securityRules)
  let delta = baseCost
  delta += options.hostCount
  if (options.deep) delta += 4
  delta += Math.max(0, options.averageSecurity - 1) * 2
  if (options.repeatedSweep) delta = Math.max(1, delta - 3)
  if (options.stealth) delta = Math.max(1, Math.round(delta * 0.5))
  const summary = options.stealth
    ? 'stealth scan'
    : options.deep
      ? 'deep recon burst'
      : options.repeatedSweep
        ? 'repeat sweep'
        : 'network activity detected'
  return { delta, summary }
}

const formatDirectoryListing = (nodes: TerminalFilesystemNode[]): string => {
  if (!nodes.length) return '[empty]'
  const sorted = [...nodes].sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name)
    return a.type === 'folder' ? -1 : 1
  })
  return sorted.map(node => `${node.type === 'folder' ? '[dir]' : 'file '}	${node.name}`).join('\n')
}

interface QuestEventResult {
  progress: TerminalQuestProgress | null
  completed: boolean
}

const applyQuestEvent = (
  quest: QuestDefinition | null,
  progress: TerminalQuestProgress | null,
  event: QuestEventPayload | null
): QuestEventResult => {
  const result = advanceQuestProgress(quest, progress, event)
  return {
    progress: result.progress,
    completed: result.completed
  }
}

const traceNoticeForStatus = (status: TraceMeterState['status']): string => {
  if (status === 'nervous') return 'Trace rising. Keep actions subtle.'
  if (status === 'panic') return 'Trace maxed out! Remote links unstable.'
  return 'Trace stabilized.'
}

const withCustomTraceDelta = (
  state: TerminalSessionState,
  delta: number,
  lines: TerminalLine[]
): { nextState: TerminalSessionState; lines: TerminalLine[] } => {
  if (!delta) {
    return { nextState: state, lines }
  }
  const current = state.trace
  const nextValue = Math.min(current.max, Math.max(0, current.current + delta))
  const nextStatus: TraceMeterState['status'] = nextValue >= current.panicThreshold
    ? 'panic'
    : nextValue >= current.nervousThreshold
      ? 'nervous'
      : 'calm'
  const statusChanged = nextStatus !== current.status ? nextStatus : undefined
  const trace = { ...current, current: nextValue, status: nextStatus }
  const nextState = {
    ...state,
    trace,
    maxTraceSeen: Math.max(state.maxTraceSeen ?? 0, nextValue)
  }
  if (!statusChanged) {
    return { nextState, lines }
  }
  return {
    nextState,
    lines: [...lines, createLine(traceNoticeForStatus(statusChanged))]
  }
}

const withTraceUpdate = (
  state: TerminalSessionState,
  action: TraceAction,
  lines: TerminalLine[]
): { nextState: TerminalSessionState; lines: TerminalLine[] } => {
  const { state: trace, statusChanged } = applyTraceCost(state.trace, action, state.securityRules)
  const updatedMaxTrace = Math.max(state.maxTraceSeen ?? 0, trace.current)
  const baseState = { ...state, trace, maxTraceSeen: updatedMaxTrace }
  if (!statusChanged) {
    return { nextState: baseState, lines }
  }
  return {
    nextState: baseState,
    lines: [...lines, createTerminalLine(traceNoticeForStatus(statusChanged))]
  }
}

export interface CommandResult {
  nextState: TerminalSessionState
  newLines: TerminalLine[]
  questCompleted?: boolean
  completionSummary?: QuestCompletionSummary
}

export const handleTerminalCommand = async (
  input: string,
  state: TerminalSessionState,
  context?: TerminalCommandContext
): Promise<CommandResult> => {
  const trimmed = input.trim()
  if (!trimmed) {
    return { nextState: state, newLines: [] }
  }
  const [rawCommand, ...rawArgs] = trimmed.split(/\s+/)
  const command = rawCommand.toLowerCase()
  const args = rawArgs
  let questCompleted = false
  let nextState: TerminalSessionState = { ...state }
  let outputLines: TerminalLine[] = []
  let completionSummary: QuestCompletionSummary | undefined

  const applyQuest = (event: QuestEventPayload | null) => {
    const beforeStatus = nextState.questProgress?.status
    const result = applyQuestEvent(nextState.quest, nextState.questProgress, event)
    if (result.progress !== nextState.questProgress) {
      nextState = { ...nextState, questProgress: result.progress }
      questCompleted = questCompleted || (beforeStatus !== 'completed' && result.progress?.status === 'completed')
    }
  }

  const requireRemote = (): boolean => {
    if (!nextState.connectedIp) {
      outputLines = [...outputLines, createLine('Not connected. Use connect <ip> first.')]
      return false
    }
    return true
  }

  const systemIp = nextState.system?.ip
  const updateSystem = (mutator: (system: QuestSystemDefinition) => QuestSystemDefinition) => {
    if (!nextState.system) return
    const updatedSystem = mutator(cloneQuestSystemDefinition(nextState.system))
    nextState = {
      ...nextState,
      system: updatedSystem,
      quest: nextState.quest ? { ...nextState.quest, system: updatedSystem } : nextState.quest
    }
  }

  const findDoorByToken = (token: string) => {
    const doors = nextState.system?.doors
    if (!doors?.length) return null
    const normalized = token.toLowerCase()
    return doors.find(door => {
      if (door.id === token) return true
      if (door.name && door.name.toLowerCase() === normalized) return true
      const portLabel = `${door.port}`
      if (portLabel === normalized) return true
      if (`${door.port}/tcp` === normalized) return true
      return false
    }) || null
  }

  switch (command) {
    case 'help': {
      const lines = nextState.connectedIp
        ? [
            'Remote commands:',
            '  ls                List directory contents',
            '  cd <path>         Change working directory',
            '  cat <file>        Display file contents',
            '  rm <file>         Delete a file',
            '  disconnect        Close the remote session'
          ]
        : [
            'Local commands:',
            '  help              Show this help text',
            '  scan <ip>         Probe a host for reachability',
            '  connect <ip>      Open a remote session',
            '  disconnect        Close the current session',
            '  mail [folder]     Inspect Atlas mail system',
            '  quest list        Browse available contracts'
          ]
      outputLines = lines.map(line => createLine(line))
      break
    }
    case 'mail': {
      const mailService = context?.mailService
      if (!mailService) {
        outputLines = [...outputLines, createLine('Mail subsystem unavailable. Install mailService to enable.')] 
        break
      }
      try {
        const sub = args[0]?.toLowerCase()
        if (sub === 'folders') {
          outputLines = [
            ...outputLines,
            createLine('Mail folders:'),
            ...MAIL_FOLDERS.map(folder => createLine(`  ${MAIL_FOLDER_LABEL[folder]} (${folder})`))
          ]
          break
        }
        if (sub === 'open') {
          const listing = nextState.mailListing
          if (!listing || !listing.entries.length) {
            outputLines = [...outputLines, createLine('List mail first: mail [inbox|archive|sent]')]
            break
          }
          const indexToken = args[1]
          const resolvedIndex = indexToken ? Number(indexToken) - 1 : NaN
          if (Number.isNaN(resolvedIndex)) {
            outputLines = [...outputLines, createLine('Usage: mail open <index>')]
            break
          }
          const entry = listing.entries[resolvedIndex]
          if (!entry) {
            outputLines = [...outputLines, createLine('No message at that index.')]
            break
          }
          const mail = await mailService.getMail(entry.id)
          if (!mail) {
            outputLines = [...outputLines, createLine('Failed to load that message.')]
            break
          }
          await mailService.markRead(entry.id, true)
          const updatedListing = updateMailListingEntry(listing, resolvedIndex, { read: true }) ?? listing
          nextState = { ...nextState, mailListing: updatedListing }
          outputLines = [
            ...outputLines,
            createLine(`Mail ${resolvedIndex + 1} · ${MAIL_FOLDER_LABEL[updatedListing.folder]}`),
            createLine(`From: ${mail.from}`),
            createLine(`Subject: ${mail.subject}`),
            createLine(`Received: ${formatMailTimestamp(mail.receivedAt)}`),
            createLine('-----'),
            ...createLinesFromMultilineText(mail.body),
            createLine('----- end message -----')
          ]
          break
        }
        if (sub === 'archive' && args[1]) {
          const listing = nextState.mailListing
          if (!listing || !listing.entries.length) {
            outputLines = [...outputLines, createLine('List a folder first before archiving messages.')]
            break
          }
          const resolvedIndex = Number(args[1]) - 1
          if (Number.isNaN(resolvedIndex)) {
            outputLines = [...outputLines, createLine('Usage: mail archive <index>')]
            break
          }
          const entry = listing.entries[resolvedIndex]
          if (!entry) {
            outputLines = [...outputLines, createLine('No message at that index.')]
            break
          }
          await mailService.archiveMail(entry.id)
          const updatedListing = removeMailListingEntry(listing, resolvedIndex) ?? listing
          nextState = { ...nextState, mailListing: updatedListing }
          outputLines = [...outputLines, createLine(`Archived message ${resolvedIndex + 1}: ${entry.subject}`)]
          break
        }
        if (!sub || isMailFolder(sub)) {
          const folder: MailFolder = isMailFolder(sub) ? sub as MailFolder : 'inbox'
          const records = await mailService.listMail(folder)
          const entries = records.map(summarizeMailEntry)
          nextState = { ...nextState, mailListing: { folder, entries } }
          outputLines = [
            ...outputLines,
            createLine(`${MAIL_FOLDER_LABEL[folder]} · ${entries.length} message${entries.length === 1 ? '' : 's'}`)
          ]
          outputLines = entries.length
            ? [...outputLines, ...entries.map((entry, index) => formatMailListingLine(entry, index))]
            : [...outputLines, createLine('Folder is empty.')]
          break
        }
        outputLines = [
          ...outputLines,
          createLine('Mail command usage:'),
          createLine('  mail [inbox|archive|sent]    List folder contents'),
          createLine('  mail folders                  Show folder labels'),
          createLine('  mail open <index>             Read a message'),
          createLine('  mail archive <index>          Archive a message')
        ]
      } catch (error) {
        console.error('Mail command failed', error)
        outputLines = [...outputLines, createLine('Mail system error. Try again later.')]
      }
      break
    }
    case 'quest': {
      const questStorage = context?.questStorage
      if (!questStorage) {
        outputLines = [...outputLines, createLine('Quest archive unavailable. Install quest storage service.')] 
        break
      }
      try {
        const action = args[0]?.toLowerCase() ?? 'list'
        if (action === 'list') {
          const quests = await questStorage.listQuests()
          const summaries = quests.map(summarizeQuestDefinition)
          nextState = { ...nextState, questDirectory: { quests: summaries } }
          outputLines = [
            ...outputLines,
            createLine(`Available quests: ${summaries.length}`)
          ]
          outputLines = summaries.length
            ? [...outputLines, ...summaries.map((summary, index) => formatQuestSummaryLine(summary, index))]
            : [...outputLines, createLine('No quests published to this client build.')]
          break
        }
        if (action === 'info') {
          const questId = args[1]
          if (!questId) {
            outputLines = [...outputLines, createLine('Usage: quest info <questId>')]
            break
          }
          const quest = await questStorage.getQuest(questId)
          if (!quest) {
            outputLines = [...outputLines, createLine(`No quest found with id ${questId}.`)]
            break
          }
          outputLines = [
            ...outputLines,
            createLine(`${quest.title} [${quest.difficulty}] · ${quest.id}`),
            createLine(quest.shortDescription || 'No briefing provided.'),
            createLine(`Steps: ${quest.steps.length}`),
            createLine(`System: ${quest.system ? `${quest.system.label} (${quest.system.ip})` : 'Not assigned'}`),
            createLine(`Bonus objectives: ${quest.bonusObjectives?.length ?? 0}`)
          ]
          break
        }
        if (action === 'start' || action === 'accept') {
          const questId = args[1]
          if (!questId) {
            outputLines = [...outputLines, createLine('Usage: quest start <questId>')]
            break
          }
          const quest = await questStorage.getQuest(questId)
          if (!quest) {
            outputLines = [...outputLines, createLine(`No quest found with id ${questId}.`)]
            break
          }
          if (!quest.system) {
            outputLines = [...outputLines, createLine('Quest missing system definition. Unable to start.')] 
            break
          }
          const merged = mergeQuestStart(nextState, quest)
          nextState = merged.next
          outputLines = [...outputLines, ...merged.introLines]
          break
        }
        outputLines = [
          ...outputLines,
          createLine('Quest command usage:'),
          createLine('  quest list'),
          createLine('  quest info <questId>'),
          createLine('  quest start <questId>'),
          createLine('  quest accept <questId>')
        ]
      } catch (error) {
        console.error('Quest command failed', error)
        outputLines = [...outputLines, createLine('Quest directory error. Try again later.')]
      }
      break
    }
    case 'scan': {
      if (!nextState.system || !systemIp) {
        outputLines = [...outputLines, createLine('No active quest system configured.')]
        break
      }
      const { positional, flags } = partitionScanArgs(args)
      const targetRange = positional[0] ?? `${systemIp}/32`
      const scanTier = getToolTier(nextState, 'scan')
      const deepRequested = flags.has('--deep')
      const stealthRequested = flags.has('--stealth')
      if (deepRequested && scanTier < 2) {
        outputLines = [...outputLines, createLine('scan: --deep requires recon tier 2. Complete more contracts to upgrade.')]
        break
      }
      if (stealthRequested && scanTier < 3) {
        outputLines = [...outputLines, createLine('scan: --stealth requires recon tier 3.')]
        break
      }
      const deepMode = deepRequested || stealthRequested
      const infoLevel: ReconInfoLevel = deepMode ? 'deep' : 'basic'
      const assignedRange = matchesAssignedRange(targetRange, systemIp)
      const hosts = assignedRange ? buildScanHosts(nextState.system) : []
      const verb = stealthRequested ? 'Performing stealth recon' : deepMode ? 'Deep scanning' : 'Scanning'
      outputLines = [...outputLines, createLine(`${verb} ${targetRange}...`)]
      let discoveryResult: ScanDiscoveryUpdateResult | null = null
      if (hosts.length) {
        outputLines = [...outputLines, createLine(`Found ${hosts.length} host${hosts.length === 1 ? '' : 's'}:`)]
        hosts.forEach((host, index) => {
          const hostLines = deepMode ? formatDeepScanHostLines(host, index) : [formatBasicScanHostLine(host, index)]
          hostLines.forEach(line => {
            outputLines = [...outputLines, createLine(line)]
          })
        })
        discoveryResult = updateScanDiscoveryState(nextState.scanDiscovery, hosts, infoLevel, targetRange)
        nextState = { ...nextState, scanDiscovery: discoveryResult.next }
        if (!discoveryResult.newlyDiscovered.length && !discoveryResult.upgraded.length) {
          const knownTotal = Object.keys(discoveryResult.next.knownHosts).length
          outputLines = [...outputLines, createLine(`No new hosts discovered. (${knownTotal} previously known)`)]
        }
      } else {
        const scope = assignedRange ? '' : ` in ${targetRange}`
        outputLines = [...outputLines, createLine(`No live hosts detected${scope}.`)]
      }
      const averageSecurity = hosts.length
        ? hosts.reduce((acc, host) => acc + securityGradeScore(host.security), 0) / hosts.length
        : 1
      const repeatedSweep = Boolean(discoveryResult && !discoveryResult.newlyDiscovered.length && !discoveryResult.upgraded.length)
      const baseAction: TraceAction = deepMode ? 'deep_scan' : 'scan'
      const { delta, summary } = computeScanTraceDelta(baseAction, nextState, {
        hostCount: hosts.length,
        averageSecurity,
        deep: deepMode,
        stealth: stealthRequested,
        repeatedSweep
      })
      outputLines = [...outputLines, createLine(`TRACE +${delta} (${summary})`)]
      const traceResult = withCustomTraceDelta(nextState, delta, outputLines)
      nextState = traceResult.nextState
      outputLines = traceResult.lines
      if (assignedRange) {
        applyQuest({ type: deepMode ? 'deep_scan' : 'scan', ip: systemIp })
      }
      break
    }
    case 'deep_scan': {
      if (!args[0]) {
        outputLines = [createLine('Usage: deep_scan <ip>')]
        break
      }
      const targetIp = args[0]
      if (!nextState.system || !systemIp) {
        outputLines = [createLine('No active quest system configured.')]
        break
      }
      const activeSystem = nextState.system
      const traceResult = withTraceUpdate(nextState, 'deep_scan', outputLines)
      nextState = traceResult.nextState
      outputLines = traceResult.lines
      if (targetIp !== systemIp) {
        outputLines = [...outputLines, createLine(`No deep scan response from ${targetIp}.`)]
        break
      }
      const securityRules = activeSystem.securityRules
      const traceSummary = securityRules
        ? `Trace cap ${securityRules.maxTrace ?? nextState.trace.max}. Nervous @ ${securityRules.nervousThreshold}, Panic @ ${securityRules.panicThreshold}.`
        : 'Security: standard perimeter.'
      const detailLines = [
        createLine(`Deep scan of ${systemIp} complete.`),
        createLine(formatDoorDescriptor(activeSystem)),
        createLine(traceSummary)
      ]
      if (activeSystem.personalityBlurb) {
        detailLines.push(createLine(activeSystem.personalityBlurb))
      }
      outputLines = [...outputLines, ...detailLines]
      applyQuest({ type: 'deep_scan', ip: targetIp })
      break
    }
    case 'connect': {
      if (!args[0]) {
        outputLines = [createLine('Usage: connect <ip>')]
        break
      }
      const targetIp = args[0]
      if (!nextState.system || !systemIp) {
        outputLines = [createLine('No active quest system configured.')]
        break
      }
      if (targetIp !== systemIp) {
        outputLines = [createLine(`Connection refused by ${targetIp}.`)]
        break
      }
      if (nextState.connectedIp === systemIp) {
        outputLines = [createLine(`Already connected to ${systemIp}.`)]
        break
      }
      const traceResult = withTraceUpdate(nextState, 'connect', outputLines)
      nextState = traceResult.nextState
      outputLines = [
        ...traceResult.lines,
        createLine(`Connected to ${systemIp}. Starting in /.`)
      ]
      nextState = { ...nextState, connectedIp: systemIp, currentPath: '/' }
      applyQuest({ type: 'connect', ip: systemIp })
      break
    }
    case 'disconnect': {
      if (!nextState.connectedIp) {
        outputLines = [createLine('Not currently connected.')]
        break
      }
      const activeIp = nextState.connectedIp
      const traceResult = withTraceUpdate(nextState, 'disconnect', outputLines)
      nextState = traceResult.nextState
      outputLines = [
        ...traceResult.lines,
        createLine(`Disconnected from ${activeIp}.`)
      ]
      applyQuest({ type: 'disconnect', ip: activeIp ?? undefined })
      nextState = { ...nextState, connectedIp: null, currentPath: '/' }
      break
    }
    case 'bruteforce': {
      if (!args[0]) {
        outputLines = [createLine('Usage: bruteforce <door|port>')]
        break
      }
      if (!nextState.system || !nextState.system.doors?.length) {
        outputLines = [createLine('No targetable doors on this system.')]
        break
      }
      const targetDoor = findDoorByToken(args[0])
      if (!targetDoor) {
        outputLines = [createLine(`No door matches ${args[0]}.`)]
        break
      }
      const traceResult = withTraceUpdate(nextState, 'bruteforce', outputLines)
      nextState = traceResult.nextState
      outputLines = traceResult.lines
      if (targetDoor.status === 'backdoor') {
        outputLines = [...outputLines, createLine('Door already compromised.')]
        break
      }
      updateSystem(system => ({
        ...system,
        doors: system.doors?.map(door => door.id === targetDoor.id ? { ...door, status: 'backdoor' } : door) ?? []
      }))
      const doorLabel = targetDoor.name || `${targetDoor.port}/tcp`
      outputLines = [...outputLines, createLine(`Backdoor planted on ${doorLabel}.`)]
      applyQuest({ type: 'bruteforce', ip: systemIp, command: 'bruteforce' })
      break
    }
    case 'ls': {
      if (!requireRemote()) break
      const nodes = listDirectory(nextState.filesystem, nextState.currentPath)
      if (nodes === null) {
        outputLines = [...outputLines, createLine('Unknown directory.')]
        break
      }
      outputLines = [...outputLines, createLine(formatDirectoryListing(nodes))]
      break
    }
    case 'cd': {
      if (!requireRemote()) break
      if (!args[0]) {
        outputLines = [...outputLines, createLine('Usage: cd <path>')]
        break
      }
      const targetPath = resolvePath(nextState.currentPath, args[0])
      const node = nextState.filesystem[targetPath]
      if (!node || node.type !== 'folder') {
        outputLines = [...outputLines, createLine(`No such directory: ${targetPath}`)]
        break
      }
      nextState = { ...nextState, currentPath: targetPath }
      outputLines = [...outputLines, createLine(`Changed directory to ${targetPath}`)]
      break
    }
    case 'cat': {
      if (!requireRemote()) break
      if (!args[0]) {
        outputLines = [...outputLines, createLine('Usage: cat <file>')]
        break
      }
      const file = readFileNode(nextState.filesystem, nextState.currentPath, args[0])
      if (!file) {
        outputLines = [...outputLines, createLine('File not found.')]
        break
      }
      const fileNode = nextState.filesystem[file.path]
      const alreadyRead = nextState.readPaths.includes(file.path)
      const updatedReadPaths = alreadyRead ? nextState.readPaths : [...nextState.readPaths, file.path]
      let updatedTraps = nextState.trapsTriggered
      if (fileNode?.tags?.includes('trap') && !updatedTraps.includes(file.path)) {
        updatedTraps = [...updatedTraps, file.path]
        outputLines = [...outputLines, createLine('Security trap tripped while reading that file.')] 
      }
      nextState = { ...nextState, readPaths: updatedReadPaths, trapsTriggered: updatedTraps }
      outputLines = [...outputLines, createLine(file.content || '[empty file]')]
      applyQuest({ type: 'read_file', path: file.path })
      break
    }
    case 'rm': {
      if (!requireRemote()) break
      if (!args[0]) {
        outputLines = [...outputLines, createLine('Usage: rm <file>')]
        break
      }
      const targetPath = resolvePath(nextState.currentPath, args[0])
      const targetNode = nextState.filesystem[targetPath]
      const result = removeFileNode(nextState.filesystem, nextState.currentPath, args[0])
      if (!result.removedPath) {
        outputLines = [...outputLines, createLine('Unable to delete file.')]
        break
      }
      const removedPath = result.removedPath
      const deletedPaths = nextState.deletedPaths.includes(removedPath)
        ? nextState.deletedPaths
        : [...nextState.deletedPaths, removedPath]
      let updatedTraps = nextState.trapsTriggered
      if (targetNode?.tags?.includes('trap') && !updatedTraps.includes(removedPath)) {
        updatedTraps = [...updatedTraps, removedPath]
        outputLines = [...outputLines, createLine('Security trap tripped while deleting that file.')] 
      }
      nextState = { ...nextState, filesystem: result.filesystem, deletedPaths, trapsTriggered: updatedTraps }
      const traceResult = withTraceUpdate(nextState, 'delete_file', outputLines)
      nextState = traceResult.nextState
      outputLines = [...traceResult.lines, createLine(`Deleted ${result.removedPath}`)]
      applyQuest({ type: 'delete_file', path: result.removedPath })
      break
    }
    case 'clean_logs': {
      if (!requireRemote()) break
      if (!args[0]) {
        outputLines = [...outputLines, createLine('Usage: clean_logs <path>')]
        break
      }
      const result = writeFileNode(nextState.filesystem, nextState.currentPath, args[0], () => {
        const timestamp = new Date().toISOString()
        return `[${timestamp}] Log scrubbed by operator.`
      })
      if (!result.updatedPath) {
        outputLines = [...outputLines, createLine('Log file not found.')]
        break
      }
      const updatedLogs = nextState.logFilesEdited.includes(result.updatedPath)
        ? nextState.logFilesEdited
        : [...nextState.logFilesEdited, result.updatedPath]
      nextState = { ...nextState, filesystem: result.filesystem, logFilesEdited: updatedLogs }
      const traceResult = withTraceUpdate(nextState, 'clean_logs', outputLines)
      nextState = traceResult.nextState
      outputLines = [...traceResult.lines, createLine(`Sanitized logs at ${result.updatedPath}.`)]
      applyQuest({ type: 'clean_logs', path: result.updatedPath })
      break
    }
    case 'backdoor_install': {
      if (!requireRemote()) break
      const alias = args[0]?.toLowerCase() || 'ghostlink'
      const traceResult = withTraceUpdate(nextState, 'backdoor_install', outputLines)
      nextState = traceResult.nextState
      const targetHost = nextState.connectedIp || systemIp || 'remote host'
      outputLines = [
        ...traceResult.lines,
        createLine(`Backdoor implant "${alias}" established on ${targetHost}.`)
      ]
      applyQuest({ type: 'backdoor_install', ip: nextState.connectedIp ?? systemIp ?? undefined, command: 'backdoor_install' })
      break
    }
    default:
      outputLines = [createLine(`Unknown command: ${command}`)]
      break
  }

  if (command) {
    applyQuest({ type: 'command_used', command })
  }

  const completedNow = questCompleted || (
    nextState.questProgress?.status === 'completed' && state.questProgress?.status !== 'completed'
  )
  if (completedNow && nextState.quest) {
    completionSummary = buildQuestCompletionSummary(nextState.quest, nextState)
    if (nextState.questProgress) {
      nextState = {
        ...nextState,
        questProgress: {
          ...nextState.questProgress,
          completedBonusIds: completionSummary.completedBonusIds
        }
      }
    }
  }

  return {
    nextState,
    newLines: outputLines,
    questCompleted: completedNow,
    completionSummary
  }
}
