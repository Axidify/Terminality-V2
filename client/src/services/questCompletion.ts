import { DEFAULT_MAIL_SENDER, PLAYER_INBOX_ADDRESS } from '../constants/mail'
import { generateId } from '../programs/quest-designer/id'
import type {
  CompletionEmailVariant,
  CompletionEmailVariantCondition,
  QuestCompletionEmailConfig,
  QuestDefinition
} from '../types/quest'
import type { GameMail } from '../types/mail'
import type { QuestOutcomeKey } from '../programs/terminalRuntime'

export interface CompletionContext {
  maxTraceSeen: number
  trapsTriggered: string[]
  bonusCompletedIds: string[]
  outcome: QuestOutcomeKey
}

export interface MailTemplate {
  subject: string
  body: string
}

export const completionVariantMatches = (
  cond: CompletionEmailVariantCondition,
  ctx: CompletionContext
): boolean => {
  switch (cond.type) {
    case 'trace_below': {
      const max = cond.data?.maxTrace
      return typeof max === 'number' && ctx.maxTraceSeen <= max
    }
    case 'bonus_objective_completed': {
      const id = cond.data?.objectiveId
      return typeof id === 'string' && ctx.bonusCompletedIds.includes(id)
    }
    case 'trap_triggered': {
      const path = cond.data?.filePath
      return typeof path === 'string' && ctx.trapsTriggered.includes(path)
    }
    case 'trace_between': {
      const min = typeof cond.data?.minTrace === 'number' ? cond.data.minTrace : 0
      const max = typeof cond.data?.maxTrace === 'number' ? cond.data.maxTrace : 100
      return ctx.maxTraceSeen >= min && ctx.maxTraceSeen <= max
    }
    case 'quest_outcome': {
      const expected = cond.data?.outcome as QuestOutcomeKey | undefined
      return Boolean(expected) && ctx.outcome === expected
    }
    default:
      return false
  }
}

const variantMatchesContext = (
  variant: CompletionEmailVariant,
  ctx: CompletionContext
): boolean => {
  const conditions = variant.conditions ?? []
  if (!conditions.length) {
    return false
  }
  return conditions.every(condition => completionVariantMatches(condition, ctx))
}

export const pickCompletionEmailTemplate = (
  quest: QuestDefinition,
  completionEmail: QuestCompletionEmailConfig | undefined,
  ctx: CompletionContext
): MailTemplate => {
  if (!completionEmail) {
    return {
      subject: `Quest complete: ${quest.title}`,
      body: `You completed "${quest.title}".`
    }
  }

  if (completionEmail.variants?.length) {
    for (const variant of completionEmail.variants) {
      if (variantMatchesContext(variant, ctx)) {
        return { subject: variant.subject, body: variant.body }
      }
    }
  }

  return {
    subject: completionEmail.default.subject,
    body: completionEmail.default.body
  }
}

export const buildQuestCompletionMail = (
  quest: QuestDefinition,
  template: MailTemplate
): GameMail => {
  const now = new Date().toISOString()

  return {
    id: generateId('mail'),
    from: DEFAULT_MAIL_SENDER,
    to: PLAYER_INBOX_ADDRESS,
    subject: template.subject,
    body: template.body,
    receivedAt: now,
    read: false,
    archived: false,
    tags: ['quest', 'reward'],
    questId: quest.id,
    type: 'completion',
    folder: 'inbox'
  }
}
