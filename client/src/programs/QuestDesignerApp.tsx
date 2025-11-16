import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import './QuestDesignerApp.css'

import { signalSessionActivity } from '../os/SessionActivityContext'
import { useToasts } from '../os/ToastContext'
import { useUser } from '../os/UserContext'
import { getCachedDesktop, hydrateFromServer } from '../services/saveService'
import { listSystemProfiles, SystemProfileDTO, SystemProfilesResponse } from '../services/systemProfiles'
import {
  listTerminalQuests,
  createTerminalQuest,
  updateTerminalQuest,
  deleteTerminalQuest,
  validateTerminalQuest
} from '../services/terminalQuests'

import type { SerializedQuestState } from './questSystem'
import type { FileSystemNode, QuestDefinition, QuestLifecycleStatus, QuestRewardFlag, QuestStep, QuestStepType, QuestTrigger, QuestTriggerType } from './terminalQuests/types'

interface DesignerQuest extends QuestDefinition {
  __unsaved?: boolean
}

interface TagInputProps {
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  suggestions?: string[]
  ariaLabel?: string
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

const FIELD_HINTS = {
  questId: 'Unique quest identifier referenced by automation and saves; keep stable once published.',
  questTitle: 'Player-facing title that appears in the terminal quest list.',
  questStatus: 'Draft quests stay internal; published quests sync to players.',
  questStatusFilter: 'Filters rely on the most recent player desktop snapshot; refresh after testing quests to see updated lifecycle states.',
  triggerType: 'Determines when this quest activates (first terminal, quest completion, or flag).',
  completionQuests: 'Select quests whose completion automatically fires this quest trigger.',
  triggerFlagKey: 'Flag key watched for ON_FLAG_SET triggers.',
  triggerFlagValue: 'Optional flag value to match; leave blank to match any value.',
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

const sortQuests = (entries: DesignerQuest[]): DesignerQuest[] => (
  [...entries].sort((a, b) => {
    const nameA = (a.title || a.id).toLowerCase()
    const nameB = (b.title || b.id).toLowerCase()
    if (nameA === nameB) return a.id.localeCompare(b.id)
    return nameA.localeCompare(nameB)
  })
)

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

const STEP_TYPES: StepType[] = ['SCAN_HOST', 'CONNECT_HOST', 'DELETE_FILE', 'DISCONNECT_HOST']
type SystemTemplateDTO = SystemProfilesResponse['templates'][number]

type FilesystemMap = Record<string, FileSystemNode>

const normalizeFilesystemPath = (input: string): string => {
  if (!input) return '/'
  const trimmed = input.trim().replace(/\\/g, '/').replace(/\/+/g, '/')
  if (!trimmed) return '/'
  let normalized = trimmed
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`
  }
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }
  return normalized || '/'
}

const normalizeFilesystemMap = (filesystem: unknown): FilesystemMap => {
  if (!filesystem || typeof filesystem !== 'object') return {}
  const normalized: FilesystemMap = {}
  Object.entries(filesystem as Record<string, FileSystemNode | null | undefined>).forEach(([key, node]) => {
    if (!node) return
    const normalizedPath = normalizeFilesystemPath(node.path || key)
    const normalizedChildren = Array.isArray(node.children)
      ? node.children.map(childPath => normalizeFilesystemPath(childPath))
      : undefined
    normalized[normalizedPath] = {
      ...node,
      name: node.name || (normalizedPath === '/' ? '/' : normalizedPath.split('/').pop() || '/'),
      path: normalizedPath,
      children: normalizedChildren
    }
  })
  return normalized
}

const stringifyFilesystemMap = (filesystem: FilesystemMap | null | undefined): string => {
  try {
    return JSON.stringify(filesystem || {}, null, 2)
  } catch (_err) {
    return '{}'
  }
}

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

const createEmptyQuest = (): DesignerQuest => ({
  id: `quest_${Date.now()}`,
  title: 'Untitled Quest',
  description: 'Describe this operation.',
  trigger: sanitizeTrigger({ type: DEFAULT_TRIGGER }),
  steps: [],
  rewards: { credits: 0, flags: [], unlocks_commands: [] },
  requirements: { required_flags: [], required_quests: [] },
  default_system_id: undefined,
  embedded_filesystems: {},
  completion_flag: undefined,
  status: 'draft',
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
  __unsaved: (quest as DesignerQuest).__unsaved
})

const questToPayload = (quest: DesignerQuest): Operation => ({
  id: quest.id.trim(),
  title: quest.title,
  description: quest.description,
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
  status: quest.status === 'published' ? 'published' : 'draft'
})
  
const useTagInput = ({ values, onChange, suggestions, placeholder, ariaLabel }: TagInputProps) => {
  const [input, setInput] = useState('')
  const listId = useId()

  const addValue = useCallback((raw: string) => {
    const value = raw.trim()
    if (!value) return
    if (values.includes(value)) {
      setInput('')
      return
    }
    onChange([...values, value])
    setInput('')
  }, [onChange, values])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === 'Tab' || event.key === ',') {
      event.preventDefault()
      addValue(input)
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
          onBlur={e => addValue(e.target.value)}
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

const validateQuestDraft = (quest?: DesignerQuest): string[] => {
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
  const [systemsLoading, setSystemsLoading] = useState(true)
  const [fsDrafts, setFsDrafts] = useState<Record<string, string>>({})
  const [playerQuestStatuses, setPlayerQuestStatuses] = useState<Record<string, QuestLifecycleStatus>>({})
  const [questStatusTimestamp, setQuestStatusTimestamp] = useState<string | null>(null)
  const [questStateLoading, setQuestStateLoading] = useState(false)
  const [questStatusError, setQuestStatusError] = useState<string | null>(null)
  const [questStatusFilter, setQuestStatusFilter] = useState<StatusFilterValue>('all')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteInProgress, setDeleteInProgress] = useState(false)
  const flagKeyListId = useId()
  const rewardFlagKeyListId = useId()
  const persistedIdRef = useRef<string | null>(null)
  const tooltipNodeRef = useRef<HTMLDivElement | null>(null)

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
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const data = await listTerminalQuests({ includeDrafts: true })
        if (cancelled) return
        setQuests(sortQuests(data.map(normalizeQuest)))
      } catch (err) {
        console.error('[quest designer] failed to load quests', err)
        if (!cancelled) setErrors(['Failed to load quests from server.'])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadSystems = async () => {
      setSystemsLoading(true)
      try {
        const payload: SystemProfilesResponse = await listSystemProfiles()
        if (cancelled) return
        setSystemProfilesState(payload.profiles || [])
        setSystemTemplates(payload.templates || [])
      } catch (err) {
        console.error('[quest designer] failed to load system profiles', err)
        if (!cancelled) {
          setSystemProfilesState([])
          setSystemTemplates([])
        }
      } finally {
        if (!cancelled) setSystemsLoading(false)
      }
    }
    void loadSystems()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!draft) {
      setFsDrafts({})
      return
    }
    const overrides = draft.embedded_filesystems || {}
    const snapshot: Record<string, string> = {}
    Object.entries(overrides).forEach(([systemId, fsMap]) => {
      const normalized = normalizeFilesystemMap(fsMap)
      snapshot[systemId] = stringifyFilesystemMap(normalized)
    })
    setFsDrafts(snapshot)
  }, [draft])

  const selectQuest = (quest: DesignerQuest) => {
    setSelectedKey(quest.id)
    setDraft(normalizeQuest(quest))
    persistedIdRef.current = quest.__unsaved ? null : quest.id
    setErrors([])
    setWarnings([])
    setValidationMessages([])
  }

  const handleCreateQuest = () => {
    const fresh = createEmptyQuest()
    setQuests(prev => sortQuests([...prev, fresh]))
    selectQuest(fresh)
    signalSessionActivity('quest-create')
  }

  const updateCurrentQuest = (updater: (prev: DesignerQuest) => DesignerQuest) => {
    setDraft(prev => (prev ? updater(prev) : prev))
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

  const unlockCommandInput = useTagInput({
    values: draft?.rewards?.unlocks_commands || [],
    onChange: values => updateCurrentQuest(prev => ({ ...prev, rewards: { ...prev.rewards, unlocks_commands: values } })),
    placeholder: 'command name',
    ariaLabel: 'Unlock command list'
  })

  const rewardFlags = draft?.rewards?.flags || []

  const addRewardFlag = () => {
    updateCurrentQuest(prev => ({
      ...prev,
      rewards: {
        ...prev.rewards,
        flags: [...(prev.rewards?.flags || []), { key: '', value: '' }]
      }
    }))
  }

  const updateRewardFlag = (index: number, patch: Partial<QuestRewardFlag>) => {
    updateCurrentQuest(prev => {
      const flags = [...(prev.rewards?.flags || [])]
      flags[index] = { ...flags[index], ...patch }
      return {
        ...prev,
        rewards: { ...prev.rewards, flags }
      }
    })
  }

  const removeRewardFlag = (index: number) => {
    updateCurrentQuest(prev => ({
      ...prev,
      rewards: {
        ...prev.rewards,
        flags: (prev.rewards?.flags || []).filter((_, idx) => idx !== index)
      }
    }))
  }

  const normalizedSearch = search.trim().toLowerCase()
  const filteredQuests = quests.filter(quest => {
    const lifecycle = playerQuestStatuses[quest.id] || DEFAULT_LIFECYCLE_STATUS
    const matchesFilter = questStatusFilter === 'all' || lifecycle === questStatusFilter
    if (!matchesFilter) return false
    if (!normalizedSearch) return true
    return quest.title.toLowerCase().includes(normalizedSearch) || quest.id.toLowerCase().includes(normalizedSearch)
  })

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

  const pendingDeleteQuest = deleteDialogOpen && draft && !draft.__unsaved ? draft : null

  const systemOptions = useMemo(() => (
    systemProfilesState.map(profile => ({
      id: profile.id,
      label: `${profile.label}${profile.identifiers?.ips?.length ? ` (${profile.identifiers.ips[0]})` : ''}`
    }))
  ), [systemProfilesState])

  const questStatusTimestampLabel = useMemo(() => {
    if (!questStatusTimestamp) return 'Snapshot not captured yet.'
    const parsed = new Date(questStatusTimestamp)
    if (Number.isNaN(parsed.getTime())) return 'Snapshot timestamp unavailable.'
    return `Snapshot saved ${parsed.toLocaleString()}`
  }, [questStatusTimestamp])

  const systemLookup = useMemo(() => {
    const map = new Map<string, SystemProfileDTO>()
    systemProfilesState.forEach(profile => map.set(profile.id, profile))
    return map
  }, [systemProfilesState])

  const systemIdsInUse = useMemo(() => {
    if (!draft) return []
    const ids = new Set<string>()
    if (draft.default_system_id) ids.add(draft.default_system_id)
    draft.steps.forEach(step => {
      if (step.target_system_id) ids.add(step.target_system_id)
    })
    return Array.from(ids)
  }, [draft])

  const handleFilesystemDraftChange = (systemId: string, value: string) => {
    setFsDrafts(prev => ({ ...prev, [systemId]: value }))
  }

  const applyFilesystemDraft = (systemId: string) => {
    if (!draft) return
    try {
      const parsed = JSON.parse(fsDrafts[systemId] || '{}')
      const normalized = normalizeFilesystemMap(parsed)
      updateCurrentQuest(prev => ({
        ...prev,
        embedded_filesystems: {
          ...(prev.embedded_filesystems || {}),
          [systemId]: normalized
        }
      }))
      setFsDrafts(prev => ({
        ...prev,
        [systemId]: stringifyFilesystemMap(normalized)
      }))
    } catch (_err) {
      setErrors([`Filesystem override for ${systemId} is invalid JSON.`])
    }
  }

  const removeFilesystemOverride = (systemId: string) => {
    updateCurrentQuest(prev => {
      if (!prev.embedded_filesystems) return prev
      const next = { ...prev.embedded_filesystems }
      delete next[systemId]
      return { ...prev, embedded_filesystems: next }
    })
    setFsDrafts(prev => {
      const next = { ...prev }
      delete next[systemId]
      return next
    })
  }

  const applyTemplateToSystem = (systemId: string, templateId: string) => {
    const template = systemTemplates.find(tpl => tpl.id === templateId)
    if (!template) return
    const serialized = JSON.stringify(template.filesystem, null, 2)
    setFsDrafts(prev => ({ ...prev, [systemId]: serialized }))
    updateCurrentQuest(prev => ({
      ...prev,
      embedded_filesystems: {
        ...(prev.embedded_filesystems || {}),
        [systemId]: template.filesystem
      }
    }))
  }

  const runSave = async (statusOverride?: 'draft' | 'published') => {
    if (!draft) return
    signalSessionActivity('quest-save-attempt')
    const targetDraft = statusOverride ? { ...draft, status: statusOverride } : draft
    if (statusOverride) {
      setDraft(targetDraft)
    }
    const validation = validateQuestDraft(targetDraft)
    if (validation.length) {
      setErrors(validation)
      pushToast({
        title: 'Fix Validation Issues',
        message: validation[0],
        kind: 'error',
        dedupeKey: 'quest-save-error'
      })
      return
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
      setQuests(prev => {
        const others = prev.filter(q => q.id !== (selectedKey || targetDraft.id))
        return sortQuests([...others, savedQuest])
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
  }

  const handleSave = () => { void runSave() }
  const handlePublish = () => { void runSave('published') }

  const handleValidate = async () => {
    if (!draft) return
    setValidating(true)
    try {
      const result = await validateTerminalQuest(questToPayload(draft))
      const issues = result.errors || []
      setValidationMessages(issues.length ? issues : ['Quest validated successfully.'])
      setWarnings(result.warnings || [])
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
      setQuests(prev => sortQuests(prev.filter(q => q.id !== draft.id)))
      setDraft(null)
      setSelectedKey(null)
      persistedIdRef.current = null
      setDeleteDialogOpen(false)
      pushToast({
        title: 'Draft Discarded',
        message: `${draft.title || draft.id} removed from the queue.`,
        kind: 'info',
        dedupeKey: 'quest-delete-success'
      })
      signalSessionActivity('quest-delete-draft')
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
      setQuests(prev => sortQuests(prev.filter(q => q.id !== targetDraft.id)))
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
          <button type="button" onClick={handleCreateQuest}>+ New</button>
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
        <div className="quest-list-items">
          {filteredQuests.map(quest => {
            const isActive = !!draft && (quest.id === draft.id || quest.id === (selectedKey || ''))
            const lifecycleStatus = playerQuestStatuses[quest.id] || DEFAULT_LIFECYCLE_STATUS
            const lifecycleLabel = STATUS_LABELS[lifecycleStatus]
            return (
              <button
                key={quest.id}
                className={`quest-list-item ${isActive ? 'selected' : ''}`}
                onClick={() => selectQuest(quest)}
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
                <h3>Filesystem Overrides</h3>
                {systemsLoading && <span className="muted">Loading systems…</span>}
              </div>
              {!systemsLoading && !systemIdsInUse.length && (
                <div className="muted empty">Assign a default system or set per-step targets to customize filesystems.</div>
              )}
              {systemIdsInUse.map(systemId => {
                const label = systemLookup.get(systemId)?.label || systemId
                return (
                  <div key={systemId} className="fs-override-card">
                    <div className="fs-override-header">
                      <strong>{label}</strong>
                      <span className="muted">System ID: {systemId}</span>
                    </div>
                    <div className="fs-override-actions">
                      <select
                        defaultValue=""
                        onChange={e => {
                          if (!e.target.value) return
                          applyTemplateToSystem(systemId, e.target.value)
                          e.target.value = ''
                        }}
                      >
                        <option value="">Apply template…</option>
                        {systemTemplates.map(template => (
                          <option key={template.id} value={template.id}>{template.label}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => applyFilesystemDraft(systemId)}>Apply Override</button>
                      <button type="button" className="ghost" onClick={() => removeFilesystemOverride(systemId)} disabled={!draft.embedded_filesystems?.[systemId]}>Remove Override</button>
                    </div>
                    <textarea
                      value={fsDrafts[systemId] ?? ''}
                      onChange={e => handleFilesystemDraftChange(systemId, e.target.value)}
                      placeholder={'{ "/path": { "type": "dir" } }'}
                    />
                  </div>
                )
              })}
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

