import React, { useMemo } from 'react'

import { fs, FSNode } from './FileSystem'
import { ContextMenu } from '../os/components/ContextMenu'
import { DesktopDialog } from '../os/components/DesktopDialog'
import { DeleteIcon } from '../os/components/Icons'
import { useUser } from '../os/UserContext'
import { getCachedDesktop, saveDesktopState } from '../services/saveService'
import './FileExplorerApp.css'

interface Props { openNotepad: (path: string) => void }

const FolderIcon: React.FC = () => (
  <svg className="fileexplorer-logo" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 25 L10 75 L90 75 L90 35 L50 35 L45 25 Z" stroke="currentColor" strokeWidth="4" fill="rgba(0, 255, 65, 0.1)"/>
    <path d="M10 35 L90 35" stroke="currentColor" strokeWidth="2"/>
  </svg>
)

interface DialogHelpers {
  close: () => void
  setError: (message: string | null) => void
}

type ConfirmDialogState = {
  type: 'confirm'
  title: string
  message?: React.ReactNode
  submitLabel?: string
  cancelLabel?: string
  onSubmit: (helpers: DialogHelpers) => void
  onCancel?: () => void
}

type InputDialogState = {
  type: 'input'
  title: string
  message?: React.ReactNode
  submitLabel?: string
  cancelLabel?: string
  placeholder?: string
  initialValue: string
  onSubmit: (value: string, helpers: DialogHelpers) => void
  onCancel?: () => void
}

type DialogState = ConfirmDialogState | InputDialogState

export const FileExplorerApp: React.FC<Props> = ({ openNotepad }) => {
  const [cwd, setCwd] = React.useState('/home/player')
  const [items, setItems] = React.useState<FSNode[]>(fs.list(cwd))
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; node?: FSNode; kind: 'item' | 'blank' } | null>(null)
  const [dialog, setDialog] = React.useState<DialogState | null>(null)
  const [dialogValue, setDialogValue] = React.useState('')
  const [dialogError, setDialogError] = React.useState<string | null>(null)
  const { isAdmin } = useUser()

  // Generate particle positions once per mount to avoid jumping
  const particles = useMemo(() => (
    Array.from({ length: 10 }).map((_, i) => ({
      key: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 5}s`,
      animationDuration: `${10 + Math.random() * 10}s`
    }))
  ), [])

  const closeDialog = React.useCallback(() => {
    setDialog(null)
    setDialogValue('')
    setDialogError(null)
  }, [])

  const openConfirmDialog = React.useCallback((config: Omit<ConfirmDialogState, 'type'>) => {
    setDialogError(null)
    setDialog({ type: 'confirm', ...config })
  }, [])

  const openInputDialog = React.useCallback((config: Omit<InputDialogState, 'type'>) => {
    setDialogError(null)
    setDialog({ type: 'input', ...config })
    setDialogValue(config.initialValue)
  }, [])

  const openAlert = React.useCallback((title: string, message: React.ReactNode, submitLabel = 'OK') => {
    setDialogError(null)
    setDialog({
      type: 'confirm',
      title,
      message,
      submitLabel,
      cancelLabel: undefined,
      onSubmit: ({ close }) => close()
    })
  }, [])

  const handleDialogSubmit = React.useCallback(() => {
    if (!dialog) return
    const helpers: DialogHelpers = {
      close: closeDialog,
      setError: setDialogError
    }
    setDialogError(null)
    if (dialog.type === 'input') {
      dialog.onSubmit(dialogValue, helpers)
    } else {
      dialog.onSubmit(helpers)
    }
  }, [dialog, dialogValue, closeDialog])

  const handleDialogCancel = React.useCallback(() => {
    if (dialog?.onCancel) {
      dialog.onCancel()
    }
    closeDialog()
  }, [dialog, closeDialog])

  const refresh = React.useCallback(() => setItems(fs.list(cwd)), [cwd])

  // Auto-refresh when window gains focus
  React.useEffect(() => {
    const handleFocus = () => refresh()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [refresh])

  // Refresh on cwd change
  React.useEffect(() => {
    setItems(fs.list(cwd))
  }, [cwd])

  // Close context menu when clicking outside
  React.useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [contextMenu])

  const enter = (n: FSNode) => {
    if (n.type === 'dir') {
      setCwd(n.path)
    } else if (n.type === 'file') {
      openNotepad(n.path)
    }
  }

  const up = () => {
    if (cwd === '/') return
    const parent = cwd.split('/').slice(0,-1).join('/') || '/'
    setCwd(parent)
  }

  const handleContextMenu = (e: React.MouseEvent, node: FSNode) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, node, kind: 'item' })
  }

  const handleBlankContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, kind: 'blank' })
  }

  const handleDelete = (node: FSNode) => {
    setContextMenu(null)
    
    // Helper to recursively collect all files in a folder
    const collectFiles = (dirPath: string): FSNode[] => {
      const items = fs.list(dirPath)
      let files: FSNode[] = []
      items.forEach(item => {
        if (item.type === 'file') {
          files.push(item)
        } else if (item.type === 'dir') {
          files = files.concat(collectFiles(item.path))
        }
      })
      return files
    }

    if (node.type === 'file') {
      openConfirmDialog({
        title: 'Move to Recycle Bin?',
        message: `Move ${node.name} to Recycle Bin?`,
        submitLabel: 'Move to Bin',
        cancelLabel: 'Cancel',
        onSubmit: ({ close, setError }) => {
          try {
            if (!fs.exists('/.recycle')) {
              fs.mkdir('/.recycle')
            }
            const timestamp = Date.now()
            const recyclePath = `/.recycle/${timestamp}_${node.name}`
            fs.move(node.path, recyclePath)
            const recycleBin = (getCachedDesktop()?.recycleBin || []).slice()
            recycleBin.push({
              recyclePath,
              originalPath: node.path,
              name: node.name,
              deletedAt: new Date().toISOString()
            })
            saveDesktopState({ recycleBin }).catch(() => {})
            refresh()
            close()
          } catch (e) {
            setError('Failed to move to recycle bin: ' + (e as Error).message)
          }
        }
      })
      return
    }

    // Allow deleting folders in /home/player for non-admin users
    const canDelete = isAdmin && node.path.startsWith('/home') || node.path.startsWith('/home/player')
    
    if (canDelete) {
      // Collect all files in folder
      const allFiles = collectFiles(node.path)
      const fileCount = allFiles.length
      
      openConfirmDialog({
        title: 'Move to Recycle Bin?',
        message: `Move folder ${node.name}${fileCount > 0 ? ` and ${fileCount} file${fileCount === 1 ? '' : 's'}` : ''} to Recycle Bin?`,
        submitLabel: 'Move to Bin',
        cancelLabel: 'Cancel',
        onSubmit: ({ close, setError }) => {
          try {
            if (!fs.exists('/.recycle')) {
              fs.mkdir('/.recycle')
            }
            
            const recycleBin = (getCachedDesktop()?.recycleBin || []).slice()
            const timestamp = Date.now()
            
            // Move all files to recycle bin
            allFiles.forEach((file, idx) => {
              const recycleFileName = `${timestamp}_${idx}_${file.name}`
              const recyclePath = `/.recycle/${recycleFileName}`
              fs.move(file.path, recyclePath)
              recycleBin.push({
                recyclePath,
                originalPath: file.path,
                name: file.name,
                deletedAt: new Date().toISOString()
              })
            })
            
            // Remove the now-empty folder
            fs.remove(node.path)
            
            saveDesktopState({ recycleBin }).catch(() => {})
            refresh()
            close()
          } catch (e) {
            setError('Failed to move to recycle bin: ' + (e as Error).message)
          }
        }
      })
    } else {
      openAlert('Cannot Delete', 'You can only delete folders in your /home/player directory')
    }
  }

  return (
    <div className="fileexplorer-root">
      {/* Background effects */}
      <div className="fileexplorer-bg-grid" />
      <div className="fileexplorer-scanlines" />
      {particles.map(p => (
        <div key={p.key} className="fileexplorer-particle" style={{
          left: p.left,
          top: p.top,
          animationDelay: p.animationDelay,
          animationDuration: p.animationDuration
        }} />
      ))}

      {/* Header */}
      <div className="fileexplorer-header">
        <div className="fileexplorer-logo-container">
          <FolderIcon />
        </div>
        <div className="fileexplorer-title-group">
          <h1 className="fileexplorer-title">
            <span className="fileexplorer-bracket">[</span>
            FILE EXPLORER
            <span className="fileexplorer-bracket">]</span>
          </h1>
          <div className="fileexplorer-subtitle">System Navigation</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="fileexplorer-toolbar">
        <button onClick={up} className="fileexplorer-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          BACK
        </button>
        <button onClick={refresh} className="fileexplorer-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
          REFRESH
        </button>
        <div className="fileexplorer-path">
          <span className="path-label">PATH:</span>
          <span className="path-value">{cwd}</span>
        </div>
      </div>
      
      {/* File Grid */}
      <div className="fileexplorer-content" onContextMenu={handleBlankContextMenu}>
        <div className="fileexplorer-grid">
          {items.map(n => (
            <div 
              key={n.path} 
              className="fileexplorer-item"
              onDoubleClick={() => enter(n)} 
              onContextMenu={(e) => handleContextMenu(e, n)}
            >
              <div className="item-border" />
              <div className="item-content">
                <svg className="item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  {n.type === 'dir' ? (
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  ) : (
                    <>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </>
                  )}
                </svg>
                <div className="item-name">{n.name}</div>
              </div>
            </div>
          ))}
        </div>
        {items.length === 0 && (
          <div className="fileexplorer-empty">
            <div className="empty-bracket">[</div>
            FOLDER IS EMPTY
            <div className="empty-bracket">]</div>
          </div>
        )}
      </div>
      
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={contextMenu.kind === 'item' && contextMenu.node ? [
            {
              label: 'Rename',
              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/><path d="M14.06 4.94l3.75 3.75"/></svg>,
              hint: 'F2',
              onClick: () => {
                const node = contextMenu.node as FSNode
                setContextMenu(null)
                openInputDialog({
                  title: 'Rename',
                  message: `Rename ${node.name}`,
                  submitLabel: 'Rename',
                  cancelLabel: 'Cancel',
                  placeholder: node.name,
                  initialValue: node.name,
                  onSubmit: (value, { close, setError }) => {
                    const newName = value
                    if (!newName) {
                      setError('Name cannot be empty')
                      return
                    }
                    if (newName === node.name) {
                      close()
                      return
                    }
                    const parent = node.parent || '/'
                    const newPath = (parent === '/' ? '' : parent) + '/' + newName
                    try {
                      fs.move(node.path, newPath)
                      refresh()
                      close()
                    } catch (e) {
                      setError('Rename failed: ' + (e as Error).message)
                    }
                  }
                })
              }
            },
            {
              label: 'Delete',
              icon: <DeleteIcon size={14} />,
              hint: 'Del',
              disabled: contextMenu.node.type === 'dir' && !isAdmin && !contextMenu.node.path.startsWith('/home/player'),
              onClick: () => handleDelete(contextMenu.node as FSNode)
            }
          ] : [
            {
              label: 'New File',
              icon: <span style={{width:14,height:14,display:'inline-block',border:'1.5px solid currentColor'}} />,
              onClick: () => {
                setContextMenu(null)
                openInputDialog({
                  title: 'New File',
                  message: `Create a new file in ${cwd}`,
                  submitLabel: 'Create',
                  cancelLabel: 'Cancel',
                  placeholder: 'untitled.txt',
                  initialValue: 'untitled.txt',
                  onSubmit: (value, { close, setError }) => {
                    const name = value
                    if (!name) {
                      setError('Name cannot be empty')
                      return
                    }
                    const p = `${cwd}/${name}`
                    
                    // Check if file already exists
                    if (fs.exists(p)) {
                      setError('A file with this name already exists. Please choose a different name.')
                      return
                    }
                    
                    const isTxt = name.toLowerCase().endsWith('.txt')
                    if (isTxt && cwd.startsWith('/home/player')) {
                      const count = fs.countFilesByExt('.txt', '/home/player')
                      if (count >= 100) {
                        setError('You have reached the 100 notes limit.')
                        return
                      }
                    }
                    try {
                      fs.ensurePath(p)
                      fs.touch(p)
                      refresh()
                      close()
                    } catch (e) {
                      setError('Failed to create file: ' + (e as Error).message)
                    }
                  }
                })
              }
            },
            {
              label: 'New Folder',
              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7V19C3 19.55 3.45 20 4 20H20C20.55 20 21 19.55 21 19V9C21 8.45 20.55 8 20 8H11L9 6H4C3.45 6 3 6.45 3 7Z"/></svg>,
              onClick: () => {
                setContextMenu(null)
                openInputDialog({
                  title: 'New Folder',
                  message: `Create a new folder in ${cwd}`,
                  submitLabel: 'Create',
                  cancelLabel: 'Cancel',
                  placeholder: 'New Folder',
                  initialValue: 'New Folder',
                  onSubmit: (value, { close, setError }) => {
                    const name = value
                    if (!name) {
                      setError('Name cannot be empty')
                      return
                    }
                    const p = `${cwd}/${name}`
                    
                    // Check if folder already exists
                    if (fs.exists(p)) {
                      setError('A folder with this name already exists. Please choose a different name.')
                      return
                    }
                    
                    if (!isAdmin && cwd !== '/home/player') {
                      setError('You may only create folders inside your /home/player directory')
                      return
                    }
                    if (p.startsWith('/home')) {
                      const parts = p.split('/').filter(Boolean)
                      if (parts.length > 3) {
                        setError('Cannot create folder: nesting limit exceeded')
                        return
                      }
                    }
                    try {
                      fs.mkdir(p)
                      refresh()
                      close()
                    } catch (e) {
                      setError('Failed to create folder: ' + (e as Error).message)
                    }
                  }
                })
              }
            },
            { divider: true },
            {
              label: 'Refresh',
              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 12a9 9 0 0 1 15.3-6.364"/><path d="M21 12a9 9 0 0 1-15.3 6.364"/><path d="M9 5H4V10"/><path d="M15 19h5v-5"/></svg>,
              hint: 'F5',
              onClick: () => refresh()
            }
          ]}
        />
      )}
      {dialog && (
        <DesktopDialog
          title={dialog.title}
          message={dialog.message}
          mode={dialog.type}
          value={dialog.type === 'input' ? dialogValue : undefined}
          onValueChange={dialog.type === 'input' ? setDialogValue : undefined}
          onSubmit={handleDialogSubmit}
          onCancel={handleDialogCancel}
          submitLabel={dialog.submitLabel}
          cancelLabel={dialog.cancelLabel}
          error={dialogError}
          placeholder={dialog.type === 'input' ? dialog.placeholder : undefined}
        />
      )}
    </div>
  )
}
