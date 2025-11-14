import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { ModularAppManifest } from '../types'
import { apiRequest, getApiBase, getToken } from '../../services/api'
import { useUser } from '../../os/UserContext'
import { useNotifications } from '../../os/NotificationContext'
import { sounds } from '../../os/SoundEffects'
import { ONLINE_CHAT_FOCUS_EVENT, OnlineChatFocusPayload } from './onlineChatEvents'

import './OnlineChatPlugin.css'

const CACHE_STORAGE_KEY = 'onlineChat:cache:v1'
const CACHE_PERSIST_LIMIT = 80
const PUBLIC_ROOMS = ['general', 'random', 'help'] as const
const NOTIFY_OPT_IN_KEY = 'onlineChat:nativeNotify'

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const BellIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M18 16v-4.5a6 6 0 10-12 0V16l-1.5 2h15z"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={active ? 0.95 : 0.7}
    />
    <path
      d="M10 20a2 2 0 004 0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="round"
    />
    {active && (
      <circle
        cx={18.5}
        cy={7}
        r={1.5}
        fill="currentColor"
        opacity={0.9}
      />
    )}
  </svg>
)

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
  let notificationsApi: ReturnType<typeof useNotifications> | null = null
  try {
    notificationsApi = useNotifications()
  } catch {
    notificationsApi = null
  }
  const addNotification = notificationsApi?.addNotification ?? (() => {})
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
  const windowFocusRef = useRef(true)
  const isAtBottomRef = useRef(true)
  const notifiedMessagesRef = useRef<Set<number>>(new Set())
  const mentionRegexRef = useRef<RegExp | null>(null)
  const [desktopNotifyOptIn, setDesktopNotifyOptIn] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return window.localStorage.getItem(NOTIFY_OPT_IN_KEY) === '1' } catch { return false }
  })
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

  const applyFocusIntent = useCallback((payload?: OnlineChatFocusPayload) => {
    if (!payload?.room) return
    setRoom(payload.room)
    if (payload.room.startsWith('dm:')) {
      const peer = payload.dmPeer || dmList.find(dm => dm.room === payload.room)?.peer
      if (peer) {
        setDmPeer(peer)
      }
    } else {
      setDmPeer(null)
    }
  }, [dmList])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<OnlineChatFocusPayload>).detail
      if (detail) {
        applyFocusIntent(detail)
      }
    }
    window.addEventListener(ONLINE_CHAT_FOCUS_EVENT, handler)
    return () => window.removeEventListener(ONLINE_CHAT_FOCUS_EVENT, handler)
  }, [applyFocusIntent])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem(NOTIFY_OPT_IN_KEY, desktopNotifyOptIn ? '1' : '0') } catch {}
  }, [desktopNotifyOptIn])

  useEffect(() => {
    if (!user?.username) {
      mentionRegexRef.current = null
      return
    }
    mentionRegexRef.current = new RegExp(`(^|[^\\w])@${escapeRegExp(user.username)}(?![\\w])`, 'i')
  }, [user?.username])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleFocus = () => { windowFocusRef.current = true }
    const handleBlur = () => { windowFocusRef.current = false }
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  useEffect(() => {
    const el = messagesContainerRef.current
    if (!el) return
    const handleScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight
      isAtBottomRef.current = distance < 64
    }
    handleScroll()
    el.addEventListener('scroll', handleScroll)
    return () => { el.removeEventListener('scroll', handleScroll) }
  }, [])

  const maybeShowNativeNotification = useCallback((title: string, body: string, tag: string) => {
    if (!desktopNotifyOptIn) return
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return
    try {
      new Notification(title, { body, tag, silent: true })
    } catch {}
  }, [desktopNotifyOptIn])

  const maybeNotifyForMessage = useCallback((targetRoom: string, message: ChatMessage) => {
    if (!message || !message.id) return
    if (!user) return
    if (message.user?.id && message.user.id === user.id) return
    if (notifiedMessagesRef.current.has(message.id)) return

    const isCurrentRoom = targetRoom === room
    const mention = mentionRegexRef.current ? mentionRegexRef.current.test(message.content || '') : false
    const isDmRoom = targetRoom.startsWith('dm:')
    const docVisible = typeof document === 'undefined' ? true : document.visibilityState === 'visible'
    const shouldAlert = mention || isDmRoom || !isCurrentRoom || !windowFocusRef.current || !docVisible || !isAtBottomRef.current
    if (!shouldAlert) return

    notifiedMessagesRef.current.add(message.id)
    if (notifiedMessagesRef.current.size > 400) {
      const trimmed = Array.from(notifiedMessagesRef.current).slice(-200)
      notifiedMessagesRef.current = new Set(trimmed)
    }

    const title = isDmRoom ? `New DM from ${message.user?.username || 'User'}` : `New activity in #${targetRoom}`
    const snippet = message.content?.length && message.content.length > 140 ? `${message.content.slice(0, 140)}…` : (message.content || '')
    const focusPayload: OnlineChatFocusPayload = {
      room: targetRoom,
      messageId: message.id
    }
    if (isDmRoom && message.user?.id && message.user.username) {
      focusPayload.dmPeer = { id: message.user.id, username: message.user.username }
    }

    addNotification(
      title,
      snippet,
      mention || isDmRoom ? 'warning' : 'info',
      {
        window: {
          type: 'modular-plugin',
          title: 'Online Chat',
          payload: { pluginId: 'online-chat' }
        },
        event: {
          type: ONLINE_CHAT_FOCUS_EVENT,
          detail: focusPayload,
          delayMs: 140
        }
      }
    )
    maybeShowNativeNotification(title, snippet, `chat-${targetRoom}-${message.id}`)
    sounds.chatMessage()
  }, [addNotification, maybeShowNativeNotification, room, user])

  const handleNotificationToggle = useCallback(async () => {
    const nextState = !desktopNotifyOptIn
    if (nextState) {
      let permission: NotificationPermission | 'unsupported' = 'unsupported'
      if (typeof window !== 'undefined' && typeof Notification !== 'undefined') {
        permission = Notification.permission
        if (permission === 'default') {
          try { permission = await Notification.requestPermission() } catch {}
        }
      }

      if (permission === 'granted') {
        addNotification('Desktop alerts enabled', 'We will notify you about new chat activity.', 'success')
      } else if (permission === 'denied') {
        addNotification('Desktop alerts limited', 'Browser permissions are blocking native notifications. In-app alerts remain enabled.', 'warning')
      } else {
        addNotification('Desktop alerts limited', 'Your browser does not expose the Notification API. We will show in-app indicators only.', 'warning')
      }
    } else {
      addNotification('Desktop alerts muted', 'We will show in-app indicators only.', 'info')
    }

    setDesktopNotifyOptIn(nextState)
  }, [addNotification, desktopNotifyOptIn])

  const prefetchRoom = useCallback(async (targetRoom: string) => {
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
      const newOnes: ChatMessage[] = []
      for (const msg of arr) {
        if (!existingIds.has(msg.id)) {
          merged.push(msg)
          newOnes.push(msg)
        }
      }
      if (!merged.length) return
      merged.sort((a, b) => a.id - b.id)
      messagesCacheRef.current[targetRoom] = merged
      newOnes.forEach(msg => maybeNotifyForMessage(targetRoom, msg))
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
  }, [maybeNotifyForMessage, scheduleCacheSave])

  const fetchMessages = async () => {
    try {
      const afterId = lastIdRef.current || 0
      const res = await apiRequest(`/api/chat/messages?room=${encodeURIComponent(room)}&afterId=${afterId}&limit=50`, { auth: true })
      if (!mounted.current) return
      const arr = Array.isArray(res) ? (res as ChatMessage[]) : []
      if (afterId > 0) {
        if (!arr.length) return
        arr.forEach(msg => maybeNotifyForMessage(room, msg))
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
                maybeNotifyForMessage(room, m)
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
      isAtBottomRef.current = true
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
        <div className="chat-header-actions">
          <div className="online-count">Online: {users.length}</div>
          <button
            className={`notify-toggle ${desktopNotifyOptIn ? 'active' : ''}`}
            onClick={handleNotificationToggle}
            type="button"
            aria-pressed={desktopNotifyOptIn}
            aria-label={desktopNotifyOptIn ? 'Desktop alerts on' : 'Desktop alerts off'}
            title={desktopNotifyOptIn ? 'Desktop alerts enabled' : 'Enable desktop notifications'}
          >
            <BellIcon active={desktopNotifyOptIn} />
          </button>
        </div>
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
                isAtBottomRef.current = false
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
  version: '0.0.2',
  component: OnlineChat,
  category: 'social',
  rating: 4.5,
  downloads: 10,
  author: 'Axidify'
}

export function registerOnlineChat(register: (m: ModularAppManifest) => void) {
  register(manifest)
}
