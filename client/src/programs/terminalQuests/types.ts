export type QuestTriggerType = 'ON_FIRST_TERMINAL_OPEN'

export type QuestStepType = 'SCAN_HOST' | 'CONNECT_HOST' | 'DELETE_FILE' | 'DISCONNECT_HOST'

export interface QuestTrigger {
  type: QuestTriggerType
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

export interface QuestRewards {
  xp?: number
  flags?: string[]
  unlocks_commands?: string[]
}

export interface QuestDefinition {
  id: string
  title: string
  description: string
  trigger: QuestTrigger
  steps: QuestStep[]
  rewards: QuestRewards
  requirements?: QuestRequirements
  default_system_id?: string
  embedded_filesystems?: Record<string, Record<string, FileSystemNode>>
}

export interface FileSystemNode {
  type: 'dir' | 'file'
  name: string
  path: string
  children?: string[]
  content?: string
}
