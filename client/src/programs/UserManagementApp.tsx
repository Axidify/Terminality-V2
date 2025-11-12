import React, { useState, useEffect } from 'react'
import './UserManagementApp.css'
import { apiRequest } from '../services/api'
import { useUser } from '../os/UserContext'

interface User {
  id: number
  username: string
  role: string
}

export const UserManagementApp: React.FC = () => {
  const { user: currentUser } = useUser()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set())
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
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

  const handleBulkDelete = async () => {
    if (selectedUsers.size === 0) return
    
    setMsg(null)
    try {
      const userIds = Array.from(selectedUsers)
      for (const id of userIds) {
        await apiRequest(`/api/admin/users/${id}`, {
          method: 'DELETE',
          auth: true
        })
      }
      setMsg({ text: `Deleted ${userIds.length} user(s)`, type: 'success' })
      setShowBulkDeleteDialog(false)
      setSelectedUsers(new Set())
      await loadUsers()
    } catch (e: any) {
      setMsg({ text: e?.message || 'Failed to delete users', type: 'error' })
    }
  }

  const toggleUserSelection = (userId: number) => {
    const newSelected = new Set(selectedUsers)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedUsers(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set())
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)))
    }
  }

  return (
    <div className="usermgmt-app">
      {/* Background effects */}
      <div className="usermgmt-bg-grid" />
      <div className="usermgmt-scanlines" />
      <div className="usermgmt-particles">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="usermgmt-particle"
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
      <div className="usermgmt-header">
        <div className="usermgmt-header-content">
          <svg className="usermgmt-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
          </svg>
          <div className="usermgmt-header-text">
            <h1 className="usermgmt-title">USER MANAGEMENT</h1>
            <p className="usermgmt-subtitle">ADMIN CONTROL PANEL</p>
          </div>
          <div className="usermgmt-header-actions">
            {selectedUsers.size > 0 && (
              <button 
                className="usermgmt-btn danger"
                onClick={() => setShowBulkDeleteDialog(true)}
              >
                DELETE {selectedUsers.size}
              </button>
            )}
            <button className="usermgmt-btn secondary" onClick={loadUsers} disabled={loading}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2" />
              </svg>
              {loading ? 'LOADING...' : 'REFRESH'}
            </button>
          </div>
        </div>
        <div className="usermgmt-header-divider" />
      </div>

      {/* Message */}
      {msg && (
        <div className={`usermgmt-message ${msg.type}`}>
          <span className="message-icon">{msg.type === 'success' ? '✓' : '✗'}</span>
          <span className="message-text">{msg.text}</span>
        </div>
      )}

      {/* Content */}
      <div className="usermgmt-content">
        <h2 className="usermgmt-section-title">
          <span className="title-bracket">{'>'}</span> USER DATABASE
        </h2>
        <div className="usermgmt-table-wrapper">
          <table className="usermgmt-table">
            <thead>
              <tr>
                <th className="usermgmt-checkbox-col">
                  <input 
                    type="checkbox" 
                    className="usermgmt-checkbox"
                    checked={selectedUsers.size > 0 && selectedUsers.size === users.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>ID</th>
                <th>USERNAME</th>
                <th>ROLE</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className={selectedUsers.has(user.id) ? 'selected' : ''}>
                  <td className="usermgmt-checkbox-col">
                    <input 
                      type="checkbox" 
                      className="usermgmt-checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                    />
                  </td>
                  <td><span className="cell-data">{user.id}</span></td>
                  <td><span className="cell-data username">{user.username}</span></td>
                  <td>
                    <span className={`role-badge ${user.role}`}>
                      [{user.role.toUpperCase()}]
                    </span>
                  </td>
                  <td className="actions-cell">
                    <button 
                      className="usermgmt-btn-small warning"
                      onClick={() => {
                        setSelectedUser(user)
                        setShowResetDialog(true)
                        setMsg(null)
                      }}
                    >
                      RESET
                    </button>
                    <button 
                      className="usermgmt-btn-small danger"
                      onClick={() => {
                        setSelectedUser(user)
                        setShowDeleteDialog(true)
                        setMsg(null)
                      }}
                      disabled={user.id === currentUser?.id}
                      title={user.id === currentUser?.id ? 'Cannot delete your own account' : ''}
                    >
                      DELETE
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && !loading && (
            <div className="usermgmt-empty">{'>'} NO USERS FOUND</div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {showResetDialog && selectedUser && (
        <div className="usermgmt-overlay" onClick={() => setShowResetDialog(false)}>
          <div className="usermgmt-dialog" onClick={e => e.stopPropagation()}>
            <div className="dialog-border" />
            <div className="dialog-content">
              <h3 className="dialog-title">{'>'} RESET PASSWORD</h3>
              <p className="dialog-text">Enter new password for <span className="highlight">{selectedUser.username}</span>:</p>
              <input
                type="password"
                className="dialog-input"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="NEW PASSWORD"
                autoFocus
              />
              <div className="dialog-actions">
                <button 
                  className="usermgmt-btn primary"
                  onClick={handleResetPassword}
                  disabled={!newPassword}
                >
                  RESET PASSWORD
                </button>
                <button 
                  className="usermgmt-btn secondary"
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
        </div>
      )}

      {showDeleteDialog && selectedUser && (
        <div className="usermgmt-overlay" onClick={() => setShowDeleteDialog(false)}>
          <div className="usermgmt-dialog" onClick={e => e.stopPropagation()}>
            <div className="dialog-border" />
            <div className="dialog-content">
              <h3 className="dialog-title">{'>'} DELETE USER</h3>
              <p className="dialog-text">Are you sure you want to delete <span className="highlight">{selectedUser.username}</span>?</p>
              <p className="dialog-warning">{'>'} THIS ACTION CANNOT BE UNDONE</p>
              <div className="dialog-actions">
                <button 
                  className="usermgmt-btn danger"
                  onClick={handleDeleteUser}
                >
                  DELETE USER
                </button>
                <button 
                  className="usermgmt-btn secondary"
                  onClick={() => setShowDeleteDialog(false)}
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBulkDeleteDialog && selectedUsers.size > 0 && (
        <div className="usermgmt-overlay" onClick={() => setShowBulkDeleteDialog(false)}>
          <div className="usermgmt-dialog" onClick={e => e.stopPropagation()}>
            <div className="dialog-border" />
            <div className="dialog-content">
              <h3 className="dialog-title">{'>'} BULK DELETE</h3>
              <p className="dialog-text">Are you sure you want to delete <span className="highlight">{selectedUsers.size}</span> user(s)?</p>
              <p className="dialog-warning">{'>'} THIS ACTION CANNOT BE UNDONE</p>
              <div className="dialog-actions">
                <button 
                  className="usermgmt-btn danger"
                  onClick={handleBulkDelete}
                >
                  DELETE {selectedUsers.size} USER(S)
                </button>
                <button 
                  className="usermgmt-btn secondary"
                  onClick={() => setShowBulkDeleteDialog(false)}
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserManagementApp
