import type {
  QuestDefinition,
  QuestStep,
  QuestStepType,
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
  flags: string[]
}

export interface SerializedQuestState {
  active?: Array<{ questId: string; currentStepIndex: number }>
  completedIds?: string[]
  flags?: string[]
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
      xp: 50,
      flags: ['quest_intro_001_completed']
    }
  }
]

let QUEST_DEFINITIONS: QuestDefinition[] = [...DEFAULT_QUEST_DEFINITIONS]
const QUEST_INDEX = new Map<string, QuestDefinition>()
const normalizeStep = (step: QuestStep): QuestStep => ({
  ...step,
  auto_advance: step.auto_advance !== undefined ? step.auto_advance : true,
  params: step.params || {}
})

const hydrateDefinitions = (definitions: QuestDefinition[]) => {
  QUEST_INDEX.clear()
  QUEST_DEFINITIONS = definitions.map(def => ({
    ...def,
    steps: def.steps?.map(normalizeStep) ?? [],
    rewards: {
      xp: def.rewards?.xp,
      flags: def.rewards?.flags || [],
      unlocks_commands: def.rewards?.unlocks_commands || []
    },
    requirements: {
      required_flags: def.requirements?.required_flags || [],
      required_quests: def.requirements?.required_quests || []
    }
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

export const createQuestEngineState = (): QuestEngineState => ({
  active: createTriggeredQuests(),
  completedIds: [],
  flags: []
})

export const getQuestDefinitionById = (id: string): QuestDefinition | undefined => QUEST_INDEX.get(id)

export const hydrateQuestState = (serialized?: SerializedQuestState | null): QuestEngineState => {
  if (!serialized) {
    return createQuestEngineState()
  }

  const completedSet = new Set(serialized.completedIds || [])
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
    })
  }

  const existingActiveIds = new Set(activeInstances.map(inst => inst.quest.id))
  createTriggeredQuests().forEach(instance => {
    if (!completedSet.has(instance.quest.id) && !existingActiveIds.has(instance.quest.id)) {
      activeInstances.push(instance)
    }
  })

  return {
    active: activeInstances,
    completedIds: Array.from(completedSet),
    flags: [...new Set(serialized.flags || [])]
  }
}

export const serializeQuestState = (state: QuestEngineState): SerializedQuestState => ({
  active: state.active.map(instance => ({
    questId: instance.quest.id,
    currentStepIndex: instance.currentStepIndex
  })),
  completedIds: [...state.completedIds],
  flags: [...state.flags]
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
}

export const processQuestEvent = (state: QuestEngineState, event: QuestEvent): QuestEventResult => {
  const notifications: string[] = []
  const nextActive: QuestInstanceState[] = state.active.map(instance => {
    if (instance.completed) return instance
    const currentStep = instance.quest.steps[instance.currentStepIndex]
    if (!currentStep) return { ...instance, completed: true }
    if (!stepSatisfiedByEvent(currentStep, event)) return instance
    const nextIndex = instance.currentStepIndex + 1
    const finished = nextIndex >= instance.quest.steps.length
    if (finished) {
      notifications.push(`Quest complete: ${instance.quest.title}`)
    } else {
      const nextStep = instance.quest.steps[nextIndex]
      notifications.push(`Progress: ${instance.quest.title} -> ${nextStep.id}`)
    }
    return {
      ...instance,
      currentStepIndex: nextIndex,
      completed: finished
    }
  })

  const newlyCompleted = nextActive.filter(inst => inst.completed && !state.completedIds.includes(inst.quest.id))
  const updatedCompletedIds = newlyCompleted.length
    ? [...state.completedIds, ...newlyCompleted.map(inst => inst.quest.id)]
    : state.completedIds

  const updatedFlags = newlyCompleted.reduce<string[]>((acc, inst) => {
    const rewards = inst.quest.rewards
    if (rewards.flags) {
      rewards.flags.forEach(flag => {
        if (!acc.includes(flag)) acc.push(flag)
      })
    }
    return acc
  }, [...state.flags])

  const stillActive = nextActive.filter(inst => !inst.completed)

  return {
    state: {
      active: stillActive,
      completedIds: updatedCompletedIds,
      flags: updatedFlags
    },
    notifications
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
