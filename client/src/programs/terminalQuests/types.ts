import type { SerializedMailState } from '../mailSystem'

export type QuestTriggerType = 'ON_FIRST_TERMINAL_OPEN' | 'ON_QUEST_COMPLETION' | 'ON_FLAG_SET'
export type QuestIntroDeliveryCondition = 'game_start' | 'after_quest' | 'flag_set' | 'manual'
export type QuestIntroStartBehavior = 'startQuest' | 'loreOnly'

export type QuestStepType = 'SCAN_HOST' | 'CONNECT_HOST' | 'DELETE_FILE' | 'DISCONNECT_HOST'

export type QuestLifecycleStatus = 'not_started' | 'in_progress' | 'completed'

export interface QuestIntroMailDelivery {
  condition: QuestIntroDeliveryCondition
  questId?: string
  flagKey?: string
  flagValue?: string
}

export interface QuestTrigger {
  type: QuestTriggerType
  quest_ids?: string[]
  flag_key?: string
  flag_value?: string
}

export interface QuestStepParamsBase {
  target_ip?: string
  file_path?: string
  [key: string]: string | undefined
}

export interface QuestStepHints {
  prompt?: string
  command_example?: string
}

export interface QuestStep {
  id: string
  type: QuestStepType
  target_system_id?: string
  params: QuestStepParamsBase
  hints?: QuestStepHints
  auto_advance?: boolean
}

export interface QuestRequirements {
  required_flags?: string[]
  required_quests?: string[]
}

export interface QuestRewardFlag {
  key: string
  value?: string
}

export interface QuestRewards {
  credits?: number
  flags?: QuestRewardFlag[]
  unlocks_commands?: string[]
}

export type QuestMailDeliveryPhase = 'on_accept' | 'on_complete'

export interface QuestMailConfig {
  briefingMailId?: string | null
  completionMailId?: string | null
  autoDeliverOnAccept?: string[]
  autoDeliverOnComplete?: string[]
  previewState?: SerializedMailState
}

export interface QuestDefinition {
  id: string
  title: string
  description: string
  summary?: string
  designerNotes?: string
  difficulty?: string
  faction?: string
  tags?: string[]
  trigger: QuestTrigger
  steps: QuestStep[]
  rewards: QuestRewards
  requirements?: QuestRequirements
  default_system_id?: string
  embedded_filesystems?: Record<string, Record<string, FileSystemNode>>
  status?: 'draft' | 'published'
  completion_flag?: string
  mail?: QuestMailConfig
  introEmailId?: string
  introMailDelivery?: QuestIntroMailDelivery
  introMailStartBehavior?: QuestIntroStartBehavior
  followUpQuestId?: string
  completionEmailId?: string
}

export interface FileSystemNode {
  type: 'dir' | 'file'
  name: string
  path: string
  children?: string[]
  content?: string
}
