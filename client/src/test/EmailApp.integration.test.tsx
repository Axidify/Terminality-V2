import React from 'react'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EmailApp } from '../programs/EmailApp'
import type { QuestDefinition } from '../types/quest'
import * as storageModule from '../programs/quest-designer/storage'
import { createMailService } from '../services/mailService'

const quest: QuestDefinition = {
  id: 'quest_mail_sync_1',
  title: 'Mail sync quest',
  shortDescription: 'Mail sync short',
  objectiveShort: 'Do mail sync',
  difficulty: 'easy',
  introEmail: {
    subject: 'Sync briefing',
    body: 'hello exfiltrate',
    showAcceptHint: true
  },
  steps: []
}

describe('EmailApp mail sync', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('seeds preview mails and shows accept hint in the inbox body', async () => {
    const listQuestsMock = vi.fn().mockResolvedValue([quest])
    vi.spyOn(storageModule, 'createQuestStorageService').mockReturnValue({
      listQuests: listQuestsMock,
      getQuest: vi.fn().mockResolvedValue(quest),
      saveQuest: vi.fn().mockResolvedValue(undefined),
      deleteQuest: vi.fn().mockResolvedValue(undefined)
    })

    const mailService = createMailService()
    render(<EmailApp mailService={mailService} />)

    // Find our generated intro mail by subject
    await waitFor(() => expect(screen.getByText('Sync briefing')).toBeInTheDocument())
    const subjectNode = screen.getByText('Sync briefing')
    const article = subjectNode.closest('[role="listitem"]') as HTMLElement
    fireEvent.click(article)

    // The preview should show the accept hint appended; check inside the email viewer body to avoid duplicate matches
    await waitFor(() => expect(document.querySelector('.email-viewer__body')).toBeTruthy())
    const viewerBody = document.querySelector('.email-viewer__body') as HTMLElement
    expect(within(viewerBody).getByText(/To accept this contract, run:/)).toBeInTheDocument()
  })
})
