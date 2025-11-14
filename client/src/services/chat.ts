import { apiRequest } from './api'

export type ChatUser = { id: number; username: string; role?: string; online?: boolean }
export type ChatMessage = { id: number; content: string; createdAt: string; user?: ChatUser; room?: string }

export async function fetchMessages(room: string, opts: { afterId?: number; limit?: number } = {}) {
  const qs = new URLSearchParams()
  if (room) qs.set('room', room)
  if (opts.afterId !== undefined) qs.set('afterId', String(opts.afterId))
  if (opts.limit !== undefined) qs.set('limit', String(opts.limit))
  const path = `/api/chat/messages?${qs.toString()}`
  return apiRequest<ChatMessage[]>(path)
}

export async function sendMessage(room: string, content: string) {
  return apiRequest<ChatMessage>('/api/chat/messages', { method: 'POST', auth: true, body: { room, content } })
}

export async function fetchUsers() {
  return apiRequest<ChatUser[]>('/api/chat/users')
}

export async function ping() {
  return apiRequest<{ message: string }>('/api/chat/ping', { method: 'POST', auth: true })
}

export function dmRoomFor(a: number, b: number) {
  const [x, y] = [a, b].sort((p, q) => p - q)
  return `dm:${x}_${y}`
}
