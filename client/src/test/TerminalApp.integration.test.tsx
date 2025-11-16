import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import { describe, it, beforeEach, afterEach, vi, expect } from 'vitest'

import { TerminalApp } from '../programs/TerminalApp'

const mockListTerminalQuests = vi.fn()
const mockListSystemProfiles = vi.fn()
const mockGetCachedDesktop = vi.fn()
const mockHydrateFromServer = vi.fn()

vi.mock('../services/terminalQuests', () => ({
  listTerminalQuests: (...args: unknown[]) => mockListTerminalQuests(...args)
}))
vi.mock('../services/systemProfiles', () => ({
  listSystemProfiles: (...args: unknown[]) => mockListSystemProfiles(...args)
}))
vi.mock('../services/saveService', () => ({
  getCachedDesktop: (...args: unknown[]) => mockGetCachedDesktop(...args),
  hydrateFromServer: (...args: unknown[]) => mockHydrateFromServer(...args)
}))

const WipeQuest = {
  id: 'intro_001_wipe_evidence',
  title: 'Wipe the Evidence',
  description: 'Your handler wants a trace log erased from a remote machine.',
  trigger: { type: 'ON_FIRST_TERMINAL_OPEN' },
  steps: [],
  rewards: { flags: [], unlocks_commands: [] },
  requirements: { required_flags: [], required_quests: [] },
  default_system_id: 'atlas_relay',
  status: 'published'
}

const seedHydratedQuestState = (completedIds: string[] = []) => {
  const serialized = { active: [], completedIds }
  mockGetCachedDesktop.mockReturnValue({ terminalState: { questState: serialized } })
  mockHydrateFromServer.mockResolvedValue({ version: 1, desktop: { terminalState: { questState: serialized } }, story: {} })
}

const setupDefaultMocks = () => {
  mockListSystemProfiles.mockResolvedValue({ profiles: [], templates: [] })
  mockListTerminalQuests.mockResolvedValue([WipeQuest])
}

describe('TerminalApp persistent intro', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('does not show completed quests in initial inbox after hydration', async () => {
    seedHydratedQuestState(['intro_001_wipe_evidence'])
    render(<TerminalApp />)

    // Terminal should print ready message
    expect(await screen.findByText(/Terminal ready. Type help./)).toBeTruthy()

    // Completed quest should not be printed in the initial inbox
    expect(screen.queryByText(/Wipe the Evidence/)).toBeNull()

    // If there are no active entries, we expect a neutral message
    expect(await screen.findByText(/Inbox empty/)).toBeTruthy()
  })
})
