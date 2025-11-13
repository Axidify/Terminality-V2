import React, { useEffect, useState, useRef } from 'react'
import { ModularAppManifest } from '../types'
import { apiRequest } from '../../services/api'

import './OnlineChatPlugin.css'

export const OnlineChat: React.FC = () => {
  const [messages, setMessages] = useState<Array<{ id: number; username: string; content: string; createdAt: string }>>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const mounted = useRef(true)

  const fetchMessages = async () => {
    try {
      const res = await apiRequest('/api/chat', { auth: true })
      if (!mounted.current) return
      setMessages(Array.isArray(res) ? (res as any) : [])
    } catch (e) {
      // ignore for now
    }
  }

  const sendMessage = async () => {
    if (!content.trim()) return
    setLoading(true)
    try {
      const created = await apiRequest('/api/chat', { method: 'POST', auth: true, body: { content } })
      setContent('')
      if (created) setMessages(prev => [...(prev || []), created as any])
    } catch (e) {
      console.error('[chat] send error', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    mounted.current = true
    fetchMessages()
    const id = setInterval(fetchMessages, 2000)
    return () => { mounted.current = false; clearInterval(id) }
  }, [])

  return (
    <div className="online-chat-root">
      <div className="online-chat-messages" role="log">
        {messages.map(m => (
          <div className="online-chat-message" key={m.id}>
            <div className="online-chat-meta"><strong>{m.username}</strong> <span className="time">{new Date(m.createdAt).toLocaleTimeString()}</span></div>
            <div className="online-chat-content">{m.content}</div>
          </div>
        ))}
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
