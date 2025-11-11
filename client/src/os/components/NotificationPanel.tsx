import React, { useState, useRef, useEffect } from 'react'
import { useNotifications } from '../NotificationContext'
import './NotificationPanel.css'

interface NotificationPanelProps {
  onClose: () => void
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ onClose }) => {
  const { notifications, markAsRead, markAllAsRead, clearNotification, clearAll } = useNotifications()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'success': return '✓'
      case 'warning': return '⚠'
      case 'error': return '✗'
      default: return 'ℹ'
    }
  }

  return (
    <div ref={panelRef} className="notification-panel">
      <div className="notification-header">
        <div className="notification-title">Notifications</div>
        <div className="notification-actions">
          {notifications.length > 0 && (
            <>
              <button className="notif-btn" onClick={markAllAsRead} title="Mark all as read">
                ✓
              </button>
              <button className="notif-btn" onClick={clearAll} title="Clear all">
                [X]
              </button>
            </>
          )}
          <button className="notif-btn close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
      </div>
      <div className="notification-list">
        {notifications.length === 0 ? (
          <div className="notification-empty">No notifications</div>
        ) : (
          notifications.map(notif => (
            <div 
              key={notif.id} 
              className={`notification-item ${notif.read ? 'read' : 'unread'} ${notif.type || 'info'}`}
              onClick={() => markAsRead(notif.id)}
            >
              <div className="notif-icon">{getTypeIcon(notif.type)}</div>
              <div className="notif-content">
                <div className="notif-item-title">{notif.title}</div>
                <div className="notif-message">{notif.message}</div>
                <div className="notif-time">{formatTime(notif.timestamp)}</div>
              </div>
              <button 
                className="notif-close" 
                onClick={(e) => { e.stopPropagation(); clearNotification(notif.id); }}
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
