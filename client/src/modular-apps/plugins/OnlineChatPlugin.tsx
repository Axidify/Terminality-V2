import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { ModularAppManifest } from '../types'
import { apiRequest, getApiBase, getToken } from '../../services/api'
import { useUser } from '../../os/UserContext'

import './OnlineChatPlugin.css'

const CACHE_STORAGE_KEY = 'onlineChat:cache:v1'
const CACHE_PERSIST_LIMIT = 80
const PUBLIC_ROOMS = ['general', 'random', 'help'] as const

type ChatMessage = { id: number; username?: string; user?: { id: number; username: string }; content: string; createdAt: string }

export const OnlineChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [users, setUsers] = useState<Array<{ id: number; username: string }>>([])
  const [content, setContent] = useState('')
  const [room, setRoom] = useState<string>('general')
  const [loading, setLoading] = useState(false)
  const mounted = useRef(true)
  const lastIdRef = useRef(0)
  const lastSeenRef = useRef<Record<number, number>>({})
  const PRESENCE_TTL_MS = 8000
  const typingRef = useRef<Record<number, number>>({})
  const [typingUsers, setTypingUsers] = useState<Array<{ id: number; username: string }>>([])
  const nextTypingAt = useRef(0)
  const { user } = useUser()
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)
  const suppressAutoScrollRef = useRef(false)
  const [dmPeer, setDmPeer] = useState<{ id: number; username: string } | null>(null)
  const lastReadByRoom = useRef<Record<string, number>>({})
  const latestByRoom = useRef<Record<string, number>>({})
  const [dmList, setDmList] = useState<Array<{ room: string; peer: { id: number; username: string }; latestId: number }>>([])
  const messagesCacheRef = useRef<Record<string, ChatMessage[]>>({})
  const lastIdByRoomRef = useRef<Record<string, number>>({})
  const lastReadHydratedRef = useRef(false)
  const prefetchingRoomsRef = useRef<Set<string>>(new Set())
  const cacheSaveTimeoutRef = useRef<number | null>(null)
  const particleConfigs = useMemo(() => (
    Array.from({ length: 8 }).map((_, idx) => ({
      key: idx,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      duration: 12 + Math.random() * 6,
      delay: Math.random() * 4,
      tx: `${(Math.random() - 0.5) * 60}px`,
      ty: `${(Math.random() - 0.5) * 80}px`
    }))
  ), [])
  const scheduleCacheSave = useCallback(() => {
    if (typeof window === 'undefined') return
    if (cacheSaveTimeoutRef.current) return
    cacheSaveTimeoutRef.current = window.setTimeout(() => {
      cacheSaveTimeoutRef.current = null
      try {
        const snapshot = {
          messages: Object.fromEntries(Object.entries(messagesCacheRef.current).map(([roomKey, list]) => [roomKey, list.slice(-CACHE_PERSIST_LIMIT)])),
          lastIds: { ...lastIdByRoomRef.current },
          lastRead: { ...lastReadByRoom.current },
          latestIds: { ...latestByRoom.current }
        }
        window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(snapshot))
      } catch (err) {
        console.warn('[chat] cache persist error', err)
      }
    }, 400)
  }, [])

  const prefetchRoom = useCallback(async (targetRoom: string) => {
    if (targetRoom === room) return
    if (prefetchingRoomsRef.current.has(targetRoom)) return
    prefetchingRoomsRef.current.add(targetRoom)
    try {
      const afterId = lastIdByRoomRef.current[targetRoom] || 0
      const res = await apiRequest(`/api/chat/messages?room=${encodeURIComponent(targetRoom)}&afterId=${afterId}&limit=50`, { auth: true })
      const arr = Array.isArray(res) ? (res as ChatMessage[]) : []
      if (!arr.length) return
      const existing = messagesCacheRef.current[targetRoom] || []
      const existingIds = new Set(existing.map(m => m.id))
      const merged = existing.length ? [...existing] : []
      for (const msg of arr) {
        if (!existingIds.has(msg.id)) merged.push(msg)
      }
      if (!merged.length) return
      merged.sort((a, b) => a.id - b.id)
      messagesCacheRef.current[targetRoom] = merged
      const last = merged[merged.length - 1]?.id || 0
      if (last) {
        lastIdByRoomRef.current[targetRoom] = last
        latestByRoom.current[targetRoom] = Math.max(latestByRoom.current[targetRoom] || 0, last)
        scheduleCacheSave()
      }
    } catch {
      /* ignore */
    } finally {
      prefetchingRoomsRef.current.delete(targetRoom)
    }
  }, [room, scheduleCacheSave])

  const fetchMessages = async () => {
    try {
      const afterId = lastIdRef.current || 0
      const res = await apiRequest(`/api/chat/messages?room=${encodeURIComponent(room)}&afterId=${afterId}&limit=50`, { auth: true })
      if (!mounted.current) return
      const arr = Array.isArray(res) ? (res as ChatMessage[]) : []
      if (afterId > 0) {
        if (!arr.length) return
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id))
          const next = [...prev]
          for (const m of arr) if (!existingIds.has(m.id)) next.push(m)
          if (next.length && next[next.length - 1].id > (lastIdRef.current || 0)) {
            lastIdRef.current = next[next.length - 1].id
            lastIdByRoomRef.current[room] = lastIdRef.current
          }
          messagesCacheRef.current[room] = next
          scheduleCacheSave()
          latestByRoom.current[room] = Math.max(latestByRoom.current[room] || 0, next[next.length - 1]?.id || 0)
          return next
        })
      } else {
        const clone = [...arr]
        messagesCacheRef.current[room] = clone
        setMessages(clone)
        const last = clone.length ? clone[clone.length - 1].id : 0
        lastIdRef.current = last
        lastIdByRoomRef.current[room] = last
        latestByRoom.current[room] = Math.max(latestByRoom.current[room] || 0, last)
        scheduleCacheSave()
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

  const notifyTyping = async () => {
    const now = Date.now()
    if (now < nextTypingAt.current) return
    nextTypingAt.current = now + 1500
    try { await apiRequest('/api/chat/typing', { method: 'POST', auth: true, body: { room } }) } catch {}
  }

  useEffect(() => {
    // load lastRead cache once per mount
    if (!lastReadHydratedRef.current) {
      try {
        const raw = window.localStorage.getItem(CACHE_STORAGE_KEY)
        if (raw) {
          const snapshot = JSON.parse(raw)
          if (snapshot && typeof snapshot === 'object') {
            messagesCacheRef.current = snapshot.messages || {}
            lastIdByRoomRef.current = snapshot.lastIds || {}
            lastReadByRoom.current = snapshot.lastRead || {}
            latestByRoom.current = snapshot.latestIds || {}
          }
        }
      } catch {}
      lastReadHydratedRef.current = true
    }

    mounted.current = true

    // hydrate messages/users from cache before fetching
    const cachedMessages = messagesCacheRef.current[room] || []
    setMessages(cachedMessages)
    lastIdRef.current = lastIdByRoomRef.current[room] || (cachedMessages.length ? cachedMessages[cachedMessages.length - 1].id : 0)

    setUsers([])
    setTypingUsers([])
    lastSeenRef.current = {}
    typingRef.current = {}
    if (!room.startsWith('dm:')) setDmPeer(null)

    void fetchMessages()

    const pollId = setInterval(fetchMessages, 2000)
    const pingId = setInterval(() => { void apiRequest('/api/chat/ping', { method: 'POST', auth: true, body: { room } }).catch(() => {}) }, 5000)

    const loadUsers = async () => {
      try {
        const u = await apiRequest(`/api/chat/users?room=${encodeURIComponent(room)}&onlineOnly=1`, { auth: true })
        if (mounted.current) {
          (Array.isArray(u) ? (u as any) : []).forEach((usr: any) => { lastSeenRef.current[usr.id] = Number(new Date().getTime()) })
          setUsers(Array.isArray(u) ? (u as any) : [])
        }
      } catch {}
    }

    const usersId = setInterval(loadUsers, 10000)
    void loadUsers()

    const pruneId = setInterval(() => {
      if (!mounted.current) return
      setUsers(prev => prev.filter(u => ((Number(new Date().getTime()) - (lastSeenRef.current[u.id] || 0)) < PRESENCE_TTL_MS)))
    }, 1000)

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
              const m = data.message as ChatMessage
              setMessages(prev => {
                if (prev.length && prev[prev.length - 1].id === m.id) return prev
                const next = [...prev, m]
                lastIdRef.current = m.id
                lastIdByRoomRef.current[room] = m.id
                messagesCacheRef.current[room] = next
                  scheduleCacheSave()
                return next
              })
            } else if (data && data.type === 'presence' && data.user) {
              const u = data.user
              lastSeenRef.current[u.id] = globalThis.Date.now()
              setUsers(prev => {
                const exists = prev.some(x => x.id === u.id)
                return exists ? prev : [...prev, { id: u.id, username: u.username }]
              })
            } else if (data && data.type === 'typing' && data.user) {
              const u = data.user
              typingRef.current[u.id] = Date.now()
              setTypingUsers(prev => {
                const exists = prev.some(x => x.id === u.id)
                return exists ? prev.map(x => x.id === u.id ? { id: u.id, username: u.username } : x) : [...prev, { id: u.id, username: u.username }]
              })
            }
          } catch { /* ignore malformed */ }
        }
        es.onerror = () => { /* silently rely on polling */ }
      }
    } catch { /* ignore */ }

    const pruneTypingId = setInterval(() => {
      const cutoff = Date.now() - 2500
      setTypingUsers(prev => prev.filter(u => (typingRef.current[u.id] || 0) > cutoff))
    }, 500)

    return () => {
      mounted.current = false
      clearInterval(pollId)
      clearInterval(pingId)
      clearInterval(usersId)
      clearInterval(pruneId)
      clearInterval(pruneTypingId)
      if (es) es.close()
    }
  }, [room])

  // Auto-scroll to bottom when new messages arrive unless suppressed (e.g., after loading older)
  useEffect(() => {
    if (suppressAutoScrollRef.current) {
      suppressAutoScrollRef.current = false
      return
    }
    const el = messagesContainerRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
    // mark current room as read up to last message
    if (messages.length) {
      const last = messages[messages.length - 1]
      if (last && last.id) {
        lastReadByRoom.current[room] = Math.max(lastReadByRoom.current[room] || 0, last.id)
        latestByRoom.current[room] = Math.max(latestByRoom.current[room] || 0, last.id)
        try { localStorage.setItem('onlineChat:lastRead', JSON.stringify(lastReadByRoom.current)) } catch {}
        scheduleCacheSave()
      }
    }
  }, [messages.length])

  // Background poll to update latest message ids for public rooms to compute unread counts
  useEffect(() => {
    let stopped = false
    const fetchLatest = async (r: string) => {
      try {
        // Get latest message id using beforeId with a large number and limit=1
        const arr = await apiRequest(`/api/chat/messages?room=${encodeURIComponent(r)}&beforeId=9007199254740991&limit=1`, { auth: true })
        const list = Array.isArray(arr) ? (arr as any) : []
        if (list.length) {
          const last = list[list.length - 1]
          latestByRoom.current[r] = Math.max(latestByRoom.current[r] || 0, last.id || 0)
          scheduleCacheSave()
        }
      } catch { /* ignore */ }
    }
    const tick = () => {
      if (stopped) return
      for (const r of PUBLIC_ROOMS) {
        if (r === room) continue
        void fetchLatest(r)
      }
    }
    // initial prime
    tick()
    const id = setInterval(tick, 8000)
    return () => { stopped = true; clearInterval(id) }
  }, [room])

  const unreadForRoom = (r: string) => {
    const latest = latestByRoom.current[r] || 0
    const read = lastReadByRoom.current[r] || 0
    return Math.max(0, latest - read)
  }

  // Poll recent DM rooms for the user and update list + latest ids
  useEffect(() => {
    let stop = false
    const load = async () => {
      try {
        const dms = await apiRequest('/api/chat/dm-list', { auth: true })
        const arr = Array.isArray(dms) ? (dms as any) : []
        if (!stop) {
          setDmList(arr)
          for (const it of arr) {
            latestByRoom.current[it.room] = Math.max(latestByRoom.current[it.room] || 0, it.latestId || 0)
          }
          scheduleCacheSave()
        }
      } catch {}
    }
    void load()
    const id = setInterval(load, 10000)
    return () => { stop = true; clearInterval(id) }
  }, [])

  useEffect(() => {
    const prefetchTargets = () => {
      const queue = [
        ...PUBLIC_ROOMS.filter(r => r !== room),
        ...dmList.map(dm => dm.room).filter(r => r !== room)
      ]
      const unique = Array.from(new Set(queue))
      const limited = unique.slice(0, 4)
      for (const target of limited) {
        void prefetchRoom(target)
      }
    }
    prefetchTargets()
    const id = setInterval(prefetchTargets, 7000)
    return () => clearInterval(id)
  }, [room, dmList, prefetchRoom])

  return (
    <div className="online-chat-root">
      {/* Background Effects */}
      <div className="online-chat-bg-grid" />
      <div className="online-chat-scanlines" />
      {particleConfigs.map(p => (
        <div
          key={p.key}
          className="online-chat-particle"
          style={{
            left: p.left,
            top: p.top,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            '--tx': p.tx,
            '--ty': p.ty
          } as React.CSSProperties}
        />
      ))}

      <div className="online-chat-app-container">
        <div className="online-chat-header">
        {!room.startsWith('dm:') ? (
          <div className="room-select">
            <label>Room:</label>
            <select value={room} onChange={e => { setRoom(e.target.value); }}>
              {PUBLIC_ROOMS.map(rm => (
                <option key={rm} value={rm}>#{rm}{unreadForRoom(rm) ? ` (${unreadForRoom(rm)})` : ''}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="room-select">
            <label>Direct:</label>
            <div>
              {dmPeer ? `@${dmPeer.username}` : 'Direct Message'}
              <button style={{ marginLeft: 8 }} onClick={() => setRoom('general')}>Back to #general</button>
            </div>
          </div>
        )}
        <div className="online-count">Online: {users.length}</div>
      </div>
      <div className="online-chat-body">
        <aside className="online-chat-sidebar">
          <div className="sidebar-title">Users</div>
          <ul>
            {users.map(u => (
              <li key={u.id} className={'online'}>
                <span className="dot" /> {u.username}
                {user && u.id !== user.id && !room.startsWith('dm:') && (
                  <button
                    style={{ marginLeft: 8 }}
                    onClick={() => {
                      const a = user.id
                      const b = u.id
                      const r = `dm:${Math.min(a, b)}:${Math.max(a, b)}`
                      setDmPeer({ id: u.id, username: u.username })
                      setRoom(r)
                    }}
                  >DM</button>
                )}
              </li>
            ))}
          </ul>
          {!room.startsWith('dm:') && dmList.length > 0 && (
            <div className="dm-list">
              <div className="sidebar-title">Direct Messages</div>
              <ul>
                {dmList.map(dm => (
                  <li key={dm.room} className={'online'}>
                    <div className="dm-item" style={{ width: '100%' }}>
                      <div className="dm-name">@{dm.peer.username}</div>
                      {(() => { const n = unreadForRoom(dm.room); return n ? <span className="pill">{n}</span> : null })()}
                    </div>
                    <button style={{ marginLeft: 8 }} onClick={() => { setDmPeer(dm.peer); setRoom(dm.room) }}>Open</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {typingUsers.length > 0 && (
            <div className="sidebar-title" style={{ marginTop: 8 }}>Typing</div>
          )}
          {typingUsers.length > 0 && (
            <ul>
              {typingUsers.map(u => (
                <li key={`typing-${u.id}`} className={'online'}>
                  <span className="dot" /> {u.username} is typing…
                </li>
              ))}
            </ul>
          )}
        </aside>
        <div className="online-chat-messages" role="log" ref={messagesContainerRef}>
        <div className="load-older-container">
          <button className="btn-load-older" onClick={async () => {
            if (!messages.length) { await fetchMessages(); return }
            try {
              const firstId = messages[0]?.id || 0
              if (!firstId) return
              const el = messagesContainerRef.current
              const prevScrollHeight = el ? el.scrollHeight : 0
              const prevScrollTop = el ? el.scrollTop : 0
              const older = await apiRequest(`/api/chat/messages?room=${encodeURIComponent(room)}&beforeId=${firstId}&limit=50`, { auth: true })
              const arr = Array.isArray(older) ? (older as ChatMessage[]) : []
              if (arr.length) {
                // prevent auto-scroll to bottom for this update
                suppressAutoScrollRef.current = true
                setMessages(prev => {
                  const next = [...arr, ...prev]
                  messagesCacheRef.current[room] = next
                  scheduleCacheSave()
                  return next
                })
                // restore scroll position so user stays at same message
                requestAnimationFrame(() => {
                  const el2 = messagesContainerRef.current
                  if (el2) {
                    const delta = el2.scrollHeight - prevScrollHeight
                    el2.scrollTop = prevScrollTop + delta
                  }
                })
              }
            } catch {}
          }}>Load older</button>
        </div>
        {messages.map(m => (
          <div className="online-chat-message" key={m.id}>
            <div className="online-chat-meta">
              <strong>{m.user?.username || m.username}</strong>
              {!room.startsWith('dm:') && user && m.user?.id && m.user.id !== user.id && (
                <button style={{ marginLeft: 8 }} onClick={() => {
                  const a = user.id
                  const b = m.user!.id
                  const r = `dm:${Math.min(a, b)}:${Math.max(a, b)}`
                  setDmPeer({ id: m.user!.id, username: m.user!.username })
                  setRoom(r)
                }}>DM</button>
              )}
              <span className="time" style={{ marginLeft: 8 }}>{new Date(m.createdAt).toLocaleTimeString()}</span>
              {/* Message deletion disabled */}
            </div>
            <div className="online-chat-content">{m.content}</div>
          </div>
        ))}
        </div>
      </div>
      <div className="online-chat-input">
        <textarea 
          value={content}
          onChange={e => { setContent(e.target.value); void notifyTyping() }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage() } }}
          rows={2}
          placeholder="Type message..." 
        />
        <button onClick={sendMessage} disabled={loading || !content.trim()} className="btn-send">Send</button>
      </div>
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
