import React, { createContext, useContext, useState, useCallback } from 'react'
import { saveDesktopState, getCachedDesktop } from '../services/saveService'

export interface Notification {
  id: string
  title: string
  message: string
  timestamp: Date
  read: boolean
  type?: 'info' | 'warning' | 'error' | 'success'
}

interface NotificationContextValue {
  notifications: Notification[]
  addNotification: (title: string, message: string, type?: Notification['type']) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearNotification: (id: string) => void
  clearAll: () => void
  unreadCount: number
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined)

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try {
      const saved = getCachedDesktop()?.notifications
      if (saved) {
        return saved.map((n: any) => ({ ...n, timestamp: new Date(n.timestamp) }))
      }
    } catch {}
    return []
  })

  // Persist to server whenever notifications change
  React.useEffect(() => {
    const serializable = notifications.map(n => ({ ...n, timestamp: n.timestamp.toISOString() }))
    saveDesktopState({ notifications: serializable }).catch(() => {})
  }, [notifications])

  const addNotification = useCallback((title: string, message: string, type: Notification['type'] = 'info') => {
    const notification: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      message,
      timestamp: new Date(),
      read: false,
      type
    }
    setNotifications(prev => [notification, ...prev])
  }, [])

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      markAsRead,
      markAllAsRead,
      clearNotification,
      clearAll,
      unreadCount
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider')
  return ctx
}
