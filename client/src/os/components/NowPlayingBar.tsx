import React, { useEffect, useState } from 'react'

import { PlayIcon, PauseIcon, NoteIcon, SkipBackIcon, SkipForwardIcon, VolumeIcon, ShuffleIcon, RepeatIcon, RepeatOneIcon } from './Icons'
import { getCachedDesktop, saveDesktopState } from '../../services/saveService'
import { useWindowManager } from '../WindowManager'

export const NowPlayingBar: React.FC = () => {
  const [trackTitle, setTrackTitle] = useState<string | null>(null)
  const [trackArtist, setTrackArtist] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [visible, setVisible] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState<number>(0.7)
  const [queueIds, setQueueIds] = useState<number[]>([])
  const [currentTrackId, setCurrentTrackId] = useState<number | null>(null)
  const [shuffle, setShuffle] = useState<boolean>(false)
  const [repeat, setRepeat] = useState<'off' | 'all' | 'one'>('all')
  const wm = useWindowManager()

  useEffect(() => {
    const refresh = () => {
      try {
        const desktop = getCachedDesktop()
  const state = desktop?.musicState as { trackId?: number; queueIds?: number[]; volume?: number; shuffle?: boolean; repeat?: 'off'|'all'|'one' } | undefined
  const playlists = (desktop?.musicPlaylists as Array<{ tracks: Array<{ id: number; title: string; artist: string; url?: string }> }>) || []
        let title: string | null = null
        let artist: string | null = null
        if (state?.trackId) {
          for (const p of playlists) {
            const t = p.tracks.find((x: { id: number; title: string; artist: string }) => x.id === state.trackId)
            if (t) { title = t.title; artist = t.artist; break }
          }
        }
        setTrackTitle(title)
        setTrackArtist(artist)
        setCurrentTrackId(state?.trackId ?? null)
        setQueueIds(Array.isArray(state?.queueIds) ? state!.queueIds! : [])
  if (typeof state?.volume === 'number') setVolume(state.volume)
  if (typeof state?.shuffle === 'boolean') setShuffle(state.shuffle)
  if (state?.repeat) setRepeat(state.repeat)
        const audio = document.querySelector('audio') as HTMLAudioElement | null
        if (audio) {
          setIsPlaying(!audio.paused)
          setCurrentTime(audio.currentTime || 0)
          setDuration(isFinite(audio.duration) ? audio.duration : 0)
        } else {
          setIsPlaying(false)
          setCurrentTime(0)
          setDuration(0)
        }
  } catch { /* ignore: audio element update issue */ }
    }
    refresh()
    const iv = setInterval(refresh, 1000)
    return () => clearInterval(iv)
  }, [])

  const togglePlay = () => {
    const audio = document.querySelector('audio') as HTMLAudioElement | null
    if (!audio) return
    if (audio.paused) audio.play().catch(() => {})
    else audio.pause()
    setIsPlaying(!audio.paused)
  }

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const seek = (value: number) => {
    const audio = document.querySelector('audio') as HTMLAudioElement | null
    if (!audio || !isFinite(duration)) return
    audio.currentTime = Math.max(0, Math.min(value, duration))
    setCurrentTime(audio.currentTime)
  }

  const withQueueTracks = () => {
    const desktop = getCachedDesktop()
    const playlists = (desktop?.musicPlaylists as Array<{ tracks: Array<{ id: number; title: string; artist: string; url?: string }> }>) || []
    const allTracks = playlists.flatMap(p => p.tracks)
    const queue = (queueIds.length ? queueIds : allTracks.map(t => t.id))
      .map(id => allTracks.find(t => t.id === id))
      .filter((t): t is { id: number; title: string; artist: string; url?: string } => Boolean(t))
    return queue
  }

  const playTrackById = (id: number) => {
    const queue = withQueueTracks()
    const track = queue.find(t => t.id === id) || queue[0]
    const audio = document.querySelector('audio') as HTMLAudioElement | null
    if (!audio || !track || !track.url) return
    if (audio.src !== track.url) audio.src = track.url
    audio.play().catch(() => {})
    setIsPlaying(true)
    setCurrentTrackId(track.id)
    // Persist state
  saveDesktopState({ musicState: { ...(getCachedDesktop()?.musicState || {}), trackId: track.id } }).catch(() => {})
  }

  const playNext = () => {
    const queue = withQueueTracks()
    if (!queue.length || currentTrackId == null) return
    const idx = queue.findIndex(t => t.id === currentTrackId)
    const next = queue[(idx + 1) % queue.length]
    if (next) playTrackById(next.id)
  }

  const playPrev = () => {
    const queue = withQueueTracks()
    if (!queue.length || currentTrackId == null) return
    const idx = queue.findIndex(t => t.id === currentTrackId)
    const prev = queue[idx <= 0 ? queue.length - 1 : idx - 1]
    if (prev) playTrackById(prev.id)
  }

  const persistState = (patch: Record<string, any>) => {
    const base = getCachedDesktop()?.musicState || {}
    saveDesktopState({ musicState: { ...base, ...patch } }).catch(() => {})
  }

  const setVol = (v: number) => {
    setVolume(v)
    const audio = document.querySelector('audio') as HTMLAudioElement | null
    if (audio) audio.volume = v
    persistState({ volume: v })
  }

  const toggleShuffle = () => {
    setShuffle(s => {
      const next = !s
      persistState({ shuffle: next })
      return next
    })
  }

  const cycleRepeat = () => {
    setRepeat(r => {
      const next = r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'
      persistState({ repeat: next })
      return next
    })
  }

  useEffect(() => {
    const musicWin = wm.windows.find(w => w.type === 'music')
    const minimized = !!musicWin && musicWin.minimized
    const hasTrack = !!(trackTitle || trackArtist)
    // smooth show/hide
    const t = setTimeout(() => setVisible(hasTrack && minimized), 0)
    return () => clearTimeout(t)
  }, [trackTitle, trackArtist, wm.windows])

  const musicWin = wm.windows.find(w => w.type === 'music')
  const shouldShow = !!musicWin && musicWin.minimized && (trackTitle || trackArtist)
  if (!shouldShow && !visible) return null

  return (
    <div
      className="now-playing-bar"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 56,
        zIndex: 10001,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 6,
        padding: '6px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: '0 4px 12px var(--color-shadow)',
        cursor: 'pointer',
        transition: 'transform 180ms ease, opacity 180ms ease',
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        opacity: visible ? 1 : 0
      }}
      onClick={() => wm.open('music', { title: 'Music Player', width: 680, height: 420 })}
      title="Open Music Player"
    >
      <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <NoteIcon size={28} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 160, maxWidth: 280 }}>
        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden' }} title={`${trackTitle || ''} — ${trackArtist || ''}`}>
          <span style={{ display: 'inline-block', minWidth: '100%', animation: (trackTitle && trackTitle.length > 24) ? 'marquee 9s linear infinite' as any : 'none' }}>{trackTitle}</span>
        </div>
        <div style={{ fontSize: 12, opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden' }}>
          <span style={{ display: 'inline-block', minWidth: '100%', animation: (trackArtist && trackArtist.length > 28) ? 'marquee 11s linear infinite' as any : 'none' }}>{trackArtist}</span>
        </div>
        {/* Progress + time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }} onClick={e => e.stopPropagation()}>
          <span style={{ fontSize: 11, opacity: 0.7, width: 36, textAlign: 'right' }}>{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.5}
            value={isFinite(duration) ? Math.min(currentTime, duration) : 0}
            onChange={(e) => seek(parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 11, opacity: 0.7, width: 38 }}>{formatTime(Math.max(0, (duration || 0) - (currentTime || 0)))}</span>
        </div>
      </div>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <button onClick={toggleShuffle} title={shuffle ? 'Shuffle On' : 'Shuffle Off'} style={{ background:'transparent',border:'none',cursor:'pointer', color: shuffle? 'var(--color-accent, var(--color-text))':'var(--color-text)', opacity: shuffle?1:0.6 }}>
          <ShuffleIcon size={16} />
        </button>
        <button onClick={playPrev} title="Previous" style={{ background: 'transparent', border: 'none', color: 'var(--color-text)', cursor: 'pointer' }}>
          <SkipBackIcon size={18} />
        </button>
        <button onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'} style={{ background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 6px', color: 'var(--color-text)', cursor: 'pointer' }}>
          {isPlaying ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
        </button>
        <button onClick={playNext} title="Next" style={{ background: 'transparent', border: 'none', color: 'var(--color-text)', cursor: 'pointer' }}>
          <SkipForwardIcon size={18} />
        </button>
        <button onClick={cycleRepeat} title={repeat === 'off' ? 'Repeat Off' : repeat === 'all' ? 'Repeat All' : 'Repeat One'} style={{ background:'transparent',border:'none',cursor:'pointer', color: repeat !== 'off' ? 'var(--color-accent, var(--color-text))':'var(--color-text)', opacity: repeat !== 'off'?1:0.6 }}>
          {repeat === 'one' ? <RepeatOneIcon size={16}/> : <RepeatIcon size={16}/>}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6 }} title={`Volume: ${Math.round(volume * 100)}%`}>
          <VolumeIcon size={16} />
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVol(parseFloat(e.target.value))} />
        </div>
      </div>
    </div>
  )
}

export default NowPlayingBar
