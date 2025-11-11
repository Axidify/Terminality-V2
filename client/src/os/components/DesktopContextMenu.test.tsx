import { render, fireEvent, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'

import { DesktopContainer } from './DesktopContextMenu'
import { WindowManagerProvider } from '../WindowManager'

function renderDesktop() {
  return render(
    <WindowManagerProvider>
      <DesktopContainer>
        <div data-testid="desktop-content" style={{ width: '100vw', height: '100vh' }} />
      </DesktopContainer>
    </WindowManagerProvider>
  )
}

describe('Desktop context menu', () => {
  beforeEach(() => {
    cleanup()
  })

  it('opens on right-click and shows primary actions', async () => {
    renderDesktop()
    const desktop = screen.getByLabelText('Desktop area')
    fireEvent.contextMenu(desktop, { clientX: 120, clientY: 150 })
    expect(await screen.findByText('Refresh')).toBeInTheDocument()
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('closes when pressing Escape', async () => {
    const user = userEvent.setup()
    renderDesktop()
    const desktop = screen.getByLabelText('Desktop area')
    fireEvent.contextMenu(desktop, { clientX: 80, clientY: 90 })
    await screen.findByText('Refresh')
    await user.keyboard('{Escape}')
    expect(screen.queryByText('Refresh')).not.toBeInTheDocument()
  })

  it('closes when clicking outside', async () => {
    renderDesktop()
    const desktop = screen.getByLabelText('Desktop area')
    fireEvent.contextMenu(desktop, { clientX: 200, clientY: 210 })
    await screen.findByText('Refresh')
    fireEvent.pointerDown(document.body)
    expect(screen.queryByText('Refresh')).not.toBeInTheDocument()
  })

  it('opens via Shift+F10 keyboard shortcut', async () => {
    const user = userEvent.setup()
    renderDesktop()
    const desktop = screen.getByLabelText('Desktop area')
    desktop.focus()
    await user.keyboard('{Shift>}{F10}{/Shift}')
    expect(await screen.findByText('Refresh')).toBeInTheDocument()
  })
})
