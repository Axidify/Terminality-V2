import { apiRequest } from './api'

export async function listQuestTags(): Promise<string[]> {
  const res = await apiRequest<{ tags?: string[] }>('/api/admin/quest-tags', { auth: true })
  return Array.isArray(res.tags) ? res.tags : []
}

export async function saveQuestTag(tag: string): Promise<string> {
  const res = await apiRequest<{ tag: string }>('/api/admin/quest-tags', {
    method: 'POST',
    auth: true,
    body: { tag }
  })
  return res.tag
}
