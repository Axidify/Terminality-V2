import React, { useState, useRef, useEffect } from 'react'

import './ChatApp.css'
import { ContextMenu } from '../os/components/ContextMenu'
import { CopyIcon, ClearIcon, InfoIcon, ChatIcon } from '../os/components/Icons'

interface Message {
  id: number
  sender: string
  text: string
  timestamp: string
  isOwn: boolean
}

const demoMessages: Message[] = [
  { id: 1, sender: 'System', text: 'Welcome to Terminality Chat!', timestamp: '10:00', isOwn: false },
  { id: 2, sender: 'Admin', text: 'This is a demo chat application. Try sending some messages!', timestamp: '10:01', isOwn: false },
]

export const ChatApp: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>(demoMessages)
  const [input, setInput] = useState('')
  const [username] = useState('Player')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<{x:number;y:number}|null>(null)

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const sendMessage = () => {
    if (!input.trim()) return

    const newMsg: Message = {
      id: Date.now(),
      sender: username,
      text: input,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      isOwn: true
    }

    setMessages([...messages, newMsg])
    setInput('')

    // Simulate a response
    setTimeout(() => {
      const responses = [
        'Interesting!',
        'Tell me more...',
        'I see what you mean.',
        'That\'s a great point!',
        'Cool! 😎',
      ]
      const botMsg: Message = {
        id: Date.now() + 1,
        sender: 'Bot',
        text: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        isOwn: false
      }
      setMessages(prev => [...prev, botMsg])
    }, 1000 + Math.random() * 2000)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY })
  }
  const closeMenu = () => setMenu(null)

  useEffect(() => {
    if (!menu) return
    const handler = () => closeMenu()
    window.addEventListener('click', handler)
    window.addEventListener('contextmenu', handler)
    return () => {
      window.removeEventListener('click', handler)
      window.removeEventListener('contextmenu', handler)
    }
  }, [menu])

  const handleCopy = async () => {
    try {
      const sel = window.getSelection()?.toString() || ''
      if (sel) await navigator.clipboard.writeText(sel)
    } catch { /* ignore */ }
    closeMenu()
  }

  const handleClear = () => {
    if (confirm('Clear chat history?')) {
      setMessages([])
    }
    closeMenu()
  }

  const handleAbout = () => {
    alert('Chat App — local demo chat with simulated bot responses.')
    closeMenu()
  }

  return (
  <div className="chat-app-container" onContextMenu={openMenu}>
      {/* Chat Header */}
      <div className="chat-header">
        <div className="chat-header-status" title="Online" />
        <strong>[ GENERAL CHAT ]</strong>
        <span className="chat-header-info">3 users online</span>
      </div>

      {/* Messages Area */}
  <div className="chat-messages-area" onContextMenu={openMenu}>
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`chat-message-wrapper ${msg.isOwn ? 'own' : 'other'}`}
          >
            <div className="chat-message-meta">
              {msg.sender} • {msg.timestamp}
            </div>
            <div className={`chat-message-bubble ${msg.isOwn ? 'own' : 'other'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="chat-input-area" onContextMenu={openMenu}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          className="chat-input"
        />
        <button 
          onClick={sendMessage} 
          disabled={!input.trim()}
          className="chat-send-button"
        >
          Send
        </button>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={closeMenu}
          items={[
            { label: 'Copy', icon: <CopyIcon size={14}/>, hint: 'Ctrl+C', onClick: handleCopy },
            { label: 'Paste', icon: <ChatIcon size={14}/>, hint: 'Ctrl+V', onClick: async () => { try { const text = await navigator.clipboard.readText(); if (text) setInput(i => i + text) } catch { /* ignore clipboard errors */ } closeMenu() } },
  { label: 'Paste', icon: <ChatIcon size={14}/>, hint: 'Ctrl+V', onClick: async () => { try { const text = await navigator.clipboard.readText(); if (text) setInput(i => i + text) } catch { /* ignore clipboard errors */ } closeMenu() } },
            { label: 'Clear Chat', icon: <ClearIcon size={14}/>, onClick: handleClear },
            { label: 'Clear Input', icon: <ChatIcon size={14}/>, onClick: () => { setInput(''); closeMenu() } },
            { divider: true },
            { label: 'About', icon: <InfoIcon size={14}/>, onClick: handleAbout },
          ]}
        />
      )}
    </div>
  )
}
