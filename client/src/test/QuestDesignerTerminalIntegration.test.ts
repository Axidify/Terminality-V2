import { describe, expect, it } from 'vitest'

import { startQuestSession } from '../programs/terminalRuntime'
import { buildIntroMailBody } from '../services/questMailSync'
import type { QuestDefinition } from '../types/quest'

const baseQuest: QuestDefinition = {
  id: 'quest_sim_01',
  title: 'Simulation Quest',
  shortDescription: 'Short desc',
  objectiveShort: 'Complete the sim objective.',
  difficulty: 'easy',
  steps: []
}

describe('Quest designer -> Terminal integration', () => {
  it('shows objective and briefing in terminal session', () => {
    const quest: QuestDefinition = {
      ...baseQuest,
      introEmail: {
        subject: 'Sim briefing',
        body: 'Operator, run this simulation.\n\nBe safe.'
      }
    }
    const session = startQuestSession(quest)
    const introText = session.lines.map(l => l.text).join('\n')
    expect(introText).toContain('Quest accepted: Simulation Quest')
    expect(introText).toContain('Briefing:')
    expect(introText).toContain('Objective: Complete the sim objective.')
  })

  it('sanitizes multiline objective into a single-line objective in the terminal', () => {
    const quest: QuestDefinition = {
      ...baseQuest,
      objectiveShort: 'Take out\n\n  the relay   \nnow',
      introEmail: { subject: 'Briefing', body: 'Dummy' }
    }
    const session = startQuestSession(quest)
    const objectiveLine = session.lines.find(l => l.text.startsWith('Objective:'))
    expect(objectiveLine).toBeTruthy()
    expect(objectiveLine!.text).toContain('Take out the relay now')
  })

  it('appends accept hint to intro mail when enabled and uses override when set', () => {
    const withDefaultHint: QuestDefinition = {
      ...baseQuest,
      introEmail: { subject: 'Briefing', body: 'Operator, start the test.' }
    }
    const bodyDefault = buildIntroMailBody(withDefaultHint)
    expect(bodyDefault).toContain('To accept this contract, run:')
    expect(bodyDefault).toContain('quest start quest_sim_01')

    const withOverride: QuestDefinition = {
      ...baseQuest,
      introEmail: { subject: 'Briefing', body: 'Operator, start the test.', acceptHintOverride: 'Type `quest start demo`' }
    }
    const bodyOverride = buildIntroMailBody(withOverride)
    expect(bodyOverride).toContain('Type `quest start demo`')
    expect(bodyOverride).not.toContain('To accept this contract, run:')

    const withDisabled: QuestDefinition = {
      ...baseQuest,
      introEmail: { subject: 'Briefing', body: 'Operator, start the test.', showAcceptHint: false }
    }
    const bodyDisabled = buildIntroMailBody(withDisabled)
    expect(bodyDisabled).not.toContain('To accept this contract, run:')
  })

  it('shows accept hint in the terminal briefing when enabled', () => {
    const quest: QuestDefinition = {
      ...baseQuest,
      introEmail: { subject: 'Briefing', body: 'Operator, start the test.' }
    }
    const session = startQuestSession(quest)
    const hintLine = session.lines.find(l => l.text.includes('To accept this contract'))
    expect(hintLine).toBeTruthy()
  })

  it('shows an overridden accept hint in the terminal briefing', () => {
    const quest: QuestDefinition = {
      ...baseQuest,
      introEmail: { subject: 'Briefing', body: 'Operator, start the test.', acceptHintOverride: 'Run quest start custom' }
    }
    const session = startQuestSession(quest)
    const hintLine = session.lines.find(l => l.text.includes('Run quest start custom'))
    expect(hintLine).toBeTruthy()
  })

  it('does not show any accept hint in terminal when disabled', () => {
    const quest: QuestDefinition = {
      ...baseQuest,
      introEmail: { subject: 'Briefing', body: 'Operator, start the test.', showAcceptHint: false }
    }
    const session = startQuestSession(quest)
    const hintLine = session.lines.find(l => l.text.includes('To accept this contract'))
    expect(hintLine).toBeUndefined()
  })
})
