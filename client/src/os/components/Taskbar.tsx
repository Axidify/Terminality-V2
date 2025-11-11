import React, { useState, useRef, useEffect } from 'react'
import { useWindowManager, WindowType } from '../WindowManager'
import { useNotifications } from '../NotificationContext'
import { NotificationPanel } from './NotificationPanel'
import { TerminalIcon, FolderIcon, NotepadIcon, BrowserIcon, RecycleBinIcon, MailIcon, MusicIcon, SettingsIcon, ChatIcon, StoreIcon } from './Icons'
import './Taskbar.css'

interface AppDefinition {
  type: WindowType
  name: string
  icon: React.ReactNode
  defaultOpts?: { title?: string; width?: number; height?: number; payload?: any }
}

const apps: AppDefinition[] = [
  { type: 'terminal', name: 'Terminal', icon: <TerminalIcon size={20} />, defaultOpts: { title: 'Terminal', width: 700, height: 500 } },
  { type: 'explorer', name: 'Explorer', icon: <FolderIcon size={20} />, defaultOpts: { title: 'File Explorer', width: 1200, height: 800 } },
  { type: 'notepad', name: 'Notepad', icon: <NotepadIcon size={20} />, defaultOpts: { title: 'Notepad', width: 1200, height: 800 } },
  { type: 'browser', name: 'Browser', icon: <BrowserIcon size={20} />, defaultOpts: { title: 'Browser', width: 1200, height: 800 } },
  { type: 'store', name: 'Store', icon: <StoreIcon size={20} />, defaultOpts: { title: 'Terminality Store', width: 1200, height: 800 } },
  { type: 'music', name: 'Music', icon: <MusicIcon size={20} />, defaultOpts: { title: 'Music Player', width: 550, height: 620 } },
  { type: 'settings', name: 'Settings', icon: <SettingsIcon size={20} />, defaultOpts: { title: 'System Settings', width: 1200, height: 800 } },
  { type: 'recycle', name: 'Recycle Bin', icon: <RecycleBinIcon size={20} />, defaultOpts: { title: 'Recycle Bin', width: 1000, height: 760 } },
  { type: 'email', name: 'Mail', icon: <MailIcon size={20} />, defaultOpts: { title: 'Mail', width: 1200, height: 800 } },
  { type: 'chat', name: 'Chat', icon: <ChatIcon size={20} />, defaultOpts: { title: 'Chat', width: 500, height: 600 } },
]

interface TaskbarProps {
  onLock: () => void
}

export const Taskbar: React.FC<TaskbarProps> = ({ onLock }) => {
  const wm = useWindowManager()
  const { unreadCount } = useNotifications()
  const [startOpen, setStartOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [time, setTime] = useState('')
  const startRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }))
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  // Close start menu on outside click
  useEffect(() => {
    if (!startOpen) return
    const handler = (e: Event) => {
      const target = e.target as Node
      if (menuRef.current && menuRef.current.contains(target)) return
      if (startRef.current && startRef.current.contains(target)) return
      setStartOpen(false)
    }
    window.addEventListener('mousedown', handler)
    window.addEventListener('touchstart', handler, { passive: true })
    return () => {
      window.removeEventListener('mousedown', handler)
      window.removeEventListener('touchstart', handler)
    }
  }, [startOpen])

  const launchApp = (app: AppDefinition) => {
    wm.open(app.type, app.defaultOpts)
    setStartOpen(false)
  }

  const getRunningApps = () => {
    const grouped = wm.windows.reduce((acc, win) => {
      if (!acc[win.type]) acc[win.type] = []
      acc[win.type].push(win)
      return acc
    }, {} as Record<WindowType, typeof wm.windows>)
    return grouped
  }

  const runningApps = getRunningApps()

  return (
    <div className="taskbar">
      {/* Start Menu */}
      <div className="taskbar-start" ref={startRef}>
        <button className="start-button" onClick={() => setStartOpen(!startOpen)}>
          <span className="start-icon">▣</span>
          <span>START</span>
        </button>
        {startOpen && (
          <div className="start-menu" ref={menuRef}>
            <div className="start-menu-header">TERMINALITY OS</div>
            <div className="start-menu-apps">
              {apps.map(app => (
                <button key={app.type} className="start-menu-item" onClick={() => launchApp(app)}>
                  <span className="app-icon">{app.icon}</span>
                  <span>{app.name}</span>
                </button>
              ))}
            </div>
            <div className="start-menu-footer">
              <button className="start-menu-power" onClick={() => { setStartOpen(false); onLock(); }}>
                🔒 Log Off
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Running Apps */}
      <div className="taskbar-apps">
        {Object.entries(runningApps).map(([type, windows]) => {
          const app = apps.find(a => a.type === type)
          if (!app) return null
          const firstWin = windows[0]
          const isMinimized = firstWin.minimized
          return (
            <button
              key={type}
              className={`taskbar-app ${firstWin.focused && !isMinimized ? 'active' : ''} ${isMinimized ? 'minimized' : ''}`}
              onClick={() => {
                if (isMinimized) {
                  wm.restore(firstWin.id)
                } else if (firstWin.focused) {
                  wm.minimize(firstWin.id)
                } else {
                  wm.focus(firstWin.id)
                }
              }}
              title={`${app.name} (${windows.length} window${windows.length > 1 ? 's' : ''})`}
            >
              <span className="app-icon">{app.icon}</span>
              <span className="app-name">{app.name}</span>
              {windows.length > 1 && <span className="app-count">({windows.length})</span>}
            </button>
          )
        })}
      </div>

      {/* System Tray */}
      <div className="taskbar-tray">
        <div className="tray-item" title="System Status">[SYS: OK]</div>
        <div 
          className={`tray-item notification-icon ${unreadCount > 0 ? 'has-unread' : ''}`}
          onClick={() => setNotificationsOpen(!notificationsOpen)}
          title={`Notifications (${unreadCount} unread)`}
        >
          🔔
          {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
        </div>
        <div className="tray-item clock">{time}</div>
      </div>
      
      {notificationsOpen && <NotificationPanel onClose={() => setNotificationsOpen(false)} />}
    </div>
  )
}
