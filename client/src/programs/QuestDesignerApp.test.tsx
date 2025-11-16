import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { QuestDesignerApp } from './QuestDesignerApp'

import type { QuestDefinition, QuestLifecycleStatus } from './terminalQuests/types'

const mockListTerminalQuests = vi.fn()
const mockListSystemProfiles = vi.fn()
const mockGetCachedDesktop = vi.fn()
const mockHydrateFromServer = vi.fn()

vi.mock('../os/UserContext', () => ({
  useUser: () => ({
    user: { id: 1, username: 'admin', isAdmin: true },
    loading: false,
    isAdmin: true,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn()
  })
}))

vi.mock('../services/terminalQuests', () => ({
  listTerminalQuests: (...args: unknown[]) => mockListTerminalQuests(...args),
  createTerminalQuest: vi.fn(),
  updateTerminalQuest: vi.fn(),
  deleteTerminalQuest: vi.fn(),
  validateTerminalQuest: vi.fn()
}))

vi.mock('../services/systemProfiles', () => ({
  listSystemProfiles: (...args: unknown[]) => mockListSystemProfiles(...args)
}))

vi.mock('../services/saveService', () => ({
  getCachedDesktop: (...args: unknown[]) => mockGetCachedDesktop(...args),
  hydrateFromServer: (...args: unknown[]) => mockHydrateFromServer(...args)
}))

const baseQuest = (overrides: Partial<QuestDefinition> = {}): QuestDefinition => ({
  id: 'quest_alpha',
  title: 'Quest Alpha',
  description: 'alpha description',
  trigger: { type: 'ON_FIRST_TERMINAL_OPEN' },
  steps: [
    {
      id: 'step_scan',
      type: 'SCAN_HOST',
      params: { target_ip: '10.0.0.1' }
    }
  ],
  rewards: { credits: 0, flags: [] },
  requirements: { required_flags: [], required_quests: [] },
  default_system_id: undefined,
  embedded_filesystems: {},
  status: 'published',
  ...overrides
})

const mockQuestSnapshot = (statuses: Record<string, QuestLifecycleStatus>, savedAt = '2025-01-01T00:00:00Z') => {
  mockGetCachedDesktop.mockReturnValue({
    terminalState: {
      questState: { statuses },
      savedAt
    }
  })
  mockHydrateFromServer.mockResolvedValue({
    version: 1,
    desktop: {
      terminalState: {
        questState: { statuses },
        savedAt
      }
    },
    story: {}
  })
}

const setupDefaultMocks = () => {
  mockListSystemProfiles.mockResolvedValue({ profiles: [], templates: [] })
  mockQuestSnapshot({})
}

describe('QuestDesignerApp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
    mockListTerminalQuests.mockResolvedValue([
      baseQuest({ id: 'quest_alpha', title: 'Quest Alpha' }),
      baseQuest({ id: 'quest_beta', title: 'Quest Beta', completion_flag: 'quest_completed_beta' })
    ])
  })

  afterEach(() => {
    cleanup()
  })

  it('renders lifecycle badges based on the latest snapshot', async () => {
    mockQuestSnapshot({ quest_alpha: 'in_progress', quest_beta: 'completed' })
    render(<QuestDesignerApp />)

    const questAlpha = await screen.findByText('Quest Alpha')
    const questAlphaRow = questAlpha.closest('button')
    expect(questAlphaRow).toBeTruthy()
    expect(within(questAlphaRow as HTMLElement).getByText('Active')).toBeInTheDocument()

    const questBeta = screen.getByText('Quest Beta')
    const questBetaRow = questBeta.closest('button')
    expect(questBetaRow).toBeTruthy()
    expect(within(questBetaRow as HTMLElement).getByText('Completed')).toBeInTheDocument()
  })

  it('filters quests by lifecycle status when a filter chip is selected', async () => {
    mockQuestSnapshot({ quest_beta: 'completed' })
    render(<QuestDesignerApp />)

    await screen.findByText('Quest Beta')
    const user = userEvent.setup()
    const completedFilter = screen
      .getAllByRole('button', { name: /Completed/i })
      .find(btn => btn.classList.contains('status-filter-chip'))
    expect(completedFilter).toBeTruthy()
    await user.click(completedFilter as HTMLElement)

    expect(screen.getByText('Quest Beta')).toBeInTheDocument()
    expect(screen.queryByText('Quest Alpha')).not.toBeInTheDocument()
  })

  it('shows completion flag conflicts when another quest uses the same flag', async () => {
    mockQuestSnapshot({})
    render(<QuestDesignerApp />)

    const user = userEvent.setup()
    const questAlpha = await screen.findByText('Quest Alpha')
    await user.click(questAlpha)

    const completionInput = await screen.findByLabelText('Completion Flag')
    await user.clear(completionInput)
    await user.type(completionInput, 'quest_completed_beta')

    expect(await screen.findByText('Also used by Quest Beta')).toBeInTheDocument()
  })
})
