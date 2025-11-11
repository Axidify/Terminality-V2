import React from 'react'
import { useUser } from '../os/UserContext'
import { fs, FSNode } from './FileSystem'
import { getCachedDesktop, saveDesktopState } from '../services/saveService'
import { ContextMenu } from '../os/components/ContextMenu'
import { DesktopDialog } from '../os/components/DesktopDialog'
import { DeleteIcon } from '../os/components/Icons'

interface Props { openNotepad: (path: string) => void }

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

  const refresh = () => setItems(fs.list(cwd))

  // Auto-refresh when window gains focus
  React.useEffect(() => {
    const handleFocus = () => refresh()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [cwd])

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
    <div style={{ fontSize: 13, position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
      {/* Toolbar */}
      <div style={{ 
        padding: '8px 12px', 
        display: 'flex', 
        gap: 8, 
        alignItems: 'center', 
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        flexShrink: 0
      }}>
        <button onClick={up} style={{ 
          padding: '6px 12px', 
          border: '1px solid var(--color-border)', 
          background: 'var(--color-surface)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--color-text)'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back
        </button>
        <button onClick={refresh} style={{ 
          padding: '6px 12px', 
          border: '1px solid var(--color-border)', 
          background: 'var(--color-surface)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--color-text)'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
          Refresh
        </button>
        <div style={{ 
          flex: 1, 
          marginLeft: 12,
          padding: '6px 12px',
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: '2px',
          color: 'var(--color-text)',
          fontFamily: 'monospace'
        }}>
          {cwd}
        </div>
      </div>
      
      {/* File Grid */}
      <div style={{ 
        flex: 1, 
        padding: 12, 
        overflow: 'auto',
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', 
        gap: 12,
        alignContent: 'start'
      }} onContextMenu={handleBlankContextMenu}>
        {items.map(n => (
          <div 
            key={n.path} 
            onDoubleClick={() => enter(n)} 
            onContextMenu={(e) => handleContextMenu(e, n)}
            style={{ 
              padding: '12px 8px',
              cursor: 'pointer',
              background: 'var(--color-surface)',
              border: '1px solid transparent',
              borderRadius: '4px',
              transition: 'all 0.15s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              textAlign: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-bgHover)'
              e.currentTarget.style.borderColor = 'var(--color-border)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--color-surface)'
              e.currentTarget.style.borderColor = 'transparent'
            }}
          >
            {/* Icon */}
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              {n.type === 'dir' ? (
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              ) : (
                <>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </>
              )}
            </svg>
            {/* Name */}
            <div style={{ 
              fontSize: 12, 
              color: 'var(--color-text)',
              wordBreak: 'break-word',
              maxWidth: '100%'
            }}>
              {n.name}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div style={{ 
            gridColumn: '1 / -1',
            textAlign: 'center',
            padding: 40,
            opacity: 0.5,
            color: 'var(--color-textDim)'
          }}>
            This folder is empty
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
