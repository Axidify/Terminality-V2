import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { createFileSystem, fs as singletonFs } from '../programs/FileSystem'
import { RecycleBinApp } from '../programs/RecycleBinApp'

/* eslint-disable no-var */
// Use var declarations to avoid temporal dead zone with hoisted vi.mock
var seededFSNodes: any = undefined
var seededRecycleMeta: Array<{ recyclePath: string; originalPath: string; name: string; deletedAt: string }> = []
/* eslint-enable no-var */

vi.mock('../services/saveService', () => {
  return {
    saveDesktopState: vi.fn().mockImplementation(async (partial: any) => {
      if (partial?.fs?.nodes) {
        seededFSNodes = partial.fs.nodes
      }
      if (partial && Array.isArray(partial.recycleBin)) {
        seededRecycleMeta = partial.recycleBin
      }
      return { version: 1, desktop: { fs: { nodes: seededFSNodes }, recycleBin: seededRecycleMeta }, story: {} }
    }),
    hydrateFromServer: vi.fn().mockResolvedValue({ version: 1, desktop: { fs: { nodes: seededFSNodes }, recycleBin: seededRecycleMeta }, story: {} }),
    getCachedDesktop: vi.fn(() => ({ fs: { nodes: seededFSNodes }, recycleBin: seededRecycleMeta }))
  }
})

function seedRecycleBin() {
  // Create a file and move it into recycle bin path, and set metadata
  const filePath = '/home/player/tmp_delete.txt'
  singletonFs.ensurePath(filePath)
  if (!singletonFs.exists(filePath)) singletonFs.touch(filePath)
  const recyclePath = '/.recycle/tmp_delete.txt'
  try { singletonFs.mkdir('/.recycle'); } catch { /* ignore if exists */ }
  singletonFs.move(filePath, recyclePath)
  seededRecycleMeta = [{ recyclePath, originalPath: filePath, name: 'tmp_delete.txt', deletedAt: new Date().toISOString() }]
}

describe('Reload persistence integration', () => {
  beforeEach(() => {
    localStorage.clear()
    seededFSNodes = undefined
    seededRecycleMeta = []
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('persists filesystem changes across reload (hydrate → mutate → rehydrate)', async () => {
    vi.useFakeTimers()
    const path = '/home/player/reload.txt'
    singletonFs.ensurePath(path)
    if (!singletonFs.exists(path)) singletonFs.touch(path)
    singletonFs.write(path, 'hello')

    // Debounced save flush
    vi.advanceTimersByTime(500)
    await Promise.resolve()

    // Simulate a reload by creating a fresh FS instance
    const fresh = createFileSystem()
    const file = fresh.read(path)
    expect(file?.content).toBe('hello')
    vi.useRealTimers()
  })

  it('persists recycle bin metadata across reload', async () => {
    seedRecycleBin()
    const { unmount } = render(<RecycleBinApp />)
    // Confirm seeded item present
    expect(await screen.findByText(/tmp_delete.txt/)).toBeInTheDocument()
    const delBtn = await screen.findByRole('button', { name: 'Delete' })

    // Accept confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await userEvent.click(delBtn)

    // Now empty and server-backed state updated
    expect(screen.queryByText(/tmp_delete.txt/)).toBeNull()
    expect(Array.isArray(seededRecycleMeta)).toBe(true)
    expect(seededRecycleMeta.length).toBe(0)

    // Simulate reload by unmounting and re-rendering
    unmount()
    render(<RecycleBinApp />)
    expect(screen.queryByText(/tmp_delete.txt/)).toBeNull()

    confirmSpy.mockRestore()
  })
})
