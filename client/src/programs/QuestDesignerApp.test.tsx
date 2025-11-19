import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { QuestDesignerApp } from './QuestDesignerApp'

import type { QuestDefinition } from '../types/quest'

const storageMock = vi.hoisted(() => ({
  listQuests: vi.fn(),
  getQuest: vi.fn(),
  saveQuest: vi.fn(),
  deleteQuest: vi.fn()
}))

const templateServiceMock = vi.hoisted(() => ({
  listTemplates: vi.fn(),
  saveTemplate: vi.fn(),
  deleteTemplate: vi.fn()
}))

const questMailSyncMocks = vi.hoisted(() => ({
  syncQuestMailPreviews: vi.fn(),
  clearQuestMailPreviews: vi.fn()
}))

const mailServiceMock = vi.hoisted(() => ({ service: 'quest-mail' }))

vi.mock('./quest-designer/storage', () => ({
  createQuestStorageService: () => storageMock
}))

vi.mock('./quest-designer/systemTemplates', () => ({
  createSystemTemplateService: () => templateServiceMock
}))

vi.mock('../services/mailService', () => ({
  createMailService: () => mailServiceMock
}))

vi.mock('../services/questMailSync', () => questMailSyncMocks)

const buildQuest = (overrides: Partial<QuestDefinition> = {}): QuestDefinition => ({
  id: 'quest_alpha',
  title: 'Quest Alpha',
  shortDescription: 'Assemble a relay.',
  difficulty: 'easy',
  steps: [],
  ...overrides
})

const resetMocks = () => {
  storageMock.listQuests.mockReset()
  storageMock.getQuest.mockReset()
  storageMock.saveQuest.mockReset()
  storageMock.deleteQuest.mockReset()
  templateServiceMock.listTemplates.mockReset()
  templateServiceMock.saveTemplate.mockReset()
  templateServiceMock.deleteTemplate.mockReset()
  questMailSyncMocks.syncQuestMailPreviews.mockReset()
  questMailSyncMocks.clearQuestMailPreviews.mockReset()

  storageMock.listQuests.mockResolvedValue([])
  storageMock.getQuest.mockResolvedValue(null)
  storageMock.saveQuest.mockResolvedValue(undefined)
  storageMock.deleteQuest.mockResolvedValue(undefined)
  templateServiceMock.listTemplates.mockResolvedValue([])
  templateServiceMock.saveTemplate.mockResolvedValue(undefined)
  templateServiceMock.deleteTemplate.mockResolvedValue(undefined)
  questMailSyncMocks.syncQuestMailPreviews.mockResolvedValue(undefined)
  questMailSyncMocks.clearQuestMailPreviews.mockResolvedValue(undefined)
}

describe('QuestDesignerApp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders quests from storage and filters them by search and difficulty', async () => {
    const quests = [
      buildQuest({ id: 'quest_alpha', title: 'Quest Alpha', shortDescription: 'Alpha brief', difficulty: 'easy' }),
      buildQuest({ id: 'quest_beta', title: 'Quest Beta', shortDescription: 'Beta intel', difficulty: 'hard' })
    ]
    storageMock.listQuests.mockResolvedValue(quests)

    render(<QuestDesignerApp />)

    expect(await screen.findByText('Quest Alpha')).toBeInTheDocument()
    expect(screen.getByText('Quest Beta')).toBeInTheDocument()

    const user = userEvent.setup()
    const searchInput = screen.getByPlaceholderText('Search quests')
    await user.type(searchInput, 'Beta')

    expect(screen.getByText('Quest Beta')).toBeInTheDocument()
    expect(screen.queryByText('Quest Alpha')).not.toBeInTheDocument()

    await user.clear(searchInput)
    const hardFilter = screen.getByRole('button', { name: 'Hard' })
    await user.click(hardFilter)

    expect(screen.getByText('Quest Beta')).toBeInTheDocument()
    expect(screen.queryByText('Quest Alpha')).not.toBeInTheDocument()
  })

  it('confirms before discarding unsaved quest edits', async () => {
    const quest = buildQuest({ id: 'quest_existing', title: 'Relay Ghost', shortDescription: 'Baseline quest', difficulty: 'medium' })
    storageMock.listQuests.mockResolvedValue([quest])
    storageMock.getQuest.mockResolvedValue(quest)

    render(<QuestDesignerApp />)

    const user = userEvent.setup()
    const questButton = await screen.findByRole('button', { name: /Relay Ghost/i })
    await user.click(questButton)

    const titleInput = await screen.findByLabelText('Title')
    expect(titleInput).toHaveValue('Relay Ghost')
    await user.clear(titleInput)
    await user.type(titleInput, 'Relay Ghost v2')

    await user.click(screen.getByRole('button', { name: /^Cancel$/i }))

    const dialog = await screen.findByRole('dialog', { name: /Discard unsaved changes\?/i })
    expect(within(dialog).getByRole('button', { name: /Stay Here/i })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /Discard & Continue/i }))

    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Relay Ghost'))
    expect(storageMock.getQuest).toHaveBeenCalledTimes(2)
  })

  it('confirms before deleting a quest from the list', async () => {
    const quests = [
      buildQuest({ id: 'quest_alpha', title: 'Quest Alpha' }),
      buildQuest({ id: 'quest_beta', title: 'Quest Beta', difficulty: 'hard' })
    ]
    storageMock.listQuests.mockResolvedValue(quests)
    storageMock.getQuest.mockImplementation(async id => quests.find(q => q.id === id) ?? null)

    render(<QuestDesignerApp />)

    const user = userEvent.setup()
    const questRow = await screen.findByRole('button', { name: /Quest Beta/i })
    const rowElement = questRow.closest('li') as HTMLElement
    const deleteButton = within(rowElement).getByRole('button', { name: /^Delete$/i })
    await user.click(deleteButton)

    const dialog = await screen.findByRole('dialog', { name: /Delete quest\?/i })
    await user.click(within(dialog).getByRole('button', { name: /^Delete$/i }))

    await waitFor(() => expect(storageMock.deleteQuest).toHaveBeenCalledWith('quest_beta'))
    expect(questMailSyncMocks.clearQuestMailPreviews).toHaveBeenCalledWith('quest_beta', expect.objectContaining({ mailService: mailServiceMock }))
  })
})
