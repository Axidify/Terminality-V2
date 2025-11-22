import { render, screen, cleanup, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import type { QuestDefinition, QuestLifecycleStatus } from './terminalQuests/types'

interface ListTerminalQuestOptions {
  includeDrafts?: boolean
}

const questDesignerMocks = vi.hoisted(() => ({
  listTerminalQuests: vi.fn<(options?: ListTerminalQuestOptions) => Promise<QuestDefinition[]>>(),
  listSystemProfiles: vi.fn(),
  getCachedDesktop: vi.fn(),
  hydrateFromServer: vi.fn(),
  pushToast: vi.fn()
}))

const {
  listTerminalQuests: mockListTerminalQuests,
  listSystemProfiles: mockListSystemProfiles,
  getCachedDesktop: mockGetCachedDesktop,
  hydrateFromServer: mockHydrateFromServer
} = questDesignerMocks

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

vi.mock('../os/ToastContext', () => ({
  useToasts: () => ({
    push: (...args: unknown[]) => questDesignerMocks.pushToast(...args),
    dismiss: vi.fn(),
    dismissAll: vi.fn()
  })
}))

vi.mock('../services/terminalQuests', () => ({
  listTerminalQuests: (options?: ListTerminalQuestOptions) => questDesignerMocks.listTerminalQuests(options),
  createTerminalQuest: vi.fn(),
  updateTerminalQuest: vi.fn(),
  deleteTerminalQuest: vi.fn(),
  validateTerminalQuest: vi.fn()
}))

vi.mock('../services/systemProfiles', () => ({
  listSystemProfiles: (...args: unknown[]) => questDesignerMocks.listSystemProfiles(...args)
}))

vi.mock('../services/saveService', () => ({
  getCachedDesktop: (...args: unknown[]) => questDesignerMocks.getCachedDesktop(...args),
  hydrateFromServer: (...args: unknown[]) => questDesignerMocks.hydrateFromServer(...args)
}))

vi.mock('../services/terminalMail', () => ({
  listAdminTerminalMail: vi.fn().mockResolvedValue([])
}))

import { QuestDesignerApp } from './QuestDesignerApp'

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

  it('asks for confirmation before discarding an unsaved quest draft', async () => {
    mockQuestSnapshot({})
    mockListTerminalQuests.mockResolvedValue([])
    render(<QuestDesignerApp />)

    const user = userEvent.setup()
    const wizardButton = (await screen.findAllByRole('button', { name: /Guided Wizard/i }))[0]
    await user.click(wizardButton)

    const deleteButton = await screen.findByRole('button', { name: /^Delete$/ })
    await user.click(deleteButton)

    const dialog = await screen.findByRole('dialog', { name: /Discard Draft Quest/i })
    expect(dialog).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /Discard Draft/i }))

    await waitFor(() => {
      expect(screen.getByText(/Select a quest from the list/i)).toBeInTheDocument()
    })
    expect(questDesignerMocks.pushToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Draft Discarded' }))
  })
})
