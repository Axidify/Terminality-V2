import type { SerializedMailState } from './mailSystem'
import type {
  QuestDefinition,
  QuestLifecycleStatus,
  QuestRewardFlag,
  QuestStep,
  QuestTrigger
} from './terminalQuests/types'

export type QuestEventType = 'SCAN_COMPLETED' | 'SESSION_CONNECTED' | 'FILE_DELETED' | 'SESSION_DISCONNECTED'

export interface QuestInstanceState {
  quest: QuestDefinition
  currentStepIndex: number
  completed: boolean
}

export interface QuestEngineState {
  active: QuestInstanceState[]
  completedIds: string[]
  flags: QuestFlagState[]
  statuses: Record<string, QuestLifecycleStatus>
}

export interface SerializedQuestState {
  active?: Array<{ questId: string; currentStepIndex: number }>
  completedIds?: string[]
  flags?: Array<string | QuestFlagState>
  statuses?: Record<string, QuestLifecycleStatus>
}

export interface QuestFlagState {
  key: string
  value?: string
}

export interface QuestEventPayload {
  playerId: string
  target_ip?: string
  file_path?: string
}

export interface QuestEvent {
  type: QuestEventType
  payload: QuestEventPayload
}

const DEFAULT_QUEST_DEFINITIONS: QuestDefinition[] = [
  {
    id: 'intro_001_wipe_evidence',
    title: 'Wipe the Evidence',
    description: 'Your handler wants a trace log erased from a remote machine.',
    trigger: { type: 'ON_FIRST_TERMINAL_OPEN' },
    default_system_id: 'atlas_relay',
    steps: [
      {
        id: 'step1_scan_host',
        type: 'SCAN_HOST',
        params: { target_ip: '10.23.4.8' },
        hints: {
          prompt: 'Use the scan tool on the IP from your inbox.',
          command_example: 'scan 10.23.4.8'
        }
      },
      {
        id: 'step2_connect_host',
        type: 'CONNECT_HOST',
        params: { target_ip: '10.23.4.8' },
        hints: {
          prompt: 'Now connect to that host.',
          command_example: 'connect 10.23.4.8'
        }
      },
      {
        id: 'step3_delete_file',
        type: 'DELETE_FILE',
        params: { target_ip: '10.23.4.8', file_path: '/var/logs/evidence.log' },
        hints: {
          prompt: 'Navigate to /var/logs and delete evidence.log.',
          command_example: 'cd /var/logs && rm evidence.log'
        }
      },
      {
        id: 'step4_disconnect',
        type: 'DISCONNECT_HOST',
        params: { target_ip: '10.23.4.8' },
        hints: {
          prompt: 'Disconnect to finish the job.',
          command_example: 'disconnect'
        }
      }
    ],
    rewards: {
      credits: 50,
      flags: [{ key: 'quest_intro_001_completed' }]
    },
    completion_flag: 'quest_intro_001_completed'
  }
]

const normalizeMailIds = (ids?: string[]): string[] => {
  if (!ids?.length) return []
  const seen = new Set<string>()
  const normalized: string[] = []
  ids.forEach(id => {
    const trimmed = id?.trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    normalized.push(trimmed)
  })
  return normalized.slice(0, 50)
}

const normalizeMailPreviewState = (state?: SerializedMailState | null): SerializedMailState | undefined => {
  if (!state) return undefined
  const deliveredIds = normalizeMailIds(state.deliveredIds)
  const readIds = normalizeMailIds(state.readIds)
  const archivedIds = normalizeMailIds(state.archivedIds)
  const deletedIds = normalizeMailIds(state.deletedIds)
  if (!deliveredIds.length && !readIds.length && !archivedIds.length && !deletedIds.length) {
    return undefined
  }
  return {
    ...(deliveredIds.length ? { deliveredIds } : {}),
    ...(readIds.length ? { readIds } : {}),
    ...(archivedIds.length ? { archivedIds } : {}),
    ...(deletedIds.length ? { deletedIds } : {})
  }
}

const normalizeMailConfig = (mail?: QuestDefinition['mail']): QuestDefinition['mail'] | undefined => {
  if (!mail) return undefined
  const briefingMailId = mail.briefingMailId?.trim() || undefined
  const completionMailId = mail.completionMailId?.trim() || undefined
  const autoDeliverOnAccept = normalizeMailIds(mail.autoDeliverOnAccept)
  const autoDeliverOnComplete = normalizeMailIds(mail.autoDeliverOnComplete)
  const previewState = normalizeMailPreviewState(mail.previewState)
  if (!briefingMailId && !completionMailId && !autoDeliverOnAccept.length && !autoDeliverOnComplete.length && !previewState) {
    return undefined
  }
  return {
    ...(briefingMailId ? { briefingMailId } : {}),
    ...(completionMailId ? { completionMailId } : {}),
    ...(autoDeliverOnAccept.length ? { autoDeliverOnAccept } : {}),
    ...(autoDeliverOnComplete.length ? { autoDeliverOnComplete } : {}),
    ...(previewState ? { previewState } : {})
  }
}

const ensureCompletionFlag = (quest: QuestDefinition): string => {
  if (quest.completion_flag && quest.completion_flag.trim()) {
    return quest.completion_flag.trim()
  }
  return `quest_completed_${quest.id}`
}

let QUEST_DEFINITIONS: QuestDefinition[] = [...DEFAULT_QUEST_DEFINITIONS]
const QUEST_INDEX = new Map<string, QuestDefinition>()
const normalizeStep = (step: QuestStep): QuestStep => ({
  ...step,
  auto_advance: step.auto_advance !== undefined ? step.auto_advance : true,
  params: step.params || {}
})

const normalizeTrigger = (trigger?: QuestTrigger): QuestTrigger => {
  const type = trigger?.type || 'ON_FIRST_TERMINAL_OPEN'
  if (type === 'ON_QUEST_COMPLETION') {
    const questIds = Array.isArray(trigger?.quest_ids)
      ? trigger.quest_ids.map(id => id?.trim()).filter(Boolean)
      : []
    return { type, quest_ids: questIds.slice(0, 5) }
  }
  if (type === 'ON_FLAG_SET') {
    const flagKey = trigger?.flag_key?.trim()
    const flagValue = trigger?.flag_value?.trim()
    return {
      type,
      ...(flagKey ? { flag_key: flagKey } : {}),
      ...(flagValue ? { flag_value: flagValue } : {})
    }
  }
  return { type }
}

const DEFAULT_FLAG_VALUE = 'true'

const normalizeFlagState = (entry?: string | QuestFlagState | QuestRewardFlag): QuestFlagState | null => {
  if (!entry) return null
  if (typeof entry === 'string') {
    const raw = entry.trim()
    if (!raw) return null
    const separators = ['=', ':']
    for (const separator of separators) {
      const idx = raw.indexOf(separator)
      if (idx > 0) {
        const key = raw.slice(0, idx).trim()
        const value = raw.slice(idx + 1).trim()
        if (!key) return null
        return { key, value: value || DEFAULT_FLAG_VALUE }
      }
    }
    return { key: raw, value: DEFAULT_FLAG_VALUE }
  }
  const key = entry.key?.trim()
  if (!key) return null
  const rawValue = entry.value != null ? String(entry.value).trim() : ''
  return {
    key,
    value: rawValue || DEFAULT_FLAG_VALUE
  }
}

const upsertFlagState = (flags: QuestFlagState[], next: QuestFlagState): QuestFlagState[] => {
  if (!next.key) return flags
  const existingIndex = flags.findIndex(flag => flag.key === next.key)
  if (existingIndex >= 0) {
    const clone = [...flags]
    clone[existingIndex] = next
    return clone
  }
  return [...flags, next]
}

const normalizeSerializedFlags = (entries?: Array<string | QuestFlagState>): QuestFlagState[] => {
  if (!entries?.length) return []
  return entries.reduce<QuestFlagState[]>((acc, entry) => {
    const normalized = normalizeFlagState(entry)
    if (!normalized) return acc
    return upsertFlagState(acc, normalized)
  }, [])
}

const applyRewardFlags = (flags: QuestFlagState[], rewardTokens?: Array<string | QuestRewardFlag>): QuestFlagState[] => {
  if (!rewardTokens?.length) return flags
  return rewardTokens.reduce<QuestFlagState[]>((acc, token) => {
    const normalized = normalizeFlagState(token)
    if (!normalized) return acc
    return upsertFlagState(acc, normalized)
  }, flags)
}

const hydrateDefinitions = (definitions: QuestDefinition[]) => {
  QUEST_INDEX.clear()
  QUEST_DEFINITIONS = definitions.map(def => ({
    ...def,
    steps: def.steps?.map(normalizeStep) ?? [],
    trigger: normalizeTrigger(def.trigger),
    rewards: {
      credits: def.rewards?.credits,
      flags: def.rewards?.flags || [],
      unlocks_commands: def.rewards?.unlocks_commands || []
    },
    requirements: {
      required_flags: def.requirements?.required_flags || [],
      required_quests: def.requirements?.required_quests || []
    },
    completion_flag: ensureCompletionFlag(def),
    mail: normalizeMailConfig(def.mail)
  }))
  QUEST_DEFINITIONS.forEach(def => QUEST_INDEX.set(def.id, def))
}

hydrateDefinitions(DEFAULT_QUEST_DEFINITIONS)

export const setQuestDefinitions = (definitions: QuestDefinition[]) => {
  if (!Array.isArray(definitions) || !definitions.length) {
    hydrateDefinitions(DEFAULT_QUEST_DEFINITIONS)
    return
  }
  hydrateDefinitions(definitions)
}

const createTriggeredQuests = () => (
  QUEST_DEFINITIONS
    .filter(q => q.trigger.type === 'ON_FIRST_TERMINAL_OPEN')
    .map<QuestInstanceState>(quest => ({ quest, currentStepIndex: 0, completed: false }))
)

const createStatusMap = (): Record<string, QuestLifecycleStatus> => {
  const map: Record<string, QuestLifecycleStatus> = {}
  QUEST_DEFINITIONS.forEach(def => {
    map[def.id] = 'not_started'
  })
  return map
}

const matchesFlagRequirement = (flags: QuestFlagState[], flagKey: string, expectedValue?: string): boolean => {
  if (!flagKey) return false
  const normalizedExpected = expectedValue?.trim().toLowerCase()
  return flags.some(flag => {
    if (flag.key !== flagKey) return false
    if (!normalizedExpected || normalizedExpected === 'set') return true
    const value = (flag.value || DEFAULT_FLAG_VALUE).toLowerCase()
    return value === normalizedExpected
  })
}

const requirementsSatisfied = (quest: QuestDefinition, completedSet: Set<string>, flags: QuestFlagState[]): boolean => {
  const requiredFlags = quest.requirements?.required_flags || []
  if (requiredFlags.some(flag => !matchesFlagRequirement(flags, flag, undefined))) {
    return false
  }
  const requiredQuests = quest.requirements?.required_quests || []
  if (requiredQuests.some(reqId => !completedSet.has(reqId))) {
    return false
  }
  return true
}

const triggerSatisfied = (trigger: QuestTrigger, completedSet: Set<string>, flags: QuestFlagState[]): boolean => {
  switch (trigger.type) {
    case 'ON_FIRST_TERMINAL_OPEN':
      return true
    case 'ON_QUEST_COMPLETION': {
      const questIds = trigger.quest_ids || []
      return questIds.length > 0 && questIds.every(id => completedSet.has(id))
    }
    case 'ON_FLAG_SET':
      return matchesFlagRequirement(flags, trigger.flag_key || '', trigger.flag_value)
    default:
      return false
  }
}

const spawnTriggeredQuests = (
  active: QuestInstanceState[],
  completedIds: string[],
  flags: QuestFlagState[],
  statuses: Record<string, QuestLifecycleStatus>
): { active: QuestInstanceState[]; triggered: QuestDefinition[] } => {
  const completedSet = new Set(completedIds)
  const activeIds = new Set(active.map(instance => instance.quest.id))
  const triggeredDefinitions = QUEST_DEFINITIONS.filter(quest => {
    if (completedSet.has(quest.id) || activeIds.has(quest.id)) return false
    if (statuses[quest.id] === 'completed') return false
    return triggerSatisfied(quest.trigger, completedSet, flags)
  })
  if (!triggeredDefinitions.length) {
    return { active, triggered: [] }
  }
  const nextActive = [...active, ...triggeredDefinitions.map(quest => ({ quest, currentStepIndex: 0, completed: false }))]
  return { active: nextActive, triggered: triggeredDefinitions }
}

export const createQuestEngineState = (): QuestEngineState => {
  const statuses = createStatusMap()
  const baseActive = createTriggeredQuests()
  baseActive.forEach(instance => { statuses[instance.quest.id] = 'in_progress' })
  return {
    active: spawnTriggeredQuests(baseActive, [], [], statuses).active,
    completedIds: [],
    flags: [],
    statuses
  }
}

export const getQuestDefinitionById = (id: string): QuestDefinition | undefined => QUEST_INDEX.get(id)

export const hydrateQuestState = (serialized?: SerializedQuestState | null): QuestEngineState => {
  if (!serialized) {
    return createQuestEngineState()
  }

  const statuses = createStatusMap()
  if (serialized.statuses) {
    Object.entries(serialized.statuses).forEach(([questId, status]) => {
      if (status === 'completed' || status === 'in_progress' || status === 'not_started') {
        statuses[questId] = status
      }
    })
  }
  const completedSet = new Set(serialized.completedIds || [])
  Object.entries(statuses).forEach(([questId, status]) => {
    if (status === 'completed') completedSet.add(questId)
  })
  const activeInstances: QuestInstanceState[] = []

  if (Array.isArray(serialized.active)) {
    serialized.active.forEach(entry => {
      const quest = entry.questId ? getQuestDefinitionById(entry.questId) : undefined
      if (!quest) return
      const cappedIndex = Math.min(entry.currentStepIndex ?? 0, quest.steps.length)
      const completed = cappedIndex >= quest.steps.length
      if (completed) {
        completedSet.add(quest.id)
        return
      }
      activeInstances.push({ quest, currentStepIndex: cappedIndex, completed: false })
      statuses[quest.id] = 'in_progress'
    })
  }

  const existingActiveIds = new Set(activeInstances.map(inst => inst.quest.id))
  createTriggeredQuests().forEach(instance => {
    if (!completedSet.has(instance.quest.id) && !existingActiveIds.has(instance.quest.id)) {
      activeInstances.push(instance)
      statuses[instance.quest.id] = 'in_progress'
    }
  })

  const completedIdsList = Array.from(completedSet)
  const normalizedFlags = normalizeSerializedFlags(serialized.flags)
  const spawnResult = spawnTriggeredQuests(activeInstances, completedIdsList, normalizedFlags, statuses)
  spawnResult.triggered.forEach(quest => {
    statuses[quest.id] = 'in_progress'
  })

  return {
    active: spawnResult.active,
    completedIds: completedIdsList,
    flags: normalizedFlags,
    statuses
  }
}

export const serializeQuestState = (state: QuestEngineState): SerializedQuestState => ({
  active: state.active.map(instance => ({
    questId: instance.quest.id,
    currentStepIndex: instance.currentStepIndex
  })),
  completedIds: [...state.completedIds],
  flags: state.flags.map(flag => (
    flag.value && flag.value !== DEFAULT_FLAG_VALUE
      ? { key: flag.key, value: flag.value }
      : { key: flag.key }
  )),
  statuses: { ...state.statuses }
})

const stepSatisfiedByEvent = (step: QuestStep, event: QuestEvent): boolean => {
  const { params } = step
  switch (step.type) {
    case 'SCAN_HOST':
      return event.type === 'SCAN_COMPLETED' && event.payload.target_ip === params.target_ip
    case 'CONNECT_HOST':
      return event.type === 'SESSION_CONNECTED' && event.payload.target_ip === params.target_ip
    case 'DELETE_FILE':
      return event.type === 'FILE_DELETED' &&
        event.payload.target_ip === params.target_ip &&
        event.payload.file_path === params.file_path
    case 'DISCONNECT_HOST':
      return event.type === 'SESSION_DISCONNECTED' && event.payload.target_ip === params.target_ip
    default:
      return false
  }
}

export interface QuestEventResult {
  state: QuestEngineState
  notifications: string[]
  completedQuestIds?: string[]
  acceptedQuestIds?: string[]
}

export const processQuestEvent = (state: QuestEngineState, event: QuestEvent): QuestEventResult => {
  const notifications: string[] = []
  const nextStatuses: Record<string, QuestLifecycleStatus> = { ...state.statuses }
  const nextActive: QuestInstanceState[] = state.active.map(instance => {
    if (instance.completed) return instance
    const currentStep = instance.quest.steps[instance.currentStepIndex]
    if (!currentStep) return { ...instance, completed: true }
    if (!stepSatisfiedByEvent(currentStep, event)) return instance
    const nextIndex = instance.currentStepIndex + 1
    const finished = nextIndex >= instance.quest.steps.length
    if (finished) {
      notifications.push(`Quest complete: ${instance.quest.title}`)
      nextStatuses[instance.quest.id] = 'completed'
    } else {
      const nextStep = instance.quest.steps[nextIndex]
      notifications.push(`Progress: ${instance.quest.title} -> ${nextStep.id}`)
      nextStatuses[instance.quest.id] = 'in_progress'
    }
    return {
      ...instance,
      currentStepIndex: nextIndex,
      completed: finished
    }
  })

  const newlyCompleted = nextActive.filter(inst => inst.completed && !state.completedIds.includes(inst.quest.id))
  const newlyCompletedIds = newlyCompleted.map(inst => inst.quest.id)
  const updatedCompletedIds = newlyCompletedIds.length
    ? [...state.completedIds, ...newlyCompletedIds]
    : state.completedIds

  let updatedFlags = newlyCompleted.reduce<QuestFlagState[]>((acc, inst) => (
    applyRewardFlags(acc, inst.quest.rewards?.flags)
  ), [...state.flags])

  newlyCompleted.forEach(inst => {
    const completionFlag = inst.quest.completion_flag || ensureCompletionFlag(inst.quest)
    updatedFlags = upsertFlagState(updatedFlags, { key: completionFlag, value: DEFAULT_FLAG_VALUE })
  })

  const stillActive = nextActive.filter(inst => !inst.completed)
  const spawnResult = spawnTriggeredQuests(stillActive, updatedCompletedIds, updatedFlags, nextStatuses)
  const acceptedQuestIds = spawnResult.triggered.map(quest => quest.id)
  if (spawnResult.triggered.length) {
    spawnResult.triggered.forEach(quest => {
      nextStatuses[quest.id] = 'in_progress'
      notifications.push(`New quest available: ${quest.title}`)
    })
  }

  return {
    state: {
      active: spawnResult.active,
      completedIds: updatedCompletedIds,
      flags: updatedFlags,
      statuses: nextStatuses
    },
    notifications,
    completedQuestIds: newlyCompletedIds,
    acceptedQuestIds
  }
}

export interface InboxEntry {
  questId: string
  title: string
  description: string
  progress: string
  hint?: string
}

export const getInboxEntries = (state: QuestEngineState): InboxEntry[] => {
  return state.active.map(instance => {
    const quest = instance.quest
    const stepIndex = Math.min(instance.currentStepIndex, Math.max(quest.steps.length - 1, 0))
    const currentStep = quest.steps[stepIndex]
    return {
      questId: quest.id,
      title: quest.title,
      description: quest.description,
      progress: quest.steps.length
        ? `Step ${Math.min(stepIndex + 1, quest.steps.length)} of ${quest.steps.length}`
        : 'Awaiting new directives',
      hint: currentStep?.hints?.prompt
    }
  })
}

export const getQuestDefinitions = () => QUEST_DEFINITIONS

export const offerQuestFromMail = (state: QuestEngineState, questId?: string | null): QuestEventResult => {
  if (!questId) {
    return { state, notifications: [] }
  }
  const quest = getQuestDefinitionById(questId)
  if (!quest) {
    return { state, notifications: [] }
  }
  if (state.completedIds.includes(questId)) {
    return { state, notifications: [] }
  }
  if (state.active.some(instance => instance.quest.id === questId)) {
    return { state, notifications: [] }
  }
  const completedSet = new Set(state.completedIds)
  if (!requirementsSatisfied(quest, completedSet, state.flags)) {
    return { state, notifications: [] }
  }
  const nextStatuses: Record<string, QuestLifecycleStatus> = { ...state.statuses, [quest.id]: 'in_progress' }
  const nextActive = [...state.active, { quest, currentStepIndex: 0, completed: false }]
  return {
    state: {
      ...state,
      active: nextActive,
      statuses: nextStatuses
    },
    notifications: [`New quest available: ${quest.title}`],
    acceptedQuestIds: [quest.id]
  }
}
