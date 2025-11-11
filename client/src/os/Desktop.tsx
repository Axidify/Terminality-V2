import React, { useRef } from 'react'

import { DesktopBranding } from './components/DesktopBranding'
import { DesktopContainer } from './components/DesktopContextMenu'
import { DesktopIcons, DesktopIconsRef } from './components/DesktopIcons'
import NowPlayingBar from './components/NowPlayingBar'
import SessionExpiredOverlay from './components/SessionExpiredOverlay'
import SystemInfo from './components/SystemInfo'
import { Taskbar } from './components/Taskbar'
import { WindowFrame } from './components/WindowFrame'
import { sounds } from './SoundEffects'
import { useUser } from './UserContext'
import { useWindowManager } from './WindowManager'
import { AdminApp } from '../programs/AdminApp'
import { ChatApp } from '../programs/ChatApp'
import { EmailApp } from '../programs/EmailApp'
import { FileExplorerApp } from '../programs/FileExplorerApp'
import { MiniBrowserApp } from '../programs/MiniBrowserApp'
import { MusicPlayerApp } from '../programs/MusicPlayerApp'
import { NotepadApp } from '../programs/NotepadApp'
import { RecycleBinApp } from '../programs/RecycleBinApp'
import { StoreApp } from '../programs/StoreApp'
import { SystemSettingsApp } from '../programs/SystemSettingsApp'
import { TerminalApp } from '../programs/TerminalApp'
import './Desktop.css'

interface DesktopProps {
  onLock: () => void
}

export const Desktop: React.FC<DesktopProps> = ({ onLock }) => {
  const wm = useWindowManager()
  const desktopIconsRef = useRef<DesktopIconsRef>(null)
  const [isExiting, setIsExiting] = React.useState(false)

  const handleAutoArrange = () => {
    desktopIconsRef.current?.autoArrange()
  }

  const { logout: ctxLogout } = useUser()

  const handleLock = () => {
    sounds.logout()
    // Clear auth/session so LockScreen doesn't auto-login
  try { ctxLogout(); } catch { /* ignore logout errors */ }
    
    // Stop music player if it's playing
    const audio = document.querySelector('audio') as HTMLAudioElement
    if (audio && !audio.paused) {
      audio.pause()
      audio.currentTime = 0
    }
    
    setIsExiting(true)
    setTimeout(() => {
      onLock()
    }, 500) // Match animation duration
  }

  return (
    <DesktopContainer onAutoArrange={handleAutoArrange}>
      <div className={`desktop ${isExiting ? 'exiting' : ''}`}>
        {/* Desktop Background - visual only */}
        <div className="desktop-bg" />
        
        {/* Clickable background layer for context menu */}
        <div className="desktop-clickable-bg" />
        
        {/* Desktop Branding */}
        <DesktopBranding />
        
        {/* System Info */}
        <SystemInfo />
        
        {/* Desktop Icons */}
  <DesktopIcons ref={desktopIconsRef} />

        {/* Windows */}
        {wm.windows.map(win => (
          <WindowFrame key={win.id} win={win}>
            {win.type === 'terminal' && <TerminalApp />}
            {win.type === 'explorer' && <FileExplorerApp openNotepad={(path: string) => wm.open('notepad', { title: `Notepad - ${path}`, payload: { path } })} />}
            {win.type === 'notepad' && <NotepadApp path={(win.payload as any)?.path || '/home/player/notes.txt'} />}
            {win.type === 'browser' && <MiniBrowserApp payload={win.payload as any} />}
            {win.type === 'recycle' && <RecycleBinApp />}
            {win.type === 'email' && <EmailApp />}
            {win.type === 'chat' && <ChatApp />}
            {win.type === 'music' && <MusicPlayerApp />}
            {win.type === 'settings' && <SystemSettingsApp />}
            {win.type === 'store' && <StoreApp />}
      {win.type === 'admin' && <AdminApp />}
          </WindowFrame>
        ))}

        {/* Taskbar */}
        <NowPlayingBar />
        <Taskbar onLock={handleLock} />
        <SessionExpiredOverlay />
      </div>
    </DesktopContainer>
  )
}
