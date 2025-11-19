import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { QuestDesignerApp } from '../programs/QuestDesignerApp'
import { type QuestDefinition } from '../types/quest'
import * as storageModule from '../programs/quest-designer/storage'
import * as systemTemplatesModule from '../programs/quest-designer/systemTemplates'
import { type QuestSystemTemplate, type SystemTemplateService } from '../programs/quest-designer/systemTemplates'
import { createDefaultSystemDefinition } from '../programs/quest-designer/systemDefaults'

describe('QuestDesignerApp wizard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const renderWithStorageMock = (overrides?: {
    quests?: QuestDefinition[]
    getQuestImpl?: (id: string) => Promise<QuestDefinition | null>
    templateService?: SystemTemplateService
  }) => {
    const listQuestsMock = vi.fn().mockResolvedValue(overrides?.quests ?? [])
    const getQuestMock = vi.fn().mockImplementation((id: string) => (overrides?.getQuestImpl ? overrides.getQuestImpl(id) : Promise.resolve(null)))
    const saveQuestMock = vi.fn().mockResolvedValue(undefined)
    const deleteQuestMock = vi.fn().mockResolvedValue(undefined)
    const templateServiceMock = overrides?.templateService ?? {
      listTemplates: vi.fn().mockResolvedValue([]),
      saveTemplate: vi.fn().mockResolvedValue(undefined),
      deleteTemplate: vi.fn().mockResolvedValue(undefined)
    }

    vi.spyOn(storageModule, 'createQuestStorageService').mockReturnValue({
      listQuests: listQuestsMock,
      getQuest: getQuestMock,
      saveQuest: saveQuestMock,
      deleteQuest: deleteQuestMock
    })
    vi.spyOn(systemTemplatesModule, 'createSystemTemplateService').mockReturnValue(templateServiceMock)

    render(<QuestDesignerApp />)

    return {
      listQuestsMock,
      getQuestMock,
      saveQuestMock,
      deleteQuestMock,
      templateServiceMock
    }
  }

  it('walks through the wizard flow, validates inputs, and saves a quest draft', async () => {
    const { saveQuestMock, listQuestsMock } = renderWithStorageMock()

    await waitFor(() => expect(listQuestsMock).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /\+ New Quest/i }))

    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }))
    expect(screen.getByText('Quest title is required.')).toBeInTheDocument()
    expect(screen.getByText('Short description cannot be empty.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Relay Shadow Operation' } })
    fireEvent.change(screen.getByLabelText('Short Description'), { target: { value: 'Intercept the relay before Atlas spots it.' } })
    const toolToggleButton = screen.getByRole('button', { name: /Select required tools/i })
    fireEvent.click(toolToggleButton)
    const toolListbox = screen.getByRole('listbox')
    fireEvent.click(within(toolListbox).getByRole('checkbox', { name: /^Scan/i }))
    fireEvent.click(within(toolListbox).getByRole('checkbox', { name: /^Clean Logs/i }))
    fireEvent.click(toolToggleButton)

    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }))

    expect(screen.getByText(/Create a target system/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Create System/i }))

    const systemNameInput = await screen.findByLabelText('System Name')
    fireEvent.change(systemNameInput, { target: { value: 'Relay Shadow' } })
    fireEvent.change(screen.getByLabelText('IP Address'), { target: { value: '10.5.0.8' } })
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }))

    expect(screen.getByText(/discovering a target via recon/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }))

    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Atlas needs you on Relay Shadow' } })
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Operator, intercept the relay before it goes dark.' } })
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }))

    fireEvent.click(screen.getByRole('button', { name: /\+ Add Step/i }))
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Scan the relay for weak signals.' } })
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }))

    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Relay secured' } })
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Atlas confirms the relay is back online.' } })
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }))

    expect(screen.getByText('Quest Overview')).toBeInTheDocument()
    expect(screen.getAllByText(/Relay Shadow/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /Save Quest/i }))

    await waitFor(() => expect(saveQuestMock).toHaveBeenCalledTimes(1))
    const savedQuest = saveQuestMock.mock.calls[0][0] as QuestDefinition
    expect(savedQuest.title).toBe('Relay Shadow Operation')
    expect(savedQuest.system?.label).toBe('Relay Shadow')
    expect(savedQuest.introEmail?.subject).toBe('Atlas needs you on Relay Shadow')
    expect(savedQuest.steps).toHaveLength(1)
    expect(savedQuest.completionEmail?.default.subject).toBe('Relay secured')
  })

  it('prompts before discarding unsaved edits', async () => {
    const existingQuest: QuestDefinition = {
      id: 'quest_existing',
      title: 'Existing Quest',
      shortDescription: 'baseline quest',
      difficulty: 'easy',
      steps: [{ id: 'step-1', type: 'scan', description: 'scan host' }]
    }

    const getQuestImpl = async () => existingQuest
    const { listQuestsMock, getQuestMock } = renderWithStorageMock({ quests: [existingQuest], getQuestImpl })

    await waitFor(() => expect(listQuestsMock).toHaveBeenCalledTimes(1))

    const questButton = screen.getByText(existingQuest.title).closest('button') as HTMLButtonElement
    fireEvent.click(questButton)

    const titleInput = await screen.findByLabelText('Title')
    await waitFor(() => expect(titleInput).toHaveValue(existingQuest.title))

    fireEvent.change(titleInput, { target: { value: 'Edited title' } })
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Edited title'))
    await waitFor(() => expect(screen.getByText(/Unsaved changes/i)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }))

    const confirmDialog = await screen.findByRole('dialog', { name: /Discard unsaved changes/i })
    expect(within(confirmDialog).getByRole('button', { name: /Stay Here/i })).toBeInTheDocument()
    fireEvent.click(within(confirmDialog).getByRole('button', { name: /Discard & Continue/i }))

    await waitFor(() => expect(getQuestMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue(existingQuest.title))
  })

  it('allows editing bonus objectives from the rewards tab', async () => {
    const { listQuestsMock } = renderWithStorageMock()

    await waitFor(() => expect(listQuestsMock).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /\+ New Quest/i }))
    fireEvent.click(screen.getByRole('button', { name: /Rewards/i }))

    fireEvent.click(screen.getByRole('button', { name: /\+ Add Bonus Objective/i }))
    const descriptionField = screen.getByPlaceholderText('Keep trace meter below 40 for the entire run.') as HTMLTextAreaElement
    fireEvent.change(descriptionField, { target: { value: 'Stay below 40 trace the entire run.' } })
    expect(descriptionField).toHaveValue('Stay below 40 trace the entire run.')

    fireEvent.click(screen.getByRole('button', { name: /Add Param/i }))
    const keyInput = screen.getAllByPlaceholderText('Key')[0] as HTMLInputElement
    const valueInput = screen.getAllByPlaceholderText('Value')[0] as HTMLInputElement
    fireEvent.change(keyInput, { target: { value: 'threshold' } })
    fireEvent.change(valueInput, { target: { value: '40' } })
    expect(valueInput).toHaveValue('40')

    expect(screen.getByRole('button', { name: /Save Quest/i })).toBeInTheDocument()
  })
  
  it('provides the full system designer experience with doors, files, and trace settings', async () => {
    const { listQuestsMock } = renderWithStorageMock()

    await waitFor(() => expect(listQuestsMock).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /\+ New Quest/i }))
    fireEvent.click(screen.getByRole('button', { name: /Systems/i }))
    fireEvent.click(screen.getByRole('button', { name: /Create System/i }))

    const systemNameInput = await screen.findByLabelText('System Name')
    fireEvent.change(systemNameInput, { target: { value: 'Backroom Syslog Cache' } })

    fireEvent.click(screen.getByRole('button', { name: /\+ Add Door/i }))
    const portInputs = screen.getAllByLabelText(/Door port/i)
    const newPortInput = portInputs[portInputs.length - 1]
    fireEvent.change(newPortInput, { target: { value: '22' } })
    expect(screen.getAllByText(/Duplicate port/i).length).toBeGreaterThan(0)

    const configureButtons = screen.getAllByRole('button', { name: /Configure/i })
    fireEvent.click(configureButtons[configureButtons.length - 1])
    fireEvent.change(screen.getByLabelText('How does this door open?'), { target: { value: 'after_file_read' } })
    const fileSelect = screen.getByLabelText('Choose file') as HTMLSelectElement
    fireEvent.change(fileSelect, { target: { value: '/logs/auth.log' } })
    expect(fileSelect.value).toBe('/logs/auth.log')

    fireEvent.click(screen.getByRole('button', { name: /\+ File/i }))
    const fileNameField = await screen.findByLabelText('File name')
    fireEvent.change(fileNameField, { target: { value: 'intel.txt' } })
    fireEvent.change(screen.getByLabelText('Content'), { target: { value: 'Trace me if you dare.' } })
    fireEvent.click(screen.getByLabelText(/Clue/i))
    expect(fileNameField).toHaveValue('intel.txt')
    expect(screen.getByLabelText(/Clue/i)).toBeChecked()

    fireEvent.change(screen.getByLabelText('Max trace'), { target: { value: '120' } })
    fireEvent.change(screen.getByLabelText('Nervous threshold'), { target: { value: '40' } })
    fireEvent.change(screen.getByLabelText('Panic threshold'), { target: { value: '90' } })
    expect(screen.getByLabelText('Max trace')).toHaveValue(120)
  })

  it('loads a saved template from the modal and applies it to the quest draft', async () => {
    const templateSystem = createDefaultSystemDefinition('templateQuest', {
      label: 'Ops Bridge Node',
      ip: '10.1.1.1'
    })
    const listTemplatesMock = vi.fn<() => Promise<QuestSystemTemplate[]>>().mockResolvedValue([
      {
        id: 'tmpl_ops_bridge',
        name: 'Ops Bridge',
        description: 'Hardened relay with verbose logging.',
        difficulty: 'medium',
        system: templateSystem
      }
    ])
    const templateService: SystemTemplateService = {
      listTemplates: listTemplatesMock,
      saveTemplate: vi.fn().mockResolvedValue(undefined),
      deleteTemplate: vi.fn().mockResolvedValue(undefined)
    }

    const { listQuestsMock } = renderWithStorageMock({ templateService })

    await waitFor(() => expect(listQuestsMock).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /\+ New Quest/i }))
    fireEvent.click(screen.getByRole('button', { name: /Systems/i }))
    fireEvent.click(screen.getAllByRole('button', { name: /Load template/i })[0])

    await waitFor(() => expect(listTemplatesMock).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Ops Bridge')).toBeInTheDocument()

    const useTemplateButtons = await screen.findAllByRole('button', { name: /Use Template/i })
    fireEvent.click(useTemplateButtons[0])

    expect(await screen.findByDisplayValue('Ops Bridge Node')).toBeInTheDocument()
    expect(screen.getByText(/Applied template/i)).toBeInTheDocument()
  })

  it('saves the current system as a reusable template with metadata', async () => {
    const listTemplatesMock = vi.fn<() => Promise<QuestSystemTemplate[]>>().mockResolvedValue([])
    const saveTemplateMock = vi.fn().mockResolvedValue(undefined)
    const deleteTemplateMock = vi.fn().mockResolvedValue(undefined)
    const templateService: SystemTemplateService = {
      listTemplates: listTemplatesMock,
      saveTemplate: saveTemplateMock,
      deleteTemplate: deleteTemplateMock
    }

    const { listQuestsMock } = renderWithStorageMock({ templateService })

    await waitFor(() => expect(listQuestsMock).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /\+ New Quest/i }))
    fireEvent.click(screen.getByRole('button', { name: /Systems/i }))
    fireEvent.click(screen.getByRole('button', { name: /Create System/i }))

    const systemNameInput = await screen.findByLabelText('System Name')
    fireEvent.change(systemNameInput, { target: { value: 'Custom Node' } })

    fireEvent.click(screen.getByRole('button', { name: /Save as template/i }))

    const templateNameField = await screen.findByLabelText('Template name')
    fireEvent.change(templateNameField, { target: { value: 'Vault Blueprint' } })
    fireEvent.change(screen.getByLabelText('Description (optional)'), { target: { value: 'Lockdown-ready system image.' } })
    fireEvent.change(screen.getByLabelText('Difficulty reference'), { target: { value: 'hard' } })

    fireEvent.click(screen.getByRole('button', { name: /Save Template/i }))

    await waitFor(() => expect(saveTemplateMock).toHaveBeenCalledTimes(1))
    const savedTemplate = saveTemplateMock.mock.calls[0][0] as QuestSystemTemplate
    expect(savedTemplate.name).toBe('Vault Blueprint')
    expect(savedTemplate.difficulty).toBe('hard')
    expect(savedTemplate.system.label).toBe('Custom Node')
    expect(screen.getByText(/Template saved locally/i)).toBeInTheDocument()
  })
})






