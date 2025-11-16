import { apiRequest } from './api'

import type { TerminalObjective, TerminalNode, TerminalPuzzle } from '../programs/terminalGameData'

export type QuestDifficulty = 'story' | 'standard' | 'elite'
export type QuestStatus = 'draft' | 'published' | 'archived'

export interface QuestDefinition {
  id?: number
  slug: string
  codename: string
  tagline: string
  summary?: string | null
  difficulty: QuestDifficulty | string
  status: QuestStatus | string
  stageOrder: string[]
  objectives: TerminalObjective[]
  nodes: TerminalNode[]
  puzzles: TerminalPuzzle[]
  finaleCipher: TerminalPuzzle
  metadata?: Record<string, unknown> | null
  createdAt?: string
  updatedAt?: string
}

export type QuestPayload = Omit<QuestDefinition, 'id' | 'createdAt' | 'updatedAt'>

export async function listAdminQuests(): Promise<QuestDefinition[]> {
  const res = await apiRequest<{ quests: QuestDefinition[] }>('/api/admin/quests', { auth: true })
  return res.quests || []
}

export async function fetchAdminQuest(identifier: string): Promise<QuestDefinition> {
  const res = await apiRequest<{ quest: QuestDefinition }>(`/api/admin/quests/${identifier}`, { auth: true })
  return res.quest
}

export async function createQuest(quest: QuestPayload): Promise<QuestDefinition> {
  const res = await apiRequest<{ quest: QuestDefinition }>('/api/admin/quests', {
    method: 'POST',
    auth: true,
    body: { quest }
  })
  return res.quest
}

export async function updateQuest(identifier: string | number, quest: QuestPayload): Promise<QuestDefinition> {
  const res = await apiRequest<{ quest: QuestDefinition }>(`/api/admin/quests/${identifier}`, {
    method: 'PUT',
    auth: true,
    body: { quest }
  })
  return res.quest
}

export async function deleteQuest(identifier: string | number): Promise<void> {
  await apiRequest(`/api/admin/quests/${identifier}`, { method: 'DELETE', auth: true })
}
