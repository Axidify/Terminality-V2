import React, { useEffect, useState } from 'react'
import { listUsers, updateUser, resetUserPassword, deleteUser, AdminUser } from '../services/admin'
import { me } from '../services/auth'
import './AdminApp.css'
import { useContextMenuPosition } from '../os/hooks/useContextMenuPosition'
import { ContextMenuPortal } from '../os/components/ContextMenuPortal'
import { RefreshIcon, InfoIcon } from '../os/components/Icons'

type ModalType = 'password' | 'delete' | null

export const AdminApp: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  
  // Modal state
  const [modalType, setModalType] = useState<ModalType>(null)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [modalBusy, setModalBusy] = useState(false)
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const { ref: menuRef, pos: menuPos } = useContextMenuPosition(contextMenu?.x ?? 0, contextMenu?.y ?? 0)

  const load = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const [data, currentUser] = await Promise.all([listUsers(), me()])
      setUsers(data)
      setCurrentUserId(currentUser.id)
    } catch (e: any) {
      setError(e.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (contextMenu) {
      const handler = () => setContextMenu(null)
      window.addEventListener('click', handler)
      return () => window.removeEventListener('click', handler)
    }
  }, [contextMenu])

  const clearMessages = () => {
    setError(null)
    setSuccess(null)
  }

  const toggleAdmin = async (u: AdminUser) => {
    clearMessages()
    try {
      const updated = await updateUser(u.id, { is_admin: !u.is_admin })
      setUsers(prev => prev.map(x => x.id === updated.id ? updated : x))
      setSuccess(`${u.username} admin rights ${updated.is_admin ? 'granted' : 'revoked'}`)
    } catch (e: any) {
      setError(e.message || 'Update failed')
    }
  }

  const openPasswordModal = (u: AdminUser) => {
    setSelectedUser(u)
    setModalType('password')
    setNewPassword('')
    setConfirmPassword('')
    clearMessages()
  }

  const openDeleteModal = (u: AdminUser) => {
    setSelectedUser(u)
    setModalType('delete')
    clearMessages()
  }

  const closeModal = () => {
    setModalType(null)
    setSelectedUser(null)
    setNewPassword('')
    setConfirmPassword('')
  }

  const handlePasswordReset = async () => {
    if (!selectedUser) return
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setModalBusy(true)
    clearMessages()
    try {
      const result = await resetUserPassword(selectedUser.id, newPassword)
      setSuccess(result.message)
      closeModal()
      load()
    } catch (e: any) {
      setError(e.message || 'Password reset failed')
    } finally {
      setModalBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedUser) return
    
    setModalBusy(true)
    clearMessages()
    try {
      const result = await deleteUser(selectedUser.id)
      setSuccess(result.message)
      closeModal()
      load()
    } catch (e: any) {
      setError(e.message || 'Delete failed')
    } finally {
      setModalBusy(false)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <div className="admin-app" onContextMenu={handleContextMenu}>
      <div className="admin-header">
        <h2 className="admin-title">User Access Management</h2>
        <button className="admin-refresh-btn" onClick={load} disabled={loading}>
          {loading ? '↻ Loading...' : '↻ Refresh'}
        </button>
      </div>

      {error && <div className="admin-message admin-error">{error}</div>}
      {success && <div className="admin-message admin-success">{success}</div>}

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Admin</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td className="admin-cell-id">{u.id}</td>
                <td className="admin-cell-username">{u.username}</td>
                <td className="admin-cell-admin">
                  <span className={`admin-badge ${u.is_admin ? 'admin-badge-yes' : 'admin-badge-no'}`}>
                    {u.is_admin ? '✓ Admin' : 'User'}
                  </span>
                </td>
                <td className="admin-cell-actions">
                  <button 
                    className={`admin-action-btn ${u.is_admin ? 'admin-btn-revoke' : 'admin-btn-grant'}`}
                    onClick={() => toggleAdmin(u)} 
                    disabled={loading || u.id === currentUserId}
                    title={u.id === currentUserId ? 'Cannot modify your own admin status' : (u.is_admin ? 'Revoke admin rights' : 'Grant admin rights')}
                  >
                    {u.is_admin ? 'Revoke' : 'Grant'}
                  </button>
                  <button 
                    className="admin-action-btn admin-btn-password"
                    onClick={() => openPasswordModal(u)}
                    disabled={loading}
                    title="Reset user password"
                  >
                    Reset PW
                  </button>
                  <button 
                    className="admin-action-btn admin-btn-delete"
                    onClick={() => openDeleteModal(u)}
                    disabled={loading || u.id === currentUserId}
                    title={u.id === currentUserId ? 'Cannot delete your own account' : 'Delete user account'}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && !loading && (
        <div className="admin-empty">No users found</div>
      )}

      {/* Password Reset Modal */}
      {modalType === 'password' && selectedUser && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Reset Password</h3>
              <button className="admin-modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="admin-modal-body">
              <p className="admin-modal-text">Reset password for <strong>{selectedUser.username}</strong></p>
              <div className="admin-form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                  autoFocus
                  disabled={modalBusy}
                />
              </div>
              <div className="admin-form-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  disabled={modalBusy}
                  onKeyDown={(e) => e.key === 'Enter' && !modalBusy && handlePasswordReset()}
                />
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-modal-btn admin-modal-btn-cancel" onClick={closeModal} disabled={modalBusy}>
                Cancel
              </button>
              <button className="admin-modal-btn admin-modal-btn-confirm" onClick={handlePasswordReset} disabled={modalBusy}>
                {modalBusy ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {modalType === 'delete' && selectedUser && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Delete User</h3>
              <button className="admin-modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="admin-modal-body">
              <p className="admin-modal-text">
                Are you sure you want to delete <strong>{selectedUser.username}</strong>?
              </p>
              <p className="admin-modal-warning">
                ⚠️ This action cannot be undone. All user data will be permanently removed.
              </p>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-modal-btn admin-modal-btn-cancel" onClick={closeModal} disabled={modalBusy}>
                Cancel
              </button>
              <button className="admin-modal-btn admin-modal-btn-delete" onClick={handleDelete} disabled={modalBusy}>
                {modalBusy ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenuPortal>
          <div
            ref={menuRef}
            className="admin-context-menu"
            style={{
              position: 'fixed',
              left: menuPos.left,
              top: menuPos.top,
              zIndex: 10001
            }}
          >
            <div className="admin-context-item" onClick={() => { load(); setContextMenu(null) }}><RefreshIcon size={14}/> Refresh Users</div>
            <div className="admin-context-divider" />
            <div className="admin-context-item" onClick={() => { alert('Terminality Admin Panel v1.0\nUser access management system'); setContextMenu(null) }}><InfoIcon size={14}/> About</div>
          </div>
        </ContextMenuPortal>
      )}
    </div>
  )
}
