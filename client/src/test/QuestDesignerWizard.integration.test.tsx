import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { QuestDesignerApp } from '../programs/QuestDesignerApp'

const mockListTerminalQuests = vi.fn()
const mockCreateTerminalQuest = vi.fn()
const mockUpdateTerminalQuest = vi.fn()
const mockDeleteTerminalQuest = vi.fn()
const mockValidateTerminalQuest = vi.fn()

const mockListSystemProfiles = vi.fn()
const mockSaveSystemProfile = vi.fn()
const mockUpdateSystemProfile = vi.fn()
const mockDeleteSystemProfile = vi.fn()

const mockListAdminTerminalMail = vi.fn()
const mockCreateTerminalMail = vi.fn()
const mockUpdateTerminalMail = vi.fn()
const mockDeleteTerminalMail = vi.fn()
const mockValidateTerminalMail = vi.fn()

const mockGetCachedDesktop = vi.fn()
const mockHydrateFromServer = vi.fn()
const mockSaveDesktopState = vi.fn()

const mockPushToast = vi.fn()
const mockSignalSessionActivity = vi.fn()

vi.mock('../os/UserContext', () => ({
  useUser: () => ({ isAdmin: true })
}))

vi.mock('../os/ToastContext', () => ({
  useToasts: () => ({ push: mockPushToast })
}))

vi.mock('../os/SessionActivityContext', () => ({
  signalSessionActivity: (...args: unknown[]) => mockSignalSessionActivity(...args)
}))

vi.mock('../services/terminalQuests', () => ({
  listTerminalQuests: (...args: unknown[]) => mockListTerminalQuests(...args),
  createTerminalQuest: (...args: unknown[]) => mockCreateTerminalQuest(...args),
  updateTerminalQuest: (...args: unknown[]) => mockUpdateTerminalQuest(...args),
  deleteTerminalQuest: (...args: unknown[]) => mockDeleteTerminalQuest(...args),
  validateTerminalQuest: (...args: unknown[]) => mockValidateTerminalQuest(...args)
}))

vi.mock('../services/systemProfiles', () => ({
  listSystemProfiles: (...args: unknown[]) => mockListSystemProfiles(...args),
  saveSystemProfile: (...args: unknown[]) => mockSaveSystemProfile(...args),
  updateSystemProfile: (...args: unknown[]) => mockUpdateSystemProfile(...args),
  deleteSystemProfile: (...args: unknown[]) => mockDeleteSystemProfile(...args)
}))

vi.mock('../services/terminalMail', () => ({
  listAdminTerminalMail: (...args: unknown[]) => mockListAdminTerminalMail(...args),
  createTerminalMail: (...args: unknown[]) => mockCreateTerminalMail(...args),
  updateTerminalMail: (...args: unknown[]) => mockUpdateTerminalMail(...args),
  deleteTerminalMail: (...args: unknown[]) => mockDeleteTerminalMail(...args),
  validateTerminalMail: (...args: unknown[]) => mockValidateTerminalMail(...args)
}))

vi.mock('../services/saveService', () => ({
  getCachedDesktop: (...args: unknown[]) => mockGetCachedDesktop(...args),
  hydrateFromServer: (...args: unknown[]) => mockHydrateFromServer(...args),
  saveDesktopState: (...args: unknown[]) => mockSaveDesktopState(...args)
}))

const questWithMail = {
  id: 'ops_cleanup',
  title: 'Cleanup Relay',
  description: 'Delete the relay traces.',
  summary: 'Erase the relay logs for Atlas.',
  designerNotes: 'Lean on existing scripts.',
  difficulty: 'Easy',
  faction: 'Atlas',
  tags: ['ops', 'cleanup'],
  trigger: { type: 'ON_FIRST_TERMINAL_OPEN' },
  steps: [
    {
      id: 'connect_node',
      type: 'CONNECT_HOST',
      params: { target_ip: '10.0.0.11' },
      hints: { prompt: 'Jack into the relay' },
      auto_advance: true
    }
  ],
  rewards: {
    credits: 200,
    flags: [{ key: 'ops_cleanup_complete' }],
    unlocks_commands: ['wipe']
  },
  requirements: { required_flags: [], required_quests: [] },
  default_system_id: 'atlas_core',
  embedded_filesystems: {},
  completion_flag: 'ops_cleanup_complete',
  status: 'draft',
  introEmailId: 'mail_ops_intro',
  completionEmailId: 'mail_ops_done',
  followUpQuestId: 'follow_ops',
  mail: {
    briefingMailId: 'mail_ops_intro',
    completionMailId: 'mail_ops_done'
  }
}

const followUpQuest = {
  ...questWithMail,
  id: 'follow_ops',
  title: 'Follow Ops',
  introEmailId: undefined,
  completionEmailId: undefined,
  followUpQuestId: undefined,
  mail: undefined
}

const mailLibrary = [
  {
    id: 'mail_ops_intro',
    emailCategory: 'main',
    fromName: 'Atlas Ops',
    fromAddress: 'ops@atlasnet',
    subject: 'Briefing: Clean the Relay',
    previewLine: 'Atlas needs the logs erased.',
    body: 'Operator, connect to the relay and purge the logs.',
    inUniverseDate: '2089-06-01 12:00',
    folder: 'inbox',
    isUnreadByDefault: true,
    linkedQuestId: 'ops_cleanup',
    status: 'draft'
  },
  {
    id: 'mail_ops_done',
    emailCategory: 'main',
    fromName: 'Atlas Ops',
    fromAddress: 'ops@atlasnet',
    subject: 'Debrief: Relay Sanitized',
    previewLine: 'Cleanup confirmed and reward tallied.',
    body: 'Logs are clear and credits booked.',
    inUniverseDate: '2089-06-01 14:00',
    folder: 'inbox',
    isUnreadByDefault: true,
    linkedQuestId: 'ops_cleanup',
    status: 'draft'
  }
]

const renderDesigner = async () => {
  render(<QuestDesignerApp />)
  await screen.findByRole('button', { name: /Guided Wizard/i })
}

const openWizardForQuest = async () => {
  await renderDesigner()
  const questButton = await screen.findByRole('button', { name: /Cleanup Relay/ })
  fireEvent.click(questButton)
  fireEvent.click(screen.getByRole('button', { name: /Guided Wizard/i }))
  await screen.findByRole('heading', { level: 2, name: /Intro Email/i })
}

const jumpToSummary = async () => {
  const summaryChip = screen.getByRole('button', { name: /Summary & Save/i })
  fireEvent.click(summaryChip)
  await screen.findByRole('heading', { level: 2, name: /Summary & Save/i })
}

describe('QuestDesigner wizard summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockListTerminalQuests.mockResolvedValue([questWithMail, followUpQuest])
    mockCreateTerminalQuest.mockResolvedValue({ quest: questWithMail, warnings: [] })
    mockUpdateTerminalQuest.mockResolvedValue({ quest: questWithMail, warnings: [] })
    mockDeleteTerminalQuest.mockResolvedValue(undefined)
    mockValidateTerminalQuest.mockResolvedValue({ errors: [], warnings: [] })

    mockListSystemProfiles.mockResolvedValue({ profiles: [], templates: [] })
    mockSaveSystemProfile.mockResolvedValue(undefined)
    mockUpdateSystemProfile.mockResolvedValue(undefined)
    mockDeleteSystemProfile.mockResolvedValue(undefined)

    mockListAdminTerminalMail.mockResolvedValue(mailLibrary)
    mockCreateTerminalMail.mockImplementation(async (_id, payload) => payload)
    mockUpdateTerminalMail.mockImplementation(async (_id, payload) => payload)
    mockDeleteTerminalMail.mockResolvedValue(undefined)
    mockValidateTerminalMail.mockResolvedValue({ errors: [], mail: null })

    mockGetCachedDesktop.mockReturnValue({})
    mockHydrateFromServer.mockResolvedValue({ desktop: {} })
    mockSaveDesktopState.mockResolvedValue({})
  })

  afterEach(() => {
    cleanup()
  })

  it('summarizes quest, mail, and rewards details in the summary step', async () => {
    await openWizardForQuest()
    await jumpToSummary()

    const introSection = screen.getByRole('heading', { level: 4, name: 'Intro Email' }).parentElement as HTMLElement
    expect(introSection).toHaveTextContent('Sender: Atlas Ops <ops@atlasnet>')
    expect(introSection).toHaveTextContent('Subject: Briefing: Clean the Relay')

    const metadataSection = screen.getByRole('heading', { level: 4, name: 'Quest Metadata' }).parentElement as HTMLElement
    expect(metadataSection).toHaveTextContent('Title: Cleanup Relay')
    expect(metadataSection).toHaveTextContent('Difficulty: Easy')

    const stepSection = screen.getByRole('heading', { level: 4, name: 'Step List' }).parentElement as HTMLElement
    expect(within(stepSection).getByText(/connect_node/)).toBeInTheDocument()
    expect(stepSection).toHaveTextContent(/Connect to Host/i)

    const completionSection = screen.getByRole('heading', { level: 4, name: 'Completion Email' }).parentElement as HTMLElement
    expect(completionSection).toHaveTextContent('Subject: Debrief: Relay Sanitized')

    const rewardsSection = screen.getByRole('heading', { level: 4, name: 'Rewards' }).parentElement as HTMLElement
    expect(rewardsSection).toHaveTextContent('Credits: 200')
    expect(within(rewardsSection).getByText(/ops_cleanup_complete/)).toBeInTheDocument()

    const followUpSection = screen.getByRole('heading', { level: 4, name: 'Next Quest Link' }).parentElement as HTMLElement
    expect(within(followUpSection).getByText(/Follow Ops/)).toBeInTheDocument()
  })

  it('asks for confirmation when canceling with unsaved wizard edits', async () => {
    mockListTerminalQuests.mockResolvedValue([])
    await renderDesigner()
    fireEvent.click(screen.getByRole('button', { name: /Guided Wizard/i }))
    await screen.findByRole('heading', { level: 2, name: /Intro Email/i })
    await jumpToSummary()

    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }))
    const confirmDialog = await screen.findByRole('dialog', { name: /Leave the Wizard/i })
    expect(confirmDialog).toBeInTheDocument()
    expect(within(confirmDialog).getByText(/Unsaved Progress/i)).toBeInTheDocument()

    fireEvent.click(within(confirmDialog).getByRole('button', { name: /Resume Wizard/i }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Leave the Wizard/i })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('heading', { level: 2, name: /Summary & Save/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }))
    const secondDialog = await screen.findByRole('dialog', { name: /Leave the Wizard/i })
    fireEvent.click(within(secondDialog).getByRole('button', { name: /Discard & Close/i }))
    await waitFor(() => {
      expect(screen.queryByRole('heading', { level: 2, name: /Summary & Save/i })).not.toBeInTheDocument()
    })
  })

  it('persists mails and quest when Save & Finish succeeds', async () => {
    await openWizardForQuest()
    await jumpToSummary()

    fireEvent.click(screen.getByRole('button', { name: /Save & Finish/i }))

    await waitFor(() => {
      expect(mockUpdateTerminalMail).toHaveBeenCalledTimes(2)
      expect(mockUpdateTerminalQuest).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(screen.queryByRole('heading', { level: 2, name: /Summary & Save/i })).not.toBeInTheDocument()
    })

    expect(mockListAdminTerminalMail).toHaveBeenCalledTimes(2)
    expect(mockPushToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Wizard Complete' }))
  })
})
