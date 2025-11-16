import React, { useState, useEffect, useRef, useId } from 'react'

import './ProfileApp.css'
import { useUser } from '../os/UserContext'
import { updateProfile } from '../services/auth'

export const ProfileApp: React.FC = () => {
  const { user } = useUser()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [busy, setBusy] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const currentPasswordId = useId()
  const newPasswordId = useId()
  const confirmPasswordId = useId()

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const container = containerRef.current
    if (container) {
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left + container.scrollLeft
      const y = e.clientY - rect.top + container.scrollTop
      setContextMenu({ x, y })
    } else {
      setContextMenu({ x: e.clientX, y: e.clientY })
    }
  }

  const closeContextMenu = () => setContextMenu(null)

  useEffect(() => {
    const handleClick = () => closeContextMenu()
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const save = async () => {
    if (!oldPassword || !newPassword) {
      setMsg({ text: 'Please fill all fields', type: 'error' })
      return
    }
    if (newPassword !== confirmPassword) {
      setMsg({ text: 'Passwords do not match', type: 'error' })
      return
    }
    if (newPassword.length < 4) {
      setMsg({ text: 'Password must be at least 4 characters', type: 'error' })
      return
    }
    
    setBusy(true)
    setMsg(null)
    try {
      await updateProfile({ password: newPassword, oldPassword })
      setMsg({ text: 'Password updated successfully', type: 'success' })
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (e: any) {
      setMsg({ text: e?.message || 'Failed to update password', type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
  <div className="profile-app" ref={containerRef} onContextMenu={handleContextMenu}>
      {/* Background effects */}
      <div className="profile-bg-grid" />
      <div className="profile-scanlines" />
      <div className="profile-particles">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="profile-particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${6 + Math.random() * 4}s`
            }}
          />
        ))}
      </div>

      {/* Header */}
      <div className="profile-header">
        <div className="profile-header-content">
          <svg className="profile-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="8" r="4" />
            <path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
          </svg>
          <div className="profile-header-text">
            <h1 className="profile-title">USER PROFILE</h1>
            <p className="profile-subtitle">ACCOUNT MANAGEMENT</p>
          </div>
        </div>
        <div className="profile-header-divider" />
      </div>

      {/* User Info */}
      <div className="profile-user-info">
        <div className="profile-info-card">
          <div className="profile-info-border" />
          <div className="profile-info-content">
            <span className="profile-info-label">{'>'} USERNAME</span>
            <span className="profile-info-value">{user?.username || 'Unknown'}</span>
          </div>
        </div>
      </div>

      {/* Password Section */}
      <div className="profile-content">
        <h2 className="profile-section-title">
          <span className="title-bracket">{'>'}</span> CHANGE PASSWORD
        </h2>
        <div className="profile-form">
          <div className="profile-field">
            <label className="profile-label" htmlFor={currentPasswordId}>CURRENT PASSWORD</label>
            <input 
              type="password" 
              className="profile-input"
              value={oldPassword} 
              onChange={e => setOldPassword(e.target.value)}
              placeholder="ENTER CURRENT PASSWORD"
              disabled={busy}
              id={currentPasswordId}
            />
          </div>
          <div className="profile-field">
            <label className="profile-label" htmlFor={newPasswordId}>NEW PASSWORD</label>
            <input 
              type="password" 
              className="profile-input"
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)}
              placeholder="ENTER NEW PASSWORD"
              disabled={busy}
              id={newPasswordId}
            />
          </div>
          <div className="profile-field">
            <label className="profile-label" htmlFor={confirmPasswordId}>CONFIRM PASSWORD</label>
            <input 
              type="password" 
              className="profile-input"
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="CONFIRM NEW PASSWORD"
              disabled={busy}
              id={confirmPasswordId}
            />
          </div>
          <button 
            className="profile-btn primary" 
            onClick={save} 
            disabled={busy || !oldPassword || !newPassword || !confirmPassword}
          >
            {busy ? 'UPDATING...' : 'UPDATE PASSWORD'}
          </button>
        </div>
      </div>

      {/* Message */}
      {msg && (
        <div className={`profile-message ${msg.type}`}>
          <span className="message-icon">{msg.type === 'success' ? '✓' : '✗'}</span>
          <span className="message-text">{msg.text}</span>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="profile-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="context-menu-item" onClick={() => { window.location.reload(); closeContextMenu() }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
              <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
            </svg>
            Refresh
          </div>
          <div className="context-menu-divider" />
          <div className="context-menu-item" onClick={() => { alert(`User: ${user?.username}\nAccount management interface`); closeContextMenu() }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
            </svg>
            About Profile
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfileApp
