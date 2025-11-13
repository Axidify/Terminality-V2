import React, { useEffect, useState, useRef } from 'react'
import { ModularAppManifest } from '../types'
import { apiRequest } from '../../services/api'

import './OnlineChatPlugin.css'

export const OnlineChat: React.FC = () => {
  const [messages, setMessages] = useState<Array<{ id: number; username?: string; user?: { username: string }; content: string; createdAt: string }>>([])
  const [users, setUsers] = useState<Array<{ id: number; username: string; online?: boolean }>>([])
  const [content, setContent] = useState('')
  const [room, setRoom] = useState<string>('general')
  const [loading, setLoading] = useState(false)
  const mounted = useRef(true)
  const lastIdRef = useRef(0)

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
      const created = await apiRequest('/api/chat/messages', { method: 'POST', auth: true, body: { content, room } })
      setContent('')
      if (created) {
        setMessages(prev => [...(prev || []), created as any])
        lastIdRef.current = (created as any).id || lastIdRef.current
      }
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
    // presence ping every 20s; users list every 5s
    const pingId = setInterval(() => { void apiRequest('/api/chat/ping', { method: 'POST', auth: true }).catch(() => {}) }, 20000)
    const usersId = setInterval(async () => {
      try { const u = await apiRequest('/api/chat/users', { auth: true }); if (mounted.current) setUsers(Array.isArray(u) ? (u as any) : []) } catch {}
    }, 5000)
    return () => { mounted.current = false; clearInterval(pollId); clearInterval(pingId); clearInterval(usersId) }
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
        <div className="online-count">Online: {users.filter(u => u.online).length}</div>
      </div>
      <div className="online-chat-body">
        <aside className="online-chat-sidebar">
          <div className="sidebar-title">Users</div>
          <ul>
            {users.map(u => (
              <li key={u.id} className={u.online ? 'online' : 'offline'}>
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
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={2} placeholder="Type message..." />
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
