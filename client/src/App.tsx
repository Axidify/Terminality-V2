import React, { useEffect, useState } from 'react'

import { LockScreen } from './os/components/LockScreen'
import { OnboardingPage } from './os/components/OnboardingPage'
import SessionExpiredOverlay from './os/components/SessionExpiredOverlay'
import { Desktop } from './os/Desktop'
import { NotificationProvider } from './os/NotificationContext'
import { ThemeProvider } from './os/ThemeContext'
import { UserProvider } from './os/UserContext'
import { WindowManagerProvider } from './os/WindowManager'
import { HomePage } from './pages/HomePage'
import { hydrateFromServer, getCachedDesktop, saveDesktopState } from './services/saveService'

type AppView = 'lock' | 'onboarding' | 'desktop'
type AppPage = 'home' | 'os'

function OSApp() {
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

export default function App() {
  const path = window.location.pathname
  const page: AppPage = path === '/app' ? 'os' : 'home'
  const [currentPage, setCurrentPage] = useState<AppPage>(page)

  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname
      setCurrentPage(p === '/app' ? 'os' : 'home')
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  if (currentPage === 'home') {
    return <HomePage />
  }

  return <OSApp />
}