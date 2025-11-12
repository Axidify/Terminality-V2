import React, { useEffect, useState } from 'react'

import './EmailApp.css'
import { ContextMenu } from '../os/components/ContextMenu'
import { CopyIcon, PasteIcon, SelectAllIcon, DeleteIcon, InfoIcon, MailIcon } from '../os/components/Icons'

interface Email {
  id: number
  from: string
  subject: string
  body: string
  date: string
  read: boolean
}

const EnvelopeIcon: React.FC = () => (
  <svg className="email-logo" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="15" y="25" width="70" height="50" stroke="currentColor" strokeWidth="3" fill="rgba(0, 255, 65, 0.05)" rx="2"/>
    <path d="M15 25 L50 50 L85 25" stroke="currentColor" strokeWidth="3" fill="none"/>
    <line x1="15" y1="75" x2="40" y2="55" stroke="currentColor" strokeWidth="2"/>
    <line x1="85" y1="75" x2="60" y2="55" stroke="currentColor" strokeWidth="2"/>
  </svg>
)

const demoEmails: Email[] = [
  {
    id: 1,
    from: 'system@terminality.os',
    subject: 'Welcome to Terminality OS',
    body: 'Welcome to Terminality OS! This is a retro terminal-based operating system simulation. Explore the various applications and have fun!',
    date: '2025-11-09 10:00',
    read: false
  },
  {
    id: 2,
    from: 'admin@terminality.os',
    subject: 'System Update Available',
    body: 'A new system update is available. Please save your work and restart when convenient.',
    date: '2025-11-08 15:30',
    read: false
  },
  {
    id: 3,
    from: 'gamemaster@terminality.os',
    subject: 'New Quest Available',
    body: 'A new quest has been unlocked! Check the terminal for more details. Good luck, adventurer!',
    date: '2025-11-07 09:15',
    read: true
  },
]

export const EmailApp: React.FC = () => {
  const [emails, setEmails] = useState<Email[]>(demoEmails)
  const [selected, setSelected] = useState<Email | null>(null)
  const [composing, setComposing] = useState(false)
  const [newEmail, setNewEmail] = useState({ to: '', subject: '', body: '' })
  const [menu, setMenu] = useState<{x:number;y:number}|null>(null)

  const markAsRead = (email: Email) => {
    setEmails(emails.map(e => e.id === email.id ? { ...e, read: true } : e))
    setSelected({ ...email, read: true })
  }

  const sendEmail = () => {
    if (!newEmail.to || !newEmail.subject) {
      alert('Please fill in recipient and subject')
      return
    }
    
    alert('Email sent! (This is a demo - email not actually sent)')
    setNewEmail({ to: '', subject: '', body: '' })
    setComposing(false)
  }

  // Context menu actions
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

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const active = document.activeElement as HTMLElement | null
      if (active && (active.tagName === 'TEXTAREA' || (active.tagName === 'INPUT' && (active as HTMLInputElement).type === 'text'))) {
        const input = active as HTMLTextAreaElement
        const start = (input as any).selectionStart ?? 0
        const end = (input as any).selectionEnd ?? 0
        const value = (input as any).value ?? ''
        const newVal = value.slice(0, start) + text + value.slice(end)
        ;(input as any).value = newVal
        const evt = new Event('input', { bubbles: true })
        input.dispatchEvent(evt)
        setTimeout(() => { (input as any).selectionStart = (input as any).selectionEnd = start + text.length }, 0)
      }
  } catch { /* ignore */ }
    closeMenu()
  }

  const handleSelectAll = () => {
    const active = document.activeElement as HTMLElement | null
    if (active && (active.tagName === 'TEXTAREA' || (active.tagName === 'INPUT' && (active as HTMLInputElement).type === 'text'))) {
      (active as HTMLTextAreaElement).select()
    } else {
      const range = document.createRange()
      const container = document.querySelector('.email-app-container')
      if (container) {
        range.selectNodeContents(container)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    }
    closeMenu()
  }

  const handleDelete = () => {
    if (!selected || composing) { closeMenu(); return }
    if (confirm('Delete this email?')) {
      setEmails(prev => prev.filter(e => e.id !== selected.id))
      setSelected(null)
    }
    closeMenu()
  }

  const handleCompose = () => {
    setComposing(true)
    setSelected(null)
    closeMenu()
  }

  return (
    <div className="email-root">
      {/* Background effects */}
      <div className="email-bg-grid" />
      <div className="email-scanlines" />
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="email-particle" style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 5}s`,
          animationDuration: `${10 + Math.random() * 10}s`
        }} />
      ))}

      <div className="email-app-container" onContextMenu={openMenu}>
        {/* Header */}
        <div className="email-header">
          <div className="email-logo-container">
            <EnvelopeIcon />
          </div>
          <div className="email-title-group">
            <h1 className="email-title">
              <span className="email-bracket">[</span>
              EMAIL
              <span className="email-bracket">]</span>
            </h1>
            <div className="email-subtitle">Secure Messaging</div>
          </div>
        </div>

        {/* Main Layout - Horizontal Split */}
        <div className="email-main-layout">
          {/* Inbox List */}
          <div className="email-inbox-panel">
            <div className="email-inbox-header">
              <span className="inbox-title">
                <span className="inbox-bracket">[</span>
                INBOX ({emails.filter(e => !e.read).length})
                <span className="inbox-bracket">]</span>
              </span>
              <button 
                onClick={() => { setComposing(true); setSelected(null) }}
                className="email-compose-button"
              >
                <span className="btn-bracket">[</span>+ COMPOSE<span className="btn-bracket">]</span>
              </button>
            </div>
            <div className="email-list">
              {emails.map(email => (
                <div
                key={email.id}
                onClick={() => { setSelected(email); markAsRead(email); setComposing(false) }}
                className={`email-list-item ${selected?.id === email.id ? 'selected' : ''} ${email.read ? '' : 'unread'}`}
                onContextMenu={openMenu}
              >
                <div className="email-item-border" />
                <div className="email-item-content">
                  <div className="email-list-item-header">
                    <span className={`email-list-item-from ${email.read ? 'read' : 'unread'}`}>
                      <span className="status-indicator">{email.read ? '[✓]' : '[●]'}</span> {email.from}
                    </span>
                    <span className="email-list-item-date">{email.date}</span>
                  </div>
                  <div className="email-list-item-subject">{email.subject}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Email Content / Compose */}
        <div className="email-content-panel">
          {composing ? (
            <div className="email-compose-container">
              <h3 className="email-compose-title">
                <span className="compose-bracket">[</span>
                NEW MESSAGE
                <span className="compose-bracket">]</span>
              </h3>
            <div className="email-compose-field">
              <label className="email-compose-label" htmlFor="email-to">To:</label>
              <input
                type="text"
                id="email-to"
                value={newEmail.to}
                onChange={e => setNewEmail({ ...newEmail, to: e.target.value })}
                placeholder="recipient@terminality.os"
                className="email-compose-input"
              onContextMenu={openMenu}
            />
            </div>
            <div className="email-compose-field">
              <label className="email-compose-label" htmlFor="email-subject">Subject:</label>
              <input
                type="text"
                id="email-subject"
                value={newEmail.subject}
                onChange={e => setNewEmail({ ...newEmail, subject: e.target.value })}
                placeholder="Email subject"
                className="email-compose-input"
              onContextMenu={openMenu}
            />
            </div>
            <div className="email-compose-textarea-wrapper">
              <label className="email-compose-label" htmlFor="email-body">Message:</label>
              <textarea
                id="email-body"
                value={newEmail.body}
                onChange={e => setNewEmail({ ...newEmail, body: e.target.value })}
                placeholder="Type your message here..."
                className="email-compose-textarea"
              onContextMenu={openMenu}
            />
            </div>
              <div className="email-compose-actions">
                <button onClick={sendEmail} className="email-action-btn send">
                  <span className="btn-bracket">[</span>SEND<span className="btn-bracket">]</span>
                </button>
                <button onClick={() => setComposing(false)} className="email-action-btn cancel">
                  <span className="btn-bracket">[</span>CANCEL<span className="btn-bracket">]</span>
                </button>
              </div>
            </div>
          ) : selected ? (
            <div className="email-read-container">
              <div className="email-read-header">
                <h3 className="email-read-subject">
                  <span className="subject-bracket">[</span>
                  {selected.subject}
                  <span className="subject-bracket">]</span>
                </h3>
                <div className="email-read-meta">
                  <div><span className="meta-label">FROM:</span> {selected.from}</div>
                  <div><span className="meta-label">DATE:</span> {selected.date}</div>
                </div>
              </div>
              <div className="email-read-body" onContextMenu={openMenu}>
                {selected.body}
              </div>
            </div>
          ) : (
            <div className="email-empty-state">
              <div className="empty-bracket">[</div>
              SELECT AN EMAIL TO READ
              <div className="empty-bracket">]</div>
            </div>
          )}
        </div>
        </div> {/* Close email-main-layout */}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={closeMenu}
          items={[
            { label: 'Copy', icon: <CopyIcon size={14}/>, hint: 'Ctrl+C', onClick: handleCopy },
            { label: 'Paste', icon: <PasteIcon size={14}/>, hint: 'Ctrl+V', onClick: handlePaste },
            { label: 'Select All', icon: <SelectAllIcon size={14}/>, hint: 'Ctrl+A', onClick: handleSelectAll },
            ...(composing || !selected ? [] : ([{ divider: true } as const, { label: 'Delete', icon: <DeleteIcon size={14}/>, onClick: handleDelete } as const] as any)),
            { divider: true },
            { label: 'Compose New', icon: <MailIcon size={14}/>, onClick: handleCompose },
            { label: 'About', icon: <InfoIcon size={14}/>, onClick: () => { alert('Email App — demo mailbox for Terminality OS') } },
          ]}
        />
      )}
    </div>
  )
}
