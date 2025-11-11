import React, { useEffect, useState } from 'react'

import { fs } from './FileSystem'
import './NotepadApp.css'
import { ContextMenu } from '../os/components/ContextMenu'
import { CopyIcon, PasteIcon, SaveIcon, SelectAllIcon, InfoIcon } from '../os/components/Icons'
import { useContextMenuPosition } from '../os/hooks/useContextMenuPosition'
import { getCachedDesktop, saveDesktopState } from '../services/saveService'

interface Props { 
  path?: string 
  onPathChange?: (newPath: string) => void
}

export const NotepadApp: React.FC<Props> = ({ path: initialPath, onPathChange }) => {
  const [currentPath, setCurrentPath] = useState(initialPath || '')
  const [content, setContent] = useState('')
  const [unsavedChanges, setUnsavedChanges] = useState(false)
  const [recentFiles, setRecentFiles] = useState<string[]>(() => {
    const cached = getCachedDesktop()?.notepadRecent
    return cached ? cached : []
  })
  const [showFileDialog, setShowFileDialog] = useState(!initialPath)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const { ref: _menuRef, pos: menuPos } = useContextMenuPosition(contextMenu?.x ?? 0, contextMenu?.y ?? 0)

  useEffect(() => {
    if (!currentPath) return
    const file = fs.read(currentPath)
    if (file) {
      setContent(file.content)
      setUnsavedChanges(false)
      const updated = [currentPath, ...recentFiles.filter(p => p !== currentPath)].slice(0, 10)
      setRecentFiles(updated)
      saveDesktopState({ notepadRecent: updated }).catch(() => {})
    }
  }, [currentPath, recentFiles])

  // loadFile inlined above in effect

  const addToRecent = (path: string) => {
    const updated = [path, ...recentFiles.filter(p => p !== path)].slice(0, 10)
    setRecentFiles(updated)
    saveDesktopState({ notepadRecent: updated }).catch(() => {})
  }

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    setUnsavedChanges(true)
  }

  const save = () => {
    if (!currentPath) {
      alert('Please create a new file or open an existing one first')
      return
    }
    fs.ensurePath(currentPath)
    if (!fs.exists(currentPath)) fs.touch(currentPath)
    fs.write(currentPath, content)
    setUnsavedChanges(false)
  }

  const createNew = () => {
    if (unsavedChanges && !confirm('Discard unsaved changes?')) return
    
    const fileName = prompt('Enter new file name:', 'untitled.txt')
    if (fileName) {
      const path = `/home/player/${fileName}`
      // Enforce notes file limit
      if (path.endsWith('.txt')) {
        const cnt = fs.countFilesByExt('.txt', '/home/player')
        if (cnt >= 100) {
          alert('You have reached the maximum number of notes (100). Delete some notes first.')
          return
        }
      }
      fs.ensurePath(path)
      fs.touch(path)
      fs.write(path, '')
      setCurrentPath(path)
      setContent('')
      setUnsavedChanges(false)
      setShowFileDialog(false)
      addToRecent(path)
      onPathChange?.(path)
    }
  }

  const openFile = (path: string) => {
    if (unsavedChanges && !confirm('Discard unsaved changes?')) return
    setCurrentPath(path)
    setShowFileDialog(false)
    onPathChange?.(path)
  }

  const openFileDialog = () => {
    const path = prompt('Enter file path to open:', '/home/player/')
    if (path && fs.exists(path)) {
      openFile(path)
    } else if (path) {
      alert('File not found!')
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation() // prevent desktop container from intercepting
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const closeContextMenu = () => {
    setContextMenu(null)
  }

  const handleCopy = () => {
    const textarea = document.querySelector('.notepad-editor') as HTMLTextAreaElement
    if (textarea) {
      const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd)
      if (selectedText) {
        navigator.clipboard.writeText(selectedText)
      }
    }
    closeContextMenu()
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const textarea = document.querySelector('.notepad-editor') as HTMLTextAreaElement
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newContent = content.substring(0, start) + text + content.substring(end)
        handleContentChange(newContent)
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + text.length
        }, 0)
      }
    } catch (err) {
      console.error('Failed to paste:', err)
    }
    closeContextMenu()
  }

  const handleSelectAll = () => {
    const textarea = document.querySelector('.notepad-editor') as HTMLTextAreaElement
    if (textarea) {
      textarea.select()
    }
    closeContextMenu()
  }

  useEffect(() => {
    if (contextMenu) {
      const handler = () => closeContextMenu()
      window.addEventListener('click', handler)
      window.addEventListener('contextmenu', handler)
      return () => {
        window.removeEventListener('click', handler)
        window.removeEventListener('contextmenu', handler)
      }
    }
  }, [contextMenu])

  if (showFileDialog && !currentPath) {
    return (
      <div className="notepad-file-dialog">
        <h3 className="notepad-dialog-title">[ NOTEPAD ]</h3>
        
        <div className="notepad-dialog-actions">
          <button onClick={createNew} className="notepad-action-btn">
            📄 Create New File
          </button>
          <button onClick={openFileDialog} className="notepad-action-btn">
            📂 Open Existing File
          </button>
        </div>

        {recentFiles.length > 0 && (
          <div className="notepad-recent-files">
            <div className="notepad-recent-title">Recent Files:</div>
            <div className="notepad-recent-list">
              {recentFiles.map(path => (
                <div
                  key={path}
                  onClick={() => openFile(path)}
                  className="notepad-recent-item"
                >
                  {path}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="notepad-container" onContextMenu={handleContextMenu}>
      {/* Menu bar */}
      <div className="notepad-menubar">
        <button onClick={createNew} className="notepad-menu-btn">New</button>
        <button onClick={openFileDialog} className="notepad-menu-btn">Open</button>
        <button onClick={save} disabled={!unsavedChanges} className="notepad-menu-btn">
          Save {unsavedChanges && '*'}
        </button>
        <div className="notepad-menubar-spacer" />
        <div className="notepad-filepath">
          {currentPath || 'Untitled'}
        </div>
      </div>

      {/* Editor */}
      <textarea 
        value={content} 
        onChange={e => handleContentChange(e.target.value)} 
        onContextMenu={handleContextMenu}
        placeholder="Start typing..."
        className="notepad-editor"
      />

      {/* Status bar */}
      <div className="notepad-statusbar">
        <span className="notepad-status-left">{unsavedChanges ? 'Modified' : 'Saved'}</span>
        <span className="notepad-status-right">{content.length} characters | {content.split('\n').length} lines</span>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={menuPos.left}
          y={menuPos.top}
          onClose={closeContextMenu}
          items={[
            { label: 'Copy', icon: <CopyIcon size={14}/>, hint: 'Ctrl+C', onClick: handleCopy },
            { label: 'Paste', icon: <PasteIcon size={14}/>, hint: 'Ctrl+V', onClick: handlePaste },
            { divider: true },
            { label: 'Select All', icon: <SelectAllIcon size={14}/>, hint: 'Ctrl+A', onClick: handleSelectAll },
            { divider: true },
            { label: `Save${unsavedChanges ? '*' : ''}`, icon: <SaveIcon size={14}/>, hint: 'Ctrl+S', disabled: !unsavedChanges, onClick: save },
            { divider: true },
            { label: 'About', icon: <InfoIcon size={14}/>, onClick: () => { alert('Notepad v1.0\nA simple text editor for Terminality OS') } }
          ]}
        />
      )}
    </div>
  )
}
