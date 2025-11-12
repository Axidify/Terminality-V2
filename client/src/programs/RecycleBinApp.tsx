import React, { useState, useEffect, useRef } from 'react'

import { fs } from './FileSystem'
import './RecycleBinApp.css'
import { saveDesktopState, hydrateFromServer, getCachedDesktop } from '../services/saveService'

interface DeletedFile {
  recyclePath: string
  originalPath: string
  name: string
  deletedAt: string
}

export const RecycleBinApp: React.FC = () => {
  const [deletedFiles, setDeletedFiles] = useState<DeletedFile[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file?: DeletedFile } | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, file?: DeletedFile) => {
    e.preventDefault()
    const container = containerRef.current
    if (container) {
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left + container.scrollLeft
      const y = e.clientY - rect.top + container.scrollTop
      setContextMenu({ x, y, file })
    } else {
      setContextMenu({ x: e.clientX, y: e.clientY, file })
    }
  }

  const closeContextMenu = () => setContextMenu(null)

  useEffect(() => {
    const handleClick = () => closeContextMenu()
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  useEffect(() => {
    // Initial load from cached server state
    const cached = getCachedDesktop()?.recycleBin
    if (cached) setDeletedFiles(cached)
    else loadDeletedFiles()

    // Hydrate fresh from server
    hydrateFromServer().then(s => {
      if (s.desktop?.recycleBin) {
        setDeletedFiles(s.desktop.recycleBin)
      }
    }).catch(() => {})

    // Poll for changes (simple approach until we add events / websockets)
    const interval = setInterval(() => loadDeletedFiles(), 3000)
    return () => clearInterval(interval)
  }, [])

  const loadDeletedFiles = () => {
    const bin = getCachedDesktop()?.recycleBin
    if (bin) setDeletedFiles(bin)
  }

  const restoreFile = (file: DeletedFile) => {
    // Restore file to original location
    const dir = file.originalPath.substring(0, file.originalPath.lastIndexOf('/'))
    const fileName = file.originalPath.substring(file.originalPath.lastIndexOf('/') + 1)
    
    try {
      // Check if file exists in recycle bin
      if (!fs.exists(file.recyclePath)) {
        alert('File no longer exists in recycle bin')
        // Clean up metadata (server-backed)
        const updated = deletedFiles.filter(f => f.recyclePath !== file.recyclePath)
        setDeletedFiles(updated)
        saveDesktopState({ recycleBin: updated }).catch(() => {})
        return
      }
      
      // Ensure the directory path exists
      fs.ensurePath(file.originalPath)
      
      // Check if file already exists at the original location
      if (fs.exists(file.originalPath)) {
        if (!confirm(`File ${fileName} already exists at ${dir}. Overwrite?`)) {
          return
        }
        // Remove the existing file first
        fs.remove(file.originalPath)
      }
      
      // Move the file back to original location
      fs.move(file.recyclePath, file.originalPath)
      
      // Remove from recycle bin metadata
  const updated = deletedFiles.filter(f => f.recyclePath !== file.recyclePath)
  setDeletedFiles(updated)
  saveDesktopState({ recycleBin: updated }).catch(() => {})
      
      alert(`✓ Restored ${fileName} to ${dir}`)
    } catch (e) {
      alert('Failed to restore file: ' + (e as Error).message)
    }
  }

  const permanentDelete = (file: DeletedFile) => {
    if (!confirm(`Permanently delete ${file.name}? This cannot be undone.`)) return
    
    try {
      // Actually delete the file from filesystem
      if (fs.exists(file.recyclePath)) {
        fs.remove(file.recyclePath)
      }
      
      // Remove from metadata
  const updated = deletedFiles.filter(f => f.recyclePath !== file.recyclePath)
  setDeletedFiles(updated)
  saveDesktopState({ recycleBin: updated }).catch(() => {})
    } catch (e) {
      alert('Failed to delete file: ' + (e as Error).message)
    }
  }

  const emptyBin = () => {
    if (!confirm('Empty the Recycle Bin? This cannot be undone.')) return
    
    // Delete all files in recycle bin
    deletedFiles.forEach(file => {
      if (fs.exists(file.recyclePath)) {
        fs.remove(file.recyclePath)
      }
    })
    
  setDeletedFiles([])
  saveDesktopState({ recycleBin: [] }).catch(() => {})
  }

  return (
  <div className="recycle-bin-container" ref={containerRef} onContextMenu={handleContextMenu}>
      {/* Background Effects */}
      <div className="recycle-bin-bg-grid" />
      <div className="recycle-bin-scanlines" />

      <div className="recycle-bin-header">
        <span className="recycle-bin-title">[ RECYCLE BIN ] ({deletedFiles.length} item{deletedFiles.length !== 1 ? 's' : ''})</span>
        {deletedFiles.length > 0 && (
          <button onClick={emptyBin} className="empty-bin-btn">
            Empty Bin
          </button>
        )}
      </div>

      {deletedFiles.length === 0 ? (
        <div className="recycle-bin-empty-state">
          <div className="empty-state-content">
            <div className="empty-state-icon">[EMPTY]</div>
            <div>Recycle Bin is empty</div>
          </div>
        </div>
      ) : (
        <div className="recycle-bin-table-container">
          <table className="recycle-bin-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Original Location</th>
                <th>Deleted</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deletedFiles.map((file, idx) => (
                <tr
                  key={idx}
                  className={selected === file.originalPath ? 'selected' : ''}
                  onClick={() => setSelected(file.originalPath)}
                  onContextMenu={(e) => handleContextMenu(e, file)}
                >
                  <td className="file-name-col">📄 {file.name}</td>
                  <td className="file-location-col">{file.originalPath.substring(0, file.originalPath.lastIndexOf('/'))}</td>
                  <td className="file-deleted-col">{new Date(file.deletedAt).toLocaleString()}</td>
                  <td className="file-actions-col">
                    <button onClick={(e) => { e.stopPropagation(); restoreFile(file) }} className="restore-btn">
                      Restore
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); permanentDelete(file) }} className="delete-btn">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="recycle-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.file ? (
            <>
              <div className="context-menu-item" onClick={() => { restoreFile(contextMenu.file!); closeContextMenu() }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                  <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                </svg>
                Restore File
              </div>
              <div className="context-menu-item" onClick={() => { permanentDelete(contextMenu.file!); closeContextMenu() }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                  <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                </svg>
                Delete Permanently
              </div>
            </>
          ) : (
            <>
              <div className="context-menu-item" onClick={() => { loadDeletedFiles(); closeContextMenu() }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                  <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                </svg>
                Refresh
              </div>
              {deletedFiles.length > 0 && (
                <>
                  <div className="context-menu-divider" />
                  <div className="context-menu-item" onClick={() => { emptyBin(); closeContextMenu() }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                      <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                    Empty Bin
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
