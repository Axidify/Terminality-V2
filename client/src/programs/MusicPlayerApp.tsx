// ...existing code... (file header)
import React, { useState, useRef, useEffect } from 'react'

import { PlayIcon, PauseIcon, SkipBackIcon, SkipForwardIcon, ShuffleIcon, RepeatIcon, RepeatOneIcon, VolumeIcon, NoteIcon, RecycleBinIcon } from '../os/components/Icons'
import './MusicPlayerApp.css'
import { getCachedDesktop, saveDesktopState } from '../services/saveService'

// Floating Music Icon Component
const MusicIcon: React.FC<{ size?: number }> = ({ size = 48 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ filter: 'drop-shadow(0 0 8px rgba(var(--color-primary-rgb, 0, 255, 65), 0.6))' }}
  >
    <path
      d="M9 18V5L21 3V16M9 18C9 19.6569 7.65685 21 6 21C4.34315 21 3 19.6569 3 18C3 16.3431 4.34315 15 6 15C7.65685 15 9 16.3431 9 18ZM21 16C21 17.6569 19.6569 19 18 19C16.3431 19 15 17.6569 15 16C15 14.3431 16.3431 13 18 13C19.6569 13 21 14.3431 21 16Z"
      stroke="var(--color-primary, #00ff41)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

interface Track {
  id: number
  title: string
  artist: string
  url: string
  duration: string
}

interface Playlist {
  id: string
  name: string
  tracks: Track[]
}

type RepeatMode = 'off' | 'all' | 'one'

const demoTracks: Track[] = [
  { 
    id: 1, 
    title: 'Neon Dreams', 
    artist: 'Cyber Synth', 
    url: '/audio/SoundHelix-Song-1.mp3', 
    duration: '3:42' 
  },
  { 
    id: 2, 
    title: 'Digital Rain', 
    artist: 'Matrix Beats', 
    url: '/audio/SoundHelix-Song-2.mp3', 
    duration: '4:15' 
  },
  { 
    id: 3, 
    title: 'Terminal Vibes', 
    artist: 'Code Warriors', 
    url: '/audio/SoundHelix-Song-3.mp3', 
    duration: '3:28' 
  },
  { 
    id: 4, 
    title: 'Retro Wave', 
    artist: 'Synth Masters', 
    url: '/audio/SoundHelix-Song-4.mp3', 
    duration: '5:03' 
  },
  { 
    id: 5, 
    title: 'Cyber City', 
    artist: 'Future Sound', 
    url: '/audio/SoundHelix-Song-5.mp3', 
    duration: '4:35' 
  },
  { 
    id: 6, 
    title: 'Data Stream', 
    artist: 'Binary Flow', 
    url: '/audio/SoundHelix-Song-6.mp3', 
    duration: '4:20' 
  },
  { 
    id: 7, 
    title: 'Code Rhythm', 
    artist: 'Tech Pulse', 
    url: '/audio/SoundHelix-Song-7.mp3', 
    duration: '3:55' 
  },
  { 
    id: 8, 
    title: 'Glitch Hop', 
    artist: 'System Error', 
    url: '/audio/SoundHelix-Song-8.mp3', 
    duration: '4:08' 
  },
  { 
    id: 9, 
    title: 'Pixel Paradise', 
    artist: '8-Bit Heroes', 
    url: '/audio/SoundHelix-Song-9.mp3', 
    duration: '3:47' 
  },
  { 
    id: 10, 
    title: 'Quantum Beats', 
    artist: 'Neon Nights', 
    url: '/audio/SoundHelix-Song-10.mp3', 
    duration: '4:52' 
  },
  { 
    id: 11, 
    title: 'Electric Dreams', 
    artist: 'Voltage Drive', 
    url: '/audio/SoundHelix-Song-11.mp3', 
    duration: '3:33' 
  },
  { 
    id: 12, 
    title: 'Matrix Protocol', 
    artist: 'Grid Runner', 
    url: '/audio/SoundHelix-Song-12.mp3', 
    duration: '4:25' 
  },
  { 
    id: 13, 
    title: 'Synthwave Sunset', 
    artist: 'Chrome Waves', 
    url: '/audio/SoundHelix-Song-13.mp3', 
    duration: '5:10' 
  },
  { 
    id: 14, 
    title: 'Neon Highway', 
    artist: 'Retro Riders', 
    url: '/audio/SoundHelix-Song-14.mp3', 
    duration: '3:58' 
  },
  { 
    id: 15, 
    title: 'Digital Horizon', 
    artist: 'Future Echoes', 
    url: '/audio/SoundHelix-Song-15.mp3', 
    duration: '4:40' 
  },
]

// Keep a singleton audio element so playback continues even if window minimized/closed.
let sharedAudio: HTMLAudioElement | null = null

// Persisted state shape for restoring session after login
interface MusicPersistState {
  playlistId: string
  trackId?: number
  queueIds?: number[]
  shuffle: boolean
  repeat: RepeatMode
  volume: number
}
const _MUSIC_STATE_KEY = 'musicStateV2'

const getPlaylists = (): Playlist[] => {
  try {
    const saved = getCachedDesktop()?.musicPlaylists
    return saved ? saved : [{ id: 'default', name: 'All Tracks', tracks: demoTracks }]
  } catch {
    return [{ id: 'default', name: 'All Tracks', tracks: demoTracks }]
  }
}

export const MusicPlayerApp: React.FC = () => {
  const [playlists, setPlaylists] = useState<Playlist[]>(getPlaylists)
  const [currentPlaylistId, setCurrentPlaylistId] = useState('default')
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.7)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<RepeatMode>('all')
  const [playQueue, setPlayQueue] = useState<Track[]>([])
  const [showPlaylistManager, setShowPlaylistManager] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track?: Track } | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  // Ensure initial restore only happens once and never overrides user actions later
  const didRestoreRef = useRef(false)

  // Initialize / reuse a single hidden audio element attached to document body.
  if (typeof window !== 'undefined' && !sharedAudio) {
    sharedAudio = document.createElement('audio')
    sharedAudio.style.position = 'fixed'
    sharedAudio.style.left = '-9999px'
    sharedAudio.style.width = '0'
    sharedAudio.setAttribute('aria-hidden', 'true')
    sharedAudio.preload = 'auto'
    sharedAudio.crossOrigin = 'anonymous'
    document.body.appendChild(sharedAudio)
  }

  const audioRef = useRef<HTMLAudioElement | null>(sharedAudio)

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  // Restore track and settings once after mount (e.g., after login)
  useEffect(() => {
    if (didRestoreRef.current) return
    const a = audioRef.current
    if (!a) return
    const allTracks = playlists.flatMap(p => p.tracks)

    try {
      // If an audio src already exists (e.g., persisted element), sync UI to it
      if (!currentTrack && a.src) {
        const found = allTracks.find(t => a.src.includes(t.url))
        if (found) {
          setCurrentTrack(found)
          setIsPlaying(!a.paused)
          setDuration(isFinite(a.duration) ? a.duration : 0)
          setCurrentTime(a.currentTime)
          setPlayQueue(prev => prev.length ? prev : allTracks)
          didRestoreRef.current = true
          return
        }
      }

      const saved: MusicPersistState | undefined = getCachedDesktop()?.musicState
      if (saved) {
        if (saved.volume != null) setVolume(saved.volume)
        if (saved.shuffle != null) setShuffle(saved.shuffle)
        if (saved.repeat) setRepeat(saved.repeat)
        if (saved.playlistId) setCurrentPlaylistId(saved.playlistId)

        if (saved.queueIds && saved.queueIds.length) {
          const queue = saved.queueIds
            .map(id => allTracks.find(t => t.id === id))
            .filter((t): t is Track => Boolean(t))
          if (queue.length) setPlayQueue(queue)
        }

        if (saved.trackId) {
          const t = allTracks.find(x => x.id === saved.trackId)
          if (t) {
            setCurrentTrack(t)
            // Don't auto-play after login; user can resume manually
            const fullUrl = new URL(t.url, window.location.origin).href
            if (a.src !== fullUrl) {
              try { a.pause() } catch { /* ignore */ }
              a.src = fullUrl
              try { a.load() } catch { /* ignore */ }
            }
            a.currentTime = 0
            setIsPlaying(false)
            setCurrentTime(0)
            setDuration(isFinite(a.duration) ? a.duration : 0)
          }
        }
      }
    } catch { /* ignore */ }

    didRestoreRef.current = true
  // run once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // No cross-component sync needed now that NowPlayingBar is removed

  // Persist state when key values change
  useEffect(() => {
    const state: MusicPersistState = {
      playlistId: currentPlaylistId,
      trackId: currentTrack?.id,
      queueIds: playQueue.map(t => t.id),
      shuffle,
      repeat,
      volume
    }
    saveDesktopState({ musicState: state }).catch(() => {})
  }, [currentPlaylistId, currentTrack?.id, playQueue, shuffle, repeat, volume])

  const currentPlaylist = playlists.find(p => p.id === currentPlaylistId) || playlists[0]
  const tracks = React.useMemo(() => currentPlaylist?.tracks || [], [currentPlaylist])

  const buildPlayQueue = React.useCallback((startTrack: Track) => {
    const trackList = [...tracks]
    if (shuffle) {
      // Fisher-Yates shuffle
      for (let i = trackList.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [trackList[i], trackList[j]] = [trackList[j], trackList[i]]
      }
    }
    // Move startTrack to front
    const startIdx = trackList.findIndex(t => t.id === startTrack.id)
    if (startIdx > 0) {
      trackList.unshift(trackList.splice(startIdx, 1)[0])
    }
    setPlayQueue(trackList)
  }, [tracks, shuffle])

  // Rebuild the play queue whenever shuffle mode changes
  useEffect(() => {
    if (currentTrack) buildPlayQueue(currentTrack)
  }, [shuffle, currentTrack, buildPlayQueue])

  const playTrack = React.useCallback((track: Track, buildQueue = true) => {
    if (buildQueue) buildPlayQueue(track)
    setCurrentTrack(track)
    setIsPlaying(true)
    if (audioRef.current && track.url) {
      const fullUrl = new URL(track.url, window.location.origin).href
  if (import.meta.env.DEV) console.log('Playing track:', track.title, 'URL:', fullUrl)

      const playAudio = () => {
        audioRef.current?.play().then(() => {
          if (import.meta.env.DEV) console.log('Audio started playing successfully')
        }).catch((error) => {
          if (import.meta.env.DEV) console.log('Audio play failed:', error)
          setIsPlaying(false)
        })
      }

      if (audioRef.current.src !== fullUrl) {
        // Stop any current playback, set src, and force reload to ensure new file is fetched
        try { audioRef.current.pause() } catch { /* ignore */ }
        audioRef.current.src = fullUrl
        try { audioRef.current.load() } catch { /* ignore */ }
        try { audioRef.current.currentTime = 0 } catch { /* ignore */ }
  if (import.meta.env.DEV) console.log('Set audio src to:', fullUrl)

        // Wait for audio to be ready before playing
        const onCanPlay = () => {
          audioRef.current?.removeEventListener('canplay', onCanPlay)
      playAudio()
  if (import.meta.env.DEV) console.log('playTrack attempt - after play call; audio.src:', audioRef.current?.src, 'audio.currentSrc:', audioRef.current?.currentSrc)
        }
        audioRef.current.addEventListener('canplay', onCanPlay)

        // Fallback timeout in case canplay doesn't fire
        setTimeout(() => {
          if (audioRef.current && !audioRef.current.paused) return // Already playing
          audioRef.current?.removeEventListener('canplay', onCanPlay)
          playAudio()
        }, 1000)
      } else {
        // Same track, just play
        playAudio()
      }
    }
  }, [buildPlayQueue, audioRef])

  const playNext = React.useCallback(() => {
    if (playQueue.length === 0) return
    const idx = playQueue.findIndex(t => t.id === currentTrack?.id)
    const nextIdx = (idx + 1) % playQueue.length
    playTrack(playQueue[nextIdx], false)
  }, [playQueue, currentTrack, playTrack])

  const playPrev = React.useCallback(() => {
    if (playQueue.length === 0) return
    const idx = playQueue.findIndex(t => t.id === currentTrack?.id)
    const prevIdx = idx <= 0 ? playQueue.length - 1 : idx - 1
    playTrack(playQueue[prevIdx], false)
  }, [playQueue, currentTrack, playTrack])

  useEffect(() => {
    saveDesktopState({ musicPlaylists: playlists }).catch(() => {})
  }, [playlists])

  // Sync state with actual audio playback
  useEffect(() => {
    const a = audioRef.current
    if (!a) return

    const onPlay = () => {
      setIsPlaying(true)
      console.log('Audio onPlay event - src:', a.src, 'currentSrc:', a.currentSrc, 'currentTime:', a.currentTime, 'duration:', a.duration)
    }
    const onPause = () => setIsPlaying(false)
    const onTime = () => {
      setCurrentTime(a.currentTime)
      setDuration(isFinite(a.duration) ? a.duration : 0)
    }
    const onEnd = () => {
      // Handle repeat and auto-next
      if (repeat === 'one' && currentTrack) {
        a.currentTime = 0
        a.play()
      } else if (repeat === 'all' || playQueue.length > 1) {
        playNext()
      } else {
        setIsPlaying(false)
      }
    }

    const onError = (e: Event) => {
      console.log('Audio error:', e, 'Error code:', (e.target as HTMLAudioElement).error?.code, 'Message:', (e.target as HTMLAudioElement).error?.message)
      setIsPlaying(false)
    }

  a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnd)
    a.addEventListener('error', onError)
    const resolveTrackFromSrc = (src: string): Track | undefined => {
      if (!src) return undefined
      // Strip origin and query/hash
      try {
        const urlObj = new URL(src)
        src = urlObj.pathname
      } catch { /* relative already */ }
      // Match by endsWith of track.url (which is /audio/filename)
      return playlists
        .flatMap(p => p.tracks)
        .find(t => src.endsWith(t.url) || src.endsWith(t.url.replace(/^\//, '')))
    }

    const onLoadedMetadata = () => {
      console.log('loadedmetadata - src:', a.src, 'currentSrc:', a.currentSrc, 'duration:', a.duration)
      const found = resolveTrackFromSrc(a.currentSrc || a.src)
      if (found && (!currentTrack || currentTrack.id !== found.id)) {
        // Update currentTrack without rebuilding queue (user may be mid-queue from MusicPlayer)
        setCurrentTrack(found)
      }
    }
    a.addEventListener('loadedmetadata', onLoadedMetadata)

    // Sync initial state
    setIsPlaying(!a.paused)
    
    return () => {
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('ended', onEnd)
  a.removeEventListener('error', onError)
  a.removeEventListener('loadedmetadata', onLoadedMetadata)
    }
  // We intentionally omit playNext from deps because it's stable via callback; adding it may cause early re-runs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeat, currentTrack, playQueue, playNext])

  // Stop playback when component unmounts (window closed)
  useEffect(() => {
    const a = audioRef.current
    return () => {
      if (a) {
        try { a.pause() } catch { /* ignore */ }
        // Optional: keep src for quick resume next time or clear to free resources
        // a.src = ''
      }
    }
  }, [])

  

  const togglePlay = () => {
    if (audioRef.current && currentTrack?.url) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play().catch(() => {/* autoplay block ignored */})
      }
    }
  }

  // handleTimeUpdate is unnecessary because onTime event handles timeupdate; kept for clarity if needed

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    setCurrentTime(time)
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const createPlaylist = () => {
    if (!newPlaylistName.trim()) return
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name: newPlaylistName.trim(),
      tracks: []
    }
    setPlaylists([...playlists, newPlaylist])
    setNewPlaylistName('')
  }

  const deletePlaylist = (id: string) => {
    if (id === 'default') {
      alert('Cannot delete default playlist')
      return
    }
    if (confirm('Delete this playlist?')) {
      setPlaylists(playlists.filter(p => p.id !== id))
      if (currentPlaylistId === id) setCurrentPlaylistId('default')
    }
  }

  const cycleRepeat = () => {
    setRepeat(r => r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')
  }

  const handleContextMenu = (e: React.MouseEvent, track?: Track) => {
    e.preventDefault()
    const container = containerRef.current
    if (container) {
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left + container.scrollLeft
      const y = e.clientY - rect.top + container.scrollTop
      setContextMenu({ x, y, track })
    } else {
      setContextMenu({ x: e.clientX, y: e.clientY, track })
    }
  }

  const closeContextMenu = () => {
    setContextMenu(null)
  }

  // Close context menu when clicking anywhere
  useEffect(() => {
    if (contextMenu) {
      const handleClick = () => closeContextMenu()
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [contextMenu])

  // Memoized particles for background effects
  const particles = React.useMemo(() => (
    Array.from({ length: 12 }).map((_, i) => ({
      key: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 5}s`,
      animationDuration: `${15 + Math.random() * 10}s`
    }))
  ), [])

  return (
  <div className="music-player-root" ref={containerRef} onContextMenu={handleContextMenu}>
      {/* Background Effects */}
      <div className="music-bg-grid" />
      <div className="music-scanlines" />
      {particles.map(particle => (
        <div
          key={particle.key}
          className="music-particle"
          style={{
            left: particle.left,
            top: particle.top,
            animationDelay: particle.animationDelay,
            animationDuration: particle.animationDuration
          }}
        />
      ))}

      {/* Main Container */}
      <div className="music-player-container">
        {/* Hidden global audio lives outside; we only show UI here */}
        {/* Playback persists when minimized because audio element is not unmounted */}

        {/* Header Section */}
        <div className="music-player-header">
          <div className="header-top">
            {/* Floating logo */}
            <div className="music-logo">
              <MusicIcon size={48} />
            </div>
            
            <div className="title-group">
              <h1 className="header-title">
                <span className="bracket">[</span>MUSIC PLAYER<span className="bracket">]</span>
              </h1>
              <div className="header-subtitle">AUDIO PLAYBACK SYSTEM v2.0</div>
            </div>
          </div>

          <div className="now-playing">
            <div className="album-art">
              <NoteIcon size={32} />
            </div>
            <div className="track-info">
              <div className="track-title">
                {currentTrack?.title || 'No track selected'}
              </div>
              <div className="track-artist">
                {currentTrack?.artist || 'Select a track to play'}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {currentTrack && (
            <div className="progress-section">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="progress-bar"
              />
              <div className="progress-time">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="player-controls">
            <div className="controls-left">
              <button 
                onClick={() => setShuffle(!shuffle)}
                className={`control-btn ${shuffle ? 'active' : ''}`}
                title="Shuffle"
              >
                <ShuffleIcon size={14} />
              </button>
              <button 
                onClick={cycleRepeat}
                className={`control-btn ${repeat !== 'off' ? 'active' : ''}`}
                title={repeat === 'off' ? 'Repeat Off' : repeat === 'all' ? 'Repeat All' : 'Repeat One'}
              >
                {repeat === 'one' ? <RepeatOneIcon size={14} /> : <RepeatIcon size={14} />}
              </button>
            </div>

            <div className="controls-center">
              <button onClick={playPrev} disabled={!currentTrack} className="control-btn">
                <SkipBackIcon size={16} />
              </button>
              <button onClick={togglePlay} disabled={!currentTrack} className="control-btn play-btn" title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
              </button>
              <button onClick={playNext} disabled={!currentTrack} className="control-btn">
                <SkipForwardIcon size={16} />
              </button>
            </div>

            <div className="controls-right">
              <VolumeIcon size={14} />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="volume-slider"
              />
            </div>
          </div>
        </div>

        {/* Playlist Selector & Manager */}
        <div className="playlist-section">
          <div className="playlist-controls">
            <select 
              value={currentPlaylistId}
              onChange={(e) => setCurrentPlaylistId(e.target.value)}
              className="playlist-select"
            >
              {playlists.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.tracks.length})</option>
              ))}
            </select>
            <button 
              onClick={() => setShowPlaylistManager(!showPlaylistManager)}
              className="playlist-toggle-btn"
            >
              <span className="bracket">[</span>
              {showPlaylistManager ? '✕' : '+'}
              <span className="bracket">]</span>
            </button>
          </div>
          
          {showPlaylistManager && (
            <div className="playlist-manager">
              <div className="playlist-manager-title">
                <span className="bracket">[</span>CREATE NEW PLAYLIST<span className="bracket">]</span>
              </div>
              <div className="playlist-create-row">
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="Enter playlist name..."
                  className="playlist-name-input"
                  onKeyPress={(e) => e.key === 'Enter' && createPlaylist()}
                />
                <button onClick={createPlaylist} className="playlist-create-btn">
                  <span className="bracket">[</span>CREATE<span className="bracket">]</span>
                </button>
              </div>
              {currentPlaylistId !== 'default' && (
                <button 
                  onClick={() => deletePlaylist(currentPlaylistId)}
                  className="delete-playlist-btn"
                >
                  <RecycleBinIcon size={14} /> 
                  <span className="bracket">[</span>DELETE CURRENT<span className="bracket">]</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Playlist */}
        <div className="track-list-container">
          <div className="track-list-header">
            <span className="bracket">[</span>
            {currentPlaylist?.name || 'Playlist'} — {tracks.length} TRACKS
            <span className="bracket">]</span>
          </div>
          {tracks.map(track => (
            <div
              key={track.id}
              onClick={() => playTrack(track)}
              onContextMenu={(e) => handleContextMenu(e, track)}
              className={`track-item ${currentTrack?.id === track.id ? 'active' : ''}`}
            >
              <div className="track-icon">
                {currentTrack?.id === track.id && isPlaying ? <VolumeIcon size={16} /> : <NoteIcon size={16} />}
              </div>
              <div className="track-details">
                <div className="track-details-title">{track.title}</div>
                <div className="track-details-artist">{track.artist}</div>
              </div>
              <div className="track-duration">
                <span className="bracket">[</span>{track.duration}<span className="bracket">]</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Context Menu */}
      {contextMenu && (
        <div 
          className="music-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.track && (
            <>
              <div className="context-menu-item" onClick={() => { playTrack(contextMenu.track!); closeContextMenu(); }}>
                <PlayIcon size={14} /> Play Track
              </div>
              <div className="context-menu-divider" />
            </>
          )}
          <div className="context-menu-item" onClick={() => { setShuffle(!shuffle); closeContextMenu(); }}>
            <ShuffleIcon size={14} /> {shuffle ? 'Disable' : 'Enable'} Shuffle
          </div>
          <div className="context-menu-item" onClick={() => { cycleRepeat(); closeContextMenu(); }}>
            {repeat === 'one' ? <RepeatOneIcon size={14} /> : <RepeatIcon size={14} />} Repeat: {repeat === 'off' ? 'Off' : repeat === 'all' ? 'All' : 'One'}
          </div>
          <div className="context-menu-divider" />
          <div className="context-menu-item" onClick={() => { setShowPlaylistManager(!showPlaylistManager); closeContextMenu(); }}>
            + Manage Playlists
          </div>
        </div>
      )}
    </div>
  )
}
