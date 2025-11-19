import React, { useCallback, useMemo, useState } from 'react'

import './GameShell.css'
import { EmailApp } from './EmailApp'
import { TerminalApp } from './TerminalApp'
import { createQuestStorageService } from './quest-designer/storage'
import { createMailService } from '../services/mailService'
import { createRewardsService } from '../services/rewardsService'
import { createQuestProgressService } from '../services/questProgressService'
import { buildQuestCompletionMail, pickCompletionEmailTemplate, type CompletionContext } from '../services/questCompletion'
import { QUEST_MAIL_SYNC_EVENT } from '../constants/mail'
import {
  createTerminalSessionState,
  startQuestSession,
  type TerminalCommandContext,
  type TerminalSessionState
} from './terminalRuntime'
import type { QuestDefinition } from '../types/quest'

/**
 * DevGameShell preserves the legacy split-pane UI (Email + Terminal) for
 * designers and debugging builds. The production runtime should mount the
 * CLI-only GameShell instead.
 */
export const DevGameShell: React.FC = () => {
  const questStorage = useMemo(() => createQuestStorageService(), [])
  const mailService = useMemo(() => createMailService(), [])
  const rewardsService = useMemo(() => createRewardsService(), [])
  const progressionService = useMemo(() => createQuestProgressService(), [])
  const [activeQuest, setActiveQuest] = useState<QuestDefinition | null>(null)
  const [terminalState, setTerminalState] = useState<TerminalSessionState>(() => createTerminalSessionState())
  const [loadingQuestId, setLoadingQuestId] = useState<string | null>(null)
  const [questError, setQuestError] = useState<string | null>(null)

  const commandContext = useMemo<TerminalCommandContext>(() => ({
    mailService,
    questStorage
  }), [mailService, questStorage])

  const handleStartQuest = useCallback(async (questId: string) => {
    if (!questId) return
    setLoadingQuestId(questId)
    setQuestError(null)
    try {
      const quest = await questStorage.getQuest(questId)
      if (!quest || !quest.system) {
        setQuestError('Quest missing target system.')
        return
      }
      setActiveQuest(quest)
      setTerminalState(startQuestSession(quest))
    } catch (error) {
      setQuestError('Failed to load quest.')
      console.error('Failed to start quest', error)
    } finally {
      setLoadingQuestId(prev => (prev === questId ? null : prev))
    }
  }, [questStorage])

  const handleQuestComplete = useCallback(async (quest: QuestDefinition, finalState: TerminalSessionState) => {
    const ctx: CompletionContext = {
      maxTraceSeen: finalState.maxTraceSeen ?? 0,
      trapsTriggered: finalState.trapsTriggered ?? [],
      bonusCompletedIds: finalState.questProgress?.completedBonusIds ?? []
    }

    const template = pickCompletionEmailTemplate(quest, quest.completionEmail, ctx)
    const mail = buildQuestCompletionMail(quest, template)

    await mailService.sendMail(mail)

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(QUEST_MAIL_SYNC_EVENT))
    }

    void rewardsService
    void progressionService
    setActiveQuest(quest)
  }, [mailService, rewardsService, progressionService])

  return (
    <div className="game-shell game-shell--dev">
      <section className="game-shell__column game-shell__column--email">
        <EmailApp onStartQuest={handleStartQuest} mailService={mailService} />
        {questError && <div className="game-shell__alert">{questError}</div>}
      </section>
      <section className="game-shell__column game-shell__column--terminal">
        <div className="game-shell__status">
          <p className="game-shell__status-label">Active Quest</p>
          <strong>{activeQuest ? activeQuest.title : 'None selected'}</strong>
          {loadingQuestId && <span className="game-shell__status-badge">Loading…</span>}
        </div>
        <TerminalApp
          state={terminalState}
          onStateChange={setTerminalState}
          onQuestCompleted={handleQuestComplete}
          commandContext={commandContext}
        />
      </section>
    </div>
  )
}
