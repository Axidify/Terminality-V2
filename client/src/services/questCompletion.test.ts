import { describe, expect, it } from 'vitest'

import { completionVariantMatches, pickCompletionEmailTemplate, type CompletionContext } from './questCompletion'
import type {
  CompletionEmailVariantCondition,
  QuestCompletionEmailConfig,
  QuestDefinition
} from '../types/quest'

const demoQuest: QuestDefinition = {
  id: 'quest_demo',
  title: 'Demo Operation',
  shortDescription: 'Test harness quest',
  difficulty: 'tutorial',
  steps: []
}

describe('pickCompletionEmailTemplate', () => {
  it('falls back to generic template when quest lacks completion email config', () => {
    const ctx: CompletionContext = { maxTraceSeen: 20, trapsTriggered: [], bonusCompletedIds: [] }
    const template = pickCompletionEmailTemplate(demoQuest, undefined, ctx)
    expect(template.subject).toBe(`Quest complete: ${demoQuest.title}`)
    expect(template.body).toContain(demoQuest.title)
  })

  it('selects the first matching variant when conditions pass', () => {
    const completionEmail: QuestCompletionEmailConfig = {
      default: { subject: 'Default', body: 'Default body' },
      variants: [
        {
          id: 'low-trace',
          subject: 'Ghosted the grid',
          body: 'Trace stayed low.',
          conditions: [{ type: 'trace_below', data: { maxTrace: 30 } }]
        },
        {
          id: 'trap',
          subject: 'Trap sprung',
          body: 'You triggered a trap.',
          conditions: [{ type: 'trap_triggered', data: { filePath: '/decoy.log' } }]
        }
      ]
    }
    const ctx: CompletionContext = { maxTraceSeen: 25, trapsTriggered: [], bonusCompletedIds: [] }
    const template = pickCompletionEmailTemplate(demoQuest, completionEmail, ctx)
    expect(template.subject).toBe('Ghosted the grid')
  })

  it('falls back to default when no variants match', () => {
    const completionEmail: QuestCompletionEmailConfig = {
      default: { subject: 'Default closing', body: 'Good work.' },
      variants: [
        {
          id: 'bonus',
          subject: 'Bonus cleared',
          body: 'All bonuses done.',
          conditions: [{ type: 'bonus_objective_completed', data: { objectiveId: 'bonus_a' } }]
        }
      ]
    }
    const ctx: CompletionContext = { maxTraceSeen: 10, trapsTriggered: [], bonusCompletedIds: [] }
    const template = pickCompletionEmailTemplate(demoQuest, completionEmail, ctx)
    expect(template.subject).toBe('Default closing')
    expect(template.body).toBe('Good work.')
  })
})

describe('completionVariantMatches', () => {
  const ctx: CompletionContext = {
    maxTraceSeen: 42,
    trapsTriggered: ['/honeypot.txt'],
    bonusCompletedIds: ['bonus_keep_trace_low']
  }

  const match = (condition: CompletionEmailVariantCondition) => completionVariantMatches(condition, ctx)

  it('validates trace thresholds', () => {
    expect(match({ type: 'trace_below', data: { maxTrace: 50 } })).toBe(true)
    expect(match({ type: 'trace_below', data: { maxTrace: 30 } })).toBe(false)
  })

  it('checks bonus objective completion', () => {
    expect(match({ type: 'bonus_objective_completed', data: { objectiveId: 'bonus_keep_trace_low' } })).toBe(true)
    expect(match({ type: 'bonus_objective_completed', data: { objectiveId: 'bonus_clean_logs' } })).toBe(false)
  })

  it('detects triggered traps', () => {
    expect(match({ type: 'trap_triggered', data: { filePath: '/honeypot.txt' } })).toBe(true)
    expect(match({ type: 'trap_triggered', data: { filePath: '/innocent.txt' } })).toBe(false)
  })
})
