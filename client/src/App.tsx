import React, { useEffect, useState } from 'react'

import { PluginManagerProvider } from './modular-apps/PluginManager'
import { LockScreen } from './os/components/LockScreen'
import { OnboardingPage } from './os/components/OnboardingPage'
import SessionExpiredOverlay from './os/components/SessionExpiredOverlay'
import { Desktop } from './os/Desktop'
import { NotificationProvider } from './os/NotificationContext'
import { SessionActivityProvider } from './os/SessionActivityContext'
import { ThemeProvider } from './os/ThemeContext'
import { ToastProvider } from './os/ToastContext'
import { UserProvider } from './os/UserContext'
import { WindowManagerProvider } from './os/WindowManager'
import { HomePage } from './pages/HomePage'
import ResetPage from './pages/ResetPage'
import { QuestDesignerPage } from './pages/QuestDesignerPage'
import { isLoggedIn } from './services/auth'
import { hydrateFromServer, getCachedDesktop, saveDesktopState } from './services/saveService'

type AppView = 'lock' | 'onboarding' | 'desktop'
type AppPage = 'home' | 'os' | 'reset' | 'designer'

const resolvePageFromPath = (pathname: string): AppPage => {
  if (pathname.startsWith('/app')) return 'os'
  if (pathname.startsWith('/reset')) return 'reset'
  if (pathname.startsWith('/designer')) return 'designer'
  return 'home'
}

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
      <ToastProvider>
        <NotificationProvider>
          <UserProvider>
            <PluginManagerProvider>
              <WindowManagerProvider>
                <SessionActivityProvider>
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
                </SessionActivityProvider>
              </WindowManagerProvider>
            </PluginManagerProvider>
          </UserProvider>
        </NotificationProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default function App() {
  const path = window.location.pathname
  const initial = resolvePageFromPath(path)
  // Gate /app and /designer behind auth: if not logged in, force home page
  const [currentPage, setCurrentPage] = useState<AppPage>(() => {
    if ((initial === 'os' || initial === 'designer') && !isLoggedIn()) return 'home'
    return initial
  })

  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname
      const next = resolvePageFromPath(p)
      if ((next === 'os' || next === 'designer') && !isLoggedIn()) {
        setCurrentPage('home')
      } else {
        setCurrentPage(next)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    // React to auth token changes (login/logout) to keep gate accurate
    const onAuthChange = () => {
      const p = window.location.pathname
      const next = resolvePageFromPath(p)
      if ((next === 'os' || next === 'designer') && !isLoggedIn()) {
        setCurrentPage('home')
      } else {
        setCurrentPage(next)
      }
    }
    window.addEventListener('authTokenChanged', onAuthChange as any)
    return () => window.removeEventListener('authTokenChanged', onAuthChange as any)
  }, [])

  if (currentPage === 'home') {
    return (
      <ThemeProvider>
        <ToastProvider>
          <NotificationProvider>
            <UserProvider>
            <HomePage />
            </UserProvider>
          </NotificationProvider>
        </ToastProvider>
      </ThemeProvider>
    )
  }

  if (currentPage === 'reset') {
    return (
      <ThemeProvider>
        <ToastProvider>
          <NotificationProvider>
            <UserProvider>
            <ResetPage />
            </UserProvider>
          </NotificationProvider>
        </ToastProvider>
      </ThemeProvider>
    )
  }

  if (currentPage === 'designer') {
    return (
      <ThemeProvider>
        <ToastProvider>
          <NotificationProvider>
            <UserProvider>
              <QuestDesignerPage />
            </UserProvider>
          </NotificationProvider>
        </ToastProvider>
      </ThemeProvider>
    )
  }

  return <OSApp />
}