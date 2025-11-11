import React, { useRef, useState } from 'react'

import { WindowInstance, useWindowManager } from '../WindowManager'
import './WindowFrame.css'

interface Props { win: WindowInstance; children: React.ReactNode }

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null

export const WindowFrame: React.FC<Props> = ({ win, children }) => {
  const { focus, close, move, resize, minimize, maximize, commitBounds } = useWindowManager()
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null)
  const resizeRef = useRef<{ dir: ResizeDirection; startX: number; startY: number; startW: number; startH: number; startPosX: number; startPosY: number } | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const rafIdRef = useRef<number | null>(null)
  const pendingPosRef = useRef<{ x: number; y: number } | null>(null)

  const onMouseDown = (e: React.MouseEvent) => {
    if (win.maximized) return // Don't allow drag when maximized
    focus(win.id)
    dragRef.current = { offsetX: e.clientX - win.x, offsetY: e.clientY - win.y }
    setIsDragging(true)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const onMove = (e: MouseEvent) => {
    if (!dragRef.current) return
    const nextX = e.clientX - dragRef.current.offsetX
    const nextY = e.clientY - dragRef.current.offsetY
    pendingPosRef.current = { x: nextX, y: nextY }
    if (rafIdRef.current == null) {
      rafIdRef.current = window.requestAnimationFrame(() => {
        if (pendingPosRef.current) {
          move(win.id, pendingPosRef.current.x, pendingPosRef.current.y)
        }
        pendingPosRef.current = null
        if (rafIdRef.current) {
          window.cancelAnimationFrame(rafIdRef.current)
        }
        rafIdRef.current = null
      })
    }
  }

  const onUp = () => {
    dragRef.current = null
    setIsDragging(false)
    if (rafIdRef.current) {
      window.cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    // Persist final bounds after drag completes
    commitBounds(win.id)
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }

  const startResize = (dir: ResizeDirection, e: React.MouseEvent) => {
    e.stopPropagation()
    focus(win.id)
    setIsResizing(true)
    resizeRef.current = {
      dir,
      startX: e.clientX,
      startY: e.clientY,
      startW: win.width,
      startH: win.height,
      startPosX: win.x,
      startPosY: win.y
    }
    window.addEventListener('mousemove', onResize)
    window.addEventListener('mouseup', onResizeEnd)
  }

  const onResize = (e: MouseEvent) => {
    if (!resizeRef.current) return
    const { dir, startX, startY, startW, startH, startPosX, startPosY } = resizeRef.current
    const dx = e.clientX - startX
    const dy = e.clientY - startY

    let newW = startW
    let newH = startH
    let newX = startPosX
    let newY = startPosY

    if (dir?.includes('e')) newW = Math.max(200, startW + dx)
    if (dir?.includes('w')) {
      newW = Math.max(200, startW - dx)
      newX = startPosX + (startW - newW)
    }
    if (dir?.includes('s')) newH = Math.max(150, startH + dy)
    if (dir?.includes('n')) {
      newH = Math.max(150, startH - dy)
      newY = startPosY + (startH - newH)
    }

    if (newX !== startPosX || newY !== startPosY) move(win.id, newX, newY)
    resize(win.id, newW, newH)
  }

  const onResizeEnd = () => {
    setIsResizing(false)
    resizeRef.current = null
    // Persist bounds after resize ends
    commitBounds(win.id)
    window.removeEventListener('mousemove', onResize)
    window.removeEventListener('mouseup', onResizeEnd)
  }

  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation()
    minimize(win.id)
  }

  // Do not unmount when minimized; keep mounted but hidden so apps can persist (e.g., music playback)

  return (
    <div
      className={`window-frame ${win.focused ? 'focused' : ''} ${win.maximized ? 'maximized' : ''} ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''} ${win.minimized ? 'minimized' : ''}`}
      style={{
        left: win.x,
        top: win.y,
        width: win.width,
        height: win.height,
        zIndex: win.z,
        display: win.minimized ? 'none' : undefined
      }}
      onMouseDown={() => focus(win.id)}
    >
      {/* Resize handles */}
      {!win.maximized && (
        <>
          <div className="resize-handle resize-n" onMouseDown={(e) => startResize('n', e)} />
          <div className="resize-handle resize-s" onMouseDown={(e) => startResize('s', e)} />
          <div className="resize-handle resize-e" onMouseDown={(e) => startResize('e', e)} />
          <div className="resize-handle resize-w" onMouseDown={(e) => startResize('w', e)} />
          <div className="resize-handle resize-ne" onMouseDown={(e) => startResize('ne', e)} />
          <div className="resize-handle resize-nw" onMouseDown={(e) => startResize('nw', e)} />
          <div className="resize-handle resize-se" onMouseDown={(e) => startResize('se', e)} />
          <div className="resize-handle resize-sw" onMouseDown={(e) => startResize('sw', e)} />
        </>
      )}

      {/* Title bar */}
      <div className="window-titlebar" onMouseDown={onMouseDown} onDoubleClick={() => maximize(win.id)}>
        <span className="window-title">{win.title}</span>
        <div className="window-controls">
          <button className="window-btn minimize-btn" onClick={handleMinimize} title="Minimize">−</button>
          <button className="window-btn maximize-btn" onClick={(e) => { e.stopPropagation(); maximize(win.id) }} title={win.maximized ? "Restore" : "Maximize"}>
            {win.maximized ? '⧉' : '□'}
          </button>
          <button className="window-btn close-btn" onClick={(e) => { e.stopPropagation(); close(win.id) }} title="Close">×</button>
        </div>
      </div>

      {/* Content */}
      <div className="window-content">
        {children}
      </div>
    </div>
  )
}
