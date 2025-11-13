import React, { useEffect, useState, useRef } from 'react'
import { ModularAppManifest } from '../types'
import { apiRequest, getApiBase, getToken } from '../../services/api'

import './OnlineChatPlugin.css'

export const OnlineChat: React.FC = () => {
  const [messages, setMessages] = useState<Array<{ id: number; username?: string; user?: { username: string }; content: string; createdAt: string }>>([])
  const [users, setUsers] = useState<Array<{ id: number; username: string }>>([])
  const [content, setContent] = useState('')
  const [room, setRoom] = useState<string>('general')
  const [loading, setLoading] = useState(false)
  const mounted = useRef(true)
  const lastIdRef = useRef(0)
  const lastSeenRef = useRef<Record<number, number>>({})
  const PRESENCE_TTL_MS = 8000

  const fetchMessages = async () => {
    try {
      const afterId = lastIdRef.current || 0
      const res = await apiRequest(`/api/chat/messages?room=${encodeURIComponent(room)}&afterId=${afterId}&limit=50`, { auth: true })
      if (!mounted.current) return
      const arr = Array.isArray(res) ? (res as any) : []
      if (afterId > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id))
          const next = [...prev]
          for (const m of arr) if (!existingIds.has(m.id)) next.push(m)
          if (next.length && next[next.length - 1].id > (lastIdRef.current || 0)) lastIdRef.current = next[next.length - 1].id
          return next
        })
      } else {
        setMessages(arr)
        if (arr.length) lastIdRef.current = arr[arr.length - 1].id
      }
    } catch (e) {
      // ignore for now
    }
  }

  const sendMessage = async () => {
    if (!content.trim()) return
    setLoading(true)
    try {
      await apiRequest('/api/chat/messages', { method: 'POST', auth: true, body: { content, room } })
      setContent('')
    } catch (e) {
      console.error('[chat] send error', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    mounted.current = true
    lastIdRef.current = 0
    fetchMessages()
    const pollId = setInterval(fetchMessages, 2000)
    // presence ping every 5s; users list every 10s (fallback)
    const pingId = setInterval(() => { void apiRequest('/api/chat/ping', { method: 'POST', auth: true }).catch(() => {}) }, 5000)
    const usersId = setInterval(async () => {
      try { const u = await apiRequest('/api/chat/users?onlineOnly=1', { auth: true }); if (mounted.current) {
        // seed lastSeen entries for these users now
        (Array.isArray(u) ? (u as any) : []).forEach((usr: any) => { lastSeenRef.current[usr.id] = Number(new Date().getTime()) })
        setUsers(Array.isArray(u) ? (u as any) : [])
      } } catch {}
    }, 10000)
    // prune users based on lastSeen for snappy offline detection
    const pruneId = setInterval(() => {
      if (!mounted.current) return
      setUsers(prev => prev.filter(u => ((Number(new Date().getTime()) - (lastSeenRef.current[u.id] || 0)) < PRESENCE_TTL_MS)))
    }, 1000)
    // Try to connect SSE
    let es: EventSource | null = null
    try {
      const token = getToken()
      if (typeof window !== 'undefined' && 'EventSource' in window && token) {
        const url = `${getApiBase()}/api/chat/stream?room=${encodeURIComponent(room)}&token=${encodeURIComponent(token)}`
        es = new EventSource(url)
        es.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data)
            if (data && data.type === 'message' && data.message) {
              const m = data.message
              setMessages(prev => {
                if (prev.length && prev[prev.length - 1].id === m.id) return prev
                const next = [...prev, m]
                lastIdRef.current = m.id
                return next
              })
            } else if (data && data.type === 'presence' && data.user) {
              const u = data.user
              lastSeenRef.current[u.id] = globalThis.Date.now()
              setUsers(prev => {
                const exists = prev.some(x => x.id === u.id)
                return exists ? prev : [...prev, { id: u.id, username: u.username }]
              })
            }
          } catch { /* ignore malformed */ }
        }
        es.onerror = () => { /* silently rely on polling */ }
      }
    } catch { /* ignore */ }
    return () => { mounted.current = false; clearInterval(pollId); clearInterval(pingId); clearInterval(usersId); clearInterval(pruneId); if (es) es.close() }
  }, [room])

  return (
    <div className="online-chat-root">
      <div className="online-chat-header">
        <div className="room-select">
          <label>Room:</label>
          <select value={room} onChange={e => { setRoom(e.target.value); }}>
            <option value="general">#general</option>
            <option value="random">#random</option>
            <option value="help">#help</option>
          </select>
        </div>
        <div className="online-count">Online: {users.length}</div>
      </div>
      <div className="online-chat-body">
        <aside className="online-chat-sidebar">
          <div className="sidebar-title">Users</div>
          <ul>
            {users.map(u => (
              <li key={u.id} className={'online'}>
                <span className="dot" /> {u.username}
              </li>
            ))}
          </ul>
        </aside>
        <div className="online-chat-messages" role="log">
        {messages.map(m => (
          <div className="online-chat-message" key={m.id}>
            <div className="online-chat-meta"><strong>{m.user?.username || m.username}</strong> <span className="time">{new Date(m.createdAt).toLocaleTimeString()}</span></div>
            <div className="online-chat-content">{m.content}</div>
          </div>
        ))}
        </div>
      </div>
      <div className="online-chat-input">
        <textarea 
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage() } }}
          rows={2}
          placeholder="Type message..." 
        />
        <button onClick={sendMessage} disabled={loading || !content.trim()} className="btn-send">Send</button>
      </div>
    </div>
  )
}

export const manifest: ModularAppManifest = {
  id: 'online-chat',
  name: 'Online Chat',
  description: 'Chat with other agents online (MVP) - authenticated users only',
  version: '0.0.1',
  component: OnlineChat,
  category: 'social',
  rating: 4.5,
  downloads: 10,
  author: 'Axidify'
}

export function registerOnlineChat(register: (m: ModularAppManifest) => void) {
  register(manifest)
}
