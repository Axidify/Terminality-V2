import React, { useState, useEffect, useRef, useId } from 'react'

import './UserManagementApp.css'
import { useUser } from '../os/UserContext'
import { apiRequest } from '../services/api'

interface User {
  id: number
  username: string
  role: string
}

export const UserManagementApp: React.FC = () => {
  const { user: currentUser, isAdmin } = useUser()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set())
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createUsername, setCreateUsername] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createRole, setCreateRole] = useState<'user' | 'admin'>('user')
  const [newPassword, setNewPassword] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const roleSelectId = useId()

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

  const handleCreateUser = async () => {
    if (!createUsername || !createPassword) return
    setMsg(null)
    try {
      await apiRequest(`/api/admin/users`, {
        method: 'POST',
        auth: true,
        body: { username: createUsername, password: createPassword, email: createEmail || undefined, role: createRole }
      })
      setMsg({ text: `User ${createUsername} created`, type: 'success' })
      setShowCreateDialog(false)
      setCreateUsername('')
      setCreatePassword('')
      setCreateEmail('')
      setCreateRole('user')
      await loadUsers()
    } catch (e: any) {
      setMsg({ text: e?.message || 'Failed to create user', type: 'error' })
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
  <div className="usermgmt-app" ref={containerRef} onContextMenu={handleContextMenu}>
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
            {isAdmin && (
              <button className="usermgmt-btn primary" onClick={() => setShowCreateDialog(true)}>
                CREATE
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
      {showCreateDialog && (
        <div className="usermgmt-overlay" onClick={() => setShowCreateDialog(false)}>
          <div className="usermgmt-dialog" onClick={e => e.stopPropagation()}>
            <div className="dialog-border" />
            <div className="dialog-content">
              <h3 className="dialog-title">{'>'} CREATE USER</h3>
              <p className="dialog-text">Create a new user account:</p>
              <input
                type="text"
                className="dialog-input"
                value={createUsername}
                onChange={e => setCreateUsername(e.target.value)}
                placeholder="USERNAME"
              />
              <input
                type="email"
                className="dialog-input"
                value={createEmail}
                onChange={e => setCreateEmail(e.target.value)}
                placeholder="EMAIL (optional)"
              />
              <input
                type="password"
                className="dialog-input"
                value={createPassword}
                onChange={e => setCreatePassword(e.target.value)}
                placeholder="PASSWORD"
              />
              <div style={{ marginTop: 8 }}>
                <label style={{ marginRight: 8 }} htmlFor={roleSelectId}>Role:</label>
                <select
                  id={roleSelectId}
                  value={createRole}
                  onChange={e => setCreateRole(e.target.value as 'user' | 'admin')}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="dialog-actions">
                <button 
                  className="usermgmt-btn primary"
                  onClick={handleCreateUser}
                  disabled={!createUsername || !createPassword}
                >
                  CREATE USER
                </button>
                <button 
                  className="usermgmt-btn secondary"
                  onClick={() => {
                    setShowCreateDialog(false)
                    setCreateUsername('')
                    setCreatePassword('')
                    setCreateEmail('')
                    setCreateRole('user')
                  }}
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="usermgmt-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="context-menu-item" onClick={() => { loadUsers(); closeContextMenu() }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
              <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
            </svg>
            Refresh Users
          </div>
          <div className="context-menu-divider" />
          <div className="context-menu-item" onClick={() => { alert(`User Management\n${users.length} users`); closeContextMenu() }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
            </svg>
            About Manager
          </div>
        </div>
      )}
    </div>
  )
}

export default UserManagementApp
