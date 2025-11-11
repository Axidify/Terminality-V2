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
      <div className="profile-header">
        <svg className="profile-icon" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="8" r="4" />
          <path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
        </svg>
        <div className="profile-info">
          <div className="profile-label">USER PROFILE</div>
          <div className="profile-username">{user?.username || 'Unknown'}</div>
        </div>
      </div>
      
      <div className="profile-divider"></div>
      
      <div className="profile-section">
        <h4 className="profile-section-title">CHANGE PASSWORD</h4>
        <div className="profile-form">
          <div className="profile-field">
            <label className="profile-label-small">Current Password</label>
            <input 
              type="password" 
              className="profile-input"
              value={oldPassword} 
              onChange={e => setOldPassword(e.target.value)}
              placeholder="Enter current password"
              disabled={busy}
            />
          </div>
          <div className="profile-field">
            <label className="profile-label-small">New Password</label>
            <input 
              type="password" 
              className="profile-input"
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              disabled={busy}
            />
          </div>
          <div className="profile-field">
            <label className="profile-label-small">Confirm Password</label>
            <input 
              type="password" 
              className="profile-input"
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              disabled={busy}
            />
          </div>
        </div>
      </div>

      {msg && (
        <div className={`profile-message profile-message-${msg.type}`}>
          {msg.type === 'success' ? '✓' : '✗'} {msg.text}
        </div>
      )}
      
      <div className="profile-actions">
        <button 
          className="profile-btn profile-btn-primary" 
          onClick={save} 
          disabled={busy || !oldPassword || !newPassword || !confirmPassword}
        >
          {busy ? 'UPDATING...' : 'UPDATE PASSWORD'}
        </button>
      </div>
    </div>
  )
}

export default ProfileApp
