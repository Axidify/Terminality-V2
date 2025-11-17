import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import App from '../App'

function createState() {
  return { version: 1, desktop: { isLocked: true }, story: {} as Record<string, unknown> }
}
const stateStore = vi.hoisted(() => ({ current: createState() }))

const resetState = () => {
  stateStore.current = createState()
}

function createWindowManagerStub() {
  return {
    windows: [],
    open: vi.fn(),
    close: vi.fn(),
    focus: vi.fn(),
    move: vi.fn(),
    resize: vi.fn(),
    minimize: vi.fn(),
    maximize: vi.fn(),
    restore: vi.fn(),
    commitBounds: vi.fn(),
    clearAll: vi.fn()
  }
}
const windowManagerStub = vi.hoisted(() => createWindowManagerStub())
const resetWindowManagerStub = () => {
  const fresh = createWindowManagerStub()
  Object.keys(fresh).forEach(key => {
    // @ts-expect-error indexing for reassignment of fn references
    windowManagerStub[key] = fresh[key as keyof typeof fresh]
  })
}

vi.mock('../services/saveService', () => {
  return {
    saveDesktopState: vi.fn().mockImplementation(async (partial: any) => {
      stateStore.current = { ...stateStore.current, desktop: { ...stateStore.current.desktop, ...partial } }
      return stateStore.current
    }),
    hydrateFromServer: vi.fn().mockImplementation(async () => stateStore.current),
    getCachedDesktop: vi.fn(() => stateStore.current.desktop)
  }
})

// Minimal mocks for contexts used by App
vi.mock('../os/ThemeContext', () => ({ ThemeProvider: ({ children }: any) => <>{children}</> }))
vi.mock('../os/NotificationContext', () => ({ NotificationProvider: ({ children }: any) => <>{children}</> }))
vi.mock('../os/UserContext', () => ({
  UserProvider: ({ children }: any) => <>{children}</>,
  useUser: () => ({
    user: { id: 1, username: 'tester', isAdmin: true },
    loading: false,
    isAdmin: true,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn()
  })
}))
vi.mock('../os/WindowManager', () => ({
  WindowManagerProvider: ({ children }: any) => <>{children}</>,
  useWindowManager: () => windowManagerStub
}))
vi.mock('../os/components/SessionExpiredOverlay', () => ({ default: () => null }))
vi.mock('../pages/HomePage', () => ({ HomePage: () => null }))
vi.mock('../os/components/LockScreen', () => ({ LockScreen: ({ onUnlock, onRegister }: any) => (<div><button onClick={onUnlock}>Unlock</button><button onClick={onRegister}>Register</button></div>) }))
vi.mock('../os/components/OnboardingPage', () => ({ OnboardingPage: ({ onComplete, onBack }: any) => (<div><button onClick={onComplete}>Complete</button><button onClick={onBack}>Back</button></div>) }))
vi.mock('../os/Desktop', () => ({ Desktop: ({ onLock }: any) => (<div><button onClick={() => onLock()}>Lock</button><span>Desktop</span></div>) }))

describe('Lock state persistence', () => {
  beforeEach(() => {
    resetState()
    resetWindowManagerStub()
    // Gate allows /app only if logged in; simulate an authenticated user
    try {
      localStorage.setItem('authToken', 'test-token')
    } catch (err) {
      void err
    }
  })

  it('hydrates from server isLocked and persists changes', async () => {
    // Mock the pathname to /app so we render OSApp instead of HomePage
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/app' },
      writable: true
    })

    render(<App />)
    // Starts locked
    expect(await screen.findByRole('button', { name: 'Unlock' })).toBeInTheDocument()

    // Unlock -> should persist isLocked=false
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    expect(stateStore.current.desktop.isLocked).toBe(false)

    // App rendered desktop; lock again -> persists true
    await userEvent.click(screen.getByRole('button', { name: 'Lock' }))
    expect(stateStore.current.desktop.isLocked).toBe(true)
  })
})
