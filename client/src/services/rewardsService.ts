import type { QuestDefinition } from '../types/quest'
import type { QuestCompletionSummary, TerminalSessionState } from '../programs/terminalRuntime'

export interface QuestRewardsContext {
  finalState: TerminalSessionState
  summary: QuestCompletionSummary
}

export interface QuestRewardsService {
  applyQuestRewards: (quest: QuestDefinition, context: QuestRewardsContext) => Promise<void>
}

class NoopQuestRewardsService implements QuestRewardsService {
  async applyQuestRewards(): Promise<void> {
    // Future batches will award credits, unlocks, etc.
  }
}

export const createRewardsService = (): QuestRewardsService => new NoopQuestRewardsService()
