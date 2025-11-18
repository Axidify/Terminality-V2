import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { QuestDesignerApp } from '../programs/QuestDesignerApp'

const mockListTerminalQuests = vi.fn()
const mockCreateTerminalQuest = vi.fn()
const mockUpdateTerminalQuest = vi.fn()
const mockDeleteTerminalQuest = vi.fn()
const mockValidateTerminalQuest = vi.fn()

const mockListSystemDefinitions = vi.fn()
const mockSaveSystemDefinition = vi.fn()
const mockUpdateSystemDefinition = vi.fn()
const mockDeleteSystemDefinition = vi.fn()

const mockListQuestTags = vi.fn()
const mockSaveQuestTag = vi.fn()

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

const mockDefinitionToProfile = (definition: any) => ({
  id: definition.id,
  label: definition.label,
  description: definition.metadata?.description,
  identifiers: {
    ips: definition.network?.ips || [],
    hostnames: definition.network?.hostnames || []
  },
  metadata: {
    username: definition.credentials?.username || 'guest',
    startingPath: definition.credentials?.startingPath || '/',
    footprint: definition.metadata?.footprint || ''
  },
  filesystem: definition.filesystem?.snapshot || {}
})

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

vi.mock('../systemDefinitions/service', () => ({
  listSystemDefinitions: (...args: unknown[]) => mockListSystemDefinitions(...args),
  saveSystemDefinition: (...args: unknown[]) => mockSaveSystemDefinition(...args),
  updateSystemDefinition: (...args: unknown[]) => mockUpdateSystemDefinition(...args),
  deleteSystemDefinition: (...args: unknown[]) => mockDeleteSystemDefinition(...args)
}))

vi.mock('../services/questTags', () => ({
  listQuestTags: (...args: unknown[]) => mockListQuestTags(...args),
  saveQuestTag: (...args: unknown[]) => mockSaveQuestTag(...args)
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

    mockListSystemDefinitions.mockResolvedValue({
      profiles: [],
      templates: [],
      lastUpdated: new Date().toISOString(),
      systems: [],
      systemTemplates: []
    })
    mockSaveSystemDefinition.mockImplementation(async (definition: any) => ({
      definition,
      profile: mockDefinitionToProfile(definition)
    }))
    mockUpdateSystemDefinition.mockImplementation(async (_id: string, definition: any) => ({
      definition,
      profile: mockDefinitionToProfile(definition)
    }))
    mockDeleteSystemDefinition.mockResolvedValue({})

    mockListQuestTags.mockResolvedValue(['ops', 'cleanup', 'stealth'])
    mockSaveQuestTag.mockResolvedValue('stealth')

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

  it('keeps the wizard open when clicking outside the modal', async () => {
    await openWizardForQuest()
    const wizardDialog = screen.getByRole('dialog', { name: /Intro Email/i })
    fireEvent.click(wizardDialog)
    expect(screen.getByRole('heading', { level: 2, name: /Intro Email/i })).toBeInTheDocument()
  })

  it('persists newly created quest tags for reuse', async () => {
    await openWizardForQuest()
    const questDetailsChip = screen.getByRole('button', { name: /Quest Details/i })
    fireEvent.click(questDetailsChip)
    await screen.findByRole('heading', { level: 2, name: /Quest Details/i })

    const tagInput = screen.getByLabelText('Quest tags')
    fireEvent.change(tagInput, { target: { value: 'black ops' } })
    fireEvent.keyDown(tagInput, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(mockSaveQuestTag).toHaveBeenCalledWith('black ops')
    })
  })

  it('asks for confirmation when canceling with unsaved wizard edits', async () => {
    mockListTerminalQuests.mockResolvedValue([])
    await renderDesigner()
    fireEvent.click(screen.getByRole('button', { name: /Guided Wizard/i }))
    await screen.findByRole('heading', { level: 2, name: /Intro Email/i })
    await jumpToSummary()

    const wizardSummaryDialog = screen.getByRole('dialog', { name: /Summary & Save/i })
    fireEvent.click(within(wizardSummaryDialog).getByRole('button', { name: /^Cancel$/ }))
    const confirmDialog = await screen.findByRole('dialog', { name: /Leave the Wizard/i })
    expect(confirmDialog).toBeInTheDocument()
    expect(within(confirmDialog).getByText(/Unsaved Progress/i)).toBeInTheDocument()

    fireEvent.click(within(confirmDialog).getByRole('button', { name: /Resume Wizard/i }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Leave the Wizard/i })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('heading', { level: 2, name: /Summary & Save/i })).toBeInTheDocument()

    const wizardDialog = screen.getByRole('dialog', { name: /Summary & Save/i })
    fireEvent.click(within(wizardDialog).getByRole('button', { name: /^Cancel$/ }))
    const secondDialog = await screen.findByRole('dialog', { name: /Leave the Wizard/i })
    fireEvent.click(within(secondDialog).getByRole('button', { name: /Discard & Close/i }))
    await waitFor(() => {
      expect(screen.queryByRole('heading', { level: 2, name: /Summary & Save/i })).not.toBeInTheDocument()
    })
  })

  it('removes wizard-created quests when discarding progress', async () => {
    mockListTerminalQuests.mockResolvedValue([])
    await renderDesigner()

    await screen.findByText(/0 quests/i)
    fireEvent.click(screen.getByRole('button', { name: /Guided Wizard/i }))
    await screen.findByRole('heading', { level: 2, name: /Intro Email/i })
    const wizardIntroDialog = await screen.findByRole('dialog', { name: /Intro Email/i })
    await screen.findByText(/1 quest/i)

    fireEvent.click(within(wizardIntroDialog).getByRole('button', { name: /^Cancel$/ }))
    const confirmDialog = await screen.findByRole('dialog', { name: /Leave the Wizard/i })
    fireEvent.click(within(confirmDialog).getByRole('button', { name: /Discard & Close/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Leave the Wizard/i })).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByText(/0 quests/i)).toBeInTheDocument()
    })
  })

  it('discards staged intro mail drafts when wizard progress is abandoned', async () => {
    mockListTerminalQuests.mockResolvedValue([])
    mockListAdminTerminalMail.mockResolvedValue([])
    await renderDesigner()
    fireEvent.click(screen.getByRole('button', { name: /Guided Wizard/i }))
    await screen.findByRole('heading', { level: 2, name: /Intro Email/i })

    fireEvent.change(screen.getByLabelText('Sender Name'), { target: { value: 'Wizard Ops' } })
    fireEvent.change(screen.getByLabelText('Sender Address'), { target: { value: 'wizard@atlasnet' } })
    fireEvent.change(screen.getByLabelText('Subject / Hook'), { target: { value: 'Wizard Subject' } })
    fireEvent.change(screen.getByPlaceholderText(/Operator,/), { target: { value: 'Wizard body copy' } })
    fireEvent.change(screen.getByLabelText('In-universe Date/Time'), { target: { value: '2089-06-03 08:00' } })

    fireEvent.click(screen.getByRole('button', { name: /^Next$/ }))
    await screen.findByRole('heading', { level: 2, name: /Quest Details/i })
    const wizardDetailsDialog = await screen.findByRole('dialog', { name: /Quest Details/i })
    await screen.findByText('Wizard Subject')

    fireEvent.click(within(wizardDetailsDialog).getByRole('button', { name: /Close wizard/i }))
    const confirmDialog = await screen.findByRole('dialog', { name: /Leave the Wizard/i })
    fireEvent.click(within(confirmDialog).getByRole('button', { name: /Discard & Close/i }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { level: 2, name: /Quest Details/i })).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.queryByText('Wizard Subject')).not.toBeInTheDocument()
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

  it('launches the system wizard for a step and assigns the saved system', async () => {
    await openWizardForQuest()
    const stepsChip = screen.getByRole('button', { name: /Quest Steps/i })
    fireEvent.click(stepsChip)
    await screen.findByRole('heading', { level: 2, name: /Quest Steps/i })

    const stepCard = screen.getByLabelText('Step 1 internal identifier').closest('.wizard-step-card') as HTMLElement
    fireEvent.click(within(stepCard).getByRole('button', { name: /Launch System Wizard/i }))

    let systemWizardDialog = await screen.findByRole('dialog', { name: /System Basics/i })
    fireEvent.change(within(systemWizardDialog).getByLabelText('System Label'), { target: { value: 'Relay Shadow' } })
    fireEvent.change(within(systemWizardDialog).getByLabelText('System ID'), { target: { value: 'relay_shadow' } })

    fireEvent.click(within(systemWizardDialog).getByRole('button', { name: /^Next$/i }))

    systemWizardDialog = await screen.findByRole('dialog', { name: /Source & Templates/i })
    fireEvent.change(within(systemWizardDialog).getByLabelText('Root Path'), { target: { value: '/ops/relay' } })
    fireEvent.click(within(systemWizardDialog).getByRole('button', { name: /^Next$/i }))

    systemWizardDialog = await screen.findByRole('dialog', { name: /Configuration/i })
    fireEvent.change(within(systemWizardDialog).getByLabelText('Description'), { target: { value: 'Shadow relay for ops' } })
    fireEvent.change(within(systemWizardDialog).getByLabelText('Primary IP / Host'), { target: { value: '10.5.0.8' } })
    fireEvent.change(within(systemWizardDialog).getByLabelText('Operator Username'), { target: { value: 'relay' } })
    fireEvent.change(within(systemWizardDialog).getByLabelText('Starting Path'), { target: { value: '/ops/relay' } })

    fireEvent.click(within(systemWizardDialog).getByRole('button', { name: /Save System/i }))

    await waitFor(() => {
      expect(mockSaveSystemDefinition).toHaveBeenCalledTimes(1)
    })

    const targetSelect = screen.getAllByLabelText('Target System')[0] as HTMLSelectElement
    await waitFor(() => {
      expect(targetSelect.value).toBe('relay_shadow')
    })
    expect(mockPushToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'System Created' }))
    expect(screen.queryByRole('dialog', { name: /Configuration/i })).not.toBeInTheDocument()
  })
})
