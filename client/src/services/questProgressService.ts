import type { QuestCompletionSummary, TerminalSessionState } from '../programs/terminalRuntime'

export interface QuestProgressUpdate {
  finalState: TerminalSessionState
  summary: QuestCompletionSummary
}

export interface QuestProgressService {
  markQuestCompleted: (questId: string, update: QuestProgressUpdate) => Promise<void>
}

class LocalQuestProgressService implements QuestProgressService {
  async markQuestCompleted(): Promise<void> {
    // Placeholder for future persistence
  }
}

export const createQuestProgressService = (): QuestProgressService => new LocalQuestProgressService()
