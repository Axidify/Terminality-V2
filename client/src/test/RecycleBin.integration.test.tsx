import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { fs } from '../programs/FileSystem'
import { RecycleBinApp } from '../programs/RecycleBinApp'

// Server-backed state mocks
/* eslint-disable no-var */
var seededMeta: Array<{ recyclePath: string; originalPath: string; name: string; deletedAt: string }> = []
/* eslint-enable no-var */
vi.mock('../services/saveService', () => ({
  saveDesktopState: vi.fn().mockImplementation(async (partial: any) => {
    if (partial && Array.isArray(partial.recycleBin)) {
      seededMeta = partial.recycleBin
    }
    return { version: 1, desktop: { recycleBin: seededMeta }, story: {} }
  }),
  hydrateFromServer: vi.fn().mockResolvedValue({ version: 1, desktop: { recycleBin: seededMeta }, story: {} }),
  getCachedDesktop: vi.fn(() => ({ recycleBin: seededMeta }))
}))

function seedRecycleBin() {
  // Create a file and move it into recycle bin path
  const filePath = '/home/player/trashme.txt'
  fs.ensurePath(filePath)
  if (!fs.exists(filePath)) fs.touch(filePath)
  const recyclePath = '/.recycle/trashme.txt'
  // Ensure recycle dir exists
  try { fs.mkdir('/.recycle') } catch { /* ignore if exists */ }
  fs.move(filePath, recyclePath)
  const meta = [{ recyclePath, originalPath: filePath, name: 'trashme.txt', deletedAt: new Date().toISOString() }]
  seededMeta = meta
}

describe('RecycleBin permanent deletion integration (client persistence)', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('permanently deletes file and removes metadata', async () => {
    seedRecycleBin()
    render(<RecycleBinApp />)
    // File row present
    expect(await screen.findByText(/trashme.txt/)).toBeInTheDocument()
    const delBtn = await screen.findByRole('button', { name: 'Delete' })

    // Mock confirm to auto-accept
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    await userEvent.click(delBtn)

  // Row disappears and server-backed state updated
    expect(screen.queryByText(/trashme.txt/)).toBeNull()
  expect(Array.isArray(seededMeta)).toBe(true)
  expect(seededMeta.length).toBe(0)

    // Underlying fs path removed
    expect(fs.exists('/.recycle/trashme.txt')).toBe(false)

    confirmSpy.mockRestore()
  })
})
