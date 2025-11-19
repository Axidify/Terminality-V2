import React, { useCallback, useMemo, useState } from 'react'

import './GameShell.css'
import { TerminalApp } from './TerminalApp'
import { createQuestStorageService } from './quest-designer/storage'
import { createMailService } from '../services/mailService'
import { createRewardsService } from '../services/rewardsService'
import { createQuestProgressService } from '../services/questProgressService'
import { buildQuestCompletionMail, pickCompletionEmailTemplate, type CompletionContext } from '../services/questCompletion'
import { QUEST_MAIL_SYNC_EVENT } from '../constants/mail'
import {
  createTerminalSessionState,
  type QuestCompletionSummary,
  type TerminalCommandContext,
  type TerminalSessionState
} from './terminalRuntime'
import type { QuestDefinition } from '../types/quest'

export const GameShell: React.FC = () => {
  const questStorage = useMemo(() => createQuestStorageService(), [])
  const mailService = useMemo(() => createMailService(), [])
  const rewardsService = useMemo(() => createRewardsService(), [])
  const progressionService = useMemo(() => createQuestProgressService(), [])
  const [terminalState, setTerminalState] = useState<TerminalSessionState>(() => createTerminalSessionState())
  const commandContext = useMemo<TerminalCommandContext>(() => ({
    mailService,
    questStorage
  }), [mailService, questStorage])

  const handleQuestComplete = useCallback(async (
    quest: QuestDefinition,
    finalState: TerminalSessionState,
    summary: QuestCompletionSummary
  ) => {
    const ctx: CompletionContext = {
      maxTraceSeen: summary.maxTrace,
      trapsTriggered: finalState.trapsTriggered ?? [],
      bonusCompletedIds: summary.completedBonusIds,
      outcome: summary.outcome
    }

    const template = pickCompletionEmailTemplate(quest, quest.completionEmail, ctx)
    const mail = buildQuestCompletionMail(quest, template)

    await mailService.sendMail(mail)

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(QUEST_MAIL_SYNC_EVENT))
    }

    await rewardsService.applyQuestRewards(quest, { finalState, summary })
    await progressionService.markQuestCompleted(quest.id, { finalState, summary })
  }, [mailService, rewardsService, progressionService])

  return (
    <div className="game-shell game-shell--cli">
      <TerminalApp
        state={terminalState}
        onStateChange={setTerminalState}
        onQuestCompleted={handleQuestComplete}
        commandContext={commandContext}
      />
    </div>
  )
}
