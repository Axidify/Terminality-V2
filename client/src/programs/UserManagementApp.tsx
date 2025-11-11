import React, { useState, useEffect } from 'react'
import './UserManagementApp.css'
import { apiRequest } from '../services/api'

interface User {
  id: number
  username: string
  role: string
}

export const UserManagementApp: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  const loadUsers = async () => {
    setLoading(true)
    setMsg(null)
    try {
      const data = await apiRequest<User[]>('/api/admin/users', { auth: true })
      setUsers(data)
    } catch (e: any) {
      setMsg({ text: e?.message || 'Failed to load users', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return
    
    setMsg(null)
    try {
      await apiRequest(`/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        auth: true,
        body: { password: newPassword }
      })
      setMsg({ text: `Password reset for ${selectedUser.username}`, type: 'success' })
      setShowResetDialog(false)
      setNewPassword('')
      setSelectedUser(null)
    } catch (e: any) {
      setMsg({ text: e?.message || 'Failed to reset password', type: 'error' })
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return
    
    setMsg(null)
    try {
      await apiRequest(`/api/admin/users/${selectedUser.id}`, {
        method: 'DELETE',
        auth: true
      })
      setMsg({ text: `User ${selectedUser.username} deleted`, type: 'success' })
      setShowDeleteDialog(false)
      setSelectedUser(null)
      await loadUsers()
    } catch (e: any) {
      setMsg({ text: e?.message || 'Failed to delete user', type: 'error' })
    }
  }

  return (
    <div className="usermgmt-app">
      <div className="usermgmt-header">
        <svg className="usermgmt-icon" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
        <div className="usermgmt-info">
          <div className="usermgmt-label">ADMIN PANEL</div>
          <div className="usermgmt-title">User Management</div>
        </div>
        <button className="usermgmt-refresh" onClick={loadUsers} disabled={loading}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2" />
          </svg>
          {loading ? 'LOADING...' : 'REFRESH'}
        </button>
      </div>

      {msg && (
        <div className={`usermgmt-message usermgmt-message-${msg.type}`}>
          {msg.type === 'success' ? '✓' : '✗'} {msg.text}
        </div>
      )}

      <div className="usermgmt-table-container">
        <table className="usermgmt-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>USERNAME</th>
              <th>ROLE</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td className="usermgmt-username">{user.username}</td>
                <td>
                  <span className={`usermgmt-role usermgmt-role-${user.role}`}>
                    {user.role}
                  </span>
                </td>
                <td className="usermgmt-actions">
                  <button 
                    className="usermgmt-btn usermgmt-btn-small usermgmt-btn-warning"
                    onClick={() => {
                      setSelectedUser(user)
                      setShowResetDialog(true)
                      setMsg(null)
                    }}
                  >
                    RESET PASSWORD
                  </button>
                  <button 
                    className="usermgmt-btn usermgmt-btn-small usermgmt-btn-danger"
                    onClick={() => {
                      setSelectedUser(user)
                      setShowDeleteDialog(true)
                      setMsg(null)
                    }}
                    disabled={user.role === 'admin'}
                  >
                    DELETE
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && !loading && (
          <div className="usermgmt-empty">No users found</div>
        )}
      </div>

      {showResetDialog && selectedUser && (
        <div className="usermgmt-overlay" onClick={() => setShowResetDialog(false)}>
          <div className="usermgmt-dialog" onClick={e => e.stopPropagation()}>
            <h3>Reset Password</h3>
            <p>Enter new password for <strong>{selectedUser.username}</strong>:</p>
            <input
              type="password"
              className="usermgmt-input"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="New password"
              autoFocus
            />
            <div className="usermgmt-dialog-actions">
              <button 
                className="usermgmt-btn usermgmt-btn-primary"
                onClick={handleResetPassword}
                disabled={!newPassword}
              >
                RESET PASSWORD
              </button>
              <button 
                className="usermgmt-btn usermgmt-btn-secondary"
                onClick={() => {
                  setShowResetDialog(false)
                  setNewPassword('')
                }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteDialog && selectedUser && (
        <div className="usermgmt-overlay" onClick={() => setShowDeleteDialog(false)}>
          <div className="usermgmt-dialog" onClick={e => e.stopPropagation()}>
            <h3>Delete User</h3>
            <p>Are you sure you want to delete <strong>{selectedUser.username}</strong>?</p>
            <p className="usermgmt-warning">This action cannot be undone.</p>
            <div className="usermgmt-dialog-actions">
              <button 
                className="usermgmt-btn usermgmt-btn-danger"
                onClick={handleDeleteUser}
              >
                DELETE USER
              </button>
              <button 
                className="usermgmt-btn usermgmt-btn-secondary"
                onClick={() => setShowDeleteDialog(false)}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserManagementApp
