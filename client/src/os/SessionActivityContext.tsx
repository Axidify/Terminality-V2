import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react'

import { useToasts } from './ToastContext'
import { useUser } from './UserContext'
import { useWindowManager } from './WindowManager'

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
  const lastActivityRef = useRef<number>(Date.now())
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
  }, [dismiss])

  const handleTimeout = useCallback(() => {
    if (timedOutRef.current) return
    timedOutRef.current = true
    wm.clearAll()
    logout()
    try {
      window.dispatchEvent(new CustomEvent('sessionExpired', { detail: { reason: 'inactivity' } }))
    } catch { /* ignore */ }
  }, [logout, wm])

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
    events.forEach(evt => {
      window.addEventListener(evt, activityHandler as EventListener, evt === 'touchstart' ? { passive: true } : undefined)
    })
    window.addEventListener('session-activity', activityHandler as EventListener)

    return () => {
      events.forEach(evt => {
        window.removeEventListener(evt, activityHandler as EventListener)
      })
      window.removeEventListener('session-activity', activityHandler as EventListener)
    }
  }, [user, reportActivity, dismiss])

  React.useEffect(() => {
    if (!user) return undefined
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
