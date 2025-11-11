import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react'

import { ContextMenu, MenuItem } from './ContextMenu'
import { DesktopDialog } from './DesktopDialog'
import { TerminalIcon, FolderIcon, NotepadIcon, BrowserIcon, RecycleBinIcon, MailIcon, MusicIcon, SettingsIcon, ChatIcon, StoreIcon, AdminIcon } from './Icons'
import { fs } from '../../programs/FileSystem'
import { saveDesktopState, getCachedDesktop } from '../../services/saveService'
import { useUser } from '../UserContext'
import { useWindowManager, WindowType } from '../WindowManager'
import './DesktopIcons.css'

interface DesktopIconDef {
  type: WindowType
  name: string
  icon: React.ReactNode
  x: number
  y: number
  defaultOpts?: { title?: string; width?: number; height?: number; payload?: any }
}

export interface DesktopIconsRef {
  autoArrange: () => void
}

// Removed legacy localStorage key, now fully server-backed

const baseIcons: DesktopIconDef[] = [
  { 
    type: 'terminal', 
    name: 'Terminal', 
    icon: <TerminalIcon size={50} />, 
    x: 20, 
    y: 20,
    defaultOpts: { title: 'Terminal' } 
  },
  { 
    type: 'explorer', 
    name: 'My Files', 
    icon: <FolderIcon size={50} />, 
    x: 20, 
    y: 120,
    defaultOpts: { title: 'File Explorer', width: 1200, height: 800 } 
  },
  { 
    type: 'notepad', 
    name: 'Notes', 
    icon: <NotepadIcon size={50} />, 
    x: 20, 
    y: 220,
    defaultOpts: { title: 'Notepad', width: 1200, height: 800, payload: { path: '/home/player/notes.txt' } } 
  },
  { 
    type: 'browser', 
    name: 'Browser', 
    icon: <BrowserIcon size={50} />, 
    x: 20, 
    y: 320,
    defaultOpts: { title: 'Browser', width: 1200, height: 800 } 
  },
  { 
    type: 'recycle', 
    name: 'Recycle Bin', 
    icon: <RecycleBinIcon size={50} />, 
    x: 20, 
    y: 420,
    defaultOpts: { title: 'Recycle Bin', width: 1000, height: 760 } 
  },
  { 
    type: 'email', 
    name: 'Mail', 
    icon: <MailIcon size={50} />, 
    x: 20, 
    y: 520,
    defaultOpts: { title: 'Mail', width: 1200, height: 800 } 
  },
  { 
    type: 'music', 
    name: 'Music', 
    icon: <MusicIcon size={50} />, 
    x: 130, 
    y: 20,
    defaultOpts: { title: 'Music Player', width: 450, height: 520 } 
  },
  { 
    type: 'settings', 
    name: 'Settings', 
    icon: <SettingsIcon size={50} />, 
    x: 130, 
    y: 120,
    defaultOpts: { title: 'System Settings', width: 1200, height: 800 } 
  },
  { 
    type: 'chat', 
    name: 'Chat', 
    icon: <ChatIcon size={50} />, 
    x: 130, 
    y: 220,
    defaultOpts: { title: 'Chat', width: 400, height: 500 } 
  },
  { 
    type: 'store', 
    name: 'Store', 
    icon: <StoreIcon size={50} />, 
    x: 130, 
    y: 320,
    defaultOpts: { title: 'Terminality Store', width: 1200, height: 800 } 
  },
]

export const DesktopIcons = forwardRef<DesktopIconsRef>((props, ref) => {
  const wm = useWindowManager()
  const [iconPositions, setIconPositions] = useState<{ [key: string]: { x: number; y: number } }>(() => (getCachedDesktop()?.icons || {}))
  const [draggingIcon, setDraggingIcon] = useState<string | null>(null)
  const [recycleBinCount, setRecycleBinCount] = useState(0)
  const [hasAutoArranged, setHasAutoArranged] = useState(false)
  const draggingIconRef = useRef<string | null>(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const dragFrameRef = useRef<number | null>(null)
  const pendingPositionRef = useRef<{ x: number; y: number } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const [showEmptyDialog, setShowEmptyDialog] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  
  const recycleBinHasFiles = recycleBinCount > 0

  // Check if recycle bin has files
  useEffect(() => {
    const checkRecycleBin = () => {
      const recycleBin = getCachedDesktop()?.recycleBin || []
      setRecycleBinCount(recycleBin.length)
    }
    checkRecycleBin()
    const interval = setInterval(checkRecycleBin, 1000)
    return () => clearInterval(interval)
  }, [])

  const { isAdmin } = useUser()

  const getIcons = (): DesktopIconDef[] => {
    const icons: DesktopIconDef[] = [...baseIcons]
    if (isAdmin) {
      icons.push({
        type: 'admin',
        name: 'Admin',
        icon: <AdminIcon size={50} />,
        x: 130,
        y: 420,
        defaultOpts: { title: 'Admin Console', width: 900, height: 600 }
      })
    }
    return icons
  }

  const autoArrange = () => {
    const newPositions: { [key: string]: { x: number; y: number } } = {}
    const COLUMN_WIDTH = 100
    const ROW_HEIGHT = 90
    const START_X = 20
    const START_Y = 20
    const TASKBAR_HEIGHT = 40
    
    // Calculate how many icons fit vertically in available space
    const availableHeight = window.innerHeight - TASKBAR_HEIGHT - START_Y
    const ICONS_PER_COLUMN = Math.floor(availableHeight / ROW_HEIGHT)

    getIcons().forEach((icon, idx) => {
      const iconKey = `${icon.type}-${idx}`
      const col = Math.floor(idx / ICONS_PER_COLUMN)
      const row = idx % ICONS_PER_COLUMN
      newPositions[iconKey] = {
        x: START_X + (col * COLUMN_WIDTH),
        y: START_Y + (row * ROW_HEIGHT)
      }
    })

    setIconPositions(newPositions)
  }

  useImperativeHandle(ref, () => ({
    autoArrange
  }))

  // Auto-arrange on first launch if no saved positions exist
  useEffect(() => {
    const hasServerIcons = !!getCachedDesktop()?.icons
    if (!hasServerIcons && !hasAutoArranged) {
      autoArrange()
      setHasAutoArranged(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Persist positions to server
    saveDesktopState({ icons: iconPositions }).catch(() => {})
  }, [iconPositions])

  const handleDoubleClick = (icon: DesktopIconDef) => {
    setContextMenu(null)
    wm.open(icon.type, icon.defaultOpts)
  }

  const handleIconContextMenu = (event: React.MouseEvent, icon: DesktopIconDef) => {
    event.preventDefault()
    event.stopPropagation()

    if (icon.type !== 'recycle') {
      return
    }

    const baseItems: MenuItem[] = [
      {
        label: 'Open',
        onClick: () => wm.open(icon.type, icon.defaultOpts)
      }
    ]

    if (recycleBinHasFiles) {
      baseItems.push({ divider: true })
      baseItems.push({
        label: `Empty Recycle Bin (${recycleBinCount} item${recycleBinCount === 1 ? '' : 's'})`,
        onClick: () => {
          setContextMenu(null)
          setDialogError(null)
          setShowEmptyDialog(true)
        }
      })
    }

    setContextMenu({ x: event.clientX, y: event.clientY, items: baseItems })
  }

  const emptyRecycleBin = async () => {
    const recycleBinMeta = [...(getCachedDesktop()?.recycleBin || [])]
    if (!recycleBinMeta.length) {
      setShowEmptyDialog(false)
      return
    }

    try {
      recycleBinMeta.forEach(file => {
        if (fs.exists(file.recyclePath)) {
          fs.remove(file.recyclePath)
        }
      })
    } catch (err) {
      setDialogError('Failed to empty recycle bin: ' + ((err as Error).message || 'Unknown error'))
      return
    }

    const cached = getCachedDesktop()
    if (cached) {
      cached.recycleBin = []
    }

    try {
      await saveDesktopState({ recycleBin: [] })
    } catch (err) {
      setDialogError('Failed to update recycle bin: ' + ((err as Error).message || 'Unknown error'))
      return
    }

    setRecycleBinCount(0)
    setDialogError(null)
    setShowEmptyDialog(false)
  }

  const flushPendingPosition = React.useCallback(() => {
    if (!draggingIconRef.current || !pendingPositionRef.current) {
      dragFrameRef.current = null
      return
    }
    const iconKey = draggingIconRef.current
    const nextPos = pendingPositionRef.current
    pendingPositionRef.current = null
    setIconPositions(prev => {
      const current = prev[iconKey]
      if (current && current.x === nextPos.x && current.y === nextPos.y) {
        return prev
      }
      return {
        ...prev,
        [iconKey]: nextPos
      }
    })
    dragFrameRef.current = null
  }, [])

  const schedulePositionUpdate = React.useCallback(() => {
    if (dragFrameRef.current !== null) return
    dragFrameRef.current = window.requestAnimationFrame(flushPendingPosition)
  }, [flushPendingPosition])

  const handlePointerDown = (e: React.PointerEvent, icon: DesktopIconDef, idx: number) => {
    setContextMenu(null)
    if (e.detail === 2) return
    if (e.button !== 0 && e.pointerType !== 'touch') return

    e.stopPropagation()
    e.preventDefault()
    const iconKey = `${icon.type}-${idx}`
    const currentPos = iconPositions[iconKey] || { x: icon.x, y: icon.y }

    draggingIconRef.current = iconKey
    setDraggingIcon(iconKey)
    dragOffsetRef.current = {
      x: e.clientX - currentPos.x,
      y: e.clientY - currentPos.y
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  useEffect(() => {
    if (!draggingIcon) return

    const handlePointerMove = (e: PointerEvent) => {
      if (!draggingIconRef.current) return
      const next = {
        x: Math.max(0, e.clientX - dragOffsetRef.current.x),
        y: Math.max(0, e.clientY - dragOffsetRef.current.y)
      }
      pendingPositionRef.current = next
      schedulePositionUpdate()
    }

    const handlePointerUp = () => {
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current)
        dragFrameRef.current = null
      }
      flushPendingPosition()
      draggingIconRef.current = null
      setDraggingIcon(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current)
        dragFrameRef.current = null
      }
    }
  }, [draggingIcon, schedulePositionUpdate, flushPendingPosition])

  return (
    <div className="desktop-icons">
      {getIcons().map((icon, idx) => {
          const iconKey = `${icon.type}-${idx}`
          const pos = iconPositions[iconKey] || { x: icon.x, y: icon.y }
          return (
            <div
              key={idx}
              className={`desktop-icon ${draggingIcon === iconKey ? 'dragging' : ''}`}
              style={{ left: pos.x, top: pos.y }}
              onPointerDown={(e) => handlePointerDown(e, icon, idx)}
              onDoubleClick={() => handleDoubleClick(icon)}
              onContextMenu={(e) => handleIconContextMenu(e, icon)}
              title={`Double-click to open ${icon.name}`}
            >
              <div 
                className="icon-image"
                style={icon.type === 'recycle' && recycleBinHasFiles ? { filter: 'sepia(1) saturate(3) hue-rotate(10deg) brightness(1.1)' } : {}}
              >
                {icon.icon}
              </div>
              <div className="icon-label">{icon.name}</div>
            </div>
          )
        })}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
      {showEmptyDialog && (
        <DesktopDialog
          title="Empty Recycle Bin?"
          message={`Delete all items (${recycleBinCount} total) from the Recycle Bin? This cannot be undone.`}
          submitLabel="Empty Bin"
          cancelLabel="Cancel"
          onSubmit={() => { void emptyRecycleBin() }}
          onCancel={() => { setShowEmptyDialog(false); setDialogError(null) }}
          error={dialogError}
        />
      )}
    </div>
  )
})
