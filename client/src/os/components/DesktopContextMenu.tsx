import React, { useState, useRef, useEffect } from 'react'

import { ContextMenu } from './ContextMenu'
import { RefreshIcon, ArrangeIcon, SettingsIcon, VolumeIcon, VolumeOffIcon, InfoIcon, ResetIcon } from './Icons'
import { useContextMenuPosition } from '../hooks/useContextMenuPosition'
import { sounds } from '../SoundEffects'
import { useWindowManager } from '../WindowManager'
import './DesktopContextMenu.css'

interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
  onRefresh?: () => void
  onAutoArrange?: () => void
}

export const DesktopContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, onRefresh, onAutoArrange }) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const wm = useWindowManager()
  const [soundsEnabled, setSoundsEnabled] = useState(sounds.isEnabled())
  const { ref: _posRef, pos: position } = useContextMenuPosition(x, y)

  useEffect(() => { /* positioning handled by hook */ }, [x, y])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  const handleRefresh = () => {
    onRefresh?.()
    onClose()
  }

  const handleOpenSettings = () => {
  wm.open('settings', { title: 'System Settings', width: 1200, height: 800 })
    sounds.click()
    onClose()
  }

  const handleToggleSounds = () => {
    const newState = sounds.toggle()
    setSoundsEnabled(newState)
    if (newState) sounds.click()
    onClose()
  }

  const handleResetWindowSizes = () => {
    try {
      localStorage.removeItem('windowMemory')
      sounds.click()
  } catch { /* ignore */ }
    onClose()
  }

  const handleAbout = () => {
    wm.open('settings', { title: 'System Settings', width: 1200, height: 800, payload: { tab: 'about' } })
    sounds.click()
    onClose()
  }

  return (
    <>
      <ContextMenu
        x={position.left}
        y={position.top}
        onClose={onClose}
        items={[
          { label: 'Refresh', icon: <RefreshIcon size={14}/>, hint: 'F5', onClick: handleRefresh },
          { label: 'Auto Arrange Icons', icon: <ArrangeIcon size={14}/>, onClick: onAutoArrange },
          { divider: true },
          { label: 'System Settings', icon: <SettingsIcon size={14}/>, onClick: handleOpenSettings },
          { label: 'Sound Effects', icon: soundsEnabled ? <VolumeIcon size={14}/> : <VolumeOffIcon size={14}/>, hint: soundsEnabled ? 'ON' : 'OFF', onClick: handleToggleSounds },
          { divider: true },
          { label: 'About', icon: <InfoIcon size={14}/>, onClick: handleAbout },
          { label: 'Reset Window Sizes', icon: <ResetIcon size={14}/>, onClick: handleResetWindowSizes },
        ]}
      />
    </>
  )
}

interface DesktopContainerProps {
  children: React.ReactNode
  onAutoArrange?: () => void
}

export const DesktopContainer: React.FC<DesktopContainerProps> = ({ children, onAutoArrange }) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  // Note: Avoid global suppression to prevent interference; handle on container only
  const longPressTimer = useRef<number | null>(null)
  const touchStartPos = useRef<{x:number;y:number} | null>(null)

  const handleContextMenu = (e: React.MouseEvent) => {
    // Only block when interacting directly with window content; allow desktop + taskbar
    const target = e.target as HTMLElement
    if (target.closest('.window-frame') || target.closest('.context-menu') || target.closest('.about-modal')) return
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  // Keyboard accessibility: Shift+F10 or ContextMenu key opens menu centered
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
      e.preventDefault()
      const rect = e.currentTarget.getBoundingClientRect()
      setContextMenu({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    } else if (e.key === 'Escape' && contextMenu) {
      setContextMenu(null)
    }
  }

  // Touch long-press (600ms) opens context menu
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return
    const target = e.target as HTMLElement
    if (target.closest('.window-frame') || target.closest('.context-menu') || target.closest('.about-modal')) return
    touchStartPos.current = { x: e.clientX, y: e.clientY }
    longPressTimer.current = window.setTimeout(() => {
      setContextMenu({ x: touchStartPos.current!.x, y: touchStartPos.current!.y })
    }, 600)
  }
  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    touchStartPos.current = null
  }
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!touchStartPos.current) return
    // cancel if moved more than threshold (10px)
    if (Math.abs(e.clientX - touchStartPos.current.x) > 10 || Math.abs(e.clientY - touchStartPos.current.y) > 10) {
      clearLongPress()
    }
  }

  useEffect(() => {
    const handleBlur = () => setContextMenu(null)
    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [])

  const handleRefresh = () => {
    // Trigger a visual refresh effect
    const desktop = document.querySelector('.desktop-bg')
    if (desktop) {
      desktop.classList.add('refreshing')
      setTimeout(() => desktop.classList.remove('refreshing'), 500)
    }
  }

  const handleAutoArrange = () => {
    onAutoArrange?.()
    setContextMenu(null)
  }

  return (
    <div
      className="desktop-container"
      tabIndex={0}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
      onPointerLeave={clearLongPress}
      onPointerMove={handlePointerMove}
      aria-label="Desktop area"
    >
      {children}
      {contextMenu && (
        <DesktopContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onRefresh={handleRefresh}
          onAutoArrange={handleAutoArrange}
        />
      )}
    </div>
  )
}
