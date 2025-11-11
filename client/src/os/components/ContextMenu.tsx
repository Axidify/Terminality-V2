import React, { useEffect, useMemo, useRef, useState } from 'react'

import { ContextMenuPortal } from './ContextMenuPortal'
import { useContextMenuPosition } from '../hooks/useContextMenuPosition'

export interface MenuItem {
  id?: string
  label?: string
  icon?: React.ReactNode
  hint?: string
  disabled?: boolean
  divider?: boolean
  onClick?: () => void
}

interface ContextMenuProps {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
  minWidth?: number
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose, minWidth = 180 }) => {
  const { ref: menuRef, pos } = useContextMenuPosition(x, y)
  const [focusIndex, setFocusIndex] = useState<number>(-1)
  const [hoverIndex, setHoverIndex] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const focusables = useMemo(() => items
    .map((it, idx) => ({ ...it, __idx: idx }))
    .filter(it => !it.divider && !it.disabled), [items])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return
      onClose()
    }

    const handleContextMenu = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return
      onClose()
    }

    const timer = window.setTimeout(() => {
      window.addEventListener('pointerdown', handlePointerDown)
      window.addEventListener('contextmenu', handleContextMenu)
    }, 0)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [onClose])

  useEffect(() => {
    // Set initial focus to -1 so no item is highlighted until keyboard navigation
    setFocusIndex(-1)
    containerRef.current?.focus()
  }, [])

  const moveFocus = (dir: 1 | -1) => {
    if (!focusables.length) return
    const current = focusables.findIndex(it => it.__idx === focusIndex)
    const next = (current + dir + focusables.length) % focusables.length
    setFocusIndex(focusables[next].__idx as number)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
    if (e.key === 'ArrowDown') { 
      e.preventDefault()
      if (focusIndex === -1 && focusables.length > 0) {
        setFocusIndex(focusables[0].__idx as number)
      } else {
        moveFocus(1)
      }
      return
    }
    if (e.key === 'ArrowUp') { 
      e.preventDefault()
      if (focusIndex === -1 && focusables.length > 0) {
        setFocusIndex(focusables[focusables.length - 1].__idx as number)
      } else {
        moveFocus(-1)
      }
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[focusIndex]
      if (item && !item.disabled && !item.divider) {
        item.onClick?.()
        onClose()
      }
    }
  }

  return (
    <ContextMenuPortal>
      <div
        ref={(el) => { (menuRef as any).current = el; containerRef.current = el }}
        className="context-menu"
        style={{ 
          position: 'fixed', 
          left: pos.left, 
          top: pos.top, 
          minWidth,
          background: 'var(--color-surface)',
          border: '2px solid var(--color-border)',
          boxShadow: `0 0 20px var(--color-shadow), inset 0 0 2px var(--color-glow)`,
          padding: '4px 0',
          zIndex: 1000001
        }}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
        role="menu"
        aria-label="Context menu"
      >
        {items.map((item, idx) => item.divider ? (
          <div key={`sep-${idx}`} style={{
            height: '1px',
            background: 'var(--color-border)',
            margin: '4px 8px',
            opacity: 0.5
          }} />
        ) : (
          <div
            key={item.id || `item-${idx}`}
            className="context-menu-item"
            onClick={() => { if (!item.disabled) { item.onClick?.(); onClose() } }}
            onMouseEnter={() => !item.disabled && setHoverIndex(idx)}
            onMouseLeave={() => setHoverIndex(-1)}
            role="menuitem"
            aria-disabled={item.disabled}
            data-focused={idx === focusIndex}
            data-disabled={item.disabled ? 'true' : 'false'}
            style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 16px',
              fontSize: '14px',
              color: item.disabled ? 'var(--color-textDim)' : 'var(--color-text)',
              opacity: item.disabled ? 0.4 : 1,
              cursor: item.disabled ? 'not-allowed' : 'pointer',
              background: (idx === focusIndex || idx === hoverIndex) && !item.disabled ? 'var(--color-background)' : 'transparent',
              boxShadow: (idx === focusIndex || idx === hoverIndex) && !item.disabled 
                ? `inset 0 0 12px rgba(var(--color-primary-rgb), 0.2), 0 0 12px rgba(var(--color-primary-rgb), 0.3)` 
                : 'none',
              textShadow: (idx === focusIndex || idx === hoverIndex) && !item.disabled ? '0 0 10px rgba(var(--color-primary-rgb), 0.5)' : 'none',
              transition: 'all 0.15s',
              outline: 'none'
            }}
          >
            {item.icon && <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px' }}>{item.icon}</span>}
            <span style={{ flex: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
            {item.hint && <span style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.6, letterSpacing: '0.5px', fontFamily: 'monospace' }}>{item.hint}</span>}
          </div>
        ))}
      </div>
    </ContextMenuPortal>
  )
}
