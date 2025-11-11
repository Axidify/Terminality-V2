import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { DesktopIcons } from './DesktopIcons'
import { WindowManagerProvider } from '../WindowManager'

vi.mock('../../services/saveService', () => ({
  getCachedDesktop: vi.fn(() => ({ icons: {} })),
  saveDesktopState: vi.fn(() => Promise.resolve()),
  hydrateFromServer: vi.fn().mockResolvedValue({ version: 1, desktop: { icons: {} }, story: {} })
}))

vi.mock('../UserContext', () => ({
  useUser: () => ({ isAdmin: false })
}))

describe('DesktopIcons dragging', () => {
  afterEach(() => {
    cleanup()
  })

  const renderIcons = () => render(
    <WindowManagerProvider>
      <DesktopIcons />
    </WindowManagerProvider>
  )

  it('updates icon position smoothly during drag', async () => {
    renderIcons()
    const icon = screen.getByText('Terminal').closest('.desktop-icon') as HTMLElement

    fireEvent.pointerDown(icon, { clientX: 40, clientY: 40, button: 0 })
    fireEvent.pointerMove(document.body, { clientX: 220, clientY: 220 })
    fireEvent.pointerUp(document.body, { clientX: 220, clientY: 220 })

    await waitFor(() => {
      expect(icon.style.left).toBe('200px')
      expect(icon.style.top).toBe('200px')
    })
  })
})
