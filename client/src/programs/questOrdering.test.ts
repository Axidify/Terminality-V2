import { describe, expect, it } from 'vitest'

import { applyQuestOrderFromStorage, reorderQuestSequence, type DesignerQuest } from './questOrdering'

const makeQuest = (id: string, title?: string): DesignerQuest => ({
  id,
  title: title ?? id,
  description: '',
  trigger: { type: 'ON_FIRST_TERMINAL_OPEN' },
  steps: [],
  rewards: {},
  status: 'draft'
})

describe('quest ordering helpers', () => {
  it('honors stored quest order while keeping alphabetical fallback', () => {
    const quests = [
      makeQuest('alpha', 'Alpha Quest'),
      makeQuest('beta', 'Beta Quest'),
      makeQuest('gamma', 'Gamma Quest')
    ]

    const ordered = applyQuestOrderFromStorage(quests, ['beta', 'alpha'])

    expect(ordered.map(q => q.id)).toEqual(['beta', 'alpha', 'gamma'])
  })

  it('falls back to alphabetical order when no stored ordering exists', () => {
    const quests = [
      makeQuest('gamma', 'Gamma Quest'),
      makeQuest('alpha', 'Alpha Quest'),
      makeQuest('beta', 'Beta Quest')
    ]

    const ordered = applyQuestOrderFromStorage(quests, [])

    expect(ordered.map(q => q.id)).toEqual(['alpha', 'beta', 'gamma'])
  })

  it('reorders quests when dragging to the end drop zone', () => {
    const quests = [makeQuest('one'), makeQuest('two'), makeQuest('three')]

    const reordered = reorderQuestSequence(quests, 'one', null)

    expect(reordered.map(q => q.id)).toEqual(['two', 'three', 'one'])
    expect(quests.map(q => q.id)).toEqual(['one', 'two', 'three'])
  })

  it('returns original list when unable to locate source quest', () => {
    const quests = [makeQuest('one'), makeQuest('two')]

    const reordered = reorderQuestSequence(quests, 'missing', 'two')

    expect(reordered).toBe(quests)
  })
})
