import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import React from 'react'
import { describe, it, beforeEach, afterEach, vi, expect } from 'vitest'

import { TerminalApp } from '../programs/TerminalApp'

const mockListTerminalQuests = vi.fn()
const mockListSystemDefinitions = vi.fn()
const mockListTerminalMail = vi.fn()
const mockGetCachedDesktop = vi.fn()
const mockHydrateFromServer = vi.fn()
const mockSaveDesktopState = vi.fn()

vi.mock('../services/terminalQuests', () => ({
  listTerminalQuests: (...args: unknown[]) => mockListTerminalQuests(...args)
}))
vi.mock('../systemDefinitions/service', () => ({
  listSystemDefinitions: (...args: unknown[]) => mockListSystemDefinitions(...args)
}))
vi.mock('../services/terminalMail', () => ({
  listTerminalMail: (...args: unknown[]) => mockListTerminalMail(...args),
  listPublishedTerminalMail: (...args: unknown[]) => mockListTerminalMail(...args)
}))
vi.mock('../services/saveService', () => ({
  getCachedDesktop: (...args: unknown[]) => mockGetCachedDesktop(...args),
  hydrateFromServer: (...args: unknown[]) => mockHydrateFromServer(...args),
  saveDesktopState: (...args: unknown[]) => mockSaveDesktopState(...args)
}))

const IntroQuest = {
  id: 'intro_001_wipe_evidence',
  title: 'Wipe the Evidence',
  description: 'Erase the flagged log from the relay logs.',
  trigger: { type: 'ON_FIRST_TERMINAL_OPEN' },
  default_system_id: 'atlas_relay',
  steps: [
    { id: 'scan_host', type: 'SCAN_HOST', params: { target_ip: '10.23.4.8' } },
    { id: 'connect_host', type: 'CONNECT_HOST', params: { target_ip: '10.23.4.8' } },
    { id: 'delete_file', type: 'DELETE_FILE', params: { target_ip: '10.23.4.8', file_path: '/var/logs/evidence.log' } },
    { id: 'disconnect', type: 'DISCONNECT_HOST', params: { target_ip: '10.23.4.8' } }
  ],
  rewards: { credits: 50, flags: [{ key: 'quest_intro_001_completed' }] },
  requirements: { required_flags: [], required_quests: [] },
  completion_flag: 'quest_intro_001_completed',
  status: 'published'
}

const LinkedQuest = {
  id: 'mail_directive_alpha',
  title: 'Directive Alpha',
  description: 'Follow ops instructions from the secure mail.',
  trigger: { type: 'ON_FLAG_SET', flag_key: 'mail_directive_alpha_opened' },
  steps: [],
  rewards: { flags: [], unlocks_commands: [] },
  requirements: { required_flags: [], required_quests: [] },
  default_system_id: 'atlas_relay',
  status: 'published'
}

const sampleMail = [
  {
    id: 'mail-main',
    emailCategory: 'main',
    fromName: 'Atlas Ops',
    fromAddress: 'ops@atlasnet',
    subject: 'Directive: Sanitize Relay',
    body: 'Remove the trace log from relay 10.23.4.8 before audit.',
    inUniverseDate: '2089-06-01 10:00',
    folder: 'inbox',
    isUnreadByDefault: true,
    linkedQuestId: 'mail_directive_alpha',
    status: 'published'
  },
  {
    id: 'mail-lore',
    emailCategory: 'lore',
    fromName: 'Atlas City News',
    fromAddress: 'bulletin@atlascity.news',
    subject: 'Weekly Incident Bulletin',
    body: 'Power grid hiccups downtown. Expect rolling outages.',
    inUniverseDate: '2089-05-31 09:00',
    folder: 'news',
    isUnreadByDefault: true,
    status: 'published'
  }
]

const seedHydratedQuestState = (completedIds: string[] = []) => {
  const serialized = { active: [], completedIds }
  mockGetCachedDesktop.mockReturnValue({ terminalState: { questState: serialized } })
  mockHydrateFromServer.mockResolvedValue({ version: 1, desktop: { terminalState: { questState: serialized } }, story: {} })
}

const setupDefaultMocks = () => {
  mockListSystemDefinitions.mockResolvedValue({
    profiles: [],
    templates: [],
    lastUpdated: new Date().toISOString(),
    systems: [],
    systemTemplates: []
  })
  mockListTerminalQuests.mockResolvedValue([IntroQuest, LinkedQuest])
  mockListTerminalMail.mockResolvedValue(sampleMail)
  mockSaveDesktopState.mockResolvedValue({ version: 1, desktop: {}, story: {} })
}

describe('TerminalApp persistent intro', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('reports unread mail count after hydration instead of quest teaser', async () => {
    seedHydratedQuestState(['intro_001_wipe_evidence'])
    render(<TerminalApp />)

    // Terminal should print ready message
    expect(await screen.findByText(/Terminal ready. Type help./)).toBeTruthy()

    // Intro now references actual mail count instead of hardcoded quest copy
    expect(await screen.findByText(/\[mail] You have 2 unread messages/)).toBeTruthy()
    expect(screen.queryByText(/\[inbox]/i)).toBeNull()
  })

  it('lists inbox entries and allows opening mail by index', async () => {
    seedHydratedQuestState([])
    render(<TerminalApp />)

    const input = await screen.findByLabelText('Terminal command input')
    expect(await screen.findByText(/\[mail] You have 2 unread messages/)).toBeTruthy()

    fireEvent.change(input, { target: { value: 'inbox' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(await screen.findByText(/INBOX \(2 unread\)/)).toBeTruthy()
    expect(await screen.findByText(/Atlas Ops/)).toBeTruthy()

    fireEvent.change(input, { target: { value: 'open 1' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(await screen.findByText(/From: Atlas Ops/)).toBeTruthy()
    expect(await screen.findByText(/Remove the trace log/)).toBeTruthy()
    expect(await screen.findByText(/\[mail] You have 1 unread message/)).toBeTruthy()
  })

  it('offers linked quests the first time an email is opened', async () => {
    seedHydratedQuestState([])
    render(<TerminalApp />)

    const input = await screen.findByLabelText('Terminal command input')
    fireEvent.change(input, { target: { value: 'mail 1' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(await screen.findByText(/New quest available: Directive Alpha/)).toBeTruthy()
  })

  it('completes the intro quest when the terminal flow is executed', async () => {
    seedHydratedQuestState([])
    render(<TerminalApp />)

    const input = await screen.findByLabelText('Terminal command input')
    const runCommand = async (command: string) => {
      fireEvent.change(input, { target: { value: command } })
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    }

    await runCommand('scan 10.23.4.8')
    expect(await screen.findByText(/\[scan] 10\.23\.4\.8 is online/)).toBeTruthy()

    await runCommand('connect 10.23.4.8')
    expect(await screen.findByText(/\[connect] connected to 10\.23\.4\.8/)).toBeTruthy()

    await runCommand('rm /var/logs/evidence.log')
    expect(await screen.findByText(/\[rm] deleted \/var\/logs\/evidence\.log/)).toBeTruthy()

    await runCommand('disconnect')
    expect(await screen.findByText(/\[quest] Quest complete: Wipe the Evidence/)).toBeTruthy()
  })
})
