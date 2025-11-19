// Core quest/system/email domain types for Terminality

export type SystemDifficulty =
  | 'tutorial'
  | 'easy'
  | 'medium'
  | 'hard'
  | 'boss'

export type DoorStatus = 'locked' | 'guarded' | 'weak_spot' | 'backdoor'

export type FileTag =
  | 'clue'
  | 'lore'
  | 'objective'
  | 'sensitive'
  | 'trap'
  | 'log'

export type HackingToolId =
  | 'scan'
  | 'deep_scan'
  | 'bruteforce'
  | 'clean_logs'
  | 'backdoor_install'

export interface DoorUnlockCondition {
  type:
    | 'always_open'
    | 'after_file_read'
    | 'after_door_used'
    | 'after_command_used'
    | 'trace_below'
  data: Record<string, any>
}

export interface QuestSystemDoor {
  id: string
  name: string
  port: number
  status: DoorStatus
  description?: string
  unlockCondition?: DoorUnlockCondition
}

export interface QuestSystemFilesystemNode {
  id: string
  name: string
  type: 'folder' | 'file'
  children?: QuestSystemFilesystemNode[]
  content?: string
  tags?: FileTag[]
  logOptions?: {
    recordFailedLogins?: boolean
    recordSuccessfulLogins?: boolean
    recordFileDeletions?: boolean
  }
}

export interface QuestSystemSecurityRules {
  maxTrace: number
  nervousThreshold: number
  panicThreshold: number
  nervousEffect: 'tighten_doors' | 'kick_user' | 'log_only'
  panicEffect: 'kick_user' | 'lockout' | 'log_only'
  actionTraceCosts: {
    scan?: number
    deepScan?: number
    bruteforce?: number
    deleteSensitiveFile?: number
    openTrapFile?: number
  }
}

export interface QuestSystemDefinition {
  id: string
  label: string
  ip: string
  difficulty: SystemDifficulty
  personalityBlurb?: string
  doors: QuestSystemDoor[]
  filesystemRoot: QuestSystemFilesystemNode
  securityRules?: QuestSystemSecurityRules
  templateId?: string | null
}

export interface QuestRequirements {
  requiredTools?: HackingToolId[]
}

export interface BonusObjective {
  id: string
  description: string
  type:
    | 'keep_trace_below'
    | 'dont_delete_file'
    | 'exfiltrate_file'
    | 'dont_trigger_trap'
    | 'clean_logs'
  params: Record<string, any>
  rewardDescription?: string
}

export interface MailTemplateFields {
  from?: string
  subject: string
  body: string
  preheader?: string
}

export interface CompletionEmailVariantCondition {
  type: 'trace_below' | 'bonus_objective_completed' | 'trap_triggered'
  data: Record<string, any>
}

export interface CompletionEmailVariant extends MailTemplateFields {
  id: string
  conditions: CompletionEmailVariantCondition[]
}

export interface QuestCompletionEmailConfig {
  default: MailTemplateFields
  variants?: CompletionEmailVariant[]
}

export interface QuestIntroEmailConfig extends MailTemplateFields {}

export interface QuestStepDefinition {
  id: string
  type: string
  description?: string
  params?: Record<string, any>
}

export interface QuestDefinition {
  id: string
  title: string
  shortDescription: string
  recommendedOrder?: number
  difficulty: SystemDifficulty
  system?: QuestSystemDefinition
  requirements?: QuestRequirements
  bonusObjectives?: BonusObjective[]
  introEmail?: QuestIntroEmailConfig
  completionEmail?: QuestCompletionEmailConfig
  steps: QuestStepDefinition[]
}
