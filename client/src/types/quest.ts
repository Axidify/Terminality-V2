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

export interface QuestRewardFlag {
  key: string
  value?: string
}

export type QuestType = 'data_theft' | 'sabotage' | 'recon' | 'cleanup' | 'misdirection'

export interface QuestRiskProfile {
  maxRecommendedTrace?: number
  failAboveTrace?: number
  requiredTraceSpike?: number
  cleanupBeforeDisconnect?: boolean
}

export interface QuestRequirements {
  requiredTools?: HackingToolId[]
  requiredFlags?: QuestRewardFlag[]
  blockedByFlags?: QuestRewardFlag[]
}

export interface QuestReconDiscoveryTarget {
  hostId: string
  rangeHint?: string
}

export interface QuestReconRequirements {
  enabled?: boolean
  mustUseScan?: boolean
  discoveryTargets?: QuestReconDiscoveryTarget[]
  allowedRanges?: string[]
  forbiddenRanges?: string[]
  maxReconTracePercent?: number
}

export type BonusObjectiveCategory = 'stealth' | 'optional' | 'cleanup'

export type BonusObjectiveType =
  | 'keep_trace_below'
  | 'avoid_trace_spike'
  | 'dont_delete_file'
  | 'exfiltrate_file'
  | 'dont_trigger_trap'
  | 'clean_logs'
  | 'sanitize_logs'
  | 'delete_logs'
  | 'retrieve_files'

export interface BonusObjective {
  id: string
  title?: string
  description: string
  category?: BonusObjectiveCategory
  type: BonusObjectiveType
  params: Record<string, any>
  rewardDescription?: string
}

export interface MailTemplateFields {
  from?: string
  subject: string
  body: string
  preheader?: string
}

export type CompletionEmailConditionType =
  | 'trace_below'
  | 'trace_between'
  | 'bonus_objective_completed'
  | 'trap_triggered'
  | 'quest_outcome'
  | 'world_flag'

export interface CompletionEmailVariantCondition {
  type: CompletionEmailConditionType
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

export interface QuestRewardsBlock {
  credits?: number
  flags?: QuestRewardFlag[]
  unlocks_commands?: string[]
  tools?: string[]
  access?: string[]
  reputation?: Record<string, number>
}

export interface QuestRewardsMatrix {
  success?: QuestRewardsBlock
  stealth?: QuestRewardsBlock
  failure?: QuestRewardsBlock
  default?: QuestRewardsBlock
}

export interface QuestBranchOutcome {
  followUpQuestId?: string
  setFlags?: QuestRewardFlag[]
  requireFlags?: QuestRewardFlag[]
  emailVariantId?: string
  notes?: string
}

export interface QuestBranchingConfig {
  success?: QuestBranchOutcome
  stealth?: QuestBranchOutcome
  failure?: QuestBranchOutcome
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
  questType?: QuestType
  riskProfile?: QuestRiskProfile
  system?: QuestSystemDefinition
  reconRequirements?: QuestReconRequirements
  requirements?: QuestRequirements
  bonusObjectives?: BonusObjective[]
  introEmail?: QuestIntroEmailConfig
  completionEmail?: QuestCompletionEmailConfig
  rewards?: QuestRewardsMatrix
  branching?: QuestBranchingConfig
  steps: QuestStepDefinition[]
}
