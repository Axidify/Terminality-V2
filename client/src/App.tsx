import React, { useEffect, useState } from 'react'

import { LockScreen } from './os/components/LockScreen'
import { OnboardingPage } from './os/components/OnboardingPage'
import SessionExpiredOverlay from './os/components/SessionExpiredOverlay'
import { Desktop } from './os/Desktop'
import { NotificationProvider } from './os/NotificationContext'
import { ThemeProvider } from './os/ThemeContext'
import { UserProvider } from './os/UserContext'
import { WindowManagerProvider } from './os/WindowManager'
import { PluginManagerProvider } from './modular-apps/PluginManager'
import { HomePage } from './pages/HomePage'
import ResetPage from './pages/ResetPage'
import { hydrateFromServer, getCachedDesktop, saveDesktopState } from './services/saveService'
import { isLoggedIn } from './services/auth'

type AppView = 'lock' | 'onboarding' | 'desktop'
type AppPage = 'home' | 'os' | 'reset'

function OSApp() {
  const [view, setView] = useState<AppView>(() => {
    const cached = getCachedDesktop()
    if (cached && typeof cached.isLocked === 'boolean') {
      return cached.isLocked ? 'lock' : 'desktop'
    }
    return 'lock'
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('onboarding')) {
      setView('onboarding')
      return
    }
    // Persist lock state server-backed (onboarding counts as locked until complete)
    saveDesktopState({ isLocked: view === 'desktop' ? false : true }).catch(() => {})
  }, [view])

  useEffect(() => {
    // Hydrate from server once
    hydrateFromServer().then(state => {
      if (state.desktop && typeof state.desktop.isLocked === 'boolean') {
        setView(state.desktop.isLocked ? 'lock' : 'desktop')
      }
      // After hydration, if we landed on desktop but want a mandatory lock screen on fresh session, re-lock
      else if (isLoggedIn()) {
        setView('lock')
      }
    }).catch(() => {})
  }, [])

  return (
    <ThemeProvider>
      <NotificationProvider>
        <UserProvider>
  <PluginManagerProvider>
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
  </PluginManagerProvider>
        </UserProvider>
      </NotificationProvider>
    </ThemeProvider>
  )
}

export default function App() {
  const path = window.location.pathname
  const initial: AppPage = path === '/app' ? 'os' : path === '/reset' ? 'reset' : 'home'
  // Gate /app behind auth: if not logged in, force home page
  const [currentPage, setCurrentPage] = useState<AppPage>(() => {
    if (initial === 'os' && !isLoggedIn()) return 'home'
    return initial
  })

  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname
      const next: AppPage = p === '/app' ? 'os' : p === '/reset' ? 'reset' : 'home'
      setCurrentPage(next === 'os' && !isLoggedIn() ? 'home' : next)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    // React to auth token changes (login/logout) to keep gate accurate
    const onAuthChange = () => {
      const p = window.location.pathname
      const next: AppPage = p === '/app' ? 'os' : p === '/reset' ? 'reset' : 'home'
      setCurrentPage(next === 'os' && !isLoggedIn() ? 'home' : next)
    }
    window.addEventListener('authTokenChanged', onAuthChange as any)
    return () => window.removeEventListener('authTokenChanged', onAuthChange as any)
  }, [])

  if (currentPage === 'home') {
    return (
      <ThemeProvider>
        <NotificationProvider>
          <UserProvider>
            <HomePage />
          </UserProvider>
        </NotificationProvider>
      </ThemeProvider>
    )
  }

  if (currentPage === 'reset') {
    return (
      <ThemeProvider>
        <NotificationProvider>
          <UserProvider>
            <ResetPage />
          </UserProvider>
        </NotificationProvider>
      </ThemeProvider>
    )
  }

  return <OSApp />
}