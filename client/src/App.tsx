import React, { useEffect, useState } from 'react'

import { LockScreen } from './os/components/LockScreen'
import { OnboardingPage } from './os/components/OnboardingPage'
import SessionExpiredOverlay from './os/components/SessionExpiredOverlay'
import { Desktop } from './os/Desktop'
import { NotificationProvider } from './os/NotificationContext'
import { ThemeProvider } from './os/ThemeContext'
import { UserProvider } from './os/UserContext'
import { WindowManagerProvider } from './os/WindowManager'
import { hydrateFromServer, getCachedDesktop, saveDesktopState } from './services/saveService'

type AppView = 'lock' | 'onboarding' | 'desktop'

export default function App() {
  const [view, setView] = useState<AppView>(() => {
    const cached = getCachedDesktop()
    if (cached && typeof cached.isLocked === 'boolean') {
      return cached.isLocked ? 'lock' : 'desktop'
    }
    return 'lock'
  })

  useEffect(() => {
    // Persist lock state server-backed (onboarding counts as locked until complete)
    saveDesktopState({ isLocked: view === 'desktop' ? false : true }).catch(() => {})
  }, [view])

  useEffect(() => {
    // Hydrate from server once
    hydrateFromServer().then(state => {
      if (state.desktop && typeof state.desktop.isLocked === 'boolean') {
        setView(state.desktop.isLocked ? 'lock' : 'desktop')
      }
    }).catch(() => {})
  }, [])

  return (
    <ThemeProvider>
      <NotificationProvider>
        <UserProvider>
        <WindowManagerProvider>
          {/* Global session expiry UI */}
          <SessionExpiredOverlay />
          {view === 'lock' && (
            <LockScreen 
              onUnlock={() => setView('desktop')} 
              onRegister={() => setView('onboarding')}
            />
          )}
          {view === 'onboarding' && (
            <OnboardingPage 
              onComplete={() => setView('desktop')}
              onBack={() => setView('lock')}
            />
          )}
          {view === 'desktop' && (
            <Desktop onLock={() => setView('lock')} />
          )}
        </WindowManagerProvider>
        </UserProvider>
      </NotificationProvider>
    </ThemeProvider>
  )
}
