import { describe, expect, it } from 'vitest'

import { validateQuest } from './validation'
import type { QuestDefinition } from '../../types/quest'

const buildQuest = (overrides: Partial<QuestDefinition> = {}): QuestDefinition => ({
  id: 'quest_alpha',
  title: 'Quest Alpha',
  shortDescription: 'Baseline recon test.',
  objectiveShort: 'Map Relay Alpha.',
  difficulty: 'easy',
  system: {
    id: 'system_alpha',
    label: 'Relay Alpha',
    ip: '10.0.0.5',
    difficulty: 'easy',
    filesystemRoot: {
      id: 'root',
      name: '/',
      type: 'folder',
      children: [
        { id: 'logs', name: 'logs', type: 'folder', children: [] }
      ]
    },
    doors: [
      { id: 'front', name: 'front', port: 22, status: 'guarded' }
    ]
  },
  steps: [{ id: 'scan', type: 'scan', description: 'Run scan' }],
  ...overrides
})

describe('quest designer validation', () => {
  it('flags unsupported required tools', () => {
    const quest = buildQuest({
      requirements: { requiredTools: ['deep_scan'] as any }
    })

    const errors = validateQuest(quest)

    expect(errors.details).toContainEqual(expect.stringMatching(/Only the scan tool/))
  })

  it('flags recon targets that do not match the quest system', () => {
    const quest = buildQuest({
      reconRequirements: {
        enabled: true,
        mustUseScan: true,
        discoveryTargets: [{ hostId: 'other_system' }]
      }
    })

    const errors = validateQuest(quest)

    expect(errors.recon).toContainEqual(expect.stringMatching(/only supports the assigned quest system/i))
  })

  it('blocks quests with more than one recon discovery target', () => {
    const quest = buildQuest({
      reconRequirements: {
        enabled: true,
        mustUseScan: true,
        discoveryTargets: [{ hostId: 'system_alpha' }, { hostId: 'system_beta' }]
      }
    })

    const errors = validateQuest(quest)

    expect(errors.recon).toContainEqual(expect.stringMatching(/only a single discovery target/))
  })
})
