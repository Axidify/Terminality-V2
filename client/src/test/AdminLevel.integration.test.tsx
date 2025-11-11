import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminPanel } from '../programs/AdminPanel'

// Use var to avoid TDZ with hoisted vi.mock
var desktop: any = { playerCurrency: 1000, installedTools: [], playerLevel: 1, playerExperience: 0, notifications: [] }

vi.mock('../services/saveService', () => ({
  saveDesktopState: vi.fn().mockImplementation(async (partial: any) => {
    desktop = { ...desktop, ...partial }
    return { version: 1, desktop, story: {} }
  }),
  getCachedDesktop: vi.fn(() => desktop),
  hydrateFromServer: vi.fn().mockResolvedValue({ version: 1, desktop, story: {} })
}))

// Keep it simple: AdminPanel CSS/other deps are not required for logic

describe('AdminPanel level persistence', () => {
  beforeEach(() => {
    desktop = { playerCurrency: 1000, installedTools: [], playerLevel: 1, playerExperience: 0, notifications: [] }
  })

  it('updates playerLevel via server-backed state', async () => {
    render(<AdminPanel />)
    const levelInput = (await screen.findAllByRole('spinbutton'))[1] // second number input is level
    await userEvent.clear(levelInput)
    await userEvent.type(levelInput, '7')

    const updateBtn = screen.getAllByRole('button', { name: 'Update' })[1]
    await userEvent.click(updateBtn)

    expect(desktop.playerLevel).toBe(7)
  })
})
