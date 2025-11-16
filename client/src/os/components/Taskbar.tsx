import React, { useState, useRef, useEffect } from 'react'

import { TerminalIcon, FolderIcon, NotepadIcon, BrowserIcon, RecycleBinIcon, MailIcon, MusicIcon, SettingsIcon, ChatIcon, StoreIcon, UserManagementIcon, QuestIcon } from './Icons'
import Icon from './icons/Icon'
import { NotificationPanel } from './NotificationPanel'
import { useNotifications } from '../NotificationContext'
import { useUser } from '../UserContext'
import { useWindowManager, WindowType } from '../WindowManager'
import './Taskbar.css'

interface AppDefinition {
  type: WindowType
  name: string
  icon: React.ReactNode
  defaultOpts?: { title?: string; width?: number; height?: number; payload?: any }
}

const baseApps: AppDefinition[] = [
  { type: 'terminal', name: 'Terminal', icon: <TerminalIcon size={20} />, defaultOpts: { title: 'Terminal', width: 700, height: 500 } },
  { type: 'explorer', name: 'Explorer', icon: <FolderIcon size={20} />, defaultOpts: { title: 'File Explorer', width: 1200, height: 800 } },
  { type: 'notepad', name: 'Notepad', icon: <NotepadIcon size={20} />, defaultOpts: { title: 'Notepad', width: 1200, height: 800 } },
  { type: 'browser', name: 'Browser', icon: <BrowserIcon size={20} />, defaultOpts: { title: 'Browser', width: 1200, height: 800 } },
  { type: 'store', name: 'Store', icon: <StoreIcon size={20} />, defaultOpts: { title: 'Terminality Store', width: 1200, height: 800 } },
  { type: 'music', name: 'Music', icon: <MusicIcon size={20} />, defaultOpts: { title: 'Music Player', width: 427, height: 800 } },
  { type: 'settings', name: 'Settings', icon: <SettingsIcon size={20} />, defaultOpts: { title: 'System Settings', width: 1200, height: 800 } },
  { type: 'recycle', name: 'Recycle Bin', icon: <RecycleBinIcon size={20} />, defaultOpts: { title: 'Recycle Bin', width: 1000, height: 760 } },
  { type: 'email', name: 'Mail', icon: <MailIcon size={20} />, defaultOpts: { title: 'Mail', width: 1200, height: 800 } },
  { type: 'chat', name: 'Chat', icon: <ChatIcon size={20} />, defaultOpts: { title: 'Chat', width: 400, height: 800 } },
  { type: 'modular-plugin', name: 'Online Chat', icon: <ChatIcon size={20} />, defaultOpts: { title: 'Online Chat', width: 500, height: 700, payload: { pluginId: 'online-chat' } } },
  { type: 'profile', name: 'Profile', icon: <Icon name="user" size={20} />, defaultOpts: { title: 'Profile', width: 460, height: 700 } },
]

interface TaskbarProps {
  onLock: () => void
}

export const Taskbar: React.FC<TaskbarProps> = ({ onLock }) => {
  const wm = useWindowManager()
  const { logout, isAdmin } = useUser()
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

  const availableApps = React.useMemo<AppDefinition[]>(() => {
    const list = [...baseApps]
    if (isAdmin) {
      list.push({ type: 'usermgmt', name: 'User Management', icon: <UserManagementIcon size={20} />, defaultOpts: { title: 'User Management', width: 900, height: 650 } })
      list.push({ type: 'quest-designer', name: 'Quest Designer', icon: <QuestIcon size={20} />, defaultOpts: { title: 'Quest Designer', width: 1200, height: 800 } })
    }
    return list
  }, [isAdmin])

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
              {availableApps.map(app => (
                <button key={app.type} className="start-menu-item" onClick={() => launchApp(app)}>
                  <span className="app-icon">{app.icon}</span>
                  <span>{app.name}</span>
                </button>
              ))}
            </div>
            <div className="start-menu-footer">
              <button 
                className="start-menu-power" 
                onClick={() => { 
                  setStartOpen(false); 
                  onLock(); 
                }}
                title="Return to lock screen"
              >
                <svg className="power-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M12 11V7M9 7h6" />
                </svg>
                <span>Lock</span>
              </button>
              <button 
                className="start-menu-power" 
                onClick={() => { 
                  setStartOpen(false); 
                  wm.clearAll(); 
                  logout(); 
                  window.location.href = '/'; 
                }}
                title="Log out and return to home page"
              >
                <svg className="power-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                <span>Log Out</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Running Apps */}
      <div className="taskbar-apps">
        {Object.entries(runningApps).map(([type, windows]) => {
          const app = availableApps.find(a => a.type === type)
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
