import React, { createContext, useContext, useState, useCallback } from 'react'

import { sounds } from './SoundEffects'
import { saveDesktopState, getCachedDesktop } from '../services/saveService'

export type WindowType = 'terminal' | 'explorer' | 'notepad' | 'browser' | 'recycle' | 'email' | 'chat' | 'music' | 'settings' | 'store' | 'profile' | 'usermgmt' | 'adminpanel' | 'modular' | 'modular-plugin'

export interface WindowInstance {
  id: string
  type: WindowType
  title: string
  x: number
  y: number
  width: number
  height: number
  z: number
  focused: boolean
  minimized: boolean
  maximized: boolean
  isMinimizing?: boolean
  prevBounds?: { x: number; y: number; width: number; height: number }
  payload?: Record<string, unknown>
}

interface WMContextValue {
  windows: WindowInstance[]
  open: (type: WindowType, opts?: Partial<WindowInstance>) => void
  close: (id: string) => void
  focus: (id: string) => void
  move: (id: string, x: number, y: number) => void
  resize: (id: string, w: number, h: number) => void
  minimize: (id: string) => void
  maximize: (id: string) => void
  restore: (id: string) => void
  /** Persist current bounds of a window to memory/localStorage. Call on drag/resize end. */
  commitBounds: (id: string) => void
}

const WindowManagerContext = createContext<WMContextValue | undefined>(undefined)

let zCounter = 100

interface WindowMemory {
  [key: string]: { x: number; y: number; width: number; height: number }
}

const loadWindowMemory = (): WindowMemory => {
  try {
    return getCachedDesktop()?.windowMemory || {}
  } catch { /* ignore: unable to read cached desktop */ return {} }
}

const saveWindowMemory = (type: WindowType, bounds: { x: number; y: number; width: number; height: number }) => {
  try {
    const current = loadWindowMemory()
    const memory: WindowMemory = { ...current, [type]: bounds }
    // Sync to server (auth required); silently ignore errors
    saveDesktopState({ windowMemory: memory }).catch(() => {})
  } catch { /* ignore: save memory failed */ }
}

export const WindowManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [windows, setWindows] = useState<WindowInstance[]>([])

  const open = useCallback((type: WindowType, opts?: Partial<WindowInstance>) => {
    sounds.windowOpen()
    setWindows(prev => {
      const requestedPluginId = type === 'modular-plugin' ? (opts?.payload as any)?.pluginId : undefined
      const existing = prev.find(w => {
        if (type === 'modular-plugin' && requestedPluginId) {
          return w.type === type && (w.payload as any)?.pluginId === requestedPluginId
        }
        return w.type === type
      })
      if (existing) {
        // Focus and restore existing window instead of opening new one
        return prev.map(w => {
          if (w.id === existing.id) {
            const nextPayload = opts?.payload ? { ...w.payload, ...opts.payload } : w.payload
            return { ...w, focused: true, minimized: false, z: ++zCounter, payload: nextPayload }
          }
          return { ...w, focused: false }
        })
      }
      
      const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`
      const memory = loadWindowMemory()
      const saved = memory[type]
      const screenW = window.innerWidth
      const screenH = window.innerHeight
      const taskbarH = 40
      const maxW = Math.max(300, screenW)
      const maxH = Math.max(240, screenH - taskbarH)
      
      const w: WindowInstance = {
        id,
        type,
        title: opts?.title || type.toUpperCase(),
        x: opts?.x ?? saved?.x ?? 40 + prev.length * 30,
        y: opts?.y ?? saved?.y ?? 40 + prev.length * 20,
        width: Math.min(opts?.width ?? saved?.width ?? 420, maxW),
        height: Math.min(opts?.height ?? saved?.height ?? 300, maxH),
        z: ++zCounter,
        focused: true,
        minimized: false,
        maximized: false,
        payload: opts?.payload || {}
      }
      // Ensure window is not positioned off-screen after clamping
      w.x = Math.max(0, Math.min(w.x, screenW - 100))
      w.y = Math.max(0, Math.min(w.y, screenH - taskbarH - 80))
      return prev
        .map(wi => ({ ...wi, focused: false }))
        .concat(w)
    })
  }, [])

  const close = useCallback((id: string) => {
    sounds.windowClose()
    setWindows(prev => prev.filter(w => w.id !== id))
  }, [])

  const focus = useCallback((id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, focused: true, z: ++zCounter } : { ...w, focused: false }))
  }, [])

  const move = useCallback((id: string, x: number, y: number) => {
    setWindows(prev => prev.map(w => {
      if (w.id === id) {
        return { ...w, x, y }
      }
      return w
    }))
  }, [])

  const resize = useCallback((id: string, width: number, height: number) => {
    setWindows(prev => prev.map(w => {
      if (w.id === id) {
        const maxW = window.innerWidth
        const maxH = window.innerHeight - 40
        const newW = Math.min(Math.max(300, width), maxW)
        const newH = Math.min(Math.max(240, height), maxH)
        saveWindowMemory(w.type, { x: w.x, y: w.y, width: newW, height: newH })
        return { ...w, width: newW, height: newH }
      }
      return w
    }))
  }, [])

  const minimize = useCallback((id: string) => {
    sounds.minimize()
    setWindows(prev => prev.map(w => w.id === id ? { ...w, minimized: true, focused: false } : w))
  }, [])

  const maximize = useCallback((id: string) => {
    sounds.maximize()
    setWindows(prev => prev.map(w => {
      if (w.id === id) {
        if (w.maximized) {
          // Restore from maximized
          return { ...w, maximized: false, ...(w.prevBounds || {}) }
        } else {
          // Maximize
          return {
            ...w,
            maximized: true,
            prevBounds: { x: w.x, y: w.y, width: w.width, height: w.height },
            x: 0,
            y: 0,
            width: window.innerWidth,
            height: window.innerHeight - 40 // Reserve space for taskbar
          }
        }
      }
      return w
    }))
  }, [])

  const restore = useCallback((id: string) => {
    setWindows(prev => prev.map(w => {
      if (w.id === id && w.minimized) {
        return { ...w, minimized: false, focused: true, z: ++zCounter }
      }
      return { ...w, focused: false }
    }))
  }, [])

  const commitBounds = useCallback((id: string) => {
    try {
      const w = windows.find(w => w.id === id)
      if (w) {
        saveWindowMemory(w.type, { x: w.x, y: w.y, width: w.width, height: w.height })
      }
    } catch { /* ignore */ }
  }, [windows])

  return (
    <WindowManagerContext.Provider value={{ windows, open, close, focus, move, resize, minimize, maximize, restore, commitBounds }}>
      {children}
    </WindowManagerContext.Provider>
  )
}

export function useWindowManager(): WMContextValue {
  const ctx = useContext(WindowManagerContext)
  if (!ctx) throw new Error('useWindowManager must be used inside WindowManagerProvider')
  return ctx
}
