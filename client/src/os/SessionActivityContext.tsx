import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react'

import { useToasts } from './ToastContext'
import { useUser } from './UserContext'
import { useWindowManager } from './WindowManager'

const ACTIVITY_STORAGE_KEY = 'terminality:last-activity'
export const SESSION_ACTIVITY_EVENT = 'session-activity' as const

const readStoredActivity = (): number | null => {
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY)
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

const writeStoredActivity = (timestamp: number) => {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, String(timestamp))
  } catch {
    /* ignore */
  }
}

const clearStoredActivity = () => {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    localStorage.removeItem(ACTIVITY_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export const signalSessionActivity = (reason?: string) => {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(SESSION_ACTIVITY_EVENT, { detail: { reason } }))
  } catch {
    /* ignore */
  }
}

interface SessionActivityContextValue {
  reportActivity: () => void
  timeoutMs: number
}

const SessionActivityContext = createContext<SessionActivityContextValue | undefined>(undefined)

interface SessionActivityProviderProps {
  timeoutMs?: number
  warningLeadMs?: number
  children: React.ReactNode
}

export const SessionActivityProvider: React.FC<SessionActivityProviderProps> = ({
  children,
  timeoutMs = 20 * 60 * 1000,
  warningLeadMs = 60 * 1000
}) => {
  const { user, logout } = useUser()
  const wm = useWindowManager()
  const { push, dismiss } = useToasts()
  const lastActivityRef = useRef<number>(typeof window !== 'undefined' ? (readStoredActivity() ?? Date.now()) : Date.now())
  const warningToastRef = useRef<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const timedOutRef = useRef(false)

  const reportActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    timedOutRef.current = false
    if (warningToastRef.current) {
      dismiss(warningToastRef.current)
      warningToastRef.current = null
    }
    writeStoredActivity(lastActivityRef.current)
  }, [dismiss])

  const handleTimeout = useCallback(() => {
    if (timedOutRef.current) return
    timedOutRef.current = true
    wm.clearAll()
    clearStoredActivity()
    logout()
    try {
      window.dispatchEvent(new CustomEvent('sessionExpired', { detail: { reason: 'inactivity' } }))
    } catch { /* ignore */ }
  }, [logout, wm])

  React.useEffect(() => {
    if (!user) {
      clearStoredActivity()
      return
    }
    const stored = typeof window !== 'undefined' ? readStoredActivity() : null
    if (stored) {
      lastActivityRef.current = stored
      if (Date.now() - stored >= timeoutMs) {
        handleTimeout()
        return
      }
    } else {
      writeStoredActivity(lastActivityRef.current)
    }
  }, [user, timeoutMs, handleTimeout])

  React.useEffect(() => {
    if (!user) {
      if (warningToastRef.current) {
        dismiss(warningToastRef.current)
        warningToastRef.current = null
      }
      return
    }

    reportActivity()
    const activityHandler = () => reportActivity()
    const events: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'focus']
    if (typeof window === 'undefined') {
      return () => {}
    }
    events.forEach(evt => {
      window.addEventListener(evt, activityHandler as EventListener, evt === 'touchstart' ? { passive: true } : undefined)
    })
    window.addEventListener(SESSION_ACTIVITY_EVENT, activityHandler as EventListener)

    return () => {
      events.forEach(evt => {
        window.removeEventListener(evt, activityHandler as EventListener)
      })
      window.removeEventListener(SESSION_ACTIVITY_EVENT, activityHandler as EventListener)
    }
  }, [user, reportActivity, dismiss])

  React.useEffect(() => {
    if (!user || typeof document === 'undefined') return undefined
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        reportActivity()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [user, reportActivity])

  React.useEffect(() => {
    if (!user || typeof window === 'undefined') return undefined
    timerRef.current = window.setInterval(() => {
      const now = Date.now()
      const elapsed = now - lastActivityRef.current
      if (
        warningLeadMs > 0 &&
        elapsed >= timeoutMs - warningLeadMs &&
        elapsed < timeoutMs &&
        !warningToastRef.current
      ) {
        warningToastRef.current = push({
          title: 'Session Timeout',
          message: 'Your Terminality OS session will time out soon due to inactivity.',
          kind: 'warning',
          durationMs: 0,
          dedupeKey: 'session-timeout-warning',
          action: {
            label: 'Stay Logged In',
            onClick: () => reportActivity()
          }
        })
      }
      if (elapsed >= timeoutMs) {
        if (warningToastRef.current) {
          dismiss(warningToastRef.current)
          warningToastRef.current = null
        }
        handleTimeout()
      }
    }, 1000) as unknown as number

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current as unknown as number)
        timerRef.current = null
      }
    }
  }, [user, timeoutMs, warningLeadMs, push, dismiss, reportActivity, handleTimeout])

  const value = useMemo(() => ({ reportActivity, timeoutMs }), [reportActivity, timeoutMs])

  return (
    <SessionActivityContext.Provider value={value}>
      {children}
    </SessionActivityContext.Provider>
  )
}

export function useSessionActivity(): SessionActivityContextValue {
  const ctx = useContext(SessionActivityContext)
  if (!ctx) {
    throw new Error('useSessionActivity must be used inside SessionActivityProvider')
  }
  return ctx
}
