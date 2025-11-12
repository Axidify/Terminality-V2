import React, { useState } from 'react'
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
    <div className="profile-app">
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
            <label className="profile-label">CURRENT PASSWORD</label>
            <input 
              type="password" 
              className="profile-input"
              value={oldPassword} 
              onChange={e => setOldPassword(e.target.value)}
              placeholder="ENTER CURRENT PASSWORD"
              disabled={busy}
            />
          </div>
          <div className="profile-field">
            <label className="profile-label">NEW PASSWORD</label>
            <input 
              type="password" 
              className="profile-input"
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)}
              placeholder="ENTER NEW PASSWORD"
              disabled={busy}
            />
          </div>
          <div className="profile-field">
            <label className="profile-label">CONFIRM PASSWORD</label>
            <input 
              type="password" 
              className="profile-input"
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="CONFIRM NEW PASSWORD"
              disabled={busy}
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
    </div>
  )
}

export default ProfileApp
