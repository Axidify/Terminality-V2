import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, it, vi, beforeEach, expect } from 'vitest'

import { MusicPlayerApp } from '../programs/MusicPlayerApp'

vi.mock('../services/saveService', () => {
  return {
    saveDesktopState: vi.fn().mockResolvedValue({} as any),
    hydrateFromServer: vi.fn().mockResolvedValue({ version: 1, desktop: {}, story: {} }),
    getCachedDesktop: vi.fn(() => undefined)
  }
})

describe('Music Player playback (integration)', () => {
  beforeEach(() => {
    // Prevent actual audio from trying to play during test
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  })

  it('clicking a track updates audio src', async () => {
    render(<MusicPlayerApp />)
    // Wait for playlist to render
    expect(await screen.findByText(/All Tracks — 15 TRACKS/)).toBeInTheDocument()
    const neon = await screen.findByText('Neon Dreams')
    await userEvent.click(neon)
    const audio = document.querySelector('audio') as HTMLAudioElement | null
    expect(audio).not.toBeNull()
    expect(audio!.src).toEqual(new URL('/audio/SoundHelix-Song-1.mp3', window.location.origin).href)
  })
})
