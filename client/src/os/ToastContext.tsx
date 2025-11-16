import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

import './components/ToastViewport.css'

export type ToastKind = 'info' | 'success' | 'warning' | 'error'

export interface ToastOptions {
  title?: string
  message: string
  kind?: ToastKind
  /** How long the toast should stay visible (ms). Pass 0 to make it sticky until dismissed. */
  durationMs?: number
  /** Collapses duplicate toasts. New content replaces the previous toast with the same key. */
  dedupeKey?: string
  action?: { label: string; onClick: () => void }
}

interface ToastEntry extends ToastOptions {
  id: string
  kind: ToastKind
  createdAt: number
  durationMs: number
}

interface ToastContextValue {
  push: (opts: ToastOptions) => string
  dismiss: (id: string) => void
  dismissAll: () => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const timersRef = useRef<Record<string, number>>({})
  const dedupeRef = useRef<Map<string, string>>(new Map())

  const clearTimer = useCallback((id: string) => {
    const timer = timersRef.current[id]
    if (timer) {
      try { clearTimeout(timer) } catch { /* noop */ }
      delete timersRef.current[id]
    }
  }, [])

  const dismiss = useCallback((id: string) => {
    clearTimer(id)
    setToasts(prev => prev.filter(t => t.id !== id))
    for (const [key, value] of dedupeRef.current.entries()) {
      if (value === id) {
        dedupeRef.current.delete(key)
        break
      }
    }
  }, [clearTimer])

  const scheduleDismiss = useCallback((id: string, durationMs: number) => {
    if (durationMs <= 0) return
    clearTimer(id)
    timersRef.current[id] = window.setTimeout(() => dismiss(id), durationMs)
  }, [clearTimer, dismiss])

  const push = useCallback((opts: ToastOptions) => {
    const { dedupeKey } = opts
    const duration = opts.durationMs ?? 4200
    if (dedupeKey) {
      const existing = dedupeRef.current.get(dedupeKey)
      if (existing) {
        setToasts(prev => prev.map(t => t.id === existing ? {
          ...t,
          title: opts.title ?? t.title,
          message: opts.message,
          kind: opts.kind ?? t.kind,
          action: opts.action,
          createdAt: Date.now(),
          durationMs: duration
        } : t))
        scheduleDismiss(existing, duration)
        return existing
      }
    }

    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const entry: ToastEntry = {
      id,
      title: opts.title ?? '',
      message: opts.message,
      kind: opts.kind ?? 'info',
      createdAt: Date.now(),
      durationMs: duration,
      action: opts.action
    }
    setToasts(prev => [entry, ...prev])
    if (dedupeKey) {
      dedupeRef.current.set(dedupeKey, id)
    }
    scheduleDismiss(id, duration)
    return id
  }, [scheduleDismiss])

  const dismissAll = useCallback(() => {
    Object.keys(timersRef.current).forEach(id => clearTimer(id))
    timersRef.current = {}
    dedupeRef.current.clear()
    setToasts([])
  }, [clearTimer])

  // Ensure timers are cleaned up if provider unmounts
  React.useEffect(() => () => {
    dismissAll()
  }, [dismissAll])

  const value = useMemo(() => ({ push, dismiss, dismissAll }), [push, dismiss, dismissAll])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.kind}`} role="status">
            <div className="toast-body">
              <div className="toast-copy">
                {toast.title && <strong>{toast.title}</strong>}
                <span>{toast.message}</span>
              </div>
              {toast.action && (
                <button className="toast-action" onClick={() => {
                  try { toast.action?.onClick() } catch { /* ignore */ }
                  dismiss(toast.id)
                }}>
                  {toast.action.label}
                </button>
              )}
              <button className="toast-dismiss" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification">×</button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToasts(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToasts must be used within a ToastProvider')
  }
  return ctx
}
