import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

// In-memory mock state
let state: any = { version: 1, desktop: { isLocked: true }, story: {} }

vi.mock('../services/saveService', () => {
  return {
    saveDesktopState: vi.fn().mockImplementation(async (partial: any) => {
      state = { ...state, desktop: { ...state.desktop, ...partial } }
      return state
    }),
    hydrateFromServer: vi.fn().mockImplementation(async () => state),
    getCachedDesktop: vi.fn(() => state.desktop)
  }
})

// Minimal mocks for contexts used by App
vi.mock('../os/ThemeContext', () => ({ ThemeProvider: ({ children }: any) => <>{children}</> }))
vi.mock('../os/NotificationContext', () => ({ NotificationProvider: ({ children }: any) => <>{children}</> }))
vi.mock('../os/UserContext', () => ({ UserProvider: ({ children }: any) => <>{children}</> }))
vi.mock('../os/WindowManager', () => ({ WindowManagerProvider: ({ children }: any) => <>{children}</> }))
vi.mock('../os/components/LockScreen', () => ({ LockScreen: ({ onUnlock, onRegister }: any) => (<div><button onClick={onUnlock}>Unlock</button><button onClick={onRegister}>Register</button></div>) }))
vi.mock('../os/components/OnboardingPage', () => ({ OnboardingPage: ({ onComplete, onBack }: any) => (<div><button onClick={onComplete}>Complete</button><button onClick={onBack}>Back</button></div>) }))
vi.mock('../os/Desktop', () => ({ Desktop: ({ onLock }: any) => (<div><button onClick={() => onLock()}>Lock</button><span>Desktop</span></div>) }))

describe('Lock state persistence', () => {
  beforeEach(() => {
    state = { version: 1, desktop: { isLocked: true }, story: {} }
  })

  it('hydrates from server isLocked and persists changes', async () => {
    render(<App />)
    // Starts locked
    expect(await screen.findByRole('button', { name: 'Unlock' })).toBeInTheDocument()

    // Unlock -> should persist isLocked=false
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    expect(state.desktop.isLocked).toBe(false)

    // App rendered desktop; lock again -> persists true
    await userEvent.click(screen.getByRole('button', { name: 'Lock' }))
    expect(state.desktop.isLocked).toBe(true)
  })
})
