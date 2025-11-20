import { describe, expect, it } from 'vitest'

import { buildIntroMailBody } from '../services/questMailSync'
import type { QuestDefinition } from '../types/quest'

const baseQuest: QuestDefinition = {
  id: 'quest_accept_hint',
  title: 'Accept Hint Quest',
  shortDescription: 'Test quest for mail previews.',
  objectiveShort: 'Accept the quest via terminal.',
  difficulty: 'easy',
  steps: []
}

describe('buildIntroMailBody', () => {
  it('appends the default accept hint when enabled', () => {
    const quest: QuestDefinition = {
      ...baseQuest,
      introEmail: {
        subject: 'Briefing',
        body: 'Operator, welcome to the run.',
        showAcceptHint: true
      }
    }

    const body = buildIntroMailBody(quest)

    expect(body).toContain('Operator, welcome to the run.')
    expect(body).toContain('To accept this contract, run:')
    expect(body).toContain('quest start quest_accept_hint')
  })

  it('uses the override text when provided', () => {
    const quest: QuestDefinition = {
      ...baseQuest,
      introEmail: {
        subject: 'Briefing',
        body: 'Operator, welcome to the run.',
        acceptHintOverride: 'Tap the console and type quest start demo_contract.'
      }
    }

    const body = buildIntroMailBody(quest)

    expect(body).toContain('Operator, welcome to the run.')
    expect(body).toContain('Tap the console and type quest start demo_contract.')
    expect(body).not.toContain('To accept this contract, run:')
  })

  it('omits the hint block when disabled', () => {
    const quest: QuestDefinition = {
      ...baseQuest,
      introEmail: {
        subject: 'Briefing',
        body: 'Operator, welcome to the run.',
        showAcceptHint: false
      }
    }

    const body = buildIntroMailBody(quest)

    expect(body).toBe('Operator, welcome to the run.')
  })
})
