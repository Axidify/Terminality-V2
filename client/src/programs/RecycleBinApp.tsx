import React, { useState, useEffect } from 'react'

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
    <div className="recycle-bin-container">
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
    </div>
  )
}
