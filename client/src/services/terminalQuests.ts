import { apiRequest } from './api'

import type { QuestDefinition } from '../programs/terminalQuests/types'

interface QuestResponse {
  quest: QuestDefinition
  warnings?: string[]
}

interface ListOptions {
  includeDrafts?: boolean
}

export async function listTerminalQuests(options?: ListOptions): Promise<QuestDefinition[]> {
  if (options?.includeDrafts) {
    const res = await apiRequest<{ quests: QuestDefinition[] }>('/api/admin/terminal-quests', { auth: true })
    return res.quests || []
  }
  const res = await apiRequest<{ quests: QuestDefinition[] }>('/api/terminal-quests')
  return res.quests || []
}

export async function fetchTerminalQuest(id: string): Promise<QuestDefinition> {
  const res = await apiRequest<QuestResponse>(`/api/terminal-quests/${id}`)
  return res.quest
}

export async function createTerminalQuest(quest: QuestDefinition) {
  const res = await apiRequest<QuestResponse>('/api/terminal-quests', {
    method: 'POST',
    auth: true,
    body: { quest }
  })
  return res
}

export async function updateTerminalQuest(id: string, quest: QuestDefinition) {
  const res = await apiRequest<QuestResponse>(`/api/terminal-quests/${id}`, {
    method: 'PUT',
    auth: true,
    body: { quest }
  })
  return res
}

export async function deleteTerminalQuest(id: string) {
  await apiRequest(`/api/terminal-quests/${id}`, {
    method: 'DELETE',
    auth: true
  })
}

export async function validateTerminalQuest(quest: QuestDefinition) {
  return apiRequest<{ errors: string[]; warnings: string[] }>('/api/terminal-quests/validate', {
    method: 'POST',
    auth: true,
    body: { quest }
  })
}
