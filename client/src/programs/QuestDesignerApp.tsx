import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import './QuestDesignerApp.css'

import { FilesystemOverrideEditor } from './filesystem/FilesystemOverrideEditor'
import { cloneFilesystemMap } from './filesystemUtils'
import {
  buildMailList,
  hydrateMailState,
  ensureMailDelivered,
  setMailDefinitions as primeMailDefinitions
} from './mailSystem'
import { applyQuestOrderFromStorage, DesignerQuest, reorderQuestSequence } from './questOrdering'
import { signalSessionActivity } from '../os/SessionActivityContext'
import { useToasts } from '../os/ToastContext'
import { useUser } from '../os/UserContext'
import { listQuestTags, saveQuestTag } from '../services/questTags'
import { getCachedDesktop, hydrateFromServer } from '../services/saveService'
import {
  listAdminTerminalMail,
  createTerminalMail,
  updateTerminalMail,
  deleteTerminalMail,
  validateTerminalMail
} from '../services/terminalMail'
import {
  listTerminalQuests,
  createTerminalQuest,
  updateTerminalQuest,
  deleteTerminalQuest,
  validateTerminalQuest
} from '../services/terminalQuests'
import { profilesToDefinitions } from '../systemDefinitions/adapters'
import { createSystemFilesystemLayout } from '../systemDefinitions/filesystemLayout'
import { resolveSystemsForContext } from '../systemDefinitions/resolvers'
import {
  deleteSystemDefinition,
  listSystemDefinitions,
  saveSystemDefinition,
  type SystemDefinitionsResponse
} from '../systemDefinitions/service'

import type { FilesystemMap } from './filesystemUtils'
import type { MailMessageDefinition, MailFolder, MailCategory, SerializedMailState, MailListEntry } from './mailSystem'
import type { SerializedQuestState } from './questSystem'
import type {
  QuestDefinition,
  QuestLifecycleStatus,
  QuestMailConfig,
  QuestRewardFlag,
  QuestIntroDeliveryCondition,
  QuestIntroMailDelivery,
  QuestIntroStartBehavior,
  QuestStep,
  QuestStepParamsBase,
  QuestStepType,
  QuestTrigger,
  QuestTriggerType
} from './terminalQuests/types'
import type { SystemProfileDTO, SystemTemplateDTO } from '../services/systemProfiles'
import type { ResolutionContext, SystemDefinition, SystemScope, SystemType } from '../systemDefinitions/types'

interface TagInputProps {
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  suggestions?: string[]
  ariaLabel?: string
  onValueAdded?: (value: string) => Promise<void> | void
}

const DEFAULT_TRIGGER: QuestTriggerType = 'ON_FIRST_TERMINAL_OPEN'
const TRIGGER_OPTIONS: Array<{ value: QuestTriggerType; label: string }> = [
  { value: 'ON_FIRST_TERMINAL_OPEN', label: 'On First Terminal Open' },
  { value: 'ON_QUEST_COMPLETION', label: 'On Quest Completion' },
  { value: 'ON_FLAG_SET', label: 'On Flag Set' }
]

type StatusFilterValue = 'all' | QuestLifecycleStatus

const DEFAULT_LIFECYCLE_STATUS: QuestLifecycleStatus = 'not_started'

const STATUS_LABELS: Record<QuestLifecycleStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'Active',
  completed: 'Completed'
}

const STATUS_FILTERS: Array<{ value: StatusFilterValue; label: string; lifecycle?: QuestLifecycleStatus }> = [
  { value: 'all', label: 'All' },
  { value: 'in_progress', label: 'Active', lifecycle: 'in_progress' },
  { value: 'completed', label: 'Completed', lifecycle: 'completed' },
  { value: 'not_started', label: 'Not Started', lifecycle: 'not_started' }
]

const SYSTEM_TYPE_LABELS: Record<SystemType, string> = {
  terminal_host: 'Terminal Hosts',
  filesystem: 'Filesystems',
  tool: 'Tool Bindings',
  composite: 'Composites',
  one_off: 'One-off'
}

const SCOPE_LABELS: Record<SystemScope, string> = {
  global: 'Global',
  quest_template: 'Quest Template',
  quest_instance: 'Quest Instance'
}

const SYSTEM_WIZARD_STEP_DETAILS: Record<SystemWizardStep, { title: string; description: string }> = {
  type: {
    title: 'System Basics',
    description: 'Choose the type, scope, and identifiers for this system.'
  },
  source: {
    title: 'Source & Templates',
    description: 'Extend an existing global system or scaffold from a filesystem template.'
  },
  configure: {
    title: 'Configuration',
    description: 'Finalize credentials, network bindings, and optional tool integrations.'
  }
}

const SYSTEM_SCOPE_OPTIONS: Array<{ value: SystemScope; label: string }> = [
  { value: 'global', label: SCOPE_LABELS.global },
  { value: 'quest_template', label: SCOPE_LABELS.quest_template },
  { value: 'quest_instance', label: SCOPE_LABELS.quest_instance }
]

const SYSTEM_WIZARD_STEPS: SystemWizardStep[] = ['type', 'source', 'configure']

const QUEST_ORDER_STORAGE_KEY = 'terminality:quest-order'

const sanitizeSystemId = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const FIELD_HINTS = {
  questId: 'Unique quest identifier referenced by automation and saves; keep stable once published.',
  questTitle: 'Player-facing title that appears in the terminal quest list.',
  questStatus: 'Draft quests stay internal; published quests sync to players.',
  questStatusFilter: 'Filters rely on the most recent player desktop snapshot; refresh after testing quests to see updated lifecycle states.',
  triggerType: 'Determines when this quest activates (first terminal, quest completion, or flag).',
  completionQuests: 'Select quests whose completion automatically fires this quest trigger.',
  triggerFlagKey: 'Flag key watched for ON_FLAG_SET triggers.',
  triggerFlagValue: 'Optional flag value to match; leave blank to match any value.',
  questSummary: 'Short blurb surfaced in quest listings and search.',
  designerNotes: 'Internal-only notes for other designers and operators.',
  questDifficulty: 'Signals relative complexity for future balancing and analytics.',
  questFaction: 'Faction or category label surfaced in player UI and reporting.',
  questTags: 'Keywords to help search, filters, and automation scripts.',
  defaultSystem: 'System profile applied to steps without their own target.',
  description: 'Briefing text shown to the player.',
  requiredQuests: 'Prerequisite quests that must be done before this one unlocks.',
  requiredFlags: 'Flag tokens (key or key=value) required before unlocking.',
  creditsReward: 'Credits granted immediately upon completion.',
  rewardFlags: 'Structured completion flags emitted when the quest ends.',
  rewardFlagKey: 'Flag key stored in player state upon completion.',
  rewardFlagValue: 'Optional value stored alongside the flag key.',
  unlockCommands: 'Terminal commands unlocked for the player after this quest.',
  completionFlag: 'Unique lifecycle flag automatically set when this quest completes; use it for dependencies and analytics.',
  stepId: 'Internal identifier for the step (used in logs/debugging).',
  stepType: 'Player action needed to progress this step.',
  stepTargetSystem: 'Override system target for this step; falls back to quest default.',
  stepAutoAdvance: 'Automatically advance when the action succeeds.',
  stepTargetIp: 'Host/IP the player interacts with for this step.',
  stepFilePath: 'Remote path required for DELETE_FILE steps.',
  stepHintPrompt: 'Hint text surfaced when the player requests help.',
  stepCommandExample: 'Optional concrete command example shown with the hint.'
} as const

const MAIL_FOLDER_OPTIONS: MailFolder[] = ['inbox', 'news', 'spam', 'archive']
const MAIL_CATEGORY_OPTIONS: MailCategory[] = ['main', 'side', 'lore', 'spam']
const MAIL_STATUS_OPTIONS: Array<'draft' | 'published'> = ['draft', 'published']

interface WizardIntroMailDraft {
  id: string
  fromName: string
  fromAddress: string
  subject: string
  previewLine: string
  body: string
  inUniverseDate: string
  deliveryCondition: QuestIntroDeliveryCondition
  deliveryQuestId?: string
  deliveryFlagKey?: string
  deliveryFlagValue?: string
  startBehavior: QuestIntroStartBehavior
}

interface WizardCompletionMailDraft {
  id: string
  fromName: string
  fromAddress: string
  subject: string
  previewLine: string
  body: string
  inUniverseDate: string
}

interface WizardSystemTemplateDraft {
  stepIndex: number
  label: string
  systemId: string
  ip: string
  username: string
  startingPath: string
  footprint: string
}

const INTRO_MAIL_DELIVERY_OPTIONS: Array<{ value: QuestIntroDeliveryCondition; label: string; description: string }> = [
  { value: 'game_start', label: 'On game start / new save', description: 'Delivered to every operator mailbox when a new save or profile starts.' },
  { value: 'after_quest', label: 'After another quest completes', description: 'Delivered immediately after the selected quest resolves.' },
  { value: 'flag_set', label: 'When a specific flag is set', description: 'Delivered once the matching state flag is applied.' },
  { value: 'manual', label: 'Manual / script triggered', description: 'Designer is responsible for dispatching this mail via scripting or tooling.' }
]

const INTRO_MAIL_START_BEHAVIOR_OPTIONS: Array<{ value: QuestIntroStartBehavior; label: string; helper: string }> = [
  { value: 'startQuest', label: 'Start quest immediately', helper: 'Opening the email automatically accepts and activates the quest.' },
  { value: 'loreOnly', label: 'Show lore only', helper: 'Email is informational; players must accept the quest another way.' }
]

const QUEST_DIFFICULTY_OPTIONS = ['Easy', 'Normal', 'Hard']
const QUEST_CATEGORY_SUGGESTIONS = ['Atlas', 'Underground', 'Corporate', 'Civic', 'Freelance']
const QUEST_TAG_SUGGESTIONS = ['stealth', 'data theft', 'cleanup', 'ops', 'heist']

type QuestWizardStep = 'introEmail' | 'questCore' | 'questSteps' | 'filesystem' | 'completionEmail' | 'summary'

const QUEST_WIZARD_STEPS: QuestWizardStep[] = ['introEmail', 'questCore', 'questSteps', 'filesystem', 'completionEmail', 'summary']

const QUEST_WIZARD_STEP_DETAILS: Record<QuestWizardStep, { title: string; description: string }> = {
  introEmail: {
    title: 'Intro Email',
    description: 'Draft the in-universe briefing mail before players accept the quest.'
  },
  questCore: {
    title: 'Quest Details',
    description: 'Set the quest id, title, trigger, and default system context.'
  },
  questSteps: {
    title: 'Quest Steps',
    description: 'Outline the interactive steps players must complete.'
  },
  filesystem: {
    title: 'Filesystems',
    description: 'Design filesystem layouts for every system targeted in this quest.'
  },
  completionEmail: {
    title: 'Completion Email',
    description: 'Author the wrap-up mail that fires when the quest ends.'
  },
  summary: {
    title: 'Summary & Save',
    description: 'Review the generated quest package and save or publish it.'
  }
}

const createEmptyMailDraft = (): MailMessageDefinition & { status?: 'draft' | 'published' } => ({
  id: '',
  fromName: '',
  fromAddress: '',
  subject: '',
  previewLine: '',
  body: '',
  inUniverseDate: new Date().toISOString(),
  folder: 'inbox',
  isUnreadByDefault: true,
  linkedQuestId: null,
  emailCategory: 'lore',
  status: 'draft'
})

const defaultInUniverseTimestamp = () => {
  const iso = new Date().toISOString()
  return iso.slice(0, 16).replace('T', ' ')
}

const buildIntroMailId = (quest?: DesignerQuest | null) => {
  if (quest?.id?.trim()) {
    return `${quest.id.trim()}_intro_mail`
  }
  return `intro_mail_${Date.now()}`
}

const createWizardIntroMailDraft = (quest?: DesignerQuest | null, mail?: MailMessageDefinition | null): WizardIntroMailDraft => {
  const fallbackSubject = quest?.title ? `${quest.title} — Briefing` : 'New Operation'
  const delivery = quest?.introMailDelivery
  const startBehavior = quest?.introMailStartBehavior || 'startQuest'
  return {
    id: mail?.id || quest?.introEmailId || buildIntroMailId(quest),
    fromName: mail?.fromName || 'Atlas Ops',
    fromAddress: mail?.fromAddress || 'ops@atlasnet',
    subject: mail?.subject || fallbackSubject,
    previewLine: mail?.previewLine || '',
    body: mail?.body || '',
    inUniverseDate: mail?.inUniverseDate || defaultInUniverseTimestamp(),
    deliveryCondition: delivery?.condition || 'game_start',
    deliveryQuestId: delivery?.questId,
    deliveryFlagKey: delivery?.flagKey,
    deliveryFlagValue: delivery?.flagValue,
    startBehavior
  }
}

const buildCompletionMailId = (quest?: DesignerQuest | null) => {
  if (quest?.id?.trim()) {
    return `${quest.id.trim()}_completion_mail`
  }
  return `completion_mail_${Date.now()}`
}

const createWizardCompletionMailDraft = (quest?: DesignerQuest | null, mail?: MailMessageDefinition | null): WizardCompletionMailDraft => {
  const fallbackSubject = quest?.title ? `${quest.title} — Debrief` : 'Mission Complete'
  return {
    id: mail?.id || quest?.completionEmailId || buildCompletionMailId(quest),
    fromName: mail?.fromName || 'Atlas Ops',
    fromAddress: mail?.fromAddress || 'ops@atlasnet',
    subject: mail?.subject || fallbackSubject,
    previewLine: mail?.previewLine || '',
    body: mail?.body || '',
    inUniverseDate: mail?.inUniverseDate || defaultInUniverseTimestamp()
  }
}

const COMPLETION_PLACEHOLDER_HINTS = [
  { token: '{reward_credits}', helper: 'Displays the credits reward amount.' },
  { token: '{reward_flag_list}', helper: 'Lists reward flags (key/value).' },
  { token: '{reward_unlocks}', helper: 'Lists unlocked commands/items.' },
  { token: '{player_handle}', helper: 'Player call sign or handle.' },
  { token: '{quest_title}', helper: 'Current quest title.' },
  { token: '{next_quest_title}', helper: 'Follow-up quest title if selected.' }
]

const SAMPLE_PLAYER_HANDLE = 'Operator'

const renderCompletionMailPreview = (body: string, quest: DesignerQuest | null, followUp: DesignerQuest | undefined): string => {
  if (!body) return ''
  const flagList = quest?.rewards?.flags?.map(flag => (flag.value ? `${flag.key}=${flag.value}` : flag.key)).filter(Boolean).join(', ') || 'flag tokens pending'
  const unlockList = quest?.rewards?.unlocks_commands?.join(', ') || 'systems access'
  const replacements: Record<string, string> = {
    reward_credits: quest?.rewards?.credits != null ? `${quest.rewards.credits}` : '0',
    reward_flag_list: flagList,
    reward_unlocks: unlockList,
    player_handle: SAMPLE_PLAYER_HANDLE,
    quest_title: quest?.title || quest?.id || 'this operation',
    next_quest_title: followUp?.title || followUp?.id || 'your next lead'
  }
  return body.replace(/\{([^}]+)\}/g, (_, token) => {
    const key = token.trim()
    return replacements[key] ?? `{${key}}`
  })
}

const StatusIcon: React.FC<{ status: StatusFilterValue }> = ({ status }) => {
  switch (status) {
    case 'in_progress':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" opacity="0.3" />
          <path d="M12 3a9 9 0 0 1 9 9" strokeWidth="2.5">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 12 12"
              to="360 12 12"
              dur="2s"
              repeatCount="indefinite"
            />
          </path>
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
      )
    case 'completed':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" opacity="0.3" />
          <path d="M7 13l3 3 7-7" />
        </svg>
      )
    case 'not_started':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" opacity="0.3" />
          <circle cx="12" cy="12" r="4" strokeWidth="2.5" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
      )
    case 'all':
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" opacity="0.3" />
          <line x1="8" y1="9" x2="16" y2="9" strokeWidth="2.5" />
          <line x1="8" y1="12" x2="16" y2="12" strokeWidth="2.5" />
          <line x1="8" y1="15" x2="13" y2="15" strokeWidth="2.5" />
        </svg>
      )
  }
}

type Operation = QuestDefinition
type OperationTrigger = QuestTrigger
type OperationTriggerType = QuestTriggerType
type OperationStep = QuestStep
type StepType = QuestStepType

const sanitizeRewardFlagEntry = (entry?: QuestRewardFlag | string | null): QuestRewardFlag | null => {
  if (!entry) return null
  if (typeof entry === 'string') {
    const raw = entry.trim()
    if (!raw) return null
    const idx = raw.search(/[:=]/)
    if (idx > 0) {
      const key = raw.slice(0, idx).trim()
      const value = raw.slice(idx + 1).trim()
      if (!key) return null
      return value ? { key, value } : { key }
    }
    return { key: raw }
  }
  const key = entry.key?.trim()
  if (!key) return null
  const rawValue = entry.value != null ? String(entry.value).trim() : ''
  return rawValue ? { key, value: rawValue } : { key }
}

const sanitizeStringList = (entries?: string[] | null): string[] => {
  if (!entries || !entries.length) return []
  const seen = new Set<string>()
  const normalized: string[] = []
  entries.forEach(entry => {
    const token = entry?.trim()
    if (!token || seen.has(token)) return
    seen.add(token)
    normalized.push(token)
  })
  return normalized
}

const sanitizeRewardFlags = (flags?: Array<QuestRewardFlag | string>): QuestRewardFlag[] => {
  if (!flags?.length) return []
  const seen = new Set<string>()
  const normalized: QuestRewardFlag[] = []
  flags.forEach(entry => {
    const flag = sanitizeRewardFlagEntry(entry)
    if (!flag) return
    const signature = flag.value ? `${flag.key}=${flag.value}` : flag.key
    if (seen.has(signature)) return
    seen.add(signature)
    normalized.push(flag)
  })
  return normalized.slice(0, 25)
}

const sanitizeMailIds = (ids?: string[], limit = 50): string[] => {
  if (!ids?.length) return []
  const seen = new Set<string>()
  const normalized: string[] = []
  ids.forEach(id => {
    const trimmed = id?.trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    normalized.push(trimmed)
  })
  return normalized.slice(0, limit)
}

const sanitizeMailPreviewState = (state?: SerializedMailState | null): SerializedMailState | undefined => {
  if (!state) return undefined
  const deliveredIds = sanitizeMailIds(state.deliveredIds, 200)
  const readIds = sanitizeMailIds(state.readIds, 200)
  const archivedIds = sanitizeMailIds(state.archivedIds, 200)
  const deletedIds = sanitizeMailIds(state.deletedIds, 200)
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

const normalizeQuestMailConfig = (mail?: QuestMailConfig | null): QuestMailConfig | undefined => {
  if (!mail) return undefined
  const briefingMailId = mail.briefingMailId?.trim() || undefined
  const completionMailId = mail.completionMailId?.trim() || undefined
  const autoDeliverOnAccept = sanitizeMailIds(mail.autoDeliverOnAccept)
  const autoDeliverOnComplete = sanitizeMailIds(mail.autoDeliverOnComplete)
  const previewState = sanitizeMailPreviewState(mail.previewState)
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

const STEP_TYPES: StepType[] = ['SCAN_HOST', 'CONNECT_HOST', 'DELETE_FILE', 'DISCONNECT_HOST']
const STEP_TYPE_LABELS: Record<StepType, string> = {
  SCAN_HOST: 'Scan Host',
  CONNECT_HOST: 'Connect to Host',
  DELETE_FILE: 'Delete File',
  DISCONNECT_HOST: 'Disconnect'
}
interface StepTemplateStep {
  id: string
  type: StepType
  params?: QuestStepParamsBase
  description?: string
  commandExample?: string
}
interface QuestStepTemplate {
  id: string
  label: string
  description: string
  steps: StepTemplateStep[]
}

const DEFAULT_TEMPLATE_IP = '10.0.0.42'

const STEP_TEMPLATES: QuestStepTemplate[] = [
  {
    id: 'connect_delete_disconnect',
    label: 'Connect and purge a log',
    description: 'Scan the host, connect, delete a log file, then disconnect cleanly.',
    steps: [
      {
        id: 'scan_target',
        type: 'SCAN_HOST',
        params: { target_ip: DEFAULT_TEMPLATE_IP },
        description: 'Survey the relay for open services.',
        commandExample: 'scan 10.0.0.42'
      },
      {
        id: 'connect_cleanup',
        type: 'CONNECT_HOST',
        params: { target_ip: DEFAULT_TEMPLATE_IP },
        description: 'Establish a session on the compromised relay.',
        commandExample: 'connect 10.0.0.42'
      },
      {
        id: 'delete_log',
        type: 'DELETE_FILE',
        params: { target_ip: DEFAULT_TEMPLATE_IP, file_path: '/var/log/trace.log' },
        description: 'Navigate to /var/log and remove trace.log.',
        commandExample: 'cd /var/log && rm trace.log'
      },
      {
        id: 'disconnect_cleanup',
        type: 'DISCONNECT_HOST',
        params: { target_ip: DEFAULT_TEMPLATE_IP },
        description: 'Drop the session to avoid detection.',
        commandExample: 'disconnect'
      }
    ]
  },
  {
    id: 'scan_then_delete',
    label: 'Scan then wipe evidence',
    description: 'Quick two-step job: ping the box and immediately delete a file.',
    steps: [
      {
        id: 'scan_probe',
        type: 'SCAN_HOST',
        params: { target_ip: DEFAULT_TEMPLATE_IP },
        description: 'Confirm the host is online before acting.',
        commandExample: 'scan 10.0.0.42'
      },
      {
        id: 'delete_artifact',
        type: 'DELETE_FILE',
        params: { target_ip: DEFAULT_TEMPLATE_IP, file_path: '/home/ops/artifact.txt' },
        description: 'Remove the specified artifact file.',
        commandExample: 'rm /home/ops/artifact.txt'
      }
    ]
  },
  {
    id: 'connect_run_command',
    label: 'Connect and clear traces',
    description: 'Direct connect / disconnect sequence for light-touch jobs.',
    steps: [
      {
        id: 'connect_direct',
        type: 'CONNECT_HOST',
        params: { target_ip: DEFAULT_TEMPLATE_IP },
        description: 'Jack into the relay specified in intel.',
        commandExample: 'connect 10.0.0.42'
      },
      {
        id: 'delete_log_direct',
        type: 'DELETE_FILE',
        params: { target_ip: DEFAULT_TEMPLATE_IP, file_path: '/tmp/run.log' },
        description: 'Clear the temporary log file the operator left behind.',
        commandExample: 'rm /tmp/run.log'
      },
      {
        id: 'disconnect_direct',
        type: 'DISCONNECT_HOST',
        params: { target_ip: DEFAULT_TEMPLATE_IP },
        description: 'Exit immediately once complete.',
        commandExample: 'disconnect'
      }
    ]
  }
]

const instantiateStepTemplate = (template: QuestStepTemplate, questId: string, defaultSystemId?: string): OperationStep[] => {
  const slugBase = sanitizeSystemId(questId || 'quest') || 'quest'
  const stamp = Date.now().toString(36)
  return template.steps.map((entry, index) => ({
    id: `${slugBase}_${entry.id}_${index + 1}_${stamp}`,
    type: entry.type,
    params: {
      target_ip: DEFAULT_TEMPLATE_IP,
      ...entry.params
    },
    hints: entry.description || entry.commandExample
      ? {
        ...(entry.description ? { prompt: entry.description } : {}),
        ...(entry.commandExample ? { command_example: entry.commandExample } : {})
      }
      : undefined,
    auto_advance: true,
    target_system_id: defaultSystemId || undefined
  }))
}

const createBlankStep = (index: number): OperationStep => ({
  id: `step_${index + 1}`,
  type: 'SCAN_HOST',
  params: { target_ip: '' },
  auto_advance: true
})
const COMPLETION_STEP_TYPES = new Set<StepType>(STEP_TYPES)
type SystemWizardStep = 'type' | 'source' | 'configure'
type SystemWizardMode = 'create' | 'override'

type ToolBindingDraft = {
  id: string
  name: string
  command: string
}

type SystemWizardDraft = {
  id: string
  label: string
  type: SystemType
  scope: SystemScope
  extendsExisting: boolean
  baseSystemId?: string
  rootPath: string
  templateKey?: string
  username: string
  startingPath: string
  footprint: string
  ip: string
  description: string
  appliesTo?: ResolutionContext
  inheritNetwork: boolean
  inheritFilesystem: boolean
  toolBindings: ToolBindingDraft[]
}

const createSystemWizardDraft = (seed?: Partial<SystemWizardDraft>): SystemWizardDraft => ({
  id: '',
  label: '',
  type: 'filesystem',
  scope: 'global',
  extendsExisting: false,
  rootPath: '/',
  username: 'guest',
  startingPath: '/',
  footprint: '',
  ip: '',
  description: '',
  inheritNetwork: true,
  inheritFilesystem: true,
  toolBindings: [],
  ...seed
})

const upsertByLabel = <T extends { id: string; label: string }>(collection: T[], entry: T) => {
  const filtered = collection.filter(item => item.id !== entry.id)
  return [...filtered, entry].sort((a, b) => a.label.localeCompare(b.label))
}

const removeById = <T extends { id: string }>(collection: T[], targetId: string) => (
  collection.filter(item => item.id !== targetId)
)
const sanitizeTrigger = (raw?: OperationTrigger | null): OperationTrigger => {
  const type = raw?.type || DEFAULT_TRIGGER
  if (type === 'ON_QUEST_COMPLETION') {
    const quest_ids = Array.from(new Set((raw?.quest_ids || []).map(id => id.trim()).filter(Boolean)))
    return quest_ids.length ? { type, quest_ids } : { type }
  }
  if (type === 'ON_FLAG_SET') {
    const flag_key = raw?.flag_key?.trim() || ''
    const flag_value = raw?.flag_value?.trim()
    if (!flag_key) return { type }
    return flag_value ? { type, flag_key, flag_value } : { type, flag_key }
  }
  return { type }
}

type RelationshipEntry = {
  quest: DesignerQuest
  reason: string
}

const resolveCompletionFlagId = (quest: DesignerQuest): string => (
  quest.completion_flag?.trim() || `quest_completed_${quest.id}`
)

const matchesExpectedFlagValue = (actualValue?: string | null, expectedValue?: string | null): boolean => {
  const normalizedExpected = expectedValue?.trim()
  if (!normalizedExpected) return true
  const normalizedActual = (actualValue?.trim() || 'true')
  return normalizedActual === normalizedExpected
}

const questEmitsFlag = (quest: DesignerQuest, flagKey: string, expectedValue?: string | null): boolean => {
  const normalizedKey = flagKey?.trim()
  if (!normalizedKey) return false
  const completionFlagId = resolveCompletionFlagId(quest)
  if (completionFlagId === normalizedKey && matchesExpectedFlagValue('true', expectedValue)) {
    return true
  }
  const rewardFlags = sanitizeRewardFlags(quest.rewards?.flags)
  return rewardFlags.some(flag => (
    flag.key === normalizedKey && matchesExpectedFlagValue(flag.value || 'true', expectedValue)
  ))
}

const findFollowUpQuests = (quest: DesignerQuest, quests: DesignerQuest[]): DesignerQuest[] => {
  const completionFlagId = resolveCompletionFlagId(quest)
  return quests.filter(candidate => {
    if (candidate.id === quest.id) return false
    const trigger = candidate.trigger
    if (!trigger) return false
    if (trigger.type === 'ON_QUEST_COMPLETION') {
      return (trigger.quest_ids || []).some(id => id?.trim() === quest.id)
    }
    if (trigger.type === 'ON_FLAG_SET') {
      return trigger.flag_key?.trim() === completionFlagId
    }
    return false
  })
}

const gatherDesignerValidationIssues = (quest: DesignerQuest | null, quests: DesignerQuest[]) => {
  const errors: string[] = []
  const warnings: string[] = []
  if (!quest) {
    return { errors, warnings }
  }

  const knownQuestIds = new Set(quests.map(entry => entry.id))
  const steps = quest.steps || []
  if (!steps.length) {
    warnings.push('Warning: Quest has no steps, so it will never complete.')
  } else {
    const lastStep = steps[steps.length - 1]
    if (!COMPLETION_STEP_TYPES.has(lastStep.type)) {
      warnings.push(`Warning: Last step "${lastStep.id || lastStep.type}" uses unsupported type "${lastStep.type}", so completion will never fire.`)
    }
  }

  if (steps.length > 0 && !(quest.completion_flag && quest.completion_flag.trim())) {
    const followUps = findFollowUpQuests(quest, quests)
    if (!followUps.length) {
      warnings.push('Warning: Quest has steps but no completion flag or follow-up quests; it may be a dead end.')
    }
  }

  const trigger = quest.trigger || { type: DEFAULT_TRIGGER }
  if (trigger.type === 'ON_QUEST_COMPLETION') {
    const questIds = trigger.quest_ids || []
    questIds.forEach((questId, index) => {
      const trimmed = questId?.trim()
      if (!trimmed) return
      if (trimmed === quest.id) {
        warnings.push(`Warning: Trigger quest_ids[${index}] references this quest (${quest.id}); self dependency detected.`)
      }
      if (!knownQuestIds.has(trimmed)) {
        errors.push(`Error: Trigger quest_ids[${index}] references unknown quest "${trimmed}".`)
      }
    })
  } else if (trigger.type === 'ON_FLAG_SET') {
    const flagKey = trigger.flag_key?.trim()
    if (flagKey) {
      const flagProvided = quests.some(candidate => questEmitsFlag(candidate, flagKey, trigger.flag_value))
      if (!flagProvided) {
        warnings.push(`Warning: Trigger flag "${flagKey}" is never granted by any quest.`)
      }
    }
  }

  return { errors, warnings }
}

const createEmptyQuest = (): DesignerQuest => ({
  id: `quest_${Date.now()}`,
  title: 'Untitled Quest',
  description: 'Describe this operation.',
  summary: '',
  designerNotes: '',
  difficulty: '',
  faction: '',
  tags: [],
  trigger: sanitizeTrigger({ type: DEFAULT_TRIGGER }),
  steps: [],
  rewards: { credits: 0, flags: [], unlocks_commands: [] },
  requirements: { required_flags: [], required_quests: [] },
  default_system_id: undefined,
  embedded_filesystems: {},
  completion_flag: undefined,
  status: 'draft',
  mail: undefined,
  introEmailId: undefined,
  introMailDelivery: undefined,
  introMailStartBehavior: 'startQuest',
  followUpQuestId: undefined,
  completionEmailId: undefined,
  __unsaved: true
})

const normalizeQuest = (quest: Operation | DesignerQuest): DesignerQuest => ({
  ...(quest as DesignerQuest),
  steps: quest.steps.map(step => ({
    ...step,
    params: step.params || {},
    auto_advance: step.auto_advance !== false
  })),
  rewards: {
    credits: quest.rewards?.credits ?? 0,
    flags: sanitizeRewardFlags(quest.rewards?.flags),
    unlocks_commands: quest.rewards?.unlocks_commands || []
  },
  requirements: {
    required_flags: quest.requirements?.required_flags || [],
    required_quests: quest.requirements?.required_quests || []
  },
  trigger: sanitizeTrigger(quest.trigger),
  default_system_id: quest.default_system_id,
  embedded_filesystems: quest.embedded_filesystems || {},
  completion_flag: quest.completion_flag?.trim() || undefined,
  status: quest.status === 'published' ? 'published' : 'draft',
  mail: normalizeQuestMailConfig(quest.mail),
  summary: quest.summary || '',
  designerNotes: quest.designerNotes || '',
  difficulty: quest.difficulty || '',
  faction: quest.faction || '',
  tags: sanitizeStringList((quest as DesignerQuest).tags || []),
  introEmailId: quest.introEmailId?.trim() || undefined,
  introMailDelivery: quest.introMailDelivery ? { ...quest.introMailDelivery } as QuestIntroMailDelivery : undefined,
  introMailStartBehavior: quest.introMailStartBehavior || 'startQuest',
  followUpQuestId: quest.followUpQuestId?.trim() || undefined,
  completionEmailId: quest.completionEmailId?.trim() || undefined,
  __unsaved: (quest as DesignerQuest).__unsaved
})

const questToPayload = (quest: DesignerQuest): Operation => {
  const mail = normalizeQuestMailConfig(quest.mail)
  return {
    id: quest.id.trim(),
    title: quest.title,
    description: quest.description,
    summary: quest.summary?.trim() || undefined,
    designerNotes: quest.designerNotes?.trim() || undefined,
    difficulty: quest.difficulty?.trim() || undefined,
    faction: quest.faction?.trim() || undefined,
    tags: sanitizeStringList(quest.tags),
    trigger: sanitizeTrigger(quest.trigger),
    steps: quest.steps.map(step => ({
      ...step,
      params: step.params || {},
      hints: step.hints && {
        prompt: step.hints.prompt || undefined,
        command_example: step.hints.command_example || undefined
      }
    })),
    rewards: {
      credits: quest.rewards?.credits,
      flags: sanitizeRewardFlags(quest.rewards?.flags),
      unlocks_commands: quest.rewards?.unlocks_commands || []
    },
    requirements: {
      required_flags: quest.requirements?.required_flags || [],
      required_quests: quest.requirements?.required_quests || []
    },
    default_system_id: quest.default_system_id,
    embedded_filesystems: quest.embedded_filesystems,
    completion_flag: quest.completion_flag?.trim() || undefined,
    status: quest.status === 'published' ? 'published' : 'draft',
    introEmailId: quest.introEmailId?.trim() || undefined,
    introMailDelivery: quest.introMailDelivery,
    introMailStartBehavior: quest.introMailStartBehavior,
    followUpQuestId: quest.followUpQuestId?.trim() || undefined,
    completionEmailId: quest.completionEmailId?.trim() || undefined,
    ...(mail ? { mail } : {})
  }
}
  
const useTagInput = ({ values, onChange, suggestions, placeholder, ariaLabel, onValueAdded }: TagInputProps) => {
  const [input, setInput] = useState('')
  const listId = useId()

  const addValue = useCallback(async (raw: string) => {
    const value = raw.trim()
    if (!value) return false
    if (values.includes(value)) {
      setInput('')
      return false
    }
    onChange([...values, value])
    setInput('')
    if (onValueAdded) {
      try {
        await onValueAdded(value)
      } catch (err) {
        console.error('[quest designer] failed to persist tag value', err)
      }
    }
    return true
  }, [onChange, onValueAdded, values])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === 'Tab' || event.key === ',') {
      event.preventDefault()
      void addValue(input)
    } else if (event.key === 'Backspace' && !input) {
      onChange(values.slice(0, -1))
    }
  }

  const removeValue = (value: string) => {
    onChange(values.filter(entry => entry !== value))
  }

  const Input = (
    <div className="tag-input">
      <div className="tag-chips">
        {values.map(value => (
          <span key={value} className="tag-chip">
            {value}
            <button type="button" onClick={() => removeValue(value)} aria-label={`Remove ${value}`}>
              ✕
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={e => { void addValue(e.target.value) }}
          placeholder={placeholder}
          aria-label={ariaLabel}
          list={suggestions && suggestions.length ? listId : undefined}
        />
      </div>
      {suggestions && suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map(option => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </div>
  )

  return { Input }
}

const StepCard: React.FC<{ 
  step: OperationStep
  index: number
  total: number
  onChange: (next: OperationStep) => void
  onMove: (dir: -1 | 1) => void
  onDuplicate: () => void
  onDelete: () => void
  systemOptions: Array<{ id: string; label: string }>
  defaultSystemId?: string | null
}> = ({ step, index, total, onChange, onMove, onDuplicate, onDelete, systemOptions, defaultSystemId }) => {
  const updateStep = (patch: Partial<OperationStep>) => {
    onChange({ ...step, ...patch })
  }

  const updateParams = (key: string, value: string) => {
    onChange({ ...step, params: { ...step.params, [key]: value } })
  }

  return (
    <div className="step-card">
      <div className="step-card-header">
        <div>
          <span className="muted">Step {index + 1}</span>
          <strong>{step.id}</strong>
          <span className="step-type">{step.type}</span>
        </div>
        <div className="step-card-actions">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} title="Move up">↑</button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} title="Move down">↓</button>
          <button type="button" onClick={onDuplicate} title="Duplicate step">⧉</button>
          <button type="button" onClick={onDelete} title="Delete step">🗑</button>
        </div>
      </div>
      <div className="step-grid">
        <label data-tooltip={FIELD_HINTS.stepId}>
          Step ID
          <input value={step.id} onChange={e => updateStep({ id: e.target.value })} />
        </label>
        <label data-tooltip={FIELD_HINTS.stepType}>
          Step Type
          <select value={step.type} onChange={e => updateStep({ type: e.target.value as StepType })}>
            {STEP_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>
        <label data-tooltip={FIELD_HINTS.stepTargetSystem}>
          Target System
          <select
            value={step.target_system_id || ''}
            onChange={e => updateStep({ target_system_id: e.target.value || undefined })}
          >
            <option value="">Quest Default {defaultSystemId ? `(${defaultSystemId})` : ''}</option>
            {systemOptions.map(option => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        <label data-tooltip={FIELD_HINTS.stepAutoAdvance}>
          Auto Advance
          <input
            type="checkbox"
            checked={step.auto_advance !== false}
            onChange={e => updateStep({ auto_advance: e.target.checked })}
          />
        </label>
      </div>
      <div className="step-grid">
        {(step.type === 'SCAN_HOST' || step.type === 'CONNECT_HOST' || step.type === 'DELETE_FILE' || step.type === 'DISCONNECT_HOST') && (
          <label data-tooltip={FIELD_HINTS.stepTargetIp}>
            Target IP
            <input value={step.params?.target_ip || ''} onChange={e => updateParams('target_ip', e.target.value)} />
          </label>
        )}
        {step.type === 'DELETE_FILE' && (
          <label data-tooltip={FIELD_HINTS.stepFilePath}>
            File Path
            <input value={step.params?.file_path || ''} onChange={e => updateParams('file_path', e.target.value)} />
          </label>
        )}
      </div>
      <div className="step-grid">
        <label data-tooltip={FIELD_HINTS.stepHintPrompt}>
          Hint Prompt
          <textarea value={step.hints?.prompt || ''} onChange={e => updateStep({ hints: { ...step.hints, prompt: e.target.value } })} />
        </label>
        <label data-tooltip={FIELD_HINTS.stepCommandExample}>
          Command Example
          <textarea value={step.hints?.command_example || ''} onChange={e => updateStep({ hints: { ...step.hints, command_example: e.target.value } })} />
        </label>
      </div>
    </div>
  )
}

const validateQuestDraft = (quest?: DesignerQuest, options?: { mailIds?: string[] }): string[] => {
  if (!quest) return ['Select or create a quest before saving.']
  const errors: string[] = []
  if (!quest.id.trim()) errors.push('Quest id is required.')
  if (!quest.title.trim()) errors.push('Quest title is required.')
  if (!quest.description.trim()) errors.push('Quest description is required.')
  if (!quest.steps.length) errors.push('Add at least one step.')
  const trigger = quest.trigger || { type: DEFAULT_TRIGGER }
  if (trigger.type === 'ON_QUEST_COMPLETION' && !(trigger.quest_ids && trigger.quest_ids.length)) {
    errors.push('Select a quest for the completion trigger.')
  }
  if (trigger.type === 'ON_FLAG_SET' && !trigger.flag_key) {
    errors.push('Select a flag for the flag-set trigger.')
  }
  quest.rewards?.flags?.forEach((flag, idx) => {
    if (!flag || !flag.key || !flag.key.trim()) {
      errors.push(`Reward flag ${idx + 1} requires a key.`)
    }
  })
  quest.steps.forEach((step, idx) => {
    if (!step.id.trim()) errors.push(`Step ${idx + 1} is missing an id.`)
    if (!STEP_TYPES.includes(step.type)) errors.push(`Step ${step.id} has unsupported type.`)
    const needsTarget = step.type === 'SCAN_HOST' || step.type === 'CONNECT_HOST' || step.type === 'DISCONNECT_HOST' || step.type === 'DELETE_FILE'
    if (needsTarget && !step.params?.target_ip) {
      errors.push(`Step ${step.id} requires params.target_ip.`)
    }
    if (needsTarget && !(step.target_system_id || quest.default_system_id)) {
      errors.push(`Step ${step.id} requires a system profile (assign a default system or set it per-step).`)
    }
    if (step.type === 'DELETE_FILE' && !step.params?.file_path) {
      errors.push(`DELETE_FILE step ${step.id} requires params.file_path.`)
    }
  })

  if (options?.mailIds?.length) {
    const mailIdSet = new Set(options.mailIds)
    const verifyMailLink = (id?: string | null, label?: string) => {
      if (!id) return
      if (!mailIdSet.has(id)) {
        errors.push(`${label || 'Mail id'} "${id}" does not exist in the mail library.`)
      }
    }
    verifyMailLink(quest.mail?.briefingMailId, 'Briefing mail')
    verifyMailLink(quest.mail?.completionMailId, 'Completion mail')
    quest.mail?.autoDeliverOnAccept?.forEach(id => verifyMailLink(id, 'Auto-deliver on accept id'))
    quest.mail?.autoDeliverOnComplete?.forEach(id => verifyMailLink(id, 'Auto-deliver on complete id'))
    quest.mail?.previewState?.deliveredIds?.forEach(id => verifyMailLink(id, 'Preview delivered id'))
    quest.mail?.previewState?.readIds?.forEach(id => verifyMailLink(id, 'Preview read id'))
    quest.mail?.previewState?.archivedIds?.forEach(id => verifyMailLink(id, 'Preview archived id'))
    quest.mail?.previewState?.deletedIds?.forEach(id => verifyMailLink(id, 'Preview deleted id'))
  }
  return errors
}

export const QuestDesignerApp: React.FC = () => {
  const { isAdmin } = useUser()
  const { push: pushToast } = useToasts()
  const [quests, setQuests] = useState<DesignerQuest[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<DesignerQuest | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [validationMessages, setValidationMessages] = useState<string[]>([])
  const [validating, setValidating] = useState(false)
  const [search, setSearch] = useState('')
  const [systemProfilesState, setSystemProfilesState] = useState<SystemProfileDTO[]>([])
  const [systemTemplates, setSystemTemplates] = useState<SystemTemplateDTO[]>([])
  const [systemDefinitionsState, setSystemDefinitionsState] = useState<SystemDefinition[]>([])
  const [systemDefinitionTemplates, setSystemDefinitionTemplates] = useState<SystemDefinition[]>([])
  const [systemsLoading, setSystemsLoading] = useState(true)
  const [systemWizardOpen, setSystemWizardOpen] = useState(false)
  const [systemWizardStep, setSystemWizardStep] = useState<SystemWizardStep>('type')
  const [systemWizardMode, setSystemWizardMode] = useState<SystemWizardMode>('create')
  const [systemWizardDraft, setSystemWizardDraft] = useState<SystemWizardDraft>(createSystemWizardDraft())
  const [systemWizardError, setSystemWizardError] = useState<string | null>(null)
  const [systemWizardSaving, setSystemWizardSaving] = useState(false)
  const [playerQuestStatuses, setPlayerQuestStatuses] = useState<Record<string, QuestLifecycleStatus>>({})
  const [questStatusTimestamp, setQuestStatusTimestamp] = useState<string | null>(null)
  const [questStateLoading, setQuestStateLoading] = useState(false)
  const [questStatusError, setQuestStatusError] = useState<string | null>(null)
  const [questStatusFilter, setQuestStatusFilter] = useState<StatusFilterValue>('all')
  const [draggingQuestId, setDraggingQuestId] = useState<string | null>(null)
  const [dragOverQuestId, setDragOverQuestId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [unsavedDeletePromptOpen, setUnsavedDeletePromptOpen] = useState(false)
  const [deleteInProgress, setDeleteInProgress] = useState(false)
  const [mailDefinitions, setMailDefinitionsState] = useState<MailMessageDefinition[]>([])
  const [mailLoading, setMailLoading] = useState(true)
  const [mailError, setMailError] = useState<string | null>(null)
  const [mailSearch, setMailSearch] = useState('')
  const [mailSelectedId, setMailSelectedId] = useState<string | null>(null)
  const [mailDraft, setMailDraft] = useState<MailMessageDefinition & { status?: 'draft' | 'published' }>(createEmptyMailDraft())
  const [mailSaving, setMailSaving] = useState(false)
  const [mailPublishing, setMailPublishing] = useState(false)
  const [mailValidating, setMailValidating] = useState(false)

  const questResolutionContext = useMemo<ResolutionContext>(() => {
    if (!draft?.id) return {}
    return {
      questTemplateId: draft.id,
      questId: draft.id
    }
  }, [draft?.id])

  const resolvedSystemDefinitions = useMemo(
    () => resolveSystemsForContext(systemDefinitionsState, questResolutionContext),
    [systemDefinitionsState, questResolutionContext]
  )

  const systemIdsInUse = useMemo(() => {
    if (!draft) return []
    const ids = new Set<string>()
    if (draft.default_system_id) ids.add(draft.default_system_id)
    draft.steps.forEach(step => {
      if (step.target_system_id) ids.add(step.target_system_id)
    })
    Object.keys(draft.embedded_filesystems || {}).forEach(systemId => ids.add(systemId))
    return Array.from(ids)
  }, [draft])

  const questScopedOverrides = useMemo(() => {
    if (!draft?.id) return []
    return systemDefinitionsState.filter(definition => {
      if (definition.scope === 'global') return false
      if (!definition.appliesTo) return false
      const { questTemplateId, questId, questInstanceId } = definition.appliesTo
      return questTemplateId === draft.id || questId === draft.id || questInstanceId === draft.id
    })
  }, [draft?.id, systemDefinitionsState])

  const questOverridesByBaseId = useMemo(() => {
    const map = new Map<string, SystemDefinition>()
    questScopedOverrides.forEach(definition => {
      if (definition.extendsSystemId) {
        map.set(definition.extendsSystemId, definition)
      }
    })
    return map
  }, [questScopedOverrides])

  const questSystemSummaries = useMemo(() => {
    if (!systemIdsInUse.length) return []
    return systemIdsInUse.map(systemId => {
      const baseDefinition = systemDefinitionsState.find(entry => entry.id === systemId && entry.scope === 'global')
      const resolvedDefinition = resolvedSystemDefinitions.find(entry => entry.id === systemId)
      const fallbackProfile = systemProfilesState.find(entry => entry.id === systemId)
      const override = questOverridesByBaseId.get(systemId)
      const questFilesystem = draft?.embedded_filesystems?.[systemId]
      return {
        systemId,
        baseDefinition,
        resolvedDefinition,
        fallbackProfile,
        override,
        questFilesystem
      }
    })
  }, [draft?.embedded_filesystems, questOverridesByBaseId, resolvedSystemDefinitions, systemDefinitionsState, systemIdsInUse, systemProfilesState])
  const [mailValidationErrors, setMailValidationErrors] = useState<string[]>([])
  const [mailDeletingId, setMailDeletingId] = useState<string | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState<QuestWizardStep>(QUEST_WIZARD_STEPS[0])
  const [wizardIntroMailDraft, setWizardIntroMailDraft] = useState<WizardIntroMailDraft>(() => createWizardIntroMailDraft())
  const [wizardIntroMailErrors, setWizardIntroMailErrors] = useState<string[]>([])
  const [wizardQuestDetailsErrors, setWizardQuestDetailsErrors] = useState<string[]>([])
  const [wizardQuestStepsErrors, setWizardQuestStepsErrors] = useState<string[]>([])
  const [wizardCompletionMailDraft, setWizardCompletionMailDraft] = useState<WizardCompletionMailDraft>(() => createWizardCompletionMailDraft())
  const [wizardCompletionMailErrors, setWizardCompletionMailErrors] = useState<string[]>([])
  const [wizardFilesystemErrors, setWizardFilesystemErrors] = useState<string[]>([])
  const [wizardSummaryErrors, setWizardSummaryErrors] = useState<string[]>([])
  const [wizardFinishing, setWizardFinishing] = useState(false)
  const [wizardCancelConfirmOpen, setWizardCancelConfirmOpen] = useState(false)
  const [wizardSystemTemplateDraft, setWizardSystemTemplateDraft] = useState<WizardSystemTemplateDraft | null>(null)
  const [wizardSystemTemplateError, setWizardSystemTemplateError] = useState<string | null>(null)
  const [wizardSystemTemplateSaving, setWizardSystemTemplateSaving] = useState(false)
  const [questTagSuggestions, setQuestTagSuggestions] = useState<string[]>(QUEST_TAG_SUGGESTIONS)
  const flagKeyListId = useId()
  const rewardFlagKeyListId = useId()
  const wizardRewardFlagListId = useId()
  const introMailBehaviorIdPrefix = useId()
  const persistedIdRef = useRef<string | null>(null)
  const questOrderRef = useRef<string[]>([])
  const [questOrderHydrated, setQuestOrderHydrated] = useState(false)
  const tooltipNodeRef = useRef<HTMLDivElement | null>(null)
  const serverMailIdsRef = useRef<Set<string>>(new Set())
  const mailSnapshotRef = useRef<Record<string, string>>({})
  const wizardEntryQuestIdRef = useRef<string | null>(null)
  const wizardPreviousQuestIdRef = useRef<string | null>(null)
  const wizardCreatedQuestRef = useRef(false)
  const wizardBodyRef = useRef<HTMLDivElement | null>(null)
  const wizardAlertRef = useRef<HTMLDivElement | null>(null)
  const systemWizardBodyRef = useRef<HTMLDivElement | null>(null)
  const resetWizardEntryTracking = useCallback(() => {
    wizardEntryQuestIdRef.current = null
    wizardPreviousQuestIdRef.current = null
    wizardCreatedQuestRef.current = false
  }, [])

  const goToNextWizardStep = useCallback(() => {
    setWizardStep(prev => {
      const currentIndex = QUEST_WIZARD_STEPS.indexOf(prev)
      const nextIndex = Math.min(currentIndex + 1, QUEST_WIZARD_STEPS.length - 1)
      return QUEST_WIZARD_STEPS[nextIndex]
    })
  }, [])

  const goToPreviousWizardStep = useCallback(() => {
    setWizardStep(prev => {
      const currentIndex = QUEST_WIZARD_STEPS.indexOf(prev)
      const nextIndex = Math.max(currentIndex - 1, 0)
      return QUEST_WIZARD_STEPS[nextIndex]
    })
  }, [])

  const jumpToWizardStep = useCallback((step: QuestWizardStep) => {
    if (!QUEST_WIZARD_STEPS.includes(step)) return
    setWizardStep(step)
  }, [])

  const persistQuestOrder = useCallback((order: string[]) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(QUEST_ORDER_STORAGE_KEY, JSON.stringify(order))
    } catch (err) {
      console.warn('[quest designer] unable to persist quest order', err)
    }
  }, [])

  const syncQuestList = useCallback((updater: (prev: DesignerQuest[]) => DesignerQuest[]) => {
    setQuests(prev => {
      const next = updater(prev)
      if (next === prev) {
        return prev
      }
      questOrderRef.current = next.map(q => q.id)
      persistQuestOrder(questOrderRef.current)
      return next
    })
  }, [persistQuestOrder])

  const updateCurrentQuest = useCallback((updater: (prev: DesignerQuest) => DesignerQuest) => {
    setDraft(prev => (prev ? updater(prev) : prev))
  }, [setDraft])

  const [openFilesystemEditors, setOpenFilesystemEditors] = useState<string[]>([])

  useEffect(() => {
    setOpenFilesystemEditors(prev => {
      const filtered = prev.filter(id => systemIdsInUse.includes(id))
      return filtered.length === prev.length ? prev : filtered
    })
  }, [systemIdsInUse])

  const toggleFilesystemEditor = useCallback((systemId: string) => {
    if (!systemId) return
    setOpenFilesystemEditors(prev => (
      prev.includes(systemId)
        ? prev.filter(id => id !== systemId)
        : [...prev, systemId]
    ))
  }, [])

  const updateEmbeddedFilesystem = useCallback((systemId: string, map: FilesystemMap | null) => {
    if (!systemId) return
    updateCurrentQuest(prev => {
      if (!prev) return prev
      const currentEmbeds = prev.embedded_filesystems || {}
      if (!map) {
        if (!currentEmbeds[systemId]) return prev
        const nextEmbedded = { ...currentEmbeds }
        delete nextEmbedded[systemId]
        return { ...prev, embedded_filesystems: nextEmbedded }
      }
      const nextEmbedded = { ...currentEmbeds, [systemId]: cloneFilesystemMap(map) }
      return { ...prev, embedded_filesystems: nextEmbedded }
    })
  }, [updateCurrentQuest])

  const clearEmbeddedFilesystem = useCallback((systemId: string) => {
    if (!systemId) return
    const confirmed = typeof window === 'undefined' ? true : window.confirm('Remove this quest-specific filesystem layout?')
    if (!confirmed) return
    updateEmbeddedFilesystem(systemId, null)
    setOpenFilesystemEditors(prev => prev.filter(id => id !== systemId))
  }, [updateEmbeddedFilesystem])

  const updateQuestMailConfig = useCallback((patch: Partial<QuestMailConfig> | null) => {
    if (patch === null) {
      updateCurrentQuest(prev => {
        if (!prev?.mail) return prev
        const clone = { ...prev }
        delete clone.mail
        return clone
      })
      return
    }
    updateCurrentQuest(prev => {
      if (!prev) return prev
      return {
        ...prev,
        mail: { ...(prev.mail || {}), ...patch }
      }
    })
  }, [updateCurrentQuest])

  const updateMailPreviewField = useCallback((field: keyof SerializedMailState, values: string[]) => {
    updateCurrentQuest(prev => {
      if (!prev) return prev
      const nextMail = { ...(prev.mail || {}) }
      const nextPreview = { ...(nextMail.previewState || {}) }
      if (values.length) {
        nextPreview[field] = values
      } else {
        delete nextPreview[field]
      }
      if (Object.keys(nextPreview).length) {
        nextMail.previewState = nextPreview
      } else {
        delete nextMail.previewState
      }
      return { ...prev, mail: nextMail }
    })
  }, [updateCurrentQuest])

  const removeMailIdFromQuest = useCallback((mailId: string) => {
    if (!mailId) return
    updateCurrentQuest(prev => {
      if (!prev) return prev
      const next: DesignerQuest = { ...prev }
      let changed = false
      if (next.introEmailId === mailId) {
        next.introEmailId = undefined
        changed = true
      }
      if (next.completionEmailId === mailId) {
        next.completionEmailId = undefined
        changed = true
      }
      if (next.mail) {
        const nextMail: QuestMailConfig = { ...next.mail }
        let mailChanged = false
        if (nextMail.briefingMailId === mailId) {
          delete nextMail.briefingMailId
          mailChanged = true
        }
        if (nextMail.completionMailId === mailId) {
          delete nextMail.completionMailId
          mailChanged = true
        }
        if (nextMail.autoDeliverOnAccept?.length) {
          const filtered = nextMail.autoDeliverOnAccept.filter(id => id !== mailId)
          if (filtered.length !== nextMail.autoDeliverOnAccept.length) {
            nextMail.autoDeliverOnAccept = filtered
            mailChanged = true
          }
          if (!nextMail.autoDeliverOnAccept.length) delete nextMail.autoDeliverOnAccept
        }
        if (nextMail.autoDeliverOnComplete?.length) {
          const filtered = nextMail.autoDeliverOnComplete.filter(id => id !== mailId)
          if (filtered.length !== nextMail.autoDeliverOnComplete.length) {
            nextMail.autoDeliverOnComplete = filtered
            mailChanged = true
          }
          if (!nextMail.autoDeliverOnComplete.length) delete nextMail.autoDeliverOnComplete
        }
        if (nextMail.previewState) {
          const preview = { ...nextMail.previewState }
          const scrub = (key: keyof SerializedMailState) => {
            const list = preview[key]
            if (!Array.isArray(list) || !list.length) return
            const filtered = list.filter(id => id !== mailId)
            if (filtered.length !== list.length) {
              preview[key] = filtered
              mailChanged = true
            }
            if (!filtered.length) delete preview[key]
          }
          scrub('deliveredIds')
          scrub('readIds')
          scrub('archivedIds')
          scrub('deletedIds')
          if (Object.keys(preview).length) {
            nextMail.previewState = preview
          } else {
            delete nextMail.previewState
          }
        }
        if (mailChanged) {
          if (!nextMail.briefingMailId && !nextMail.completionMailId && !nextMail.autoDeliverOnAccept?.length && !nextMail.autoDeliverOnComplete?.length && !nextMail.previewState) {
            delete next.mail
          } else {
            next.mail = nextMail
          }
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [updateCurrentQuest])

  const cleanupWizardMailDrafts = useCallback((questId: string | null) => {
    if (!questId) return
    const stagedIds: string[] = []
    setMailDefinitionsState(prev => {
      const removable = prev.filter(mail => mail.linkedQuestId === questId && !serverMailIdsRef.current.has(mail.id))
      if (!removable.length) return prev
      stagedIds.push(...removable.map(mail => mail.id))
      return prev.filter(entry => !stagedIds.includes(entry.id))
    })
    if (!stagedIds.length) return
    stagedIds.forEach(id => {
      delete mailSnapshotRef.current[id]
      serverMailIdsRef.current.delete(id)
      removeMailIdFromQuest(id)
    })
  }, [removeMailIdFromQuest])

  const upsertMailDefinition = useCallback((message: MailMessageDefinition) => {
    setMailDefinitionsState(prev => {
      const next = prev.filter(entry => entry.id !== message.id)
      next.push(message)
      next.sort((a, b) => new Date(b.inUniverseDate).getTime() - new Date(a.inUniverseDate).getTime())
      return next
    })
  }, [])

  const handleMailSelect = (message: MailMessageDefinition) => {
    setMailSelectedId(message.id)
    setMailDraft({ ...message, body: message.body || '', status: message.status || 'draft' })
    setMailValidationErrors([])
  }

  const handleNewMail = () => {
    setMailSelectedId(null)
    setMailDraft(createEmptyMailDraft())
    setMailValidationErrors([])
  }

  const handleMailDuplicate = () => {
    setMailSelectedId(null)
    setMailDraft(prev => ({
      ...prev,
      id: prev.id ? `${prev.id}_copy` : '',
      subject: prev.subject ? `${prev.subject} (Copy)` : prev.subject,
      status: 'draft'
    }))
    setMailValidationErrors([])
  }

  const selectQuest = useCallback((quest: DesignerQuest | null) => {
    if (!quest) {
      setSelectedKey(null)
      setDraft(null)
      persistedIdRef.current = null
    } else {
      setSelectedKey(quest.id)
      setDraft(normalizeQuest(quest))
      persistedIdRef.current = quest.__unsaved ? null : quest.id
    }
    setErrors([])
    setWarnings([])
    setValidationMessages([])
  }, [])

  const handleMailFieldChange = (field: keyof (MailMessageDefinition & { status?: 'draft' | 'published' }), value: any) => {
    setMailDraft(prev => ({ ...prev, [field]: value }))
  }

  const handleMailSave = async (statusOverride?: 'draft' | 'published') => {
    const id = mailDraft.id?.trim()
    if (!id) {
      setMailValidationErrors(['Mail id is required before saving.'])
      return
    }
    const payload = {
      ...mailDraft,
      id,
      status: statusOverride || mailDraft.status || 'draft'
    }
    const exists = mailDefinitions.some(entry => entry.id === id)
    setMailValidationErrors([])
    setMailSaving(true)
    if (statusOverride === 'published') {
      setMailPublishing(true)
    }
    try {
      const result = exists
        ? await updateTerminalMail(id, payload)
        : await createTerminalMail(payload)
      serverMailIdsRef.current.add(result.id)
      mailSnapshotRef.current[result.id] = JSON.stringify(result)
      upsertMailDefinition(result)
      setMailDraft({ ...result, body: result.body || '', status: result.status || payload.status })
      setMailSelectedId(result.id)
      pushToast({
        title: statusOverride === 'published' ? 'Mail Published' : 'Mail Saved',
        message: `${result.subject || result.id} ${statusOverride === 'published' ? 'is now live.' : 'saved as draft.'}`,
        kind: 'success',
        dedupeKey: `mail-save-${result.id}`
      })
    } catch (err: any) {
      console.error('[quest designer] failed to save mail', err)
      setMailValidationErrors([err?.message || 'Failed to save mail.'])
    } finally {
      setMailSaving(false)
      setMailPublishing(false)
    }
  }

  const handleMailValidate = async () => {
    setMailValidating(true)
    try {
      const result = await validateTerminalMail(mailDraft)
      setMailValidationErrors(result.errors || [])
      if (result.mail) {
        setMailDraft(prev => ({ ...prev, ...result.mail }))
      }
    } catch (err: any) {
      console.error('[quest designer] failed to validate mail', err)
      setMailValidationErrors([err?.message || 'Mail validation failed.'])
    } finally {
      setMailValidating(false)
    }
  }

  const handleMailDelete = async () => {
    const id = mailDraft.id?.trim()
    if (!id) return
    const confirmed = typeof window === 'undefined' ? true : window.confirm(`Delete mail "${id}"?`)
    if (!confirmed) return
    setMailDeletingId(id)
    try {
      await deleteTerminalMail(id)
      setMailDefinitionsState(prev => prev.filter(entry => entry.id !== id))
      serverMailIdsRef.current.delete(id)
      delete mailSnapshotRef.current[id]
      removeMailIdFromQuest(id)
      handleNewMail()
      pushToast({ title: 'Mail Deleted', message: `${id} removed from library.`, kind: 'warning', dedupeKey: `mail-delete-${id}` })
    } catch (err: any) {
      console.error('[quest designer] failed to delete mail', err)
      setMailValidationErrors([err?.message || 'Failed to delete mail.'])
    } finally {
      setMailDeletingId(null)
    }
  }

  const assignMailToQuest = (mailId: string, slot: 'briefing' | 'completion') => {
    if (!mailId || !draft) return
    updateQuestMailConfig(slot === 'briefing' ? { briefingMailId: mailId } : { completionMailId: mailId })
    pushToast({
      title: 'Quest Mail Linked',
      message: `${slot === 'briefing' ? 'Briefing' : 'Completion'} mail set to ${mailId}.`,
      kind: 'info',
      dedupeKey: `quest-mail-${slot}-${mailId}`
    })
  }

  const ensureQuestDraft = useCallback((): DesignerQuest => {
    if (draft) {
      return draft
    }
    const fresh = createEmptyQuest()
    syncQuestList(prev => [fresh, ...prev])
    selectQuest(fresh)
    signalSessionActivity('quest-create')
    return fresh
  }, [draft, selectQuest, syncQuestList])

  const closeWizard = useCallback(() => {
    setWizardOpen(false)
    setWizardCancelConfirmOpen(false)
    setWizardStep(QUEST_WIZARD_STEPS[0])
    setWizardIntroMailErrors([])
    setWizardQuestDetailsErrors([])
    setWizardQuestStepsErrors([])
    setWizardCompletionMailErrors([])
    setWizardSummaryErrors([])
    setWizardSystemTemplateDraft(null)
    setWizardSystemTemplateError(null)
    setWizardFinishing(false)
    resetWizardEntryTracking()
  }, [resetWizardEntryTracking])

  const openWizard = useCallback(() => {
    const existingQuest = draft
    const quest = ensureQuestDraft()
    const introMail = quest.introEmailId ? (mailDefinitions.find(entry => entry.id === quest.introEmailId) ?? null) : null
    const completionMail = quest.completionEmailId ? (mailDefinitions.find(entry => entry.id === quest.completionEmailId) ?? null) : null
    resetWizardEntryTracking()
    wizardEntryQuestIdRef.current = quest.id
    wizardPreviousQuestIdRef.current = existingQuest?.id || null
    wizardCreatedQuestRef.current = !existingQuest
    setWizardIntroMailDraft(createWizardIntroMailDraft(quest, introMail))
    setWizardCompletionMailDraft(createWizardCompletionMailDraft(quest, completionMail))
    setWizardIntroMailErrors([])
    setWizardQuestDetailsErrors([])
    setWizardQuestStepsErrors([])
    setWizardCompletionMailErrors([])
    setWizardSummaryErrors([])
    setWizardSystemTemplateDraft(null)
    setWizardSystemTemplateError(null)
    setWizardFinishing(false)
    setWizardCancelConfirmOpen(false)
    setWizardStep(QUEST_WIZARD_STEPS[0])
    setWizardOpen(true)
  }, [draft, ensureQuestDraft, mailDefinitions, resetWizardEntryTracking])

  const handleCreateQuest = () => {
    ensureQuestDraft()
  }


  const updateWizardIntroMail = useCallback((patch: Partial<WizardIntroMailDraft>) => {
    setWizardIntroMailDraft(prev => ({ ...prev, ...patch }))
  }, [])

  const updateWizardCompletionMail = useCallback((patch: Partial<WizardCompletionMailDraft>) => {
    setWizardCompletionMailErrors([])
    setWizardCompletionMailDraft(prev => ({ ...prev, ...patch }))
  }, [])

  const saveWizardSystemTemplate = useCallback(async () => {
    if (!wizardSystemTemplateDraft) return
    const trimmedLabel = wizardSystemTemplateDraft.label.trim()
    if (!trimmedLabel) {
      setWizardSystemTemplateError('Template name is required.')
      return
    }
    const normalizedId = sanitizeSystemId(wizardSystemTemplateDraft.systemId || trimmedLabel)
    if (!normalizedId) {
      setWizardSystemTemplateError('System ID can only contain letters, numbers, underscores, and dashes.')
      return
    }
    if (
      systemProfilesState.some(profile => profile.id === normalizedId) ||
      systemDefinitionsState.some(definition => definition.id === normalizedId)
    ) {
      setWizardSystemTemplateError('System ID already exists. Choose another value.')
      return
    }
    const ipValue = wizardSystemTemplateDraft.ip.trim()
    const resolvedRootPath = wizardSystemTemplateDraft.startingPath.trim() || '/'
    const filesystemSnapshot = createSystemFilesystemLayout({
      systemId: normalizedId,
      scope: 'global',
      rootPath: resolvedRootPath
    })
    const definition: SystemDefinition = {
      id: normalizedId,
      key: normalizedId,
      name: trimmedLabel,
      label: trimmedLabel,
      kind: 'profile',
      type: 'filesystem',
      scope: 'global',
      network: {
        primaryIp: ipValue || undefined,
        ips: ipValue ? [ipValue] : [],
        hostnames: []
      },
      credentials: {
        username: wizardSystemTemplateDraft.username.trim() || 'operator',
        startingPath: resolvedRootPath
      },
      metadata: {
        description: trimmedLabel,
        footprint: wizardSystemTemplateDraft.footprint.trim(),
        tags: []
      },
      filesystem: {
        rootPath: resolvedRootPath,
        readOnly: false,
        snapshot: filesystemSnapshot
      }
    }
    setWizardSystemTemplateSaving(true)
    try {
      const response = await saveSystemDefinition(definition)
      const savedDefinition = response.definition
      if (savedDefinition) {
        setSystemDefinitionsState(prev => upsertByLabel(prev, savedDefinition))
      }
      if (response.profile) {
        setSystemProfilesState(prev => upsertByLabel(prev, response.profile))
      }
      const savedSystemId = savedDefinition?.id || response.profile?.id || normalizedId
      const resolvedTargetIp = ipValue || savedDefinition?.network.primaryIp || savedDefinition?.network.ips[0] || ''
      updateCurrentQuest(prev => {
        if (!prev) return prev
        const stepIndex = wizardSystemTemplateDraft.stepIndex
        const nextSteps = prev.steps.map((step, idx) => {
          if (idx !== stepIndex) return step
          const nextStep: OperationStep = {
            ...step,
            target_system_id: savedSystemId,
            params: { ...(step.params || {}) }
          }
          if (resolvedTargetIp && (!nextStep.params?.target_ip || !nextStep.params.target_ip.trim())) {
            nextStep.params = { ...nextStep.params, target_ip: resolvedTargetIp }
          }
          return nextStep
        })
        const nextDraft = { ...prev, steps: nextSteps }
        if (!nextDraft.default_system_id) {
          nextDraft.default_system_id = savedSystemId
        }
        return nextDraft
      })
      const toastLabel = savedDefinition?.label || response.profile?.label || trimmedLabel
      pushToast({
        title: 'Target System Added',
        message: `${toastLabel} is ready and assigned to this step.`,
        kind: 'success',
        dedupeKey: `wizard-system-template-${savedSystemId}`
      })
      setWizardSystemTemplateDraft(null)
      setWizardSystemTemplateError(null)
    } catch (err: any) {
      console.error('[quest designer] failed to create wizard system template', err)
      const friendly = err?.message || 'Failed to create template.'
      setWizardSystemTemplateError(friendly)
      pushToast({ title: 'Template Save Failed', message: friendly, kind: 'error', dedupeKey: 'wizard-system-template-error' })
    } finally {
      setWizardSystemTemplateSaving(false)
    }
  }, [
    pushToast,
    setSystemDefinitionsState,
    setSystemProfilesState,
    systemDefinitionsState,
    systemProfilesState,
    updateCurrentQuest,
    wizardSystemTemplateDraft
  ])

  const handleIntroEmailNext = useCallback(() => {
    const activeQuest = ensureQuestDraft()
    const trimmed = {
      id: wizardIntroMailDraft.id?.trim() || '',
      fromName: wizardIntroMailDraft.fromName?.trim() || '',
      fromAddress: wizardIntroMailDraft.fromAddress?.trim() || '',
      subject: wizardIntroMailDraft.subject?.trim() || '',
      previewLine: wizardIntroMailDraft.previewLine?.trim() || '',
      body: wizardIntroMailDraft.body || '',
      inUniverseDate: wizardIntroMailDraft.inUniverseDate?.trim() || defaultInUniverseTimestamp(),
      deliveryCondition: wizardIntroMailDraft.deliveryCondition,
      deliveryQuestId: wizardIntroMailDraft.deliveryQuestId?.trim() || undefined,
      deliveryFlagKey: wizardIntroMailDraft.deliveryFlagKey?.trim() || undefined,
      deliveryFlagValue: wizardIntroMailDraft.deliveryFlagValue?.trim() || undefined,
      startBehavior: wizardIntroMailDraft.startBehavior
    }
    const errors: string[] = []
    if (!trimmed.fromName) errors.push('Sender name is required.')
    if (!trimmed.fromAddress) errors.push('Sender address is required.')
    if (!trimmed.subject) errors.push('Subject is required.')
    if (!trimmed.body.trim()) errors.push('Body content is required.')
    if (!trimmed.inUniverseDate) errors.push('In-universe date/time is required.')
    if (trimmed.deliveryCondition === 'after_quest' && !trimmed.deliveryQuestId) {
      errors.push('Select a quest that unlocks this email.')
    }
    if (trimmed.deliveryCondition === 'flag_set' && !trimmed.deliveryFlagKey) {
      errors.push('Provide a flag key for the delivery condition.')
    }
    setWizardIntroMailErrors(errors)
    if (errors.length) {
      return
    }
    const emailId = trimmed.id || buildIntroMailId(activeQuest)
    const existingMail = mailDefinitions.find(entry => entry.id === emailId)
    const previewLine = trimmed.previewLine || trimmed.body.split('\n').find(line => line.trim().length > 0)?.slice(0, 120) || ''
    const mailRecord: MailMessageDefinition = {
      ...(existingMail || {}),
      id: emailId,
      fromName: trimmed.fromName,
      fromAddress: trimmed.fromAddress,
      subject: trimmed.subject,
      previewLine,
      body: trimmed.body,
      inUniverseDate: trimmed.inUniverseDate,
      folder: existingMail?.folder || 'inbox',
      isUnreadByDefault: existingMail?.isUnreadByDefault ?? true,
      linkedQuestId: activeQuest.id,
      emailCategory: existingMail?.emailCategory || 'main',
      status: existingMail?.status || 'draft'
    }
    upsertMailDefinition(mailRecord)
    updateQuestMailConfig({ briefingMailId: emailId })
    updateCurrentQuest(prev => ({
      ...prev,
      introEmailId: emailId,
      introMailDelivery: {
        condition: trimmed.deliveryCondition,
        questId: trimmed.deliveryCondition === 'after_quest' ? trimmed.deliveryQuestId : undefined,
        flagKey: trimmed.deliveryCondition === 'flag_set' ? trimmed.deliveryFlagKey : undefined,
        flagValue: trimmed.deliveryCondition === 'flag_set' ? trimmed.deliveryFlagValue : undefined
      },
      introMailStartBehavior: trimmed.startBehavior
    }))
    setWizardIntroMailDraft(prev => ({ ...prev, ...trimmed, id: emailId, previewLine }))
    setWizardIntroMailErrors([])
    pushToast({
      title: 'Intro Email Staged',
      message: `Linked ${emailId} to ${activeQuest.title || activeQuest.id}.`,
      kind: 'success',
      dedupeKey: `intro-mail-${emailId}`
    })
    goToNextWizardStep()
  }, [ensureQuestDraft, goToNextWizardStep, mailDefinitions, pushToast, updateCurrentQuest, updateQuestMailConfig, upsertMailDefinition, wizardIntroMailDraft])

  const handleQuestDetailsNext = useCallback(() => {
    const quest = ensureQuestDraft()
    const trimmed = {
      id: quest.id?.trim() || '',
      title: quest.title?.trim() || '',
      summary: quest.summary?.trim() || '',
      description: quest.description?.trim() || '',
      designerNotes: quest.designerNotes?.trim() || '',
      difficulty: quest.difficulty?.trim() || '',
      faction: quest.faction?.trim() || ''
    }
    const errors: string[] = []
    if (!trimmed.title) errors.push('Quest title cannot be empty.')
    if (!trimmed.id) errors.push('Quest id cannot be empty.')
    if (!trimmed.summary) errors.push('Provide a short summary for mission lists.')
    if (!trimmed.description) errors.push('Add a player-facing description.')
    setWizardQuestDetailsErrors(errors)
    if (errors.length) {
      return
    }
    updateCurrentQuest(prev => ({
      ...prev,
      ...trimmed
    }))
    setWizardQuestDetailsErrors([])
    goToNextWizardStep()
  }, [ensureQuestDraft, goToNextWizardStep, updateCurrentQuest])

  const handleQuestMetadataChange = useCallback((field: keyof DesignerQuest, value: any) => {
    setWizardQuestDetailsErrors([])
    updateCurrentQuest(prev => {
      if (!prev) return prev
      return { ...prev, [field]: value }
    })
  }, [setWizardQuestDetailsErrors, updateCurrentQuest])

  const handleQuestStepsNext = useCallback(() => {
    const quest = ensureQuestDraft()
    const errors: string[] = []
    if (!quest.steps.length) {
      errors.push('Add at least one quest step to define the mission flow.')
    }
    quest.steps.forEach((step, idx) => {
      const label = `Step ${idx + 1}`
      if (!step.id?.trim()) {
        errors.push(`${label} is missing an internal id.`)
      }
      if (!STEP_TYPES.includes(step.type as StepType)) {
        errors.push(`${label} has an unsupported step type.`)
      }
      const needsTargetSystem = step.type === 'SCAN_HOST' || step.type === 'CONNECT_HOST' || step.type === 'DISCONNECT_HOST' || step.type === 'DELETE_FILE'
      const targetIp = step.params?.target_ip?.trim()
      if (!targetIp) {
        errors.push(`${label} requires a target host / IP.`)
      }
      if (step.type === 'DELETE_FILE' && !step.params?.file_path?.trim()) {
        errors.push(`${label} must include a file path.`)
      }
      if (needsTargetSystem && !(step.target_system_id || quest.default_system_id)) {
        errors.push(`${label} needs a system profile (pick a default or assign it per-step).`)
      }
    })
    setWizardQuestStepsErrors(errors)
    if (errors.length) {
      return
    }
    goToNextWizardStep()
  }, [ensureQuestDraft, goToNextWizardStep])

  const hasFilesystemLayout = useCallback((map?: FilesystemMap | null) => !!(map && Object.keys(map).length), [])

  const handleFilesystemStepNext = useCallback(() => {
    const quest = ensureQuestDraft()
    const overrideIds = Object.keys(quest.embedded_filesystems || {})
    if (!overrideIds.length) {
      setWizardFilesystemErrors([])
      goToNextWizardStep()
      return
    }
    const incomplete = overrideIds.filter(systemId => !hasFilesystemLayout(quest.embedded_filesystems?.[systemId]))
    if (incomplete.length) {
      setWizardFilesystemErrors(incomplete.map(id => `Finish configuring the filesystem layout for ${id}.`))
      return
    }
    setWizardFilesystemErrors([])
    goToNextWizardStep()
  }, [ensureQuestDraft, goToNextWizardStep, hasFilesystemLayout])

  const handleWizardStepUpdate = useCallback((index: number, updater: (step: OperationStep) => OperationStep) => {
    setWizardQuestStepsErrors([])
    updateCurrentQuest(prev => {
      if (!prev || !prev.steps[index]) return prev
      const steps = prev.steps.map((step, idx) => (idx === index ? updater(step) : step))
      return { ...prev, steps }
    })
  }, [updateCurrentQuest])

  const handleWizardStepParamChange = useCallback((index: number, field: keyof QuestStepParamsBase, value: string) => {
    handleWizardStepUpdate(index, step => {
      const nextParams: QuestStepParamsBase = { ...(step.params || {}) }
      if (value?.trim()) {
        nextParams[field] = value
      } else {
        delete nextParams[field]
      }
      return { ...step, params: nextParams }
    })
  }, [handleWizardStepUpdate])

  const handleWizardStepTargetSystemChange = useCallback((index: number, value: string) => {
    handleWizardStepUpdate(index, step => ({
      ...step,
      target_system_id: value?.trim() ? value : undefined
    }))
  }, [handleWizardStepUpdate])

  const handleWizardStepTypeChange = useCallback((index: number, type: StepType) => {
    handleWizardStepUpdate(index, step => {
      const nextParams: QuestStepParamsBase = { ...(step.params || {}) }
      if (type !== 'DELETE_FILE') {
        delete nextParams.file_path
      }
      return { ...step, type, params: nextParams }
    })
  }, [handleWizardStepUpdate])

  const handleWizardStepIdChange = useCallback((index: number, value: string) => {
    handleWizardStepUpdate(index, step => ({ ...step, id: value }))
  }, [handleWizardStepUpdate])

  const handleWizardStepDescriptionChange = useCallback((index: number, value: string) => {
    handleWizardStepUpdate(index, step => ({
      ...step,
      hints: {
        ...(step.hints || {}),
        prompt: value
      }
    }))
  }, [handleWizardStepUpdate])

  const handleWizardStepCommandExampleChange = useCallback((index: number, value: string) => {
    handleWizardStepUpdate(index, step => ({
      ...step,
      hints: {
        ...(step.hints || {}),
        command_example: value
      }
    }))
  }, [handleWizardStepUpdate])

  const handleWizardStepAutoAdvanceChange = useCallback((index: number, value: boolean) => {
    handleWizardStepUpdate(index, step => ({ ...step, auto_advance: value }))
  }, [handleWizardStepUpdate])

  const handleWizardStepMove = useCallback((index: number, dir: -1 | 1) => {
    setWizardQuestStepsErrors([])
    updateCurrentQuest(prev => {
      if (!prev) return prev
      const target = index + dir
      if (target < 0 || target >= prev.steps.length) return prev
      const steps = [...prev.steps]
      const temp = steps[index]
      steps[index] = steps[target]
      steps[target] = temp
      return { ...prev, steps }
    })
  }, [updateCurrentQuest])

  const handleWizardStepDuplicate = useCallback((index: number) => {
    setWizardQuestStepsErrors([])
    updateCurrentQuest(prev => {
      if (!prev) return prev
      const step = prev.steps[index]
      if (!step) return prev
      const clone: OperationStep = {
        ...step,
        id: `${step.id || 'step'}_copy`,
        params: { ...step.params },
        hints: step.hints ? { ...step.hints } : undefined
      }
      const steps = [...prev.steps]
      steps.splice(index + 1, 0, clone)
      return { ...prev, steps }
    })
  }, [updateCurrentQuest])

  const handleWizardStepDelete = useCallback((index: number) => {
    setWizardQuestStepsErrors([])
    updateCurrentQuest(prev => {
      if (!prev) return prev
      if (!prev.steps[index]) return prev
      const steps = prev.steps.filter((_, idx) => idx !== index)
      return { ...prev, steps }
    })
  }, [updateCurrentQuest])

  const openWizardSystemTemplateCreator = useCallback((stepIndex: number) => {
    if (!draft) return
    const targetStep = draft.steps[stepIndex]
    const baseId = targetStep?.target_system_id || `${draft.id || 'quest'}_${targetStep?.id || `system_${stepIndex + 1}`}`
    const sanitizedBaseId = sanitizeSystemId(baseId) || `system_${Date.now()}`
    const defaultLabel = targetStep?.target_system_id || targetStep?.id
      ? `${(targetStep?.id || baseId).replace(/_/g, ' ')}`.trim()
      : `System ${stepIndex + 1}`
    setWizardSystemTemplateDraft({
      stepIndex,
      label: defaultLabel || `System ${stepIndex + 1}`,
      systemId: sanitizedBaseId,
      ip: '',
      username: 'operator',
      startingPath: '/',
      footprint: ''
    })
    setWizardSystemTemplateError(null)
  }, [draft])

  const closeWizardSystemTemplateCreator = useCallback(() => {
    setWizardSystemTemplateDraft(null)
    setWizardSystemTemplateError(null)
  }, [])

  const updateWizardSystemTemplateDraft = useCallback(<K extends keyof Omit<WizardSystemTemplateDraft, 'stepIndex'>>(field: K, value: WizardSystemTemplateDraft[K]) => {
    setWizardSystemTemplateError(null)
    setWizardSystemTemplateDraft(prev => (prev ? { ...prev, [field]: value } : prev))
  }, [])

  const handleWizardAddStep = useCallback(() => {
    const quest = ensureQuestDraft()
    const nextIndex = quest.steps.length
    const blank = createBlankStep(nextIndex)
    const fallbackSystemId = quest.default_system_id || resolvedSystemDefinitions[0]?.id || systemProfilesState[0]?.id
    const stepWithTarget = fallbackSystemId ? { ...blank, target_system_id: fallbackSystemId } : blank
    setWizardQuestStepsErrors([])
    updateCurrentQuest(prev => ({
      ...prev,
      steps: [...prev.steps, stepWithTarget]
    }))
  }, [ensureQuestDraft, resolvedSystemDefinitions, systemProfilesState, updateCurrentQuest])

  const handleWizardApplyTemplate = useCallback((templateId: string) => {
    const quest = ensureQuestDraft()
    const template = STEP_TEMPLATES.find(entry => entry.id === templateId)
    if (!template) return
    const fallbackSystemId = quest.default_system_id || resolvedSystemDefinitions[0]?.id || systemProfilesState[0]?.id
    const instantiated = instantiateStepTemplate(template, quest.id, fallbackSystemId)
    setWizardQuestStepsErrors([])
    updateCurrentQuest(prev => ({
      ...prev,
      steps: [...prev.steps, ...instantiated]
    }))
    pushToast({
      title: 'Template Applied',
      message: `${template.label} added ${instantiated.length} step${instantiated.length === 1 ? '' : 's'}.`,
      kind: 'info',
      dedupeKey: `wizard-template-${template.id}`
    })
  }, [ensureQuestDraft, pushToast, resolvedSystemDefinitions, systemProfilesState, updateCurrentQuest])

  const handleCompletionEmailNext = useCallback(() => {
    const quest = ensureQuestDraft()
    const trimmed = {
      id: wizardCompletionMailDraft.id?.trim() || buildCompletionMailId(quest),
      fromName: wizardCompletionMailDraft.fromName?.trim() || '',
      fromAddress: wizardCompletionMailDraft.fromAddress?.trim() || '',
      subject: wizardCompletionMailDraft.subject?.trim() || '',
      previewLine: wizardCompletionMailDraft.previewLine?.trim() || '',
      body: wizardCompletionMailDraft.body || '',
      inUniverseDate: wizardCompletionMailDraft.inUniverseDate?.trim() || defaultInUniverseTimestamp()
    }
    const errors: string[] = []
    if (!trimmed.fromName) errors.push('Sender name is required.')
    if (!trimmed.fromAddress) errors.push('Sender address is required.')
    if (!trimmed.subject) errors.push('Subject is required.')
    if (!trimmed.body.trim()) errors.push('Body content is required.')
    if (!trimmed.inUniverseDate) errors.push('In-universe date/time is required.')
    setWizardCompletionMailErrors(errors)
    if (errors.length) {
      return
    }
    const emailId = trimmed.id || buildCompletionMailId(quest)
    const existingMail = mailDefinitions.find(entry => entry.id === emailId)
    const previewLine = trimmed.previewLine || trimmed.body.split('\n').find(line => line.trim().length > 0)?.slice(0, 120) || ''
    const mailRecord: MailMessageDefinition = {
      ...(existingMail || {}),
      id: emailId,
      fromName: trimmed.fromName,
      fromAddress: trimmed.fromAddress,
      subject: trimmed.subject,
      previewLine,
      body: trimmed.body,
      inUniverseDate: trimmed.inUniverseDate,
      folder: existingMail?.folder || 'inbox',
      isUnreadByDefault: existingMail?.isUnreadByDefault ?? true,
      linkedQuestId: quest.id,
      emailCategory: existingMail?.emailCategory || 'main',
      status: existingMail?.status || 'draft'
    }
    upsertMailDefinition(mailRecord)
    updateQuestMailConfig({ completionMailId: emailId })
    updateCurrentQuest(prev => ({
      ...prev,
      completionEmailId: emailId
    }))
    setWizardCompletionMailDraft(prev => ({ ...prev, ...trimmed, id: emailId, previewLine }))
    setWizardCompletionMailErrors([])
    pushToast({
      title: 'Completion Email Staged',
      message: `Linked ${emailId} to ${quest.title || quest.id}.`,
      kind: 'success',
      dedupeKey: `completion-mail-${emailId}`
    })
    goToNextWizardStep()
  }, [ensureQuestDraft, goToNextWizardStep, mailDefinitions, pushToast, updateCurrentQuest, updateQuestMailConfig, upsertMailDefinition, wizardCompletionMailDraft])

  const persistWizardMail = useCallback(async (mail: MailMessageDefinition | null) => {
    if (!mail?.id) return null
    const payload = {
      ...mail,
      body: mail.body || '',
      linkedQuestId: mail.linkedQuestId || draft?.id || null,
      status: mail.status || 'draft'
    }
    const existsOnServer = serverMailIdsRef.current.has(mail.id)
    const result = existsOnServer
      ? await updateTerminalMail(mail.id, payload)
      : await createTerminalMail(payload)
    serverMailIdsRef.current.add(result.id)
    mailSnapshotRef.current[result.id] = JSON.stringify(result)
    upsertMailDefinition(result)
    return result
  }, [draft?.id, upsertMailDefinition])

  const systemOptions = useMemo(() => {
    if (resolvedSystemDefinitions.length) {
      return resolvedSystemDefinitions.map(definition => ({
        id: definition.id,
        label: definition.network.primaryIp ? `${definition.label} (${definition.network.primaryIp})` : definition.label
      }))
    }
    return systemProfilesState.map(profile => ({
      id: profile.id,
      label: `${profile.label}${profile.identifiers?.ips?.length ? ` (${profile.identifiers.ips[0]})` : ''}`
    }))
  }, [resolvedSystemDefinitions, systemProfilesState])

  const persistQuestTagSuggestion = useCallback(async (tag: string) => {
    if (!isAdmin) return
    const normalized = tag.trim()
    if (!normalized) return
    try {
      await saveQuestTag(normalized)
      setQuestTagSuggestions(prev => {
        if (prev.some(entry => entry.toLowerCase() === normalized.toLowerCase())) {
          return prev
        }
        return [...prev, normalized].sort((a, b) => a.localeCompare(b))
      })
    } catch (err: any) {
      console.error('[quest designer] failed to save quest tag', err)
      const friendly = err?.message || 'Unable to save quest tag.'
      pushToast({ title: 'Tag Save Failed', message: friendly, kind: 'error', dedupeKey: `quest-tag-${normalized}` })
    }
  }, [isAdmin, pushToast])

  const wizardQuestTagInput = useTagInput({
    values: draft?.tags || [],
    onChange: values => updateCurrentQuest(prev => (prev ? { ...prev, tags: values } : prev)),
    placeholder: 'stealth',
    suggestions: questTagSuggestions,
    ariaLabel: 'Quest tags',
    onValueAdded: persistQuestTagSuggestion
  })

  const rewardFlags = useMemo(() => draft?.rewards?.flags || [], [draft?.rewards?.flags])

  const addRewardFlag = useCallback(() => {
    updateCurrentQuest(prev => ({
      ...prev,
      rewards: {
        ...prev.rewards,
        flags: [...(prev.rewards?.flags || []), { key: '', value: '' }]
      }
    }))
  }, [updateCurrentQuest])

  const updateRewardFlag = useCallback((index: number, patch: Partial<QuestRewardFlag>) => {
    updateCurrentQuest(prev => {
      const flags = [...(prev.rewards?.flags || [])]
      flags[index] = { ...flags[index], ...patch }
      return {
        ...prev,
        rewards: { ...prev.rewards, flags }
      }
    })
  }, [updateCurrentQuest])

  const removeRewardFlag = useCallback((index: number) => {
    updateCurrentQuest(prev => ({
      ...prev,
      rewards: {
        ...prev.rewards,
        flags: (prev.rewards?.flags || []).filter((_, idx) => idx !== index)
      }
    }))
  }, [updateCurrentQuest])

  const questFlagSuggestions = useMemo(() => {
    const flags = new Set<string>()
    const source = draft ? [...quests.filter(q => q.id !== draft.id), draft] : quests
    source.forEach(q => q.rewards?.flags?.forEach(entry => {
      const flag = sanitizeRewardFlagEntry(entry)
      if (!flag) return
      flags.add(flag.key)
      if (flag.value) flags.add(`${flag.key}=${flag.value}`)
    }))
    source.forEach(q => {
      const completionFlag = q.completion_flag?.trim()
      if (!completionFlag) return
      flags.add(completionFlag)
    })
    return Array.from(flags)
  }, [draft, quests])

  const unlockCommandInput = useTagInput({
    values: draft?.rewards?.unlocks_commands || [],
    onChange: values => updateCurrentQuest(prev => ({ ...prev, rewards: { ...prev.rewards, unlocks_commands: values } })),
    placeholder: 'command name',
    ariaLabel: 'Unlock command list'
  })

  const wizardStepContent = useMemo(() => {
    if (wizardStep === 'introEmail') {
      const deliveryOption = INTRO_MAIL_DELIVERY_OPTIONS.find(option => option.value === wizardIntroMailDraft.deliveryCondition)
      return (
        <div className="quest-wizard-form intro-mail-form">
          {wizardIntroMailErrors.length > 0 && (
            <div
              className="inline-alert error"
              role="alert"
              tabIndex={-1}
              ref={wizardStep === 'introEmail' ? wizardAlertRef : undefined}
            >
              <strong>Fix these before continuing</strong>
              <ul>
                {wizardIntroMailErrors.map(error => <li key={error}>{error}</li>)}
              </ul>
            </div>
          )}
          <div className="wizard-field-grid">
            <label>
              Sender Name
              <input
                value={wizardIntroMailDraft.fromName}
                onChange={e => updateWizardIntroMail({ fromName: e.target.value })}
                placeholder="Atlas Ops"
              />
            </label>
            <label>
              Sender Address
              <input
                value={wizardIntroMailDraft.fromAddress}
                onChange={e => updateWizardIntroMail({ fromAddress: e.target.value })}
                placeholder="ops@atlasnet"
              />
            </label>
            <label className="full">
              Subject / Hook
              <input
                value={wizardIntroMailDraft.subject}
                onChange={e => updateWizardIntroMail({ subject: e.target.value })}
                placeholder="Directive: Wipe the Evidence"
              />
            </label>
            <label className="full">
              Preview / Snippet (optional)
              <input
                value={wizardIntroMailDraft.previewLine}
                onChange={e => updateWizardIntroMail({ previewLine: e.target.value })}
                placeholder="Remote relay logs picked up your alias."
              />
            </label>
            <label className="full">
              Body
              <textarea
                value={wizardIntroMailDraft.body}
                onChange={e => updateWizardIntroMail({ body: e.target.value })}
                rows={8}
                placeholder={'Operator,\n\nTelemetry shows a relay...'}
              />
            </label>
            <label>
              In-universe Date/Time
              <input
                value={wizardIntroMailDraft.inUniverseDate}
                onChange={e => updateWizardIntroMail({ inUniverseDate: e.target.value })}
                placeholder="2089-06-01 14:22"
              />
            </label>
          </div>
          <div className="wizard-field-group">
            <label>
              Delivery Condition
              <select
                value={wizardIntroMailDraft.deliveryCondition}
                onChange={e => updateWizardIntroMail({ deliveryCondition: e.target.value as QuestIntroDeliveryCondition })}
              >
                {INTRO_MAIL_DELIVERY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            {deliveryOption && <p className="muted description">{deliveryOption.description}</p>}
            {wizardIntroMailDraft.deliveryCondition === 'after_quest' && (
              <label className="full">
                Deliver after quest
                <select
                  value={wizardIntroMailDraft.deliveryQuestId || ''}
                  onChange={e => updateWizardIntroMail({ deliveryQuestId: e.target.value || undefined })}
                >
                  <option value="">Select quest</option>
                  {quests.map(quest => (
                    <option key={`delivery-quest-${quest.id}`} value={quest.id}>
                      {quest.title || quest.id}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {wizardIntroMailDraft.deliveryCondition === 'flag_set' && (
              <div className="wizard-flag-fields">
                <label>
                  Flag Key
                  <input
                    value={wizardIntroMailDraft.deliveryFlagKey || ''}
                    onChange={e => updateWizardIntroMail({ deliveryFlagKey: e.target.value })}
                    placeholder="quest_intro_complete"
                  />
                </label>
                <label>
                  Flag Value (optional)
                  <input
                    value={wizardIntroMailDraft.deliveryFlagValue || ''}
                    onChange={e => updateWizardIntroMail({ deliveryFlagValue: e.target.value })}
                    placeholder="true"
                  />
                </label>
              </div>
            )}
            {wizardIntroMailDraft.deliveryCondition === 'manual' && (
              <p className="muted description">
                Document how and when scripting should trigger this mail so automation engineers can wire it up later.
              </p>
            )}
          </div>
          <div className="wizard-field-group">
            <span className="field-label">When player reads this email…</span>
            <div className="wizard-radio-group">
              {INTRO_MAIL_START_BEHAVIOR_OPTIONS.map(option => {
                const behaviorInputId = `${introMailBehaviorIdPrefix}-${option.value}`
                const isActive = wizardIntroMailDraft.startBehavior === option.value
                return (
                  <div key={option.value} className={`wizard-radio ${isActive ? 'active' : ''}`}>
                    <input
                      id={behaviorInputId}
                      type="radio"
                      name="intro-mail-start-behavior"
                      value={option.value}
                      checked={isActive}
                      onChange={e => updateWizardIntroMail({ startBehavior: e.target.value as QuestIntroStartBehavior })}
                    />
                    <label htmlFor={behaviorInputId}>
                      <strong>{option.label}</strong>
                      <p className="muted">{option.helper}</p>
                    </label>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )
    }
    if (wizardStep === 'questCore') {
      if (!draft) {
        return (
          <div className="quest-wizard-placeholder">
            <p>Select or create a quest before editing its metadata.</p>
          </div>
        )
      }
      const introMail = draft.introEmailId ? mailDefinitions.find(entry => entry.id === draft.introEmailId) : null
      const deliverySummary = (() => {
        if (!draft.introMailDelivery) return null
        const delivery = draft.introMailDelivery
        switch (delivery.condition) {
          case 'game_start':
            return 'Delivered when a new save/profile boots up.'
          case 'after_quest':
            return delivery.questId ? `Delivered after ${delivery.questId} completes.` : 'Delivered after the selected quest resolves.'
          case 'flag_set':
            return `Delivered when flag ${delivery.flagKey}${delivery.flagValue ? `=${delivery.flagValue}` : ''} is set.`
          case 'manual':
            return 'Delivery handled manually or via scripting.'
          default:
            return null
        }
      })()
      const introStartText = draft.introMailStartBehavior === 'startQuest'
        ? 'Reading the mail starts this quest automatically.'
        : 'Mail is lore-only; quest activates elsewhere.'
      return (
        <div className="quest-wizard-form quest-core-form">
          {wizardQuestDetailsErrors.length > 0 && (
            <div
              className="inline-alert error"
              role="alert"
              tabIndex={-1}
              ref={wizardStep === 'questCore' ? wizardAlertRef : undefined}
            >
              <strong>Fix these before continuing</strong>
              <ul>
                {wizardQuestDetailsErrors.map(error => <li key={error}>{error}</li>)}
              </ul>
            </div>
          )}
          <div className="wizard-field-grid">
            <label data-tooltip={FIELD_HINTS.questTitle}>
              Quest Title
              <input
                value={draft.title}
                onChange={e => handleQuestMetadataChange('title', e.target.value)}
                placeholder="Wipe the Evidence"
              />
            </label>
            <label data-tooltip={FIELD_HINTS.questId}>
              Quest ID
              <div className="wizard-inline-input">
                <input
                  value={draft.id}
                  onChange={e => handleQuestMetadataChange('id', e.target.value)}
                  onBlur={e => handleQuestMetadataChange('id', sanitizeSystemId(e.target.value))}
                  placeholder="atlas_wipe_evidence"
                />
                <button
                  type="button"
                  onClick={() => handleQuestMetadataChange('id', sanitizeSystemId(draft.title || draft.id))}
                  title="Generate id from title"
                >
                  Auto ID
                </button>
              </div>
              <span className="muted helper">Letters, numbers, underscores, and hyphens only.</span>
            </label>
            <label className="full" data-tooltip={FIELD_HINTS.questSummary}>
              Summary (1-2 sentences)
              <textarea
                value={draft.summary}
                onChange={e => handleQuestMetadataChange('summary', e.target.value)}
                rows={3}
                placeholder="Atlas intercepted a wipe order. Clean the relay before it lands."
              />
            </label>
            <label className="full" data-tooltip={FIELD_HINTS.description}>
              Player-facing Description
              <textarea
                value={draft.description}
                onChange={e => handleQuestMetadataChange('description', e.target.value)}
                rows={5}
                placeholder="Atlas needs you to…"
              />
            </label>
          </div>
          <div className="wizard-field-grid">
            <label data-tooltip={FIELD_HINTS.questDifficulty}>
              Difficulty
              <select
                value={draft.difficulty}
                onChange={e => handleQuestMetadataChange('difficulty', e.target.value)}
              >
                <option value="">Select difficulty</option>
                {QUEST_DIFFICULTY_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label data-tooltip={FIELD_HINTS.questFaction}>
              Faction / Category
              <input
                value={draft.faction}
                onChange={e => handleQuestMetadataChange('faction', e.target.value)}
                placeholder="Atlas"
                list="quest-faction-suggestions"
              />
              <datalist id="quest-faction-suggestions">
                {QUEST_CATEGORY_SUGGESTIONS.map(option => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </label>
            <label className="full" data-tooltip={FIELD_HINTS.questTags}>
              Tags
              {wizardQuestTagInput.Input}
            </label>
          </div>
          <div className="wizard-field-grid">
            <label data-tooltip={FIELD_HINTS.defaultSystem}>
              Default System
              <select
                value={draft.default_system_id || ''}
                onChange={e => handleQuestMetadataChange('default_system_id', e.target.value || undefined)}
                disabled={systemsLoading}
              >
                <option value="">Unassigned (set per step)</option>
                {systemOptions.map(option => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
              <span className="muted helper">
                {systemsLoading ? 'Loading system profiles…' : 'Applied whenever a step does not pick a specific target system.'}
              </span>
            </label>
          </div>
          <div className="wizard-field-group">
            <label className="full" data-tooltip={FIELD_HINTS.designerNotes}>
              Designer Notes (internal)
              <textarea
                value={draft.designerNotes}
                onChange={e => handleQuestMetadataChange('designerNotes', e.target.value)}
                rows={3}
                placeholder="Call out special scripting or dependencies for other designers."
              />
            </label>
          </div>
          <div className="wizard-field-group">
            <span className="field-label">Intro Email Link</span>
            {draft.introEmailId ? (
              <div>
                <p>
                  <code>{draft.introEmailId}</code>
                  {introMail?.subject ? ` — ${introMail.subject}` : ''}
                </p>
                <p className="muted">
                  {introStartText}
                  {deliverySummary ? ` ${deliverySummary}` : ''}
                </p>
              </div>
            ) : (
              <p className="muted">Complete the Intro Email step to auto-link the quest briefing.</p>
            )}
          </div>
        </div>
      )
    }
    if (wizardStep === 'questSteps') {
      if (!draft) {
        return (
          <div className="quest-wizard-placeholder">
            <p>Create or select a quest to define its gameplay flow.</p>
          </div>
        )
      }
      return (
        <div className="quest-wizard-form quest-steps-form">
          {wizardQuestStepsErrors.length > 0 && (
            <div
              className="inline-alert error"
              role="alert"
              tabIndex={-1}
              ref={wizardStep === 'questSteps' ? wizardAlertRef : undefined}
            >
              <strong>Resolve these step issues</strong>
              <ul>
                {wizardQuestStepsErrors.map(error => <li key={error}>{error}</li>)}
              </ul>
            </div>
          )}
          <div className="wizard-template-section">
            <div className="wizard-template-header">
              <div>
                <span className="field-label">Start from a template</span>
                <p className="muted">Drop in a proven sequence and tweak the details.</p>
              </div>
            </div>
            <div className="wizard-template-grid">
              {STEP_TEMPLATES.map(template => (
                <button key={template.id} type="button" className="wizard-template-card" onClick={() => handleWizardApplyTemplate(template.id)}>
                  <div>
                    <strong>{template.label}</strong>
                    <p className="muted">{template.description}</p>
                  </div>
                  <span className="wizard-template-meta">{template.steps.length} step{template.steps.length === 1 ? '' : 's'}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="wizard-step-list">
            {draft.steps.length === 0 ? (
              <div className="wizard-step-empty">
                <p>No steps yet. Use a template or add a custom step.</p>
              </div>
            ) : (
              draft.steps.map((step, index) => (
                <div key={step.id || `step-${index}`} className="wizard-step-card">
                  <div className="wizard-step-card-header">
                    <div className="wizard-step-id-shell" data-tooltip={FIELD_HINTS.stepId}>
                      <span className="muted">Step {index + 1}</span>
                      <input
                        className="wizard-step-id-input"
                        aria-label={`Step ${index + 1} internal identifier`}
                        value={step.id}
                        onChange={e => handleWizardStepIdChange(index, e.target.value)}
                        placeholder={`step_${index + 1}`}
                      />
                    </div>
                    <div className="wizard-step-card-actions">
                      <button type="button" onClick={() => handleWizardStepMove(index, -1)} disabled={index === 0} title="Move up">↑</button>
                      <button type="button" onClick={() => handleWizardStepMove(index, 1)} disabled={index === draft.steps.length - 1} title="Move down">↓</button>
                      <button type="button" onClick={() => handleWizardStepDuplicate(index)} title="Duplicate step">⧉</button>
                      <button type="button" onClick={() => handleWizardStepDelete(index)} title="Remove step">🗑</button>
                    </div>
                  </div>
                  <div className="wizard-field-grid">
                    <label data-tooltip={FIELD_HINTS.stepType}>
                      Step Type
                      <select value={step.type} onChange={e => handleWizardStepTypeChange(index, e.target.value as StepType)}>
                        {STEP_TYPES.map(type => (
                          <option key={type} value={type}>{STEP_TYPE_LABELS[type]}</option>
                        ))}
                      </select>
                    </label>
                    <div className="wizard-target-system-field" data-tooltip={FIELD_HINTS.stepTargetSystem}>
                      <label>
                        Target System
                        <select
                          value={step.target_system_id || ''}
                          onChange={e => handleWizardStepTargetSystemChange(index, e.target.value)}
                          disabled={systemsLoading}
                        >
                          <option value="">Quest Default {draft.default_system_id ? `(${draft.default_system_id})` : ''}</option>
                          {systemOptions.map(option => (
                            <option key={option.id} value={option.id}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <button type="button" className="ghost" onClick={() => openWizardSystemTemplateCreator(index)}>
                        Create New Template
                      </button>
                    </div>
                    {wizardSystemTemplateDraft?.stepIndex === index && (
                      <div className="wizard-system-template-panel">
                        <p className="muted">Give the target a label and ID; we will assign it to this step immediately.</p>
                        <div className="wizard-field-grid wizard-system-template-grid">
                          <label>
                            Template Name
                            <input
                              value={wizardSystemTemplateDraft.label}
                              onChange={e => updateWizardSystemTemplateDraft('label', e.target.value)}
                              placeholder="Atlas Relay"
                            />
                          </label>
                          <label>
                            System ID
                            <input
                              value={wizardSystemTemplateDraft.systemId}
                              onChange={e => updateWizardSystemTemplateDraft('systemId', e.target.value)}
                              placeholder="relay_alpha"
                            />
                          </label>
                          <label>
                            Primary IP (optional)
                            <input
                              value={wizardSystemTemplateDraft.ip}
                              onChange={e => updateWizardSystemTemplateDraft('ip', e.target.value)}
                              placeholder="10.0.0.24"
                            />
                          </label>
                          <label>
                            Username (optional)
                            <input
                              value={wizardSystemTemplateDraft.username}
                              onChange={e => updateWizardSystemTemplateDraft('username', e.target.value)}
                              placeholder="operator"
                            />
                          </label>
                          <label>
                            Starting Path
                            <input
                              value={wizardSystemTemplateDraft.startingPath}
                              onChange={e => updateWizardSystemTemplateDraft('startingPath', e.target.value)}
                              placeholder="/home/operator"
                            />
                          </label>
                          <label className="full">
                            Footprint Notes
                            <textarea
                              rows={2}
                              value={wizardSystemTemplateDraft.footprint}
                              onChange={e => updateWizardSystemTemplateDraft('footprint', e.target.value)}
                              placeholder="Optional context for filesystem overrides."
                            />
                          </label>
                        </div>
                        {wizardSystemTemplateError && (
                          <div className="inline-alert error" role="alert">
                            <strong>Template Error</strong>
                            <p>{wizardSystemTemplateError}</p>
                          </div>
                        )}
                        <div className="wizard-system-template-actions">
                          <button type="button" onClick={saveWizardSystemTemplate} disabled={wizardSystemTemplateSaving}>
                            {wizardSystemTemplateSaving ? 'Saving Template…' : 'Save Template & Assign'}
                          </button>
                          <button type="button" className="ghost" onClick={closeWizardSystemTemplateCreator}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    <label data-tooltip={FIELD_HINTS.stepAutoAdvance}>
                      Auto Advance
                      <input
                        type="checkbox"
                        checked={step.auto_advance !== false}
                        onChange={e => handleWizardStepAutoAdvanceChange(index, e.target.checked)}
                      />
                    </label>
                  </div>
                  <div className="wizard-field-grid">
                    <label className="full" data-tooltip={FIELD_HINTS.stepTargetIp}>
                      Target Host / IP
                      <input
                        value={step.params?.target_ip || ''}
                        onChange={e => handleWizardStepParamChange(index, 'target_ip', e.target.value)}
                        placeholder="10.0.0.42"
                      />
                    </label>
                    {step.type === 'DELETE_FILE' && (
                      <label className="full" data-tooltip={FIELD_HINTS.stepFilePath}>
                        File Path
                        <input
                          value={step.params?.file_path || ''}
                          onChange={e => handleWizardStepParamChange(index, 'file_path', e.target.value)}
                          placeholder="/var/log/trace.log"
                        />
                      </label>
                    )}
                  </div>
                  <div className="wizard-field-grid">
                    <label className="full" data-tooltip={FIELD_HINTS.stepHintPrompt}>
                      Designer Description
                      <textarea
                        value={step.hints?.prompt || ''}
                        onChange={e => handleWizardStepDescriptionChange(index, e.target.value)}
                        rows={3}
                        placeholder="Remind the operator what to accomplish."
                      />
                    </label>
                    <label className="full" data-tooltip={FIELD_HINTS.stepCommandExample}>
                      Command Example (optional)
                      <textarea
                        value={step.hints?.command_example || ''}
                        onChange={e => handleWizardStepCommandExampleChange(index, e.target.value)}
                        rows={2}
                        placeholder="connect 10.0.0.42"
                      />
                    </label>
                  </div>
                </div>
              ))
            )}
          </div>
          <button type="button" className="wizard-add-step" onClick={handleWizardAddStep}>
            + Add custom step
          </button>
        </div>
      )
    }
    if (wizardStep === 'filesystem') {
      if (!draft) {
        return (
          <div className="quest-wizard-placeholder">
            <p>Stage or select a quest before designing its filesystems.</p>
          </div>
        )
      }
      if (!systemIdsInUse.length) {
        return (
          <div className="quest-wizard-placeholder">
            <p>Assign a default system or per-step targets to unlock filesystem editing.</p>
          </div>
        )
      }
      return (
        <div className="quest-wizard-form filesystem-wizard-form">
          {wizardFilesystemErrors.length > 0 && (
            <div
              className="inline-alert error"
              role="alert"
              tabIndex={-1}
              ref={wizardStep === 'filesystem' ? wizardAlertRef : undefined}
            >
              <strong>Add filesystem layouts before continuing</strong>
              <ul>
                {wizardFilesystemErrors.map(message => <li key={message}>{message}</li>)}
              </ul>
            </div>
          )}
          <p className="muted">Each targeted system needs a quest-scoped filesystem so runtime hacks spawn with the correct directories and files.</p>
          <div className="filesystem-wizard-grid">
            {questSystemSummaries.map(summary => {
              const override = summary.override
              const resolvedDefinition = summary.resolvedDefinition || summary.baseDefinition
              const label = override?.label || resolvedDefinition?.label || summary.fallbackProfile?.label || summary.systemId
              const isDefault = draft?.default_system_id === summary.systemId
              const questFilesystem = summary.questFilesystem
              const filesystemReady = !!questFilesystem
              const editorOpen = openFilesystemEditors.includes(summary.systemId)
              return (
                <div key={`filesystem-wizard-${summary.systemId}`} className="filesystem-wizard-card">
                  <div className="filesystem-wizard-header">
                    <div>
                      <strong>{label}</strong>
                      <span className="muted">{summary.systemId}</span>
                    </div>
                    {isDefault && <span className="pill">Quest Default</span>}
                  </div>
                  <p className="muted">
                    {filesystemReady ? 'Filesystem override ready.' : 'No filesystem override yet.'}
                  </p>
                  <div className="filesystem-wizard-actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => toggleFilesystemEditor(summary.systemId)}
                      disabled={!draft}
                    >
                      {editorOpen ? 'Close Editor' : filesystemReady ? 'Edit Filesystem' : 'Design Filesystem'}
                    </button>
                    {filesystemReady && (
                      <button
                        type="button"
                        className="ghost danger"
                        onClick={() => clearEmbeddedFilesystem(summary.systemId)}
                        disabled={!draft}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  {editorOpen && (
                    <FilesystemOverrideEditor
                      systemId={summary.systemId}
                      value={questFilesystem}
                      onChange={next => updateEmbeddedFilesystem(summary.systemId, next)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )
    }
    if (wizardStep === 'completionEmail') {
      if (!draft) {
        return (
          <div className="quest-wizard-placeholder">
            <p>Stage a quest earlier in the wizard before drafting its completion mail.</p>
          </div>
        )
      }
      const followUpQuest = draft.followUpQuestId ? quests.find(q => q.id === draft.followUpQuestId) : undefined
      const completionPreview = renderCompletionMailPreview(wizardCompletionMailDraft.body, draft, followUpQuest)
      return (
        <div className="quest-wizard-form completion-mail-form">
          {wizardCompletionMailErrors.length > 0 && (
            <div
              className="inline-alert error"
              role="alert"
              tabIndex={-1}
              ref={wizardStep === 'completionEmail' ? wizardAlertRef : undefined}
            >
              <strong>Resolve these completion mail issues</strong>
              <ul>
                {wizardCompletionMailErrors.map(error => <li key={error}>{error}</li>)}
              </ul>
            </div>
          )}
          <div className="wizard-field-grid">
            <label>
              Sender Name
              <input
                value={wizardCompletionMailDraft.fromName}
                onChange={e => updateWizardCompletionMail({ fromName: e.target.value })}
                placeholder="Atlas Ops"
              />
            </label>
            <label>
              Sender Address
              <input
                value={wizardCompletionMailDraft.fromAddress}
                onChange={e => updateWizardCompletionMail({ fromAddress: e.target.value })}
                placeholder="ops@atlasnet"
              />
            </label>
            <label className="full">
              Subject / Wrap-up headline
              <input
                value={wizardCompletionMailDraft.subject}
                onChange={e => updateWizardCompletionMail({ subject: e.target.value })}
                placeholder="Debrief: Evidence Purged"
              />
            </label>
            <label className="full">
              Preview / Snippet (optional)
              <input
                value={wizardCompletionMailDraft.previewLine}
                onChange={e => updateWizardCompletionMail({ previewLine: e.target.value })}
                placeholder="Atlas tallied your reward and the relay is clean."
              />
            </label>
            <label>
              In-universe Date/Time
              <input
                value={wizardCompletionMailDraft.inUniverseDate}
                onChange={e => updateWizardCompletionMail({ inUniverseDate: e.target.value })}
                placeholder="2089-06-02 09:44"
              />
            </label>
          </div>
          <div className="completion-mail-body-grid">
            <label className="completion-mail-body-field">
              Body
              <textarea
                className="completion-mail-body-input"
                rows={9}
                value={wizardCompletionMailDraft.body}
                onChange={e => updateWizardCompletionMail({ body: e.target.value })}
                placeholder={'Operator {player_handle},\n\nAtlas logged your wipe. {reward_credits} credits transferred.'}
              />
            </label>
            <div className="completion-mail-preview">
              <div className="completion-mail-preview-header">
                <strong>Live Preview</strong>
                {followUpQuest && (
                  <span>Next: {followUpQuest.title || followUpQuest.id}</span>
                )}
              </div>
              <pre>
                {completionPreview || 'Start typing the body copy to preview placeholder replacements.'}
              </pre>
            </div>
          </div>
          <div className="completion-mail-hints">
            <span>Dynamic placeholders</span>
            <ul>
              {COMPLETION_PLACEHOLDER_HINTS.map(({ token, helper }) => (
                <li key={token}>
                  <code>{token}</code>
                  <span>{helper}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="wizard-field-grid completion-mail-meta-grid">
            <label data-tooltip={FIELD_HINTS.creditsReward}>
              Credits Reward
              <input
                type="number"
                value={draft.rewards?.credits ?? 0}
                onChange={e => updateCurrentQuest(prev => ({ ...prev, rewards: { ...prev.rewards, credits: Number(e.target.value) } }))}
              />
            </label>
            <label>
              Follow-up Quest (optional)
              <select
                value={draft.followUpQuestId || ''}
                onChange={e => updateCurrentQuest(prev => ({ ...prev, followUpQuestId: e.target.value || undefined }))}
              >
                <option value="">No automatic next quest</option>
                {quests.filter(q => q.id !== draft.id).map(q => (
                  <option key={q.id} value={q.id}>{q.title || q.id}</option>
                ))}
              </select>
              <span className="muted helper">
                {followUpQuest
                  ? `Players are nudged toward ${followUpQuest.title || followUpQuest.id}.`
                  : 'Optional: chain directly into a follow-up quest.'}
              </span>
            </label>
          </div>
          <div className="wizard-field-grid completion-mail-rewards">
            <div className="full reward-flags-field" data-tooltip={FIELD_HINTS.rewardFlags}>
              <div className="reward-flags-header">
                <span>Flags Granted</span>
                <button type="button" onClick={addRewardFlag}>+ Add Flag</button>
              </div>
              {rewardFlags.length === 0 && <p className="muted empty">No completion flags defined yet.</p>}
              {rewardFlags.map((flag, idx) => (
                <div key={`${flag.key || 'flag'}-${idx}`} className="reward-flag-row">
                  <label data-tooltip={FIELD_HINTS.rewardFlagKey}>
                    Key
                    <input
                      list={wizardRewardFlagListId}
                      value={flag.key || ''}
                      onChange={e => updateRewardFlag(idx, { key: e.target.value })}
                      placeholder="quest_completed"
                    />
                  </label>
                  <label data-tooltip={FIELD_HINTS.rewardFlagValue}>
                    Value
                    <input
                      value={flag.value || ''}
                      onChange={e => updateRewardFlag(idx, { value: e.target.value })}
                      placeholder="true"
                    />
                  </label>
                  <button type="button" className="ghost" onClick={() => removeRewardFlag(idx)}>Remove</button>
                </div>
              ))}
              {questFlagSuggestions.length > 0 && (
                <datalist id={wizardRewardFlagListId}>
                  {questFlagSuggestions.map(flag => (
                    <option key={`reward-flag-${flag}`} value={flag} />
                  ))}
                </datalist>
              )}
            </div>
            <label className="full" data-tooltip={FIELD_HINTS.unlockCommands}>
              Unlock Commands
              {unlockCommandInput.Input}
            </label>
          </div>
          <div className="wizard-field-group completion-mail-link">
            <span className="field-label">Completion mail id</span>
            <p>
              <code>{draft.completionEmailId || wizardCompletionMailDraft.id}</code>
            </p>
            <p className="muted">When you hit Next we stage this mail as a draft entry linked to the quest.</p>
          </div>
        </div>
      )
    }
    if (wizardStep === 'summary') {
      if (!draft) {
        return (
          <div className="quest-wizard-placeholder">
            <p>Create or select a quest before reviewing the summary.</p>
          </div>
        )
      }
      const introMail = draft.introEmailId ? mailDefinitions.find(entry => entry.id === draft.introEmailId) : null
      const completionMail = draft.completionEmailId ? mailDefinitions.find(entry => entry.id === draft.completionEmailId) : null
      const followUpQuest = draft.followUpQuestId ? quests.find(q => q.id === draft.followUpQuestId) : null
      const rewardCredits = draft.rewards?.credits ?? 0
      const rewardFlagsList = (draft.rewards?.flags || []).filter(flag => flag?.key?.trim())
      const unlocks = draft.rewards?.unlocks_commands || []
      const stepSummaries = draft.steps || []
      return (
        <div className="quest-wizard-form summary-form">
          {wizardSummaryErrors.length > 0 && (
            <div
              className="inline-alert error"
              role="alert"
              tabIndex={-1}
              ref={wizardStep === 'summary' ? wizardAlertRef : undefined}
            >
              <strong>Resolve before saving</strong>
              <ul>
                {wizardSummaryErrors.map(message => <li key={message}>{message}</li>)}
              </ul>
            </div>
          )}
          {wizardFinishing && (
            <div className="inline-alert info">
              <strong>Working…</strong> Saving mails and quest definition.
            </div>
          )}
          <div className="summary-grid">
            <section>
              <h4>Intro Email</h4>
              {introMail ? (
                <ul>
                  <li><strong>Sender:</strong> {introMail.fromName} &lt;{introMail.fromAddress}&gt;</li>
                  <li><strong>Subject:</strong> {introMail.subject}</li>
                  <li><strong>Snippet:</strong> {introMail.previewLine || '—'}</li>
                </ul>
              ) : (
                <p className="muted">Not linked yet.</p>
              )}
            </section>
            <section>
              <h4>Quest Metadata</h4>
              <ul>
                <li><strong>Title:</strong> {draft.title || 'Untitled quest'}</li>
                <li><strong>Difficulty:</strong> {draft.difficulty || 'Unspecified'}</li>
                <li><strong>Tags:</strong> {draft.tags?.length ? draft.tags.join(', ') : 'None'}</li>
              </ul>
            </section>
            <section className="summary-steps">
              <h4>Step List</h4>
              {stepSummaries.length === 0 ? (
                <p className="muted">No steps attached.</p>
              ) : (
                <ol>
                  {stepSummaries.map((step, idx) => (
                    <li key={step.id || `step-${idx}`}>
                      <div className="summary-step-title">
                        <strong>{step.id || `Step ${idx + 1}`}</strong>
                        <span className="muted">{STEP_TYPE_LABELS[step.type] || step.type}</span>
                      </div>
                      {step.hints?.prompt && <p className="muted">{step.hints.prompt}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <section>
              <h4>Filesystems</h4>
              {systemIdsInUse.length === 0 ? (
                <p className="muted">No systems targeted.</p>
              ) : (
                <ul className="filesystem-summary-list">
                  {questSystemSummaries.map(summary => {
                    const name = summary.override?.label || summary.baseDefinition?.label || summary.fallbackProfile?.label || summary.systemId
                    const hasFilesystem = !!draft.embedded_filesystems?.[summary.systemId]
                    return (
                      <li key={`summary-fs-${summary.systemId}`}>
                        <strong>{name}</strong>
                        <span className={`pill-lite ${hasFilesystem ? 'success' : 'warning'}`}>
                          {hasFilesystem ? 'Override ready' : 'Missing override'}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
            <section>
              <h4>Completion Email</h4>
              {completionMail ? (
                <ul>
                  <li><strong>Sender:</strong> {completionMail.fromName} &lt;{completionMail.fromAddress}&gt;</li>
                  <li><strong>Subject:</strong> {completionMail.subject}</li>
                </ul>
              ) : (
                <p className="muted">No completion email linked.</p>
              )}
            </section>
            <section>
              <h4>Rewards</h4>
              <ul>
                <li><strong>Credits:</strong> {rewardCredits}</li>
                <li>
                  <strong>Flags:</strong>
                  {rewardFlagsList.length === 0 ? (
                    <span> None</span>
                  ) : (
                    <ul>
                      {rewardFlagsList.map((flag, idx) => (
                        <li key={`${flag.key}-${idx}`}><code>{flag.key}{flag.value ? `=${flag.value}` : ''}</code></li>
                      ))}
                    </ul>
                  )}
                </li>
                <li>
                  <strong>Unlocks:</strong>
                  {unlocks.length === 0 ? <span> None</span> : <span> {unlocks.join(', ')}</span>}
                </li>
              </ul>
            </section>
            <section>
              <h4>Next Quest Link</h4>
              {followUpQuest ? (
                <p>{followUpQuest.title || followUpQuest.id} ({followUpQuest.id})</p>
              ) : (
                <p className="muted">No automatic follow-up configured.</p>
              )}
            </section>
          </div>
          <p className="muted summary-note">
            Review the details above, then use “Save & Finish” to persist the mails and quest, or Back to revise earlier steps.
          </p>
        </div>
      )
    }
    const details = QUEST_WIZARD_STEP_DETAILS[wizardStep as QuestWizardStep]
    return (
      <div className="quest-wizard-placeholder">
        <p>
          {details.title} content will live here. This placeholder keeps the modal wired up while the detailed step forms
          are implemented.
        </p>
        <p className="muted">
          Continue using the existing quest editor to make changes until each guided step is fully interactive.
        </p>
      </div>
    )
  }, [
    addRewardFlag,
    draft,
    handleQuestMetadataChange,
    handleWizardAddStep,
    handleWizardApplyTemplate,
    handleWizardStepAutoAdvanceChange,
    handleWizardStepCommandExampleChange,
    handleWizardStepDescriptionChange,
    handleWizardStepDuplicate,
    handleWizardStepIdChange,
    handleWizardStepMove,
    handleWizardStepTargetSystemChange,
    handleWizardStepParamChange,
    handleWizardStepTypeChange,
    handleWizardStepDelete,
    mailDefinitions,
    quests,
    questFlagSuggestions,
    removeRewardFlag,
    rewardFlags,
    unlockCommandInput.Input,
    updateCurrentQuest,
    updateRewardFlag,
    updateWizardCompletionMail,
    updateWizardIntroMail,
    updateWizardSystemTemplateDraft,
    closeWizardSystemTemplateCreator,
    openWizardSystemTemplateCreator,
    saveWizardSystemTemplate,
    wizardFinishing,
    wizardCompletionMailDraft,
    wizardCompletionMailErrors,
    wizardIntroMailDraft,
    wizardIntroMailErrors,
    wizardQuestDetailsErrors,
    wizardQuestStepsErrors,
    wizardQuestTagInput.Input,
    wizardSummaryErrors,
    wizardStep,
    wizardSystemTemplateDraft,
    wizardSystemTemplateError,
    wizardSystemTemplateSaving,
    systemOptions,
    systemsLoading,
    questSystemSummaries,
    systemIdsInUse,
    wizardFilesystemErrors,
    openFilesystemEditors,
    toggleFilesystemEditor,
    clearEmbeddedFilesystem,
    updateEmbeddedFilesystem,
    introMailBehaviorIdPrefix,
    wizardRewardFlagListId
  ])

  useEffect(() => {
    if (wizardStep !== 'summary') {
      setWizardSummaryErrors([])
    }
  }, [wizardStep])

  useEffect(() => {
    if (wizardStep !== 'filesystem') {
      setWizardFilesystemErrors([])
    }
  }, [wizardStep])

  useEffect(() => {
    if (wizardStep !== 'questSteps') {
      setWizardSystemTemplateDraft(null)
      setWizardSystemTemplateError(null)
    }
  }, [wizardStep])

  const hasWizardDraft = !!draft
  const wizardDraftStepCount = draft?.steps.length ?? 0

  useEffect(() => {
    if (!hasWizardDraft || !wizardSystemTemplateDraft) return
    if (wizardSystemTemplateDraft.stepIndex >= wizardDraftStepCount) {
      setWizardSystemTemplateDraft(null)
      setWizardSystemTemplateError(null)
    }
  }, [hasWizardDraft, wizardDraftStepCount, wizardSystemTemplateDraft])

  useEffect(() => {
    if (!wizardOpen) {
      setWizardSystemTemplateDraft(null)
      setWizardSystemTemplateError(null)
    }
  }, [wizardOpen])

  const discardWizardQuestChanges = useCallback(() => {
    const questId = wizardEntryQuestIdRef.current
    const createdByWizard = wizardCreatedQuestRef.current
    const previousQuestId = wizardPreviousQuestIdRef.current
    if (questId) {
      cleanupWizardMailDrafts(questId)
    }
    resetWizardEntryTracking()
    if (!questId) return

    if (createdByWizard) {
      syncQuestList(prev => prev.filter(q => q.id !== questId))
      if (previousQuestId) {
        const previousQuest = quests.find(q => q.id === previousQuestId)
        if (previousQuest) {
          selectQuest(previousQuest)
        } else {
          selectQuest(null)
        }
      } else {
        selectQuest(null)
      }
      return
    }

    const fallbackQuest = quests.find(q => q.id === questId)
    if (fallbackQuest) {
      selectQuest(fallbackQuest)
    } else {
      selectQuest(null)
    }
  }, [cleanupWizardMailDrafts, quests, resetWizardEntryTracking, selectQuest, syncQuestList])

  useEffect(() => {
    if (!wizardOpen) {
      setWizardCancelConfirmOpen(false)
      resetWizardEntryTracking()
    }
  }, [resetWizardEntryTracking, wizardOpen])

  const focusWizardAlert = useCallback(() => {
    if (typeof window === 'undefined') return
    window.requestAnimationFrame(() => {
      const target = wizardAlertRef.current
      if (!target) return
      target.focus()
      if (target.scrollIntoView) {
        target.scrollIntoView({ block: 'start', behavior: 'smooth' })
      }
    })
  }, [])

  useEffect(() => {
    if (!wizardOpen) return
    const bodyNode = wizardBodyRef.current
    if (!bodyNode) return
    if (bodyNode.scrollTo) {
      bodyNode.scrollTo({ top: 0 })
    } else {
      bodyNode.scrollTop = 0
    }
  }, [wizardOpen, wizardStep])

  useEffect(() => {
    if (!systemWizardOpen) return
    const node = systemWizardBodyRef.current
    if (!node) return
    if (node.scrollTo) {
      node.scrollTo({ top: 0 })
    } else {
      node.scrollTop = 0
    }
  }, [systemWizardOpen, systemWizardStep])

  useEffect(() => {
    if (!wizardOpen) return
    const hasErrors =
      (wizardStep === 'introEmail' && wizardIntroMailErrors.length > 0) ||
      (wizardStep === 'questCore' && wizardQuestDetailsErrors.length > 0) ||
      (wizardStep === 'questSteps' && wizardQuestStepsErrors.length > 0) ||
      (wizardStep === 'filesystem' && wizardFilesystemErrors.length > 0) ||
      (wizardStep === 'completionEmail' && wizardCompletionMailErrors.length > 0) ||
      (wizardStep === 'summary' && wizardSummaryErrors.length > 0)
    if (hasErrors) {
      focusWizardAlert()
    }
  }, [focusWizardAlert, wizardCompletionMailErrors, wizardFilesystemErrors, wizardIntroMailErrors, wizardOpen, wizardQuestDetailsErrors, wizardQuestStepsErrors, wizardStep, wizardSummaryErrors])

  const wizardQuestDirty = useMemo(() => {
    if (!draft) return false
    if (draft.__unsaved) return true
    const baseline = quests.find(q => q.id === draft.id)
    if (!baseline) return true
    try {
      return JSON.stringify(questToPayload(draft)) !== JSON.stringify(questToPayload(baseline))
    } catch (err) {
      console.warn('[quest designer] unable to diff quest payload', err)
      return true
    }
  }, [draft, quests])

  const wizardMailDirty = useMemo(() => {
    if (!draft) return false
    const ids = [draft.introEmailId, draft.completionEmailId].filter(Boolean) as string[]
    if (!ids.length) return false
    return ids.some(id => {
      const entry = mailDefinitions.find(mail => mail.id === id)
      if (!entry) return false
      const snapshot = mailSnapshotRef.current[id]
      if (!snapshot) return true
      try {
        return JSON.stringify(entry) !== snapshot
      } catch (err) {
        console.warn('[quest designer] unable to diff mail payload', err)
        return true
      }
    })
  }, [draft, mailDefinitions])

  const wizardHasUnsavedChanges = wizardQuestDirty || wizardMailDirty

  const currentWizardStepDetails = QUEST_WIZARD_STEP_DETAILS[wizardStep]
  const currentWizardStepIndex = QUEST_WIZARD_STEPS.indexOf(wizardStep)
  const totalWizardSteps = QUEST_WIZARD_STEPS.length
  const wizardProgressLabel = `Step ${currentWizardStepIndex + 1} of ${totalWizardSteps}`
  const wizardAtFirstStep = currentWizardStepIndex === 0
  const wizardAtLastStep = currentWizardStepIndex === totalWizardSteps - 1

  const handleWizardNext = () => {
    if (wizardStep === 'introEmail') {
      handleIntroEmailNext()
      return
    }
    if (wizardStep === 'questCore') {
      handleQuestDetailsNext()
      return
    }
    if (wizardStep === 'questSteps') {
      handleQuestStepsNext()
      return
    }
    if (wizardStep === 'filesystem') {
      handleFilesystemStepNext()
      return
    }
    if (wizardStep === 'completionEmail') {
      handleCompletionEmailNext()
      return
    }
    goToNextWizardStep()
  }

  const dismissWizardCancelPrompt = useCallback(() => {
    setWizardCancelConfirmOpen(false)
  }, [])

  const confirmWizardCancel = useCallback(() => {
    discardWizardQuestChanges()
    setWizardCancelConfirmOpen(false)
    closeWizard()
  }, [closeWizard, discardWizardQuestChanges])

  const handleWizardCancel = useCallback(() => {
    if (wizardHasUnsavedChanges) {
      setWizardCancelConfirmOpen(true)
      return
    }
    closeWizard()
  }, [closeWizard, wizardHasUnsavedChanges])

  useEffect(() => {
    if (typeof window === 'undefined') {
      setQuestOrderHydrated(true)
      return
    }
    try {
      const raw = window.localStorage.getItem(QUEST_ORDER_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          questOrderRef.current = parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        }
      }
    } catch (err) {
      console.warn('[quest designer] unable to hydrate quest order', err)
    } finally {
      setQuestOrderHydrated(true)
    }
  }, [])


  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const node = document.createElement('div')
    node.className = 'quest-designer-tooltip'
    document.body.appendChild(node)
    tooltipNodeRef.current = node
    return () => {
      document.body.removeChild(node)
      tooltipNodeRef.current = null
    }
  }, [])

  const hideTooltip = useCallback(() => {
    const node = tooltipNodeRef.current
    if (!node) return
    node.style.opacity = '0'
    node.style.visibility = 'hidden'
  }, [])

  const showTooltipAtPoint = useCallback((text: string, clientX: number, clientY: number) => {
    const node = tooltipNodeRef.current
    if (!node) return
    if (node.textContent !== text) {
      node.textContent = text
    }

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const offset = 8
    const tooltipWidth = node.offsetWidth || 0
    const tooltipHeight = node.offsetHeight || 0

    let nextX = clientX + offset
    let nextY = clientY + offset

    if (clientX + tooltipWidth + offset > viewportWidth) {
      nextX = Math.max(0, clientX - tooltipWidth - offset)
    }
    if (clientY + tooltipHeight + offset > viewportHeight) {
      nextY = Math.max(0, clientY - tooltipHeight - offset)
    }

    node.style.transform = `translate(${nextX}px, ${nextY}px)`
    node.style.opacity = '1'
    node.style.visibility = 'visible'
  }, [])

  const handleTooltipMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement | null)?.closest('[data-tooltip]') as HTMLElement | null
    if (!target) {
      hideTooltip()
      return
    }
    const hint = target.getAttribute('data-tooltip')
    if (!hint) {
      hideTooltip()
      return
    }
    showTooltipAtPoint(hint, event.clientX, event.clientY)
  }, [hideTooltip, showTooltipAtPoint])

  const handleTooltipFocus = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement | null)?.closest('[data-tooltip]') as HTMLElement | null
    if (!target) {
      hideTooltip()
      return
    }
    const hint = target.getAttribute('data-tooltip')
    if (!hint) {
      hideTooltip()
      return
    }
    const rect = target.getBoundingClientRect()
    const focusX = rect.left + rect.width / 2
    const focusY = rect.bottom
    showTooltipAtPoint(hint, focusX, focusY)
  }, [hideTooltip, showTooltipAtPoint])

  const handleTooltipLeave = useCallback(() => {
    hideTooltip()
  }, [hideTooltip])

  const handleTooltipBlur = useCallback(() => {
    hideTooltip()
  }, [hideTooltip])

  const loadMailLibrary = useCallback(async () => {
    setMailLoading(true)
    setMailError(null)
    try {
      const messages = await listAdminTerminalMail()
      setMailDefinitionsState(messages)
      serverMailIdsRef.current = new Set(messages.map(mail => mail.id))
      const snapshot: Record<string, string> = {}
      messages.forEach(mail => {
        snapshot[mail.id] = JSON.stringify(mail)
      })
      mailSnapshotRef.current = snapshot
      return messages
    } catch (err) {
      console.error('[quest designer] failed to load mail library', err)
      setMailDefinitionsState([])
      serverMailIdsRef.current = new Set()
      mailSnapshotRef.current = {}
      setMailError('Unable to load mail library.')
      return []
    } finally {
      setMailLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMailLibrary()
  }, [loadMailLibrary])

  useEffect(() => {
    primeMailDefinitions(mailDefinitions)
  }, [mailDefinitions])

  useEffect(() => {
    if (!isAdmin) return undefined
    let cancelled = false
    const loadTags = async () => {
      try {
        const tags = await listQuestTags()
        if (cancelled || !Array.isArray(tags) || !tags.length) return
        setQuestTagSuggestions(tags)
      } catch (err: any) {
        console.error('[quest designer] failed to load quest tags', err)
        if (cancelled) return
        const friendly = err?.message || 'Unable to load quest tag suggestions.'
        pushToast({ title: 'Tag Suggestions Unavailable', message: friendly, kind: 'warning', dedupeKey: 'quest-tags-load' })
      }
    }
    void loadTags()
    return () => { cancelled = true }
  }, [isAdmin, pushToast])

  useEffect(() => {
    if (!mailSelectedId || mailSaving || mailPublishing) return
    const entry = mailDefinitions.find(mail => mail.id === mailSelectedId)
    if (!entry) return
    setMailDraft(prev => (prev.id === entry.id ? { ...entry, body: entry.body || '', status: entry.status || 'draft' } : prev))
  }, [mailDefinitions, mailSelectedId, mailSaving, mailPublishing])

  const applyStoredQuestOrder = useCallback((entries: DesignerQuest[]) => (
    applyQuestOrderFromStorage(entries, questOrderRef.current)
  ), [])

  const reorderQuestList = useCallback((sourceId: string, targetId: string | null) => {
    syncQuestList(prev => reorderQuestSequence(prev, sourceId, targetId))
  }, [syncQuestList])

  useEffect(() => {
    if (typeof window === 'undefined' || !deleteDialogOpen) return undefined
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleteInProgress) {
        setDeleteDialogOpen(false)
      }
    }
    window.addEventListener('keydown', listener)
    return () => {
      window.removeEventListener('keydown', listener)
    }
  }, [deleteDialogOpen, deleteInProgress])

  const applyQuestSnapshot = useCallback((snapshot?: SerializedQuestState | null, savedAt?: string | null) => {
    if (!snapshot) return false
    setPlayerQuestStatuses(snapshot.statuses || {})
    setQuestStatusTimestamp(savedAt || null)
    return true
  }, [])

  const loadQuestStatusSnapshot = useCallback(async () => {
    setQuestStateLoading(true)
    setQuestStatusError(null)
    let hadSnapshot = false
    try {
      const cached = getCachedDesktop()
      if (cached?.terminalState?.questState) {
        hadSnapshot = applyQuestSnapshot(cached.terminalState.questState, cached.terminalState.savedAt || null) || hadSnapshot
      }
      const unified = await hydrateFromServer()
      if (unified?.desktop?.terminalState?.questState) {
        hadSnapshot = applyQuestSnapshot(unified.desktop.terminalState.questState, unified.desktop.terminalState.savedAt || null) || hadSnapshot
      } else if (!hadSnapshot) {
        setPlayerQuestStatuses({})
        setQuestStatusTimestamp(null)
      }
    } catch (err) {
      console.error('[quest designer] failed to load quest snapshot', err)
      if (!hadSnapshot) {
        setQuestStatusError('Unable to load player quest status snapshot.')
        setPlayerQuestStatuses({})
        setQuestStatusTimestamp(null)
      } else {
        setQuestStatusError('Unable to refresh player quest status snapshot.')
      }
    } finally {
      setQuestStateLoading(false)
    }
  }, [applyQuestSnapshot])

  useEffect(() => {
    void loadQuestStatusSnapshot()
  }, [loadQuestStatusSnapshot])

  useEffect(() => {
    if (!questOrderHydrated) return undefined
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const data = await listTerminalQuests({ includeDrafts: true })
        if (cancelled) return
        const normalized = data.map(normalizeQuest)
        const ordered = applyStoredQuestOrder(normalized)
        questOrderRef.current = ordered.map(q => q.id)
        setQuests(ordered)
        persistQuestOrder(questOrderRef.current)
      } catch (err) {
        console.error('[quest designer] failed to load quests', err)
        if (!cancelled) setErrors(['Failed to load quests from server.'])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [applyStoredQuestOrder, persistQuestOrder, questOrderHydrated])

  useEffect(() => {
    let cancelled = false
    const loadSystems = async () => {
      setSystemsLoading(true)
      try {
        const payload: SystemDefinitionsResponse = await listSystemDefinitions()
        if (cancelled) return
        const nextDefinitions = payload.systems?.length
          ? payload.systems
          : profilesToDefinitions(payload.profiles || [], 'profile')
        const nextDefinitionTemplates = payload.systemTemplates?.length
          ? payload.systemTemplates
          : profilesToDefinitions(payload.templates || [], 'template')
        setSystemProfilesState(payload.profiles || [])
        setSystemTemplates(payload.templates || [])
        setSystemDefinitionsState(nextDefinitions)
        setSystemDefinitionTemplates(nextDefinitionTemplates)
      } catch (err) {
        console.error('[quest designer] failed to load system profiles', err)
        if (!cancelled) {
          setSystemProfilesState([])
          setSystemTemplates([])
          setSystemDefinitionsState([])
          setSystemDefinitionTemplates([])
        }
      } finally {
        if (!cancelled) setSystemsLoading(false)
      }
    }
    void loadSystems()
    return () => { cancelled = true }
  }, [])

  const handleQuestSelection = (quest: DesignerQuest) => {
    if (draggingQuestId) return
    if (draft && draft.id === quest.id) {
      selectQuest(null)
      return
    }
    if (!draft && selectedKey === quest.id) {
      selectQuest(null)
      return
    }
    selectQuest(quest)
  }

  const handleQuestDragStart = (questId: string) => (event: React.DragEvent<HTMLButtonElement>) => {
    if (quests.length <= 1) return
    event.stopPropagation()
    setDraggingQuestId(questId)
    setDragOverQuestId(null)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', questId)
  }

  const handleQuestDragOver = (questId: string) => (event: React.DragEvent<HTMLButtonElement>) => {
    if (!draggingQuestId || draggingQuestId === questId) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (dragOverQuestId !== questId) {
      setDragOverQuestId(questId)
    }
  }

  const handleQuestDragLeave = (questId: string) => () => {
    if (dragOverQuestId === questId) {
      setDragOverQuestId(null)
    }
  }

  const handleQuestDrop = (questId: string) => (event: React.DragEvent<HTMLButtonElement>) => {
    if (!draggingQuestId) return
    event.preventDefault()
    event.stopPropagation()
    if (draggingQuestId !== questId) {
      reorderQuestList(draggingQuestId, questId)
    }
    setDragOverQuestId(null)
    setDraggingQuestId(null)
  }

  const handleQuestDragEnd = () => {
    setDraggingQuestId(null)
    setDragOverQuestId(null)
  }

  const handleDropToEnd = (event: React.DragEvent<HTMLDivElement>) => {
    if (!draggingQuestId) return
    event.preventDefault()
    reorderQuestList(draggingQuestId, null)
    setDraggingQuestId(null)
    setDragOverQuestId(null)
  }

  const handleDropZoneDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!draggingQuestId) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragOverQuestId(null)
  }


  const updateTrigger = (patch: Partial<OperationTrigger>) => {
    updateCurrentQuest(prev => {
      if (!prev) return prev
      const base = prev.trigger || { type: DEFAULT_TRIGGER }
      const merged: OperationTrigger = { ...base, ...patch }
      if (patch.quest_ids) {
        merged.quest_ids = patch.quest_ids.filter(id => id && id !== prev.id)
      }
      return {
        ...prev,
        trigger: sanitizeTrigger(merged)
      }
    })
  }

  const updateStep = (index: number, next: OperationStep) => {
    updateCurrentQuest(prev => ({ ...prev, steps: prev.steps.map((step, idx) => (idx === index ? next : step)) }))
  }

  const addStep = () => {
    if (!draft) return
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={publishing || saving || draft.status === 'published'}
                  >
                    {publishing ? 'Publishing…' : 'Publish'}
                  </button>
    const nextStep: OperationStep = {
      id: `step_${draft.steps.length + 1}`,
      type: 'SCAN_HOST',
      params: { target_ip: '' },
      auto_advance: true
    }
    updateCurrentQuest(prev => ({ ...prev, steps: [...prev.steps, nextStep] }))
  }

  const moveStep = (index: number, dir: -1 | 1) => {
    if (!draft) return
    const steps = [...draft.steps]
    const target = index + dir
    if (target < 0 || target >= steps.length) return
    const tmp = steps[index]
    steps[index] = steps[target]
    steps[target] = tmp
    updateCurrentQuest(prev => ({ ...prev, steps }))
  }

  const duplicateStep = (index: number) => {
    if (!draft) return
    const step = draft.steps[index]
    const clone: OperationStep = {
      ...step,
      id: `${step.id}_copy`,
      params: { ...step.params }
    }
    const steps = [...draft.steps]
    steps.splice(index + 1, 0, clone)
    updateCurrentQuest(prev => ({ ...prev, steps }))
  }

  const deleteStep = (index: number) => {
    if (!draft) return
    updateCurrentQuest(prev => ({ ...prev, steps: prev.steps.filter((_, idx) => idx !== index) }))
  }

  const completionFlagConflicts = useMemo(() => {
    if (!draft) return [] as string[]
    const trimmed = draft.completion_flag?.trim()
    if (!trimmed) return []
    return quests
      .filter(q => q.id !== draft.id && q.completion_flag?.trim() === trimmed)
      .map(q => q.title || q.id)
  }, [draft, quests])

  const questIdSuggestions = useMemo(() => {
    const currentId = draft?.id
    return quests
      .filter(q => !currentId || q.id !== currentId)
      .map(q => q.id)
  }, [draft?.id, quests])

  const completionTriggerInput = useTagInput({
    values: draft?.trigger?.quest_ids || [],
    onChange: values => updateTrigger({ quest_ids: values }),
    suggestions: questIdSuggestions,
    placeholder: 'quest_id',
    ariaLabel: 'Trigger quest completions'
  })

  const requiredQuestInput = useTagInput({
    values: draft?.requirements?.required_quests || [],
    onChange: values => updateCurrentQuest(prev => ({ ...prev, requirements: { ...prev.requirements, required_quests: values } })),
    suggestions: questIdSuggestions,
    placeholder: 'quest_id',
    ariaLabel: 'Required quests'
  })

  const requiredFlagInput = useTagInput({
    values: draft?.requirements?.required_flags || [],
    onChange: values => updateCurrentQuest(prev => ({ ...prev, requirements: { ...prev.requirements, required_flags: values } })),
    suggestions: questFlagSuggestions,
    placeholder: 'flag_name',
    ariaLabel: 'Required flags'
  })

  const mailIdSuggestions = useMemo(() => mailDefinitions.map(entry => entry.id), [mailDefinitions])

  const autoDeliverAcceptInput = useTagInput({
    values: draft?.mail?.autoDeliverOnAccept || [],
    onChange: values => updateQuestMailConfig({ autoDeliverOnAccept: values }),
    suggestions: mailIdSuggestions,
    placeholder: 'mail_id',
    ariaLabel: 'Mail delivered on accept'
  })

  const autoDeliverCompleteInput = useTagInput({
    values: draft?.mail?.autoDeliverOnComplete || [],
    onChange: values => updateQuestMailConfig({ autoDeliverOnComplete: values }),
    suggestions: mailIdSuggestions,
    placeholder: 'mail_id',
    ariaLabel: 'Mail delivered on completion'
  })

  const previewDeliveredInput = useTagInput({
    values: draft?.mail?.previewState?.deliveredIds || [],
    onChange: values => updateMailPreviewField('deliveredIds', values),
    suggestions: mailIdSuggestions,
    placeholder: 'mail_id',
    ariaLabel: 'Preview delivered ids'
  })

  const previewReadInput = useTagInput({
    values: draft?.mail?.previewState?.readIds || [],
    onChange: values => updateMailPreviewField('readIds', values),
    suggestions: mailIdSuggestions,
    placeholder: 'mail_id',
    ariaLabel: 'Preview read ids'
  })

  const previewArchivedInput = useTagInput({
    values: draft?.mail?.previewState?.archivedIds || [],
    onChange: values => updateMailPreviewField('archivedIds', values),
    suggestions: mailIdSuggestions,
    placeholder: 'mail_id',
    ariaLabel: 'Preview archived ids'
  })

  const previewDeletedInput = useTagInput({
    values: draft?.mail?.previewState?.deletedIds || [],
    onChange: values => updateMailPreviewField('deletedIds', values),
    suggestions: mailIdSuggestions,
    placeholder: 'mail_id',
    ariaLabel: 'Preview deleted ids'
  })

  const normalizedSearch = search.trim().toLowerCase()
  const filteredQuests = quests.filter(quest => {
    const lifecycle = playerQuestStatuses[quest.id] || DEFAULT_LIFECYCLE_STATUS
    const matchesFilter = questStatusFilter === 'all' || lifecycle === questStatusFilter
    if (!matchesFilter) return false
    if (!normalizedSearch) return true
    return quest.title.toLowerCase().includes(normalizedSearch) || quest.id.toLowerCase().includes(normalizedSearch)
  })
  const allowQuestReorder = quests.length > 1
  const dropZoneVisible = allowQuestReorder && !!draggingQuestId

  const questStatusCounters = useMemo(() => {
    const counters: Record<QuestLifecycleStatus, number> = {
      not_started: 0,
      in_progress: 0,
      completed: 0
    }
    quests.forEach(q => {
      const lifecycle = playerQuestStatuses[q.id] || DEFAULT_LIFECYCLE_STATUS
      counters[lifecycle] += 1
    })
    return counters
  }, [playerQuestStatuses, quests])

  const runtimeStatusForDraft = draft ? (playerQuestStatuses[draft.id] || DEFAULT_LIFECYCLE_STATUS) : DEFAULT_LIFECYCLE_STATUS

  const dependentQuests = useMemo(() => {
    if (!draft) return { questLinks: [], flagDependents: [] as Array<{ flag: QuestRewardFlag; quests: DesignerQuest[] }> }
    const questLinks = quests.filter(q => q.requirements?.required_quests?.includes(draft.id))
    const normalizedFlags = sanitizeRewardFlags(draft.rewards?.flags)
    const flagDependents = normalizedFlags.map(flag => {
      const tokens = [flag.key]
      if (flag.value) tokens.push(`${flag.key}=${flag.value}`)
      const questsUsing = quests.filter(q => q.id !== draft.id && q.requirements?.required_flags?.some(req => tokens.includes(req)))
      return { flag, quests: questsUsing }
    }).filter(entry => entry.quests.length)
    return { questLinks, flagDependents }
  }, [draft, quests])

  const filteredMailDefinitions = useMemo(() => {
    const term = mailSearch.trim().toLowerCase()
    if (!term) return mailDefinitions
    return mailDefinitions.filter(mail => {
      const haystack = [mail.id, mail.subject, mail.fromName, mail.fromAddress, mail.emailCategory, mail.folder]
      return haystack.some(value => value?.toLowerCase().includes(term))
    })
  }, [mailDefinitions, mailSearch])

  const mailPreviewState = useMemo(() => {
    const serialized = draft?.mail?.previewState || null
    let state = hydrateMailState(serialized)
    state = ensureMailDelivered(state, draft?.mail?.autoDeliverOnAccept)
    state = ensureMailDelivered(state, draft?.mail?.autoDeliverOnComplete)
    return state
  }, [draft?.mail])

  const mailPreviewList: MailListEntry[] = useMemo(
    () => buildMailList(mailPreviewState, { includeArchived: true, includeDeleted: true }),
    [mailPreviewState]
  )

  const currentMailExists = useMemo(() => (
    !!(mailDraft.id && mailDefinitions.some(entry => entry.id === mailDraft.id))
  ), [mailDraft.id, mailDefinitions])

  const relationships = useMemo(() => {
    if (!draft) return null
    const completionFlagId = resolveCompletionFlagId(draft)
    const questMap = new Map(quests.map(quest => [quest.id, quest]))
    const previous: RelationshipEntry[] = []
    const next: RelationshipEntry[] = []
    const prevSeen = new Set<string>()
    const nextSeen = new Set<string>()

    const pushPrev = (quest: DesignerQuest, reason: string) => {
      const key = `${quest.id}|${reason}`
      if (prevSeen.has(key)) return
      prevSeen.add(key)
      previous.push({ quest, reason })
    }

    const pushNext = (quest: DesignerQuest, reason: string) => {
      const key = `${quest.id}|${reason}`
      if (nextSeen.has(key)) return
      nextSeen.add(key)
      next.push({ quest, reason })
    }

    if (draft.trigger?.type === 'ON_QUEST_COMPLETION') {
      (draft.trigger.quest_ids || []).forEach(questId => {
        const quest = questMap.get(questId)
        if (quest) pushPrev(quest, 'ON_QUEST_COMPLETION')
      })
    }

    if (draft.trigger?.type === 'ON_FLAG_SET' && draft.trigger.flag_key) {
      quests.forEach(quest => {
        if (quest.id === draft.id) return
        if (questEmitsFlag(quest, draft.trigger!.flag_key!, draft.trigger.flag_value)) {
          const flagLabel = draft.trigger.flag_value
            ? `${draft.trigger.flag_key}=${draft.trigger.flag_value}`
            : draft.trigger.flag_key
          pushPrev(quest, `ON_FLAG_SET: ${flagLabel}`)
        }
      })
    }

    quests.forEach(quest => {
      if (quest.id === draft.id) return
      if (quest.trigger?.type === 'ON_QUEST_COMPLETION' && quest.trigger.quest_ids?.includes(draft.id)) {
        pushNext(quest, 'ON_QUEST_COMPLETION')
      }
      if (quest.trigger?.type === 'ON_FLAG_SET' && quest.trigger.flag_key === completionFlagId) {
        const flagLabel = quest.trigger.flag_value
          ? `${quest.trigger.flag_key}=${quest.trigger.flag_value}`
          : quest.trigger.flag_key
        pushNext(quest, `ON_FLAG_SET: ${flagLabel}`)
      }
    })

    const shared = quests
      .filter(quest => quest.id !== draft.id && resolveCompletionFlagId(quest) === completionFlagId)
      .map(quest => ({ quest, reason: `completionFlagId = ${completionFlagId}` }))

    return { completionFlagId, previous, next, shared }
  }, [draft, quests])

  const pendingDeleteQuest = deleteDialogOpen && draft && !draft.__unsaved ? draft : null

  const questStatusTimestampLabel = useMemo(() => {
    if (!questStatusTimestamp) return 'Snapshot not captured yet.'
    const parsed = new Date(questStatusTimestamp)
    if (Number.isNaN(parsed.getTime())) return 'Snapshot timestamp unavailable.'
    return `Snapshot saved ${parsed.toLocaleString()}`
  }, [questStatusTimestamp])


  const systemLibraryGroups = useMemo(() => {
    if (!systemDefinitionsState.length) return []
    const typeMap = new Map<SystemType, Map<SystemScope, SystemDefinition[]>>()
    systemDefinitionsState.forEach(definition => {
      const scopes = typeMap.get(definition.type) || new Map<SystemScope, SystemDefinition[]>()
      const entries = scopes.get(definition.scope) || []
      entries.push(definition)
      scopes.set(definition.scope, entries)
      typeMap.set(definition.type, scopes)
    })
    return Array.from(typeMap.entries()).map(([type, scopes]) => ({
      type,
      scopes: Array.from(scopes.entries()).map(([scope, entries]) => ({
        scope,
        entries: entries.sort((a, b) => a.label.localeCompare(b.label))
      }))
    }))
  }, [systemDefinitionsState])

  const systemWizardBaseOptions = useMemo(() => (
    systemDefinitionsState
      .filter(entry => entry.scope === 'global' && entry.type === systemWizardDraft.type)
      .sort((a, b) => a.label.localeCompare(b.label))
  ), [systemDefinitionsState, systemWizardDraft.type])

  const systemWizardBaseDefinition = useMemo(() => (
    systemWizardDraft.baseSystemId
      ? systemDefinitionsState.find(entry => entry.id === systemWizardDraft.baseSystemId)
      : undefined
  ), [systemDefinitionsState, systemWizardDraft.baseSystemId])

  const systemTemplateOptions = useMemo(() => {
    const deduped = new Map<string, string>()
    systemDefinitionTemplates.forEach(template => {
      deduped.set(template.id, template.label)
    })
    systemTemplates.forEach(template => {
      if (!deduped.has(template.id)) {
        deduped.set(template.id, template.label)
      }
    })
    return Array.from(deduped.entries()).map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [systemDefinitionTemplates, systemTemplates])

  const removeSystemIdReferences = useCallback((systemId: string) => {
    if (!systemId) return
    setDraft(prev => {
      if (!prev) return prev
      let changed = false
      const nextSteps = prev.steps.map(step => {
        if (step.target_system_id === systemId) {
          changed = true
          return { ...step, target_system_id: undefined }
        }
        return step
      })
      let nextEmbedded = prev.embedded_filesystems
      if (prev.embedded_filesystems?.[systemId]) {
        nextEmbedded = { ...(prev.embedded_filesystems || {}) }
        delete nextEmbedded[systemId]
        changed = true
      }
      const defaultChanged = prev.default_system_id === systemId
      if (!changed && !defaultChanged) return prev
      return {
        ...prev,
        steps: changed ? nextSteps : prev.steps,
        default_system_id: defaultChanged ? undefined : prev.default_system_id,
        embedded_filesystems: nextEmbedded
      }
    })
  }, [setDraft])

  const openSystemWizardForCreate = useCallback(() => {
    setSystemWizardMode('create')
    setSystemWizardDraft(createSystemWizardDraft())
    setSystemWizardStep('type')
    setSystemWizardError(null)
    setSystemWizardOpen(true)
  }, [])

  const closeSystemWizard = useCallback(() => {
    setSystemWizardOpen(false)
    setSystemWizardError(null)
  }, [])

  const handleCreateQuestOverride = useCallback((systemId: string) => {
    const baseDefinition = systemDefinitionsState.find(entry => entry.id === systemId)
    if (!baseDefinition) {
      pushToast({ title: 'System Not Found', message: 'Unable to locate the selected system.', kind: 'error', dedupeKey: `override-missing-${systemId}` })
      return
    }
    const overrideId = sanitizeSystemId(`${baseDefinition.id}_${draft?.id || 'override'}`)
    const overrideLabel = `${baseDefinition.label} Override`
    setSystemWizardMode('override')
    setSystemWizardDraft(createSystemWizardDraft({
      id: overrideId,
      label: overrideLabel,
      type: baseDefinition.type,
      scope: 'quest_template',
      extendsExisting: true,
      baseSystemId: baseDefinition.id,
      rootPath: baseDefinition.filesystem?.rootPath || baseDefinition.credentials.startingPath || '/',
      templateKey: baseDefinition.filesystem?.templateKey,
      username: baseDefinition.credentials.username,
      startingPath: baseDefinition.credentials.startingPath,
      footprint: baseDefinition.metadata.footprint || '',
      ip: baseDefinition.network.primaryIp || baseDefinition.network.ips[0] || '',
      description: baseDefinition.metadata.description || baseDefinition.description || baseDefinition.label,
      appliesTo: draft?.id ? { questTemplateId: draft.id } : undefined
    }))
    setSystemWizardStep('configure')
    setSystemWizardError(null)
    setSystemWizardOpen(true)
  }, [draft?.id, pushToast, systemDefinitionsState])

  const handleDeleteOverride = useCallback(async (overrideId: string) => {
    const definition = systemDefinitionsState.find(entry => entry.id === overrideId)
    if (!definition) return
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(`Delete override "${definition.label}"?`)
    if (!confirmed) return
    try {
      await deleteSystemDefinition(overrideId)
      setSystemDefinitionsState(prev => removeById(prev, overrideId))
      setSystemProfilesState(prev => prev.filter(entry => entry.id !== overrideId))
      removeSystemIdReferences(overrideId)
      pushToast({ title: 'Override Deleted', message: `${definition.label} removed.`, kind: 'success', dedupeKey: `override-delete-${overrideId}` })
    } catch (err: any) {
      console.error('[quest designer] failed to delete override', err)
      const friendly = err?.message || 'Failed to delete override.'
      pushToast({ title: 'Delete Failed', message: friendly, kind: 'error', dedupeKey: `override-delete-error-${overrideId}` })
    }
  }, [pushToast, removeSystemIdReferences, setSystemDefinitionsState, setSystemProfilesState, systemDefinitionsState])


  const updateSystemWizardDraftField = useCallback(<K extends keyof SystemWizardDraft>(field: K, value: SystemWizardDraft[K]) => {
    setSystemWizardDraft(prev => ({ ...prev, [field]: value }))
  }, [])

  const addWizardTool = useCallback(() => {
    setSystemWizardDraft(prev => ({ ...prev, toolBindings: [...prev.toolBindings, { id: '', name: '', command: '' }] }))
  }, [])

  const updateWizardTool = useCallback((index: number, field: keyof ToolBindingDraft, value: string) => {
    setSystemWizardDraft(prev => {
      const next = [...prev.toolBindings]
      next[index] = { ...next[index], [field]: value }
      return { ...prev, toolBindings: next }
    })
  }, [])

  const removeWizardTool = useCallback((index: number) => {
    setSystemWizardDraft(prev => ({ ...prev, toolBindings: prev.toolBindings.filter((_, idx) => idx !== index) }))
  }, [])


  const currentSystemWizardStepDetails = SYSTEM_WIZARD_STEP_DETAILS[systemWizardStep]
  const systemWizardStepIndex = SYSTEM_WIZARD_STEPS.indexOf(systemWizardStep)
  const systemWizardProgressLabel = `${systemWizardStepIndex + 1} / ${SYSTEM_WIZARD_STEPS.length}`
  const systemWizardAtFirstStep = systemWizardStepIndex <= 0
  const systemWizardAtLastStep = systemWizardStepIndex === SYSTEM_WIZARD_STEPS.length - 1

  const handleSystemWizardBaseChange = useCallback((baseId: string) => {
    const baseDefinition = systemDefinitionsState.find(entry => entry.id === baseId)
    setSystemWizardDraft(prev => ({
      ...prev,
      baseSystemId: baseId || undefined,
      username: baseDefinition?.credentials.username || prev.username,
      startingPath: baseDefinition?.credentials.startingPath || prev.startingPath,
      rootPath: baseDefinition?.filesystem?.rootPath || prev.rootPath,
      ip: baseDefinition?.network.primaryIp || baseDefinition?.network.ips[0] || prev.ip,
      footprint: baseDefinition?.metadata.footprint || prev.footprint,
      templateKey: baseDefinition?.filesystem?.templateKey || prev.templateKey
    }))
  }, [systemDefinitionsState])

  const systemWizardCanNavigate = systemWizardMode === 'create'

  const handleSystemWizardNext = useCallback(() => {
    if (!systemWizardCanNavigate) return
    if (systemWizardStep === 'type') {
      setSystemWizardStep('source')
      setSystemWizardError(null)
      return
    }
    if (systemWizardStep === 'source') {
      if (systemWizardDraft.extendsExisting && !systemWizardDraft.baseSystemId) {
        setSystemWizardError('Select a base system to extend.')
        return
      }
      setSystemWizardStep('configure')
      setSystemWizardError(null)
    }
  }, [systemWizardCanNavigate, systemWizardDraft.baseSystemId, systemWizardDraft.extendsExisting, systemWizardStep])

  const handleSystemWizardBack = useCallback(() => {
    if (!systemWizardCanNavigate) return
    if (systemWizardStep === 'configure') {
      setSystemWizardStep('source')
      setSystemWizardError(null)
      return
    }
    if (systemWizardStep === 'source') {
      setSystemWizardStep('type')
      setSystemWizardError(null)
    }
  }, [systemWizardCanNavigate, systemWizardStep])

  const handleSystemWizardSubmit = useCallback(async () => {
    const normalizedId = sanitizeSystemId(systemWizardDraft.id)
    if (!normalizedId) {
      setSystemWizardError('System ID is required (letters, numbers, dashes, underscores).')
      return
    }
    const label = systemWizardDraft.label.trim()
    if (!label) {
      setSystemWizardError('System label is required.')
      return
    }
    const baseDefinition = systemWizardDraft.extendsExisting && systemWizardDraft.baseSystemId
      ? systemDefinitionsState.find(entry => entry.id === systemWizardDraft.baseSystemId)
      : undefined
    if (systemWizardDraft.extendsExisting && !baseDefinition) {
      setSystemWizardError('Select a base system to extend.')
      return
    }
    const description = systemWizardDraft.description.trim() || label
    const rootPath = systemWizardDraft.rootPath.trim() || baseDefinition?.filesystem?.rootPath || systemWizardDraft.startingPath || '/'
    const templateDefinition = systemWizardDraft.templateKey
      ? systemDefinitionTemplates.find(entry => entry.id === systemWizardDraft.templateKey)
      : undefined
    const legacyTemplate = systemWizardDraft.templateKey
      ? systemTemplates.find(entry => entry.id === systemWizardDraft.templateKey)
      : undefined
    const templateSnapshot = templateDefinition?.filesystem?.snapshot || legacyTemplate?.filesystem
    const shouldIncludeFilesystem = ['filesystem', 'terminal_host', 'composite'].includes(systemWizardDraft.type)
    const filesystemConfig = shouldIncludeFilesystem
      ? systemWizardDraft.extendsExisting && systemWizardDraft.inheritFilesystem && baseDefinition?.filesystem?.snapshot
        ? {
            rootPath,
            readOnly: baseDefinition.filesystem?.readOnly || false,
            templateKey: baseDefinition.filesystem?.templateKey,
            snapshot: cloneFilesystemMap(baseDefinition.filesystem.snapshot)
          }
        : {
            rootPath,
            readOnly: false,
            templateKey: systemWizardDraft.templateKey,
            snapshot: createSystemFilesystemLayout({
              systemId: normalizedId,
              scope: systemWizardDraft.scope,
              rootPath,
              templateSnapshot: templateSnapshot ? cloneFilesystemMap(templateSnapshot) : undefined
            })
          }
      : undefined
    const fallbackIps = baseDefinition?.network.ips?.length ? baseDefinition.network.ips : ['0.0.0.0']
    const resolvedIp = systemWizardDraft.ip.trim()
    const network = systemWizardDraft.extendsExisting && systemWizardDraft.inheritNetwork && baseDefinition
      ? baseDefinition.network
      : {
          primaryIp: resolvedIp || fallbackIps[0],
          ips: resolvedIp ? [resolvedIp] : fallbackIps,
          hostnames: baseDefinition?.network.hostnames || []
        }
    const credentials = {
      username: systemWizardDraft.username.trim() || baseDefinition?.credentials.username || 'guest',
      startingPath: systemWizardDraft.startingPath.trim() || baseDefinition?.credentials.startingPath || '/'
    }
    const metadata = {
      description,
      footprint: systemWizardDraft.footprint.trim() || baseDefinition?.metadata.footprint || '',
      tags: baseDefinition?.metadata.tags || []
    }
    const cleanedTools = systemWizardDraft.toolBindings
      .map(tool => ({
        id: sanitizeSystemId(tool.id) || sanitizeSystemId(tool.name),
        name: tool.name.trim(),
        command: tool.command.trim()
      }))
      .filter(tool => tool.id && tool.name && tool.command)
    const toolsConfig = cleanedTools.length ? { tools: cleanedTools } : undefined
    const appliesTo = systemWizardDraft.appliesTo && Object.keys(systemWizardDraft.appliesTo).length
      ? systemWizardDraft.appliesTo
      : undefined
    const definition: SystemDefinition = {
      id: normalizedId,
      key: normalizedId,
      name: label,
      label,
      description,
      type: systemWizardDraft.type,
      scope: systemWizardDraft.scope,
      extendsSystemId: systemWizardDraft.extendsExisting ? baseDefinition?.id : undefined,
      network,
      credentials,
      metadata,
      ...(filesystemConfig ? { filesystem: filesystemConfig } : {}),
      ...(toolsConfig ? { tools: toolsConfig } : {}),
      ...(appliesTo ? { appliesTo } : {})
    }
    setSystemWizardSaving(true)
    setSystemWizardError(null)
    try {
      const response = await saveSystemDefinition(definition)
      if (response.definition) {
        setSystemDefinitionsState(prev => upsertByLabel(prev, response.definition))
      }
      if (response.profile) {
        setSystemProfilesState(prev => upsertByLabel(prev, response.profile))
      }
      const savedSystemId = response.definition?.id || response.profile?.id || normalizedId
      if (!draft?.default_system_id && systemWizardMode === 'create') {
        updateCurrentQuest(prev => (prev ? { ...prev, default_system_id: savedSystemId } : prev))
      }
      closeSystemWizard()
      pushToast({
        title: systemWizardMode === 'override' ? 'Override Created' : 'System Created',
        message: `${label} is ready to use.`,
        kind: 'success',
        dedupeKey: `system-wizard-${savedSystemId}`
      })
    } catch (err: any) {
      console.error('[quest designer] wizard failed to save system', err)
      const friendly = err?.message || 'Failed to save system.'
      setSystemWizardError(friendly)
      pushToast({ title: 'System Save Failed', message: friendly, kind: 'error', dedupeKey: 'system-wizard-error' })
    } finally {
      setSystemWizardSaving(false)
    }
  }, [
    closeSystemWizard,
    draft?.default_system_id,
    pushToast,
    setSystemDefinitionsState,
    setSystemProfilesState,
    systemDefinitionTemplates,
    systemDefinitionsState,
    systemTemplates,
    systemWizardDraft,
    systemWizardMode,
    updateCurrentQuest
  ])

  const handleSystemWizardScopeChange = useCallback((scope: SystemScope) => {
    setSystemWizardDraft(prev => {
      const next: SystemWizardDraft = {
        ...prev,
        scope
      }
      if (scope === 'global') {
        delete next.appliesTo
      }
      return next
    })
  }, [])

  const handleSystemWizardExtendsToggle = useCallback((extend: boolean) => {
    setSystemWizardDraft(prev => ({
      ...prev,
      extendsExisting: extend,
      baseSystemId: extend ? prev.baseSystemId : undefined
    }))
  }, [])

  const handleSystemWizardAppliesToChange = useCallback((field: 'questTemplateId' | 'questId' | 'questInstanceId', value: string) => {
    setSystemWizardDraft(prev => {
      const trimmed = value.trim()
      if (!trimmed) {
        if (!prev.appliesTo) return prev
        const nextContext = { ...prev.appliesTo }
        delete nextContext[field]
        const hasKeys = Object.keys(nextContext).length > 0
        const next = { ...prev }
        if (hasKeys) {
          next.appliesTo = nextContext
        } else {
          delete next.appliesTo
        }
        return next
      }
      const next = { ...prev, appliesTo: { ...(prev.appliesTo || {}), [field]: trimmed } }
      return next
    })
  }, [])

  const systemWizardStepContent = useMemo(() => {
    const includesFilesystem = systemWizardDraft.type === 'filesystem' || systemWizardDraft.type === 'terminal_host' || systemWizardDraft.type === 'composite'
    const scopeBindingLabel = systemWizardDraft.scope === 'quest_template'
      ? 'Quest Template ID'
      : systemWizardDraft.scope === 'quest_instance'
        ? 'Quest Instance ID'
        : 'Quest ID'
    const scopeBindingKey: 'questTemplateId' | 'questInstanceId' | 'questId' = systemWizardDraft.scope === 'quest_template'
      ? 'questTemplateId'
      : systemWizardDraft.scope === 'quest_instance'
        ? 'questInstanceId'
        : 'questId'
    if (systemWizardStep === 'type') {
      return (
        <div className="system-wizard-form">
          <div className="wizard-field-grid">
            <label>
              System Label
              <input
                value={systemWizardDraft.label}
                onChange={e => updateSystemWizardDraftField('label', e.target.value)}
                placeholder="Atlas Relay"
              />
            </label>
            <label>
              System ID
              <input
                value={systemWizardDraft.id}
                onChange={e => updateSystemWizardDraftField('id', e.target.value)}
                placeholder="relay_alpha"
              />
            </label>
            <label>
              System Type
              <select value={systemWizardDraft.type} onChange={e => updateSystemWizardDraftField('type', e.target.value as SystemType)}>
                {Object.entries(SYSTEM_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              Scope
              <select value={systemWizardDraft.scope} onChange={e => handleSystemWizardScopeChange(e.target.value as SystemScope)}>
                {SYSTEM_SCOPE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
          {systemWizardDraft.scope !== 'global' && (
            <div className="wizard-field-grid">
              <label>
                {scopeBindingLabel}
                <input
                  value={systemWizardDraft.appliesTo?.[scopeBindingKey] || ''}
                  onChange={e => handleSystemWizardAppliesToChange(scopeBindingKey, e.target.value)}
                  placeholder={scopeBindingLabel.toLowerCase()}
                />
              </label>
              {draft?.id && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => handleSystemWizardAppliesToChange(scopeBindingKey, draft.id)}
                >
                  Use Current Quest ({draft.id})
                </button>
              )}
            </div>
          )}
          <div className="wizard-field-grid">
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={systemWizardDraft.extendsExisting}
                onChange={e => handleSystemWizardExtendsToggle(e.target.checked)}
                disabled={systemWizardMode === 'override'}
              />
              Extend an existing global system
            </label>
            {systemWizardMode === 'override' && (
              <p className="muted">Quest overrides always extend a base global system.</p>
            )}
          </div>
        </div>
      )
    }
    if (systemWizardStep === 'source') {
      return (
        <div className="system-wizard-form">
          {systemWizardDraft.extendsExisting ? (
            <div className="wizard-field-grid">
              <label>
                Base System
                <select
                  value={systemWizardDraft.baseSystemId || ''}
                  onChange={e => handleSystemWizardBaseChange(e.target.value)}
                  disabled={systemWizardMode === 'override'}
                >
                  <option value="">Select a global system…</option>
                  {systemWizardBaseOptions.map(option => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              {systemWizardBaseDefinition && (
                <div className="system-wizard-base-details">
                  <strong>{systemWizardBaseDefinition.label}</strong>
                  <p className="muted">{SYSTEM_TYPE_LABELS[systemWizardBaseDefinition.type]} • {SCOPE_LABELS[systemWizardBaseDefinition.scope]}</p>
                  {systemWizardBaseDefinition.network.primaryIp && <p className="muted">IP {systemWizardBaseDefinition.network.primaryIp}</p>}
                </div>
              )}
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={systemWizardDraft.inheritNetwork}
                  onChange={e => updateSystemWizardDraftField('inheritNetwork', e.target.checked)}
                />
                Inherit network bindings
              </label>
              {includesFilesystem && (
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={systemWizardDraft.inheritFilesystem}
                    onChange={e => updateSystemWizardDraftField('inheritFilesystem', e.target.checked)}
                  />
                  Copy filesystem snapshot
                </label>
              )}
            </div>
          ) : (
            <div className="wizard-field-grid">
              {includesFilesystem && (
                <label>
                  Filesystem Template (optional)
                  <select
                    value={systemWizardDraft.templateKey || ''}
                    onChange={e => updateSystemWizardDraftField('templateKey', e.target.value || undefined)}
                  >
                    <option value="">Blank filesystem</option>
                    {systemTemplateOptions.map(option => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {includesFilesystem && (
                <label>
                  Root Path
                  <input
                    value={systemWizardDraft.rootPath}
                    onChange={e => updateSystemWizardDraftField('rootPath', e.target.value)}
                    placeholder="/"
                  />
                </label>
              )}
              {!includesFilesystem && (
                <p className="muted">This system type does not require a filesystem template. Continue to configure credentials and bindings.</p>
              )}
            </div>
          )}
        </div>
      )
    }
    return (
      <div className="system-wizard-form">
        <div className="wizard-field-grid">
          <label>
            Description
            <textarea
              rows={2}
              value={systemWizardDraft.description}
              onChange={e => updateSystemWizardDraftField('description', e.target.value)}
              placeholder="Player-facing or operator summary"
            />
          </label>
          <label>
            Primary IP / Host
            <input
              value={systemWizardDraft.ip}
              onChange={e => updateSystemWizardDraftField('ip', e.target.value)}
              placeholder="10.0.0.42"
            />
          </label>
          <label>
            Operator Username
            <input
              value={systemWizardDraft.username}
              onChange={e => updateSystemWizardDraftField('username', e.target.value)}
              placeholder="guest"
            />
          </label>
          <label>
            Starting Path
            <input
              value={systemWizardDraft.startingPath}
              onChange={e => updateSystemWizardDraftField('startingPath', e.target.value)}
              placeholder="/home/guest"
            />
          </label>
          {includesFilesystem && (
            <label>
              Root Path
              <input
                value={systemWizardDraft.rootPath}
                onChange={e => updateSystemWizardDraftField('rootPath', e.target.value)}
                placeholder="/"
              />
            </label>
          )}
          <label className="full">
            Footprint / Notes
            <textarea
              rows={2}
              value={systemWizardDraft.footprint}
              onChange={e => updateSystemWizardDraftField('footprint', e.target.value)}
              placeholder="Operational notes, service owners, etc."
            />
          </label>
        </div>
        {systemWizardDraft.scope !== 'global' && (
          <div className="wizard-field-grid">
            <label>
              {scopeBindingLabel}
              <input
                value={systemWizardDraft.appliesTo?.[scopeBindingKey] || ''}
                onChange={e => handleSystemWizardAppliesToChange(scopeBindingKey, e.target.value)}
                placeholder="Bind to quest id"
              />
            </label>
          </div>
        )}
        <div className="system-wizard-tools">
          <div className="system-wizard-tools-header">
            <strong>Tool Bindings</strong>
            <button type="button" className="ghost" onClick={addWizardTool}>+ Add Tool</button>
          </div>
          {systemWizardDraft.toolBindings.length === 0 && <p className="muted">No tools attached yet.</p>}
          {systemWizardDraft.toolBindings.map((tool, index) => (
            <div key={`tool-${index}`} className="wizard-field-grid tool-binding-row">
              <label>
                Tool Name
                <input
                  value={tool.name}
                  onChange={e => updateWizardTool(index, 'name', e.target.value)}
                  placeholder="Port scan"
                />
              </label>
              <label>
                Tool ID
                <input
                  value={tool.id}
                  onChange={e => updateWizardTool(index, 'id', e.target.value)}
                  placeholder="scan"
                />
              </label>
              <label className="full">
                Command / Binding
                <input
                  value={tool.command}
                  onChange={e => updateWizardTool(index, 'command', e.target.value)}
                  placeholder="nmap -sV {target}"
                />
              </label>
              <button type="button" className="ghost danger" onClick={() => removeWizardTool(index)}>Remove</button>
            </div>
          ))}
        </div>
      </div>
    )
  }, [
    addWizardTool,
    draft?.id,
    handleSystemWizardAppliesToChange,
    handleSystemWizardBaseChange,
    handleSystemWizardExtendsToggle,
    handleSystemWizardScopeChange,
    systemTemplateOptions,
    systemWizardBaseDefinition,
    systemWizardBaseOptions,
    systemWizardDraft,
    systemWizardMode,
    systemWizardStep,
    updateSystemWizardDraftField,
    updateWizardTool,
    removeWizardTool
  ])

  const runSave = useCallback(async (statusOverride?: 'draft' | 'published'): Promise<boolean> => {
    if (!draft) return false
    signalSessionActivity('quest-save-attempt')
    const targetDraft = statusOverride ? { ...draft, status: statusOverride } : draft
    if (statusOverride) {
      setDraft(targetDraft)
    }
    const validation = validateQuestDraft(targetDraft, { mailIds: mailDefinitions.map(mail => mail.id) })
    if (validation.length) {
      setErrors(validation)
      pushToast({
        title: 'Fix Validation Issues',
        message: validation[0],
        kind: 'error',
        dedupeKey: 'quest-save-error'
      })
      return false
    }
    const wasUnsaved = !!targetDraft.__unsaved
    const isPublishing = statusOverride === 'published'
    if (isPublishing) {
      setPublishing(true)
    } else {
      setSaving(true)
    }
    setErrors([])
    setValidationMessages([])
    let success = false
    try {
      let response
      if (targetDraft.__unsaved) {
        response = await createTerminalQuest(questToPayload(targetDraft))
        persistedIdRef.current = response.quest.id
      } else {
        response = await updateTerminalQuest(persistedIdRef.current || targetDraft.id, questToPayload(targetDraft))
      }
      const savedQuest = normalizeQuest(response.quest)
      setWarnings(response.warnings || [])
      syncQuestList(prev => {
        const targetId = selectedKey || targetDraft.id
        const index = prev.findIndex(q => q.id === targetId)
        if (index === -1) {
          return [...prev, savedQuest]
        }
        const next = [...prev]
        next.splice(index, 1, savedQuest)
        return next
      })
      setSelectedKey(savedQuest.id)
      persistedIdRef.current = savedQuest.id
      setDraft(savedQuest)
      pushToast({
        title: isPublishing ? 'Quest Published' : 'Draft Saved',
        message: `${savedQuest.title || savedQuest.id} ${isPublishing ? 'is now live for players.' : 'changes saved successfully.'}`,
        kind: 'success',
        dedupeKey: isPublishing ? 'quest-publish-success' : 'quest-save-success'
      })
      signalSessionActivity(isPublishing ? 'quest-publish-success' : 'quest-save-success')
      if (typeof window !== 'undefined') {
        const action = isPublishing ? 'publish' : wasUnsaved ? 'create' : 'update'
        window.dispatchEvent(new CustomEvent('terminalQuestsUpdated', {
          detail: { action, questId: savedQuest.id }
        }))
      }
      success = true
    } catch (err: any) {
      console.error('[quest designer] save failed', err)
      const friendly = err?.message || 'Failed to save quest.'
      setErrors([friendly])
      pushToast({
        title: isPublishing ? 'Publish Failed' : 'Save Failed',
        message: friendly,
        kind: 'error',
        dedupeKey: isPublishing ? 'quest-publish-error' : 'quest-save-error'
      })
      signalSessionActivity('quest-save-error')
    } finally {
      if (isPublishing) {
        setPublishing(false)
      } else {
        setSaving(false)
      }
    }
    return success
  }, [
    draft,
    mailDefinitions,
    pushToast,
    selectedKey,
    setDraft,
    setErrors,
    setPublishing,
    setSaving,
    setSelectedKey,
    setValidationMessages,
    setWarnings,
    syncQuestList
  ])

  const handleSave = () => { void runSave() }
  const handlePublish = () => { void runSave('published') }

  const handleWizardFinish = useCallback(async () => {
    if (!draft) return
    const introMail = draft.introEmailId ? (mailDefinitions.find(entry => entry.id === draft.introEmailId) ?? null) : null
    const completionMail = draft.completionEmailId ? (mailDefinitions.find(entry => entry.id === draft.completionEmailId) ?? null) : null
    const issues: string[] = []
    if (!introMail) issues.push('Intro email is missing or not staged yet.')
    if (!completionMail) issues.push('Completion email is missing or not staged yet.')
    if (!draft.steps.length) issues.push('Quest requires at least one step before saving.')
    const questFilesystemIds = Object.keys(draft.embedded_filesystems || {})
    if (questFilesystemIds.length) {
      const incomplete = questFilesystemIds.filter(systemId => !hasFilesystemLayout(draft.embedded_filesystems?.[systemId]))
      if (incomplete.length) {
        issues.push(`Finish filesystem overrides for: ${incomplete.join(', ')}`)
      }
    }
    setWizardSummaryErrors(issues)
    if (issues.length) {
      return
    }
    setWizardFinishing(true)
    try {
      await persistWizardMail(introMail)
      await persistWizardMail(completionMail)
      const questSaved = await runSave()
      if (!questSaved) {
        setWizardSummaryErrors(['Quest save failed. Check validation messages and try again.'])
        return
      }
      await loadMailLibrary()
      setWizardSummaryErrors([])
      pushToast({
        title: 'Wizard Complete',
        message: `${draft.title || draft.id} saved and synced.`,
        kind: 'success',
        dedupeKey: `wizard-finish-${draft.id}`
      })
      closeWizard()
    } catch (err: any) {
      console.error('[quest designer] wizard finish failed', err)
      const friendly = err?.message || 'Failed to save quest and mails.'
      setWizardSummaryErrors([friendly])
      pushToast({ title: 'Wizard Finish Failed', message: friendly, kind: 'error', dedupeKey: 'wizard-finish-error' })
    } finally {
      setWizardFinishing(false)
    }
  }, [closeWizard, draft, loadMailLibrary, mailDefinitions, persistWizardMail, pushToast, runSave, hasFilesystemLayout])

  const handleValidate = async () => {
    if (!draft) return
    setValidating(true)
    try {
      const result = await validateTerminalQuest(questToPayload(draft))
      const designerIssues = gatherDesignerValidationIssues(draft, quests)
      const clientValidation = validateQuestDraft(draft, { mailIds: mailDefinitions.map(mail => mail.id) })
      const serverErrors = result.errors || []
      const serverWarnings = result.warnings || []
      const combinedErrors = [...serverErrors, ...designerIssues.errors, ...clientValidation]
      const combinedWarnings = [...serverWarnings, ...designerIssues.warnings]
      setValidationMessages(combinedErrors.length ? combinedErrors : ['Quest validated successfully.'])
      setWarnings(combinedWarnings)
    } catch (err: any) {
      console.error('[quest designer] validation failed', err)
      setValidationMessages([err?.message || 'Validation failed.'])
    } finally {
      setValidating(false)
    }
  }

  const handleDelete = () => {
    if (!draft) return
    if (draft.__unsaved) {
      setUnsavedDeletePromptOpen(true)
      return
    }
    setDeleteDialogOpen(true)
  }

  const confirmDeleteQuest = async () => {
    if (!draft || draft.__unsaved) return
    const targetDraft = draft
    setDeleteInProgress(true)
    try {
      await deleteTerminalQuest(targetDraft.id)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('terminalQuestsUpdated', {
          detail: { action: 'delete', questId: targetDraft.id }
        }))
      }
      syncQuestList(prev => prev.filter(q => q.id !== targetDraft.id))
      setDraft(null)
      setSelectedKey(null)
      persistedIdRef.current = null
      pushToast({
        title: 'Quest Deleted',
        message: `${targetDraft.title || targetDraft.id} removed.`,
        kind: 'warning',
        dedupeKey: 'quest-delete-success'
      })
      signalSessionActivity('quest-delete-success')
    } catch (err: any) {
      console.error('[quest designer] delete failed', err)
      const friendly = err?.message || 'Failed to delete quest.'
      setErrors([friendly])
      pushToast({
        title: 'Delete Failed',
        message: friendly,
        kind: 'error',
        dedupeKey: 'quest-delete-error'
      })
      signalSessionActivity('quest-delete-error')
    } finally {
      setDeleteInProgress(false)
      setDeleteDialogOpen(false)
    }
  }

  const cancelDeleteQuest = () => {
    if (deleteInProgress) return
    setDeleteDialogOpen(false)
  }

  const confirmDiscardUnsavedQuest = () => {
    if (!draft || !draft.__unsaved) {
      setUnsavedDeletePromptOpen(false)
      return
    }
    syncQuestList(prev => prev.filter(q => q.id !== draft.id))
    setDraft(null)
    setSelectedKey(null)
    persistedIdRef.current = null
    setUnsavedDeletePromptOpen(false)
    pushToast({
      title: 'Draft Discarded',
      message: `${draft.title || draft.id} removed from the queue.`,
      kind: 'info',
      dedupeKey: 'quest-delete-success'
    })
    signalSessionActivity('quest-delete-draft')
  }

  const cancelDiscardUnsavedQuest = () => {
    setUnsavedDeletePromptOpen(false)
  }

  if (!isAdmin) {
    return (
      <div className="quest-designer barred">
        <h2>Access Restricted</h2>
        <p>You must be an administrator to edit terminal quests.</p>
      </div>
    )
  }

  return (
    <>
      <div
        className="quest-designer"
        onMouseMove={handleTooltipMouseMove}
        onMouseLeave={handleTooltipLeave}
        onFocusCapture={handleTooltipFocus}
        onBlurCapture={handleTooltipBlur}
      >
      <aside className="quest-list">
        <div className="quest-list-header">
          <div>
            <h2>Terminal Quests</h2>
            <p className="muted">{loading ? 'Loading…' : `${quests.length} quest${quests.length === 1 ? '' : 's'}`}</p>
          </div>
        </div>
        <div className="quest-list-actions">
          <button type="button" onClick={handleCreateQuest}>+ New Quest</button>
          <button type="button" className="ghost" onClick={openWizard}>Guided Wizard</button>
        </div>
        <input
          className="quest-search"
          placeholder="Search quests"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="quest-status-filter" data-tooltip={FIELD_HINTS.questStatusFilter}>
          <div className="legend-heading">Quest Lifecycle</div>
          {STATUS_FILTERS.map(option => {
            const count = option.lifecycle ? questStatusCounters[option.lifecycle] : quests.length
            return (
              <button
                key={option.value}
                type="button"
                className={`status-filter-chip status-${option.value} ${questStatusFilter === option.value ? 'active' : ''}`}
                onClick={() => setQuestStatusFilter(option.value)}
              >
                <span className="status-icon-wrapper" aria-hidden="true">
                  <StatusIcon status={option.value} />
                </span>
                <span className="status-text">
                  <span className="status-label">{option.label}</span>
                  <span className="chip-count">{count}</span>
                </span>
              </button>
            )
          })}
          <button
            type="button"
            className="ghost refresh-status"
            onClick={() => { void loadQuestStatusSnapshot() }}
            disabled={questStateLoading}
          >
            {questStateLoading ? 'Syncing…' : 'Refresh'}
          </button>
        </div>
        {questStatusError && <div className="inline-alert error">{questStatusError}</div>}
        <div className={`quest-list-items ${draggingQuestId ? 'drag-active' : ''}`}>
          {filteredQuests.map(quest => {
            const isActive = !!draft && (quest.id === draft.id || quest.id === (selectedKey || ''))
            const lifecycleStatus = playerQuestStatuses[quest.id] || DEFAULT_LIFECYCLE_STATUS
            const lifecycleLabel = STATUS_LABELS[lifecycleStatus]
            return (
              <button
                key={quest.id}
                type="button"
                className={`quest-list-item ${isActive ? 'selected' : ''} ${draggingQuestId === quest.id ? 'dragging' : ''} ${dragOverQuestId === quest.id ? 'drag-over' : ''}`}
                onClick={() => handleQuestSelection(quest)}
                draggable={allowQuestReorder}
                onDragStart={allowQuestReorder ? handleQuestDragStart(quest.id) : undefined}
                onDragOver={allowQuestReorder ? handleQuestDragOver(quest.id) : undefined}
                onDragLeave={allowQuestReorder ? handleQuestDragLeave(quest.id) : undefined}
                onDrop={allowQuestReorder ? handleQuestDrop(quest.id) : undefined}
                onDragEnd={allowQuestReorder ? handleQuestDragEnd : undefined}
              >
                <div className="quest-item-header">
                  <strong>{quest.title}</strong>
                  <div className="quest-item-badges">
                    <span className={`tag quest-status ${quest.status}`}>
                      {quest.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                    <span
                      className={`tag lifecycle-status ${lifecycleStatus}`}
                      aria-label={lifecycleLabel}
                    >
                      <span className="sr-only">{lifecycleLabel}</span>
                      <StatusIcon status={lifecycleStatus} />
                    </span>
                  </div>
                </div>
                <span className="muted">{quest.id}</span>
                {quest.__unsaved && <span className="tag unsaved">Unsaved</span>}
              </button>
            )
          })}
          {!filteredQuests.length && <div className="muted empty">No quests match this filter.</div>}
          {dropZoneVisible && (
            <div
              className="quest-drop-zone active"
              role="presentation"
              onDragOver={handleDropZoneDragOver}
              onDrop={handleDropToEnd}
            >
              Drop to move to end
            </div>
          )}
        </div>
      </aside>
      <section className="quest-editor">
        {!draft && (
          <div className="quest-placeholder">
            <p>Select a quest from the list or create a new one.</p>
          </div>
        )}
        {draft && (
          <div className="quest-form">
            <header className="quest-editor-header">
              <div>
                <h1>{draft.title}</h1>
                <p className="muted">{draft.description}</p>
              </div>
              <div className="editor-actions">
                <button type="button" className="ghost" onClick={handleValidate} disabled={validating}>{validating ? 'Validating…' : 'Validate Quest'}</button>
                <button type="button" onClick={handleSave} disabled={saving || publishing}>{saving ? 'Saving…' : 'Save Draft'}</button>
                <button
                  type="button"
                  className="publish"
                  onClick={handlePublish}
                  disabled={publishing || saving || draft.status === 'published'}
                >
                  {publishing ? 'Publishing…' : 'Publish'}
                </button>
                <button type="button" className="danger" onClick={handleDelete}>Delete</button>
              </div>
            </header>

            <div className="quest-runtime-status">
              <div>
                <span className={`status-pill ${runtimeStatusForDraft}`}>{STATUS_LABELS[runtimeStatusForDraft]}</span>
                <span className="muted status-timestamp">{questStatusTimestampLabel}</span>
              </div>
              <button
                type="button"
                className="ghost"
                onClick={() => { void loadQuestStatusSnapshot() }}
                disabled={questStateLoading}
              >
                {questStateLoading ? 'Syncing…' : 'Refresh Status'}
              </button>
            </div>

            {errors.length > 0 && (
              <div className="alert error">
                <strong>Validation</strong>
                <ul>
                  {errors.map(err => <li key={err}>{err}</li>)}
                </ul>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="alert warning">
                <strong>Warnings</strong>
                <ul>
                  {warnings.map(warn => <li key={warn}>{warn}</li>)}
                </ul>
              </div>
            )}

            {validationMessages.length > 0 && (
              <div className="alert info">
                <strong>Validation</strong>
                <ul>
                  {validationMessages.map(msg => <li key={msg}>{msg}</li>)}
                </ul>
              </div>
            )}

            {relationships && (
              <section className="quest-relationships-panel" aria-label="Quest relationships">
                <div className="relationships-header">
                  <h3>Relationships</h3>
                  <div className="relationships-flag">
                    <span>Completion flag</span>
                    <code>{relationships.completionFlagId}</code>
                  </div>
                </div>
                <div className="relationships-grid">
                  {[
                    { title: 'Previous', items: relationships.previous, empty: 'No quests unlock this one yet.' },
                    { title: 'Next', items: relationships.next, empty: 'No quests unlocked by this quest yet.' },
                    { title: 'Shared flags', items: relationships.shared, empty: 'No other quests share this completion flag.' }
                  ].map(column => (
                    <div key={column.title} className="relationship-column">
                      <span className="relationship-column-title">{column.title}</span>
                      {column.items.length === 0 ? (
                        <p className="muted empty">{column.empty}</p>
                      ) : (
                        <ul>
                          {column.items.map(entry => (
                            <li key={`${column.title}-${entry.quest.id}-${entry.reason}`}>
                              <div className="relationship-row">
                                <span className="relationship-id">{entry.quest.id}</span>
                                {entry.quest.title && <span className="relationship-title">{entry.quest.title}</span>}
                              </div>
                              <span className="relationship-reason">{entry.reason}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h3>Quest Info</h3>
              <div className="info-grid">
                <label data-tooltip={FIELD_HINTS.questId}>
                  Quest ID
                  <input value={draft.id} onChange={e => updateCurrentQuest(prev => ({ ...prev, id: e.target.value }))} />
                </label>
                <label data-tooltip={FIELD_HINTS.questTitle}>
                  Title
                  <input value={draft.title} onChange={e => updateCurrentQuest(prev => ({ ...prev, title: e.target.value }))} />
                </label>
                <label data-tooltip={FIELD_HINTS.questStatus}>
                  Status
                  <select
                    value={draft.status || 'draft'}
                    onChange={e => updateCurrentQuest(prev => ({ ...prev, status: e.target.value as 'draft' | 'published' }))}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </label>
                <label data-tooltip={FIELD_HINTS.triggerType}>
                  Trigger
                  <select
                    value={draft.trigger?.type || DEFAULT_TRIGGER}
                    onChange={e => updateTrigger({ type: e.target.value as OperationTriggerType })}
                  >
                    {TRIGGER_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                {draft.trigger?.type === 'ON_QUEST_COMPLETION' && (
                  <label className="full" data-tooltip={FIELD_HINTS.completionQuests}>
                    Completion Quests
                    {completionTriggerInput.Input}
                  </label>
                )}
                {draft.trigger?.type === 'ON_FLAG_SET' && (
                  <>
                    <label className="full" data-tooltip={FIELD_HINTS.triggerFlagKey}>
                      Flag Key
                      <input
                        list={flagKeyListId}
                        value={draft.trigger?.flag_key || ''}
                        onChange={e => updateTrigger({ flag_key: e.target.value })}
                        placeholder="quest_intro_001_completed"
                      />
                      {questFlagSuggestions.length > 0 && (
                        <datalist id={flagKeyListId}>
                          {questFlagSuggestions.map(flag => (
                            <option key={flag} value={flag} />
                          ))}
                        </datalist>
                      )}
                    </label>
                    <label data-tooltip={FIELD_HINTS.triggerFlagValue}>
                      Required Value
                      <input
                        value={draft.trigger?.flag_value || ''}
                        onChange={e => updateTrigger({ flag_value: e.target.value })}
                        placeholder="true"
                      />
                    </label>
                  </>
                )}
                <label data-tooltip={FIELD_HINTS.defaultSystem}>
                  Default System
                  <select
                    value={draft.default_system_id || ''}
                    onChange={e => updateCurrentQuest(prev => ({ ...prev, default_system_id: e.target.value || undefined }))}
                    disabled={systemsLoading}
                  >
                    <option value="">Unassigned (set per step)</option>
                    {systemOptions.map(option => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="full" data-tooltip={FIELD_HINTS.description}>
                  Description
                  <textarea value={draft.description} onChange={e => updateCurrentQuest(prev => ({ ...prev, description: e.target.value }))} />
                </label>
                <label className="full" data-tooltip={FIELD_HINTS.completionFlag}>
                  Completion Flag
                  <input
                    value={draft.completion_flag || ''}
                    placeholder={`quest_completed_${draft.id}`}
                    onChange={e => updateCurrentQuest(prev => ({ ...prev, completion_flag: e.target.value }))}
                  />
                  {completionFlagConflicts.length > 0 && (
                    <small className="field-note warning">
                      Also used by {completionFlagConflicts.join(', ')}
                    </small>
                  )}
                </label>
              </div>
            </section>

            <section className="quest-mail-section">
              <div className="section-header">
                <h3>Mail & Inbox</h3>
                <div className="mail-section-actions">
                  <button type="button" className="ghost" onClick={() => updateQuestMailConfig(null)} disabled={!draft.mail}>
                    Clear Quest Mail
                  </button>
                </div>
              </div>
              <div className="quest-mail-grid">
                <div className="mail-config-panel">
                  <h4>Quest Mail Delivery</h4>
                  <div className="info-grid">
                    <label>
                      Briefing Mail
                      <select
                        value={draft.mail?.briefingMailId || ''}
                        onChange={e => updateQuestMailConfig({ briefingMailId: e.target.value || undefined })}
                      >
                        <option value="">None</option>
                        {mailDefinitions.map(mail => (
                          <option key={`briefing-${mail.id}`} value={mail.id}>
                            {mail.subject || mail.id}{mail.status === 'draft' ? ' (draft)' : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Completion Mail
                      <select
                        value={draft.mail?.completionMailId || ''}
                        onChange={e => updateQuestMailConfig({ completionMailId: e.target.value || undefined })}
                      >
                        <option value="">None</option>
                        {mailDefinitions.map(mail => (
                          <option key={`completion-${mail.id}`} value={mail.id}>
                            {mail.subject || mail.id}{mail.status === 'draft' ? ' (draft)' : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="full">
                      Auto-deliver on Accept
                      {autoDeliverAcceptInput.Input}
                    </label>
                    <label className="full">
                      Auto-deliver on Completion
                      {autoDeliverCompleteInput.Input}
                    </label>
                  </div>
                  <div className="mail-preview-controls">
                    <div>
                      <strong>Preview Delivered</strong>
                      {previewDeliveredInput.Input}
                    </div>
                    <div>
                      <strong>Preview Read</strong>
                      {previewReadInput.Input}
                    </div>
                    <div>
                      <strong>Preview Archived</strong>
                      {previewArchivedInput.Input}
                    </div>
                    <div>
                      <strong>Preview Deleted</strong>
                      {previewDeletedInput.Input}
                    </div>
                  </div>
                </div>
                <div className="mail-preview-panel">
                  <div className="mail-preview-header">
                    <div>
                      <h4>Inbox Preview</h4>
                      <p className="muted">{mailPreviewList.length} delivered / {mailPreviewList.filter(entry => !entry.read && !entry.deleted && !entry.archived).length} unread</p>
                    </div>
                  </div>
                  {mailPreviewList.length === 0 ? (
                    <p className="muted empty">No mail delivered for this quest yet.</p>
                  ) : (
                    <ul className="mail-preview-list">
                      {mailPreviewList.map(entry => (
                        <li key={`preview-${entry.id}`} className={`mail-preview-item ${entry.read ? 'read' : 'unread'}`}>
                          <div className="mail-preview-row">
                            <div>
                              <strong>{entry.subject}</strong>
                              <span className="mail-preview-from">{entry.fromName}</span>
                            </div>
                            <div className="mail-preview-tags">
                              <span className={`pill ${entry.read ? 'read' : 'unread'}`}>{entry.read ? 'Read' : 'Unread'}</span>
                              {entry.archived && <span className="pill archived">Archived</span>}
                              {entry.deleted && <span className="pill deleted">Deleted</span>}
                            </div>
                          </div>
                          <p className="muted">{entry.previewLine || entry.body.slice(0, 120)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="mail-library-panel">
                <div className="mail-library-column">
                  <div className="mail-library-header">
                    <h4>Mail Library</h4>
                    <button type="button" onClick={handleNewMail}>+ New Mail</button>
                  </div>
                  <input
                    className="mail-search"
                    placeholder="Search mail"
                    value={mailSearch}
                    onChange={e => setMailSearch(e.target.value)}
                  />
                  {mailError && <div className="inline-alert error">{mailError}</div>}
                  <div className={`mail-library-list ${mailLoading ? 'loading' : ''}`}>
                    {mailLoading && <p className="muted">Loading mail…</p>}
                    {!mailLoading && filteredMailDefinitions.length === 0 && <p className="muted empty">No mail matches this filter.</p>}
                    {!mailLoading && filteredMailDefinitions.map(mail => (
                      <button
                        key={`mail-${mail.id}`}
                        type="button"
                        className={`mail-library-item ${mailSelectedId === mail.id ? 'selected' : ''}`}
                        onClick={() => handleMailSelect(mail)}
                      >
                        <div>
                          <strong>{mail.subject || mail.id}</strong>
                          <span className="muted">{mail.fromName}</span>
                        </div>
                        <div className="mail-library-badges">
                          <span className={`tag ${mail.status === 'published' ? 'published' : 'draft'}`}>{mail.status === 'published' ? 'Published' : 'Draft'}</span>
                          <span className="tag pill-lite">{mail.folder}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mail-editor-panel">
                  <div className="mail-editor-header">
                    <div>
                      <h4>{mailSelectedId ? `Editing ${mailSelectedId}` : 'New Mail'}</h4>
                      <p className="muted">Standalone messages that can be linked to quests or lore drops.</p>
                    </div>
                    {mailSelectedId && (
                      <button type="button" className="ghost" onClick={handleMailDuplicate}>
                        Duplicate
                      </button>
                    )}
                  </div>
                  <div className="mail-editor-grid">
                    <label>
                      Mail ID
                      <input value={mailDraft.id} onChange={e => handleMailFieldChange('id', e.target.value)} placeholder="ops_directive" />
                    </label>
                    <label>
                      Status
                      <select value={mailDraft.status || 'draft'} onChange={e => handleMailFieldChange('status', e.target.value)}>
                        {MAIL_STATUS_OPTIONS.map(option => (
                          <option key={`mail-status-${option}`} value={option}>{option === 'draft' ? 'Draft' : 'Published'}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Folder
                      <select value={mailDraft.folder || 'inbox'} onChange={e => handleMailFieldChange('folder', e.target.value)}>
                        {MAIL_FOLDER_OPTIONS.map(option => (
                          <option key={`mail-folder-${option}`} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Category
                      <select value={mailDraft.emailCategory || 'lore'} onChange={e => handleMailFieldChange('emailCategory', e.target.value)}>
                        {MAIL_CATEGORY_OPTIONS.map(option => (
                          <option key={`mail-category-${option}`} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      From Name
                      <input value={mailDraft.fromName} onChange={e => handleMailFieldChange('fromName', e.target.value)} placeholder="Atlas Ops" />
                    </label>
                    <label>
                      From Address
                      <input value={mailDraft.fromAddress} onChange={e => handleMailFieldChange('fromAddress', e.target.value)} placeholder="ops@atlasnet" />
                    </label>
                    <label className="full">
                      Subject
                      <input value={mailDraft.subject} onChange={e => handleMailFieldChange('subject', e.target.value)} placeholder="Directive: …" />
                    </label>
                    <label className="full">
                      Preview Line
                      <input value={mailDraft.previewLine || ''} onChange={e => handleMailFieldChange('previewLine', e.target.value)} placeholder="Short summary" />
                    </label>
                    <label>
                      In-universe Date
                      <input value={mailDraft.inUniverseDate} onChange={e => handleMailFieldChange('inUniverseDate', e.target.value)} placeholder="2089-06-01 12:30" />
                    </label>
                    <label>
                      Linked Quest
                      <input value={mailDraft.linkedQuestId || ''} onChange={e => handleMailFieldChange('linkedQuestId', e.target.value)} placeholder="quest_id (optional)" />
                    </label>
                    <label className="checkbox-field">
                      <input
                        type="checkbox"
                        checked={mailDraft.isUnreadByDefault ?? true}
                        onChange={e => handleMailFieldChange('isUnreadByDefault', e.target.checked)}
                      />
                      Unread by default
                    </label>
                  </div>
                  <label className="full">
                    Body
                    <textarea value={mailDraft.body} onChange={e => handleMailFieldChange('body', e.target.value)} rows={6} />
                  </label>
                  {mailValidationErrors.length > 0 && (
                    <div className="inline-alert error">
                      <strong>Mail Validation</strong>
                      <ul>
                        {mailValidationErrors.map(err => <li key={err}>{err}</li>)}
                      </ul>
                    </div>
                  )}
                  <div className="editor-actions mail-editor-actions">
                    <button type="button" className="ghost" onClick={handleMailValidate} disabled={mailValidating}>
                      {mailValidating ? 'Validating…' : 'Validate Mail'}
                    </button>
                    <button type="button" onClick={() => handleMailSave()} disabled={mailSaving || mailPublishing}>
                      {mailSaving ? 'Saving…' : 'Save Draft'}
                    </button>
                    <button type="button" className="publish" onClick={() => handleMailSave('published')} disabled={mailPublishing || mailSaving}>
                      {mailPublishing ? 'Publishing…' : 'Publish Mail'}
                    </button>
                    {currentMailExists && (
                      <button type="button" className="danger" onClick={handleMailDelete} disabled={mailDeletingId === mailDraft.id}>
                        {mailDeletingId === mailDraft.id ? 'Deleting…' : 'Delete Mail'}
                      </button>
                    )}
                  </div>
                  <div className="mail-assign-actions">
                    <button type="button" className="ghost" onClick={() => assignMailToQuest(mailDraft.id, 'briefing')} disabled={!draft || !mailDraft.id}>
                      Use as Briefing Mail
                    </button>
                    <button type="button" className="ghost" onClick={() => assignMailToQuest(mailDraft.id, 'completion')} disabled={!draft || !mailDraft.id}>
                      Use as Completion Mail
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="section-header">
                <h3>Steps</h3>
                <button type="button" onClick={addStep}>+ Add Step</button>
              </div>
              {draft.steps.length === 0 && <div className="muted empty">No steps yet.</div>}
              {draft.steps.map((step, idx) => (
                <StepCard
                  key={step.id || idx}
                  step={step}
                  index={idx}
                  total={draft.steps.length}
                  onChange={next => updateStep(idx, next)}
                  onMove={dir => moveStep(idx, dir)}
                  onDuplicate={() => duplicateStep(idx)}
                  onDelete={() => deleteStep(idx)}
                  systemOptions={systemOptions}
                  defaultSystemId={draft.default_system_id || null}
                />
              ))}
            </section>

            <section>
              <div className="section-header">
                <h3>Systems</h3>
                <div className="system-header-actions">
                  <button type="button" onClick={openSystemWizardForCreate} disabled={systemWizardSaving}>+ New System</button>
                </div>
              </div>
              <div className="system-panels">
                <div className="system-panel quest-systems-panel">
                  <div className="system-panel-header">
                    <h4>Quest Systems</h4>
                    {systemsLoading && <span className="muted">Loading systems…</span>}
                  </div>
                  {!systemIdsInUse.length && !systemsLoading && (
                    <div className="muted empty">Assign a default system or set per-step targets to customize contexts.</div>
                  )}
                  {systemIdsInUse.length > 0 && (
                    <div className="quest-system-list">
                      {questSystemSummaries.map(summary => {
                        const override = summary.override
                        const resolvedDefinition = summary.resolvedDefinition || summary.baseDefinition
                        const resolvedType = override?.type || resolvedDefinition?.type
                        const resolvedScope = (override?.scope || resolvedDefinition?.scope || 'global') as SystemScope
                        const label = override?.label || resolvedDefinition?.label || summary.fallbackProfile?.label || summary.systemId
                        const ip = override?.network?.primaryIp || override?.network?.ips?.[0] || resolvedDefinition?.network?.primaryIp || resolvedDefinition?.network?.ips?.[0] || summary.fallbackProfile?.identifiers?.ips?.[0]
                        const username = override?.credentials?.username || resolvedDefinition?.credentials?.username || summary.fallbackProfile?.metadata?.username
                        const startingPath = override?.credentials?.startingPath || resolvedDefinition?.credentials?.startingPath || summary.fallbackProfile?.metadata?.startingPath
                        const isDefault = draft?.default_system_id === summary.systemId
                        const typeLabel = resolvedType ? SYSTEM_TYPE_LABELS[resolvedType] : 'System'
                        const questFilesystem = summary.questFilesystem
                        const filesystemReady = !!questFilesystem
                        const editorOpen = openFilesystemEditors.includes(summary.systemId)
                        return (
                          <div key={summary.systemId} className="quest-system-card">
                            <div className="quest-system-heading">
                              <div>
                                <strong>{label}</strong>
                                <span className="muted">{summary.systemId}</span>
                              </div>
                              {isDefault && <span className="pill">Quest Default</span>}
                            </div>
                            <div className="quest-system-meta">
                              <span className="pill-lite">{typeLabel}</span>
                              <span className="pill-lite">{SCOPE_LABELS[resolvedScope]}</span>
                              {ip && <span className="muted">IP {ip}</span>}
                              {username && startingPath && <span className="muted">{username}@{startingPath}</span>}
                            </div>
                            {override ? (
                              <div className="quest-system-override">
                                <div>
                                  <strong>{override.label}</strong>
                                  <span className="muted">{override.id}</span>
                                </div>
                                <button
                                  type="button"
                                  className="ghost danger"
                                  onClick={() => handleDeleteOverride(override.id)}
                                  disabled={systemsLoading}
                                >
                                  Remove Override
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="ghost"
                                onClick={() => handleCreateQuestOverride(summary.systemId)}
                                disabled={!draft?.id}
                              >
                                Create Quest Override
                              </button>
                            )}
                            <div className="quest-system-filesystem">
                              <div className="quest-system-filesystem-status">
                                <span className={`pill-lite ${filesystemReady ? 'success' : 'warning'}`}>
                                  {filesystemReady ? 'Custom filesystem' : 'Needs filesystem'}
                                </span>
                                <span className="muted">
                                  {filesystemReady
                                    ? 'Quest-specific filesystem layout is staged.'
                                    : 'Design a filesystem layout to embed with this quest.'}
                                </span>
                              </div>
                              <div className="quest-system-filesystem-actions">
                                <button
                                  type="button"
                                  className="ghost"
                                  onClick={() => toggleFilesystemEditor(summary.systemId)}
                                  disabled={!draft}
                                >
                                  {editorOpen ? 'Close Editor' : filesystemReady ? 'Edit Filesystem' : 'Design Filesystem'}
                                </button>
                                {filesystemReady && (
                                  <button
                                    type="button"
                                    className="ghost danger"
                                    onClick={() => clearEmbeddedFilesystem(summary.systemId)}
                                    disabled={!draft}
                                  >
                                    Reset Filesystem
                                  </button>
                                )}
                              </div>
                              {editorOpen && (
                                <div className="quest-system-filesystem-editor">
                                  <FilesystemOverrideEditor
                                    systemId={summary.systemId}
                                    value={questFilesystem}
                                    onChange={next => updateEmbeddedFilesystem(summary.systemId, next)}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="system-panel system-library-panel">
                  <div className="system-panel-header">
                    <h4>System Library</h4>
                    <span className="muted">{systemDefinitionsState.length} total</span>
                  </div>
                  {!systemDefinitionsState.length && !systemsLoading && <div className="muted empty">No systems loaded yet.</div>}
                  {systemsLoading && <div className="muted">Loading definitions…</div>}
                  {!systemsLoading && systemLibraryGroups.map(group => (
                    <div key={group.type} className="system-library-group">
                      <div className="system-library-type">
                        <strong>{SYSTEM_TYPE_LABELS[group.type]}</strong>
                      </div>
                      {group.scopes.map(scope => (
                        <div key={`${group.type}-${scope.scope}`} className="system-library-scope">
                          <div className="system-scope-header">
                            <span>{SCOPE_LABELS[scope.scope]}</span>
                            <span className="muted">{scope.entries.length} system{scope.entries.length === 1 ? '' : 's'}</span>
                          </div>
                          <ul className="system-library-list">
                            {scope.entries.map(entry => {
                              const scopeDetails = entry.scope === 'global'
                                ? 'Global'
                                : entry.appliesTo?.questTemplateId || entry.appliesTo?.questId || entry.appliesTo?.questInstanceId || 'Scoped override'
                              const canOverride = entry.scope === 'global' && !!draft?.id
                              const canDeleteOverride = entry.scope !== 'global' && draft?.id && (entry.appliesTo?.questTemplateId === draft.id || entry.appliesTo?.questId === draft.id)
                              return (
                                <li key={entry.id} className="system-library-item">
                                  <div className="system-library-details">
                                    <strong>{entry.label}</strong>
                                    <span className="muted">{entry.id}</span>
                                    <span className="muted">{scopeDetails}</span>
                                  </div>
                                  <div className="system-library-actions">
                                    {canOverride && (
                                      <button type="button" className="ghost" onClick={() => handleCreateQuestOverride(entry.id)}>
                                        Override for Quest
                                      </button>
                                    )}
                                    {canDeleteOverride && (
                                      <button type="button" className="ghost danger" onClick={() => handleDeleteOverride(entry.id)}>
                                        Delete Override
                                      </button>
                                    )}
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section>
              <h3>Requirements</h3>
              <div className="info-grid">
                <label className="full" data-tooltip={FIELD_HINTS.requiredQuests}>
                  Required Quests
                  {requiredQuestInput.Input}
                </label>
                <label className="full" data-tooltip={FIELD_HINTS.requiredFlags}>
                  Required Flags
                  {requiredFlagInput.Input}
                </label>
              </div>
            </section>

            <section>
              <h3>Rewards</h3>
              <div className="info-grid">
                <label data-tooltip={FIELD_HINTS.creditsReward}>
                  Credits Reward
                  <input
                    type="number"
                    value={draft.rewards?.credits ?? 0}
                    onChange={e => updateCurrentQuest(prev => ({ ...prev, rewards: { ...prev.rewards, credits: Number(e.target.value) } }))}
                  />
                </label>
                <div className="full reward-flags-field">
                  <div className="reward-flags-header" data-tooltip={FIELD_HINTS.rewardFlags}>
                    <span>Flags Granted</span>
                    <button type="button" onClick={addRewardFlag}>+ Add Flag</button>
                  </div>
                  {rewardFlags.length === 0 && <p className="muted empty">No completion flags defined yet.</p>}
                  {rewardFlags.map((flag, idx) => (
                    <div key={`${flag.key || 'flag'}-${idx}`} className="reward-flag-row">
                      <label data-tooltip={FIELD_HINTS.rewardFlagKey}>
                        Key
                        <input
                          list={rewardFlagKeyListId}
                          value={flag.key || ''}
                          onChange={e => updateRewardFlag(idx, { key: e.target.value })}
                          placeholder="quest_completed"
                        />
                      </label>
                      <label data-tooltip={FIELD_HINTS.rewardFlagValue}>
                        Value
                        <input
                          value={flag.value || ''}
                          onChange={e => updateRewardFlag(idx, { value: e.target.value })}
                          placeholder="true"
                        />
                      </label>
                      <button type="button" className="ghost" onClick={() => removeRewardFlag(idx)}>Remove</button>
                    </div>
                  ))}
                  {questFlagSuggestions.length > 0 && (
                    <datalist id={rewardFlagKeyListId}>
                      {questFlagSuggestions.map(flag => (
                        <option key={`reward-flag-${flag}`} value={flag} />
                      ))}
                    </datalist>
                  )}
                </div>
                <label className="full" data-tooltip={FIELD_HINTS.unlockCommands}>
                  Unlock Commands
                  {unlockCommandInput.Input}
                </label>
              </div>
            </section>

            <section>
              <h3>Connections</h3>
              <div className="connections">
                <div>
                  <strong>Unlocks quests</strong>
                  {dependentQuests.questLinks.length === 0 && <p className="muted">No quests depend directly on this quest yet.</p>}
                  <ul>
                    {dependentQuests.questLinks.map(q => (
                      <li key={q.id}>{q.title} ({q.id})</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <strong>Flags used by</strong>
                  {dependentQuests.flagDependents.length === 0 && <p className="muted">No quests reference the reward flags.</p>}
                  <ul className="flag-dependents">
                    {dependentQuests.flagDependents.map(({ flag, quests }) => (
                      <li key={`${flag.key}-${flag.value || 'true'}`}>
                        <div><strong>{flag.key}{flag.value ? ` = ${flag.value}` : ''}</strong></div>
                        {quests.length === 0 && <p className="muted">Unused</p>}
                        {quests.length > 0 && (
                          <ul>
                            {quests.map(q => (
                              <li key={q.id}>{q.title} ({q.id})</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
      {wizardOpen && (
        <div
          className="quest-modal-overlay quest-wizard-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quest-wizard-title"
        >
          <div className="quest-modal quest-wizard" onClick={event => event.stopPropagation()}>
            <header className="quest-modal-header quest-wizard-header">
              <div className="quest-wizard-header-top">
                <div className="quest-wizard-progress" aria-live="polite">
                  {QUEST_WIZARD_STEPS.map((stepKey, idx) => {
                    const isActive = wizardStep === stepKey
                    return (
                      <button
                        key={stepKey}
                        type="button"
                        className={`ghost wizard-step-chip ${isActive ? 'active' : ''}`}
                        onClick={() => jumpToWizardStep(stepKey)}
                        aria-current={isActive ? 'step' : undefined}
                      >
                        <span className="wizard-step-index">{idx + 1}</span>
                        {QUEST_WIZARD_STEP_DETAILS[stepKey].title}
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  className="ghost icon-btn wizard-close"
                  onClick={handleWizardCancel}
                  aria-label="Close wizard"
                  title="Close"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" className="icon-x">
                    <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.9 4.89a1 1 0 1 0 1.41 1.42L12 13.41l4.89 4.9a1 1 0 0 0 1.42-1.41L13.41 12l4.9-4.89a1 1 0 0 0 0-1.4z" fill="currentColor" />
                  </svg>
                </button>
              </div>
              <div className="quest-wizard-header-details">
                <p className="muted">Guided Build • {wizardProgressLabel}</p>
                <h2 id="quest-wizard-title">{currentWizardStepDetails.title}</h2>
                <p className="muted">{currentWizardStepDetails.description}</p>
              </div>
            </header>
            <div className="quest-modal-body quest-wizard-body" ref={wizardBodyRef}>
              {wizardStepContent}
            </div>
            <div className="quest-modal-actions quest-wizard-actions">
              <button
                type="button"
                className="ghost"
                onClick={wizardAtFirstStep ? handleWizardCancel : goToPreviousWizardStep}
              >
                {wizardAtFirstStep ? 'Cancel' : 'Back'}
              </button>
              {wizardStep === 'summary' && (
                <button type="button" className="ghost danger" onClick={handleWizardCancel}>
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={wizardAtLastStep ? handleWizardFinish : handleWizardNext}
                disabled={wizardAtLastStep && wizardFinishing}
              >
                {wizardAtLastStep ? (wizardFinishing ? 'Saving…' : 'Save & Finish') : 'Next'}
              </button>
            </div>
          </div>
        </div>
      )}
      {systemWizardOpen && (
        <div
          className="quest-modal-overlay system-wizard-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="system-wizard-title"
          onClick={closeSystemWizard}
        >
          <div className="quest-modal system-wizard" onClick={event => event.stopPropagation()}>
            <header className="quest-modal-header system-wizard-header">
              <div className="system-wizard-progress" aria-label="System builder progress">
                {SYSTEM_WIZARD_STEPS.map((stepKey, idx) => {
                  const state = stepKey === systemWizardStep ? 'active' : idx < systemWizardStepIndex ? 'complete' : ''
                  return (
                    <span key={stepKey} className={`wizard-step-chip ${state}`}>
                      <span className="wizard-step-index">{idx + 1}</span>
                      {SYSTEM_WIZARD_STEP_DETAILS[stepKey].title}
                    </span>
                  )
                })}
                <span className="muted system-wizard-progress-label">{systemWizardProgressLabel}</span>
              </div>
              <div className="system-wizard-header-details">
                <p className="muted">
                  {systemWizardMode === 'override' ? 'Quest Override' : 'New System'} • {SCOPE_LABELS[systemWizardDraft.scope]}
                </p>
                <h2 id="system-wizard-title">{currentSystemWizardStepDetails.title}</h2>
                <p className="muted">{currentSystemWizardStepDetails.description}</p>
              </div>
            </header>
            <div className="quest-modal-body system-wizard-body" ref={systemWizardBodyRef}>
              {systemWizardError && (
                <div className="inline-alert error" role="alert">
                  <strong>Check Inputs</strong>
                  <p>{systemWizardError}</p>
                </div>
              )}
              {systemWizardStepContent}
            </div>
            <div className="quest-modal-actions system-wizard-actions">
              <button
                type="button"
                className="ghost"
                onClick={systemWizardCanNavigate && !systemWizardAtFirstStep ? handleSystemWizardBack : closeSystemWizard}
              >
                {systemWizardCanNavigate && !systemWizardAtFirstStep ? 'Back' : 'Cancel'}
              </button>
              {systemWizardCanNavigate && !systemWizardAtLastStep ? (
                <button type="button" onClick={handleSystemWizardNext}>
                  Next
                </button>
              ) : (
                <button type="button" onClick={handleSystemWizardSubmit} disabled={systemWizardSaving}>
                  {systemWizardSaving ? 'Saving…' : systemWizardMode === 'override' ? 'Save Override' : 'Save System'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {wizardCancelConfirmOpen && (
        <div
          className="quest-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wizard-cancel-title"
          onClick={dismissWizardCancelPrompt}
        >
          <div className="quest-modal quest-wizard-cancel" onClick={event => event.stopPropagation()}>
            <header className="quest-modal-header">
              <div>
                <p className="muted">Guided Build • Unsaved Progress</p>
                <h2 id="wizard-cancel-title">Leave the Wizard?</h2>
              </div>
            </header>
            <div className="quest-modal-body">
              <p>
                {draft ? (
                  <>
                    Discarding now will abandon changes to <strong>{draft.title || draft.id}</strong> and any staged mails.
                  </>
                ) : (
                  'Discarding now will abandon any staged quest progress.'
                )}
              </p>
              <p className="muted">Choose Resume to keep editing, or Discard to exit the guided flow.</p>
            </div>
            <div className="quest-modal-actions">
              <button type="button" className="ghost" onClick={dismissWizardCancelPrompt}>Resume Wizard</button>
              <button type="button" className="danger" onClick={confirmWizardCancel}>Discard &amp; Close</button>
            </div>
          </div>
        </div>
      )}
      {unsavedDeletePromptOpen && draft && draft.__unsaved && (
        <div
          className="quest-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quest-discard-draft-title"
          onClick={cancelDiscardUnsavedQuest}
        >
          <div className="quest-modal" onClick={event => event.stopPropagation()}>
            <header className="quest-modal-header">
              <div>
                <p className="muted">Quest Management • Draft</p>
                <h2 id="quest-discard-draft-title">Discard Draft Quest?</h2>
              </div>
            </header>
            <div className="quest-modal-body">
              <p>
                Removing <strong>{draft.title || draft.id || 'Untitled Quest'}</strong> will delete this unsaved draft and any wizard progress.
              </p>
              <p className="muted">You can always create a fresh quest later from the sidebar.</p>
            </div>
            <div className="quest-modal-actions">
              <button type="button" className="ghost" onClick={cancelDiscardUnsavedQuest}>Keep Draft</button>
              <button type="button" className="danger" onClick={confirmDiscardUnsavedQuest}>Discard Draft</button>
            </div>
          </div>
        </div>
      )}
      {pendingDeleteQuest && (
        <div
          className="quest-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quest-delete-title"
          onClick={cancelDeleteQuest}
        >
          <div className="quest-modal" onClick={event => event.stopPropagation()}>
            <header className="quest-modal-header">
              <div>
                <p className="muted">Secure Control • Deletion Request</p>
                <h2 id="quest-delete-title">Confirm Quest Deletion</h2>
              </div>
            </header>
            <div className="quest-modal-body">
              <p>
                Removing <strong>{pendingDeleteQuest.title || pendingDeleteQuest.id}</strong> will immediately
                purge it from the terminal roster. This action cannot be undone.
              </p>
              <div className="quest-modal-card">
                <div>
                  <span className="muted">Quest ID</span>
                  <p className="quest-modal-mono">{pendingDeleteQuest.id}</p>
                </div>
                <div>
                  <span className="muted">Status</span>
                  <p className={`quest-modal-status ${pendingDeleteQuest.status}`}>
                    {pendingDeleteQuest.status === 'published' ? 'Published' : 'Draft'}
                  </p>
                </div>
              </div>
            </div>
            <div className="quest-modal-actions">
              <button type="button" className="ghost" onClick={cancelDeleteQuest} disabled={deleteInProgress}>Cancel</button>
              <button type="button" className="danger" onClick={confirmDeleteQuest} disabled={deleteInProgress}>
                {deleteInProgress ? 'Deleting…' : 'Delete Quest'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

