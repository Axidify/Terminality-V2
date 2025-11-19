import type {
  CompletionEmailVariant,
  CompletionEmailVariantCondition,
  QuestDefinition,
  QuestStepDefinition,
  QuestSystemDoor
} from '../../types/quest'

export type QuestWizardStep = 'details' | 'system' | 'intro_email' | 'steps' | 'completion_email' | 'summary'

export interface QuestValidationErrors {
  details?: string[]
  system?: string[]
  intro_email?: string[]
  steps?: string[]
  completion_email?: string[]
}

const hasText = (value?: string | null) => Boolean(value && value.trim().length > 0)

const validateDetails = (quest: QuestDefinition) => {
  const issues: string[] = []
  if (!hasText(quest.title)) issues.push('Quest title is required.')
  if (!hasText(quest.shortDescription)) issues.push('Short description cannot be empty.')
  return issues
}

const isValidIp = (value: string) => {
  const parts = value.split('.')
  if (parts.length !== 4) return false
  return parts.every(part => {
    if (!/^[0-9]{1,3}$/.test(part)) return false
    const num = Number(part)
    return num >= 0 && num <= 255
  })
}

const validateSystem = (quest: QuestDefinition) => {
  const issues: string[] = []
  if (!quest.system) {
    issues.push('Quest must define a target system.')
    return issues
  }
  const { label, ip, doors, filesystemRoot, securityRules } = quest.system
  if (!hasText(label)) issues.push('System name cannot be empty.')
  if (!hasText(ip)) issues.push('System IP / host is required.')
  else if (!isValidIp(ip)) issues.push('IP must look like 10.14.6.23 (four numbers 0-255).')
  if (!doors || doors.length === 0) {
    issues.push('Add at least one door / entry point.')
  } else {
    const portsSeen = new Map<number, number>()
    doors.forEach((door: QuestSystemDoor, index) => {
      const labelPrefix = door.name?.trim() ? `Door “${door.name.trim()}”` : `Door ${index + 1}`
      if (!hasText(door.name)) issues.push(`${labelPrefix}: name is required.`)
      if (typeof door.port !== 'number' || Number.isNaN(door.port)) {
        issues.push(`${labelPrefix}: port must be a number.`)
      } else {
        if (door.port < 1 || door.port > 65535) {
          issues.push(`${labelPrefix}: port must be between 1 and 65535.`)
        }
        portsSeen.set(door.port, (portsSeen.get(door.port) || 0) + 1)
      }
      if (!door.status) issues.push(`${labelPrefix}: select a status.`)
    })
    portsSeen.forEach((count, port) => {
      if (count > 1) {
        issues.push(`Port ${port} is reused across multiple doors. Ports must be unique.`)
      }
    })
  }
  if (!filesystemRoot) {
    issues.push('Filesystem root is missing.')
  } else {
    if (filesystemRoot.type !== 'folder') {
      issues.push('Filesystem root must be a folder node.')
    }
    if (!filesystemRoot.children || filesystemRoot.children.length === 0) {
      issues.push('Filesystem root should contain at least one folder or file.')
    }
  }
  if (securityRules) {
    const { maxTrace, nervousThreshold, panicThreshold } = securityRules
    if (maxTrace <= 0) issues.push('Max trace must be greater than zero.')
    if (nervousThreshold <= 0 || nervousThreshold >= maxTrace) {
      issues.push('Nervous threshold must be above zero and below max trace.')
    }
    if (panicThreshold <= nervousThreshold || panicThreshold > maxTrace) {
      issues.push('Panic threshold must be between nervous threshold and max trace.')
    }
  }
  return issues
}

const validateIntroEmail = (quest: QuestDefinition) => {
  const issues: string[] = []
  if (!quest.introEmail) {
    issues.push('Intro email must be drafted.')
    return issues
  }
  if (!hasText(quest.introEmail.from)) issues.push('Intro email sender is required.')
  if (!hasText(quest.introEmail.subject)) issues.push('Intro email subject is required.')
  if (!hasText(quest.introEmail.body)) issues.push('Intro email body is required.')
  return issues
}

const validateSteps = (quest: QuestDefinition) => {
  const issues: string[] = []
  if (!quest.steps || quest.steps.length === 0) {
    issues.push('Add at least one quest step.')
    return issues
  }
  quest.steps.forEach((step: QuestStepDefinition, index) => {
    const label = `Step ${index + 1}`
    if (!hasText(step.type)) issues.push(`${label}: select a step type.`)
    if (!hasText(step.description)) issues.push(`${label}: description is required.`)
  })
  return issues
}

const validateVariantConditions = (variant: CompletionEmailVariant, label: string, issues: string[]) => {
  if (!variant.conditions || variant.conditions.length === 0) {
    issues.push(`${label}: add at least one delivery condition.`)
    return
  }
  variant.conditions.forEach((condition: CompletionEmailVariantCondition, index) => {
    const conditionLabel = `${label} • Condition ${index + 1}`
    switch (condition.type) {
      case 'trace_below': {
        const threshold = Number(condition.data?.threshold)
        if (!Number.isFinite(threshold) || threshold <= 0) {
          issues.push(`${conditionLabel}: set a trace threshold above zero.`)
        }
        break
      }
      case 'bonus_objective_completed': {
        const objectiveId = `${condition.data?.objectiveId || ''}`.trim()
        if (!objectiveId) {
          issues.push(`${conditionLabel}: choose a bonus objective to monitor.`)
        }
        break
      }
      case 'trap_triggered': {
        const trapId = `${condition.data?.trapId || ''}`.trim()
        if (!trapId) {
          issues.push(`${conditionLabel}: provide the trap identifier to listen for.`)
        }
        break
      }
      default:
        break
    }
  })
}

const validateCompletionEmail = (quest: QuestDefinition) => {
  const issues: string[] = []
  const completion = quest.completionEmail
  if (!completion || !completion.default) {
    issues.push('Completion email must be drafted.')
    return issues
  }
  if (!hasText(completion.default.from)) issues.push('Completion email sender is required.')
  if (!hasText(completion.default.subject)) issues.push('Completion email subject is required.')
  if (!hasText(completion.default.body)) issues.push('Completion email body is required.')
  completion.variants?.forEach((variant, index) => {
    const label = `Completion variant ${index + 1}`
    if (!hasText(variant.subject)) issues.push(`${label}: subject is required.`)
    if (!hasText(variant.body)) issues.push(`${label}: body copy is required.`)
    validateVariantConditions(variant, label, issues)
  })
  return issues
}

const STEP_VALIDATORS: Record<Exclude<QuestWizardStep, 'summary'>, (quest: QuestDefinition) => string[]> = {
  details: validateDetails,
  system: validateSystem,
  intro_email: validateIntroEmail,
  steps: validateSteps,
  completion_email: validateCompletionEmail
}

export const QUEST_WIZARD_STEPS: QuestWizardStep[] = ['details', 'system', 'intro_email', 'steps', 'completion_email', 'summary']

export const validateQuestForStep = (quest: QuestDefinition, step: QuestWizardStep): string[] => {
  if (step === 'summary') {
    return Object.values(STEP_VALIDATORS).flatMap(fn => fn(quest))
  }
  return STEP_VALIDATORS[step](quest)
}

export const validateQuest = (quest: QuestDefinition): QuestValidationErrors => ({
  details: validateDetails(quest),
  system: validateSystem(quest),
  intro_email: validateIntroEmail(quest),
  steps: validateSteps(quest),
  completion_email: validateCompletionEmail(quest)
})
