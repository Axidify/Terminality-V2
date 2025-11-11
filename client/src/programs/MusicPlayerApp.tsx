import React, { useState, useRef, useEffect } from 'react'
import { PlayIcon, PauseIcon, SkipBackIcon, SkipForwardIcon, ShuffleIcon, RepeatIcon, RepeatOneIcon, VolumeIcon, NoteIcon, RecycleBinIcon } from '../os/components/Icons'
import './MusicPlayerApp.css'
import { getCachedDesktop, saveDesktopState } from '../services/saveService'

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
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', 
    duration: '3:42' 
  },
  { 
    id: 2, 
    title: 'Digital Rain', 
    artist: 'Matrix Beats', 
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', 
    duration: '4:15' 
  },
  { 
    id: 3, 
    title: 'Terminal Vibes', 
    artist: 'Code Warriors', 
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', 
    duration: '3:28' 
  },
  { 
    id: 4, 
    title: 'Retro Wave', 
    artist: 'Synth Masters', 
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', 
    duration: '5:03' 
  },
  { 
    id: 5, 
    title: 'Cyber City', 
    artist: 'Future Sound', 
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', 
    duration: '4:35' 
  },
  { 
    id: 6, 
    title: 'Data Stream', 
    artist: 'Binary Flow', 
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', 
    duration: '4:20' 
  },
  { 
    id: 7, 
    title: 'Code Rhythm', 
    artist: 'Tech Pulse', 
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', 
    duration: '3:55' 
  },
  { 
    id: 8, 
    title: 'Glitch Hop', 
    artist: 'System Error', 
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', 
    duration: '4:08' 
  },
  { 
    id: 9, 
    title: 'Pixel Paradise', 
    artist: '8-Bit Heroes', 
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3', 
    duration: '3:47' 
  },
  { 
    id: 10, 
    title: 'Quantum Beats', 
    artist: 'Neon Nights', 
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', 
    duration: '4:52' 
  },
  { 
    id: 11, 
    title: 'Electric Dreams', 
    artist: 'Voltage Drive', 
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3', 
    duration: '3:33' 
  },
  { 
    id: 12, 
    title: 'Matrix Protocol', 
    artist: 'Grid Runner', 
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3', 
    duration: '4:25' 
  },
  { 
    id: 13, 
    title: 'Synthwave Sunset', 
    artist: 'Chrome Waves', 
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3', 
    duration: '5:10' 
  },
  { 
    id: 14, 
    title: 'Neon Highway', 
    artist: 'Retro Riders', 
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3', 
    duration: '3:58' 
  },
  { 
    id: 15, 
    title: 'Digital Horizon', 
    artist: 'Future Echoes', 
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3', 
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
const MUSIC_STATE_KEY = 'musicStateV2'

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

  // Initialize / reuse a single hidden audio element attached to document body.
  if (typeof window !== 'undefined' && !sharedAudio) {
    sharedAudio = document.createElement('audio')
    sharedAudio.style.position = 'fixed'
    sharedAudio.style.left = '-9999px'
    sharedAudio.style.width = '0'
    sharedAudio.setAttribute('aria-hidden', 'true')
    document.body.appendChild(sharedAudio)
  }

  const audioRef = useRef<HTMLAudioElement | null>(sharedAudio)

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  // Restore track and settings after re-mount (e.g., after login)
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const allTracks = playlists.flatMap(p => p.tracks)

    let restored = false
    if (!currentTrack && a.src) {
      const found = allTracks.find(t => a.src.includes(t.url))
      if (found) {
        setCurrentTrack(found)
        setIsPlaying(!a.paused)
        setDuration(isFinite(a.duration) ? a.duration : 0)
        setCurrentTime(a.currentTime)
        setPlayQueue(prev => prev.length ? prev : allTracks)
        restored = true
      }
    }

    if (!restored) {
      try {
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
              if (a.src !== t.url) a.src = t.url
              a.currentTime = 0
              setIsPlaying(false)
              setCurrentTime(0)
              setDuration(isFinite(a.duration) ? a.duration : 0)
            }
          }
        }
      } catch {}
    }
  }, [])

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
  const tracks = currentPlaylist?.tracks || []

  useEffect(() => {
    saveDesktopState({ musicPlaylists: playlists }).catch(() => {})
  }, [playlists])

  // Sync state with actual audio playback
  useEffect(() => {
    const a = audioRef.current
    if (!a) return

    const onPlay = () => setIsPlaying(true)
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

    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnd)

    // Sync initial state
    setIsPlaying(!a.paused)
    
    return () => {
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('ended', onEnd)
    }
  }, [repeat, currentTrack, playQueue])

  // Stop playback when component unmounts (window closed)
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause()
        } catch {}
        // Optional: keep src for quick resume next time or clear to free resources
        // audioRef.current.src = ''
      }
    }
  }, [])

  const buildPlayQueue = (startTrack: Track) => {
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
  }

  const playTrack = (track: Track, buildQueue = true) => {
    if (buildQueue) buildPlayQueue(track)
    setCurrentTrack(track)
    setIsPlaying(true)
    if (audioRef.current && track.url) {
      if (audioRef.current.src !== track.url) {
        audioRef.current.src = track.url
      }
      audioRef.current.play().catch(() => {/* autoplay block ignored */})
    }
  }

  const playNext = () => {
    if (playQueue.length === 0) return
    const idx = playQueue.findIndex(t => t.id === currentTrack?.id)
    const nextIdx = (idx + 1) % playQueue.length
    playTrack(playQueue[nextIdx], false)
  }

  const playPrev = () => {
    if (playQueue.length === 0) return
    const idx = playQueue.findIndex(t => t.id === currentTrack?.id)
    const prevIdx = idx <= 0 ? playQueue.length - 1 : idx - 1
    playTrack(playQueue[prevIdx], false)
  }

  const togglePlay = () => {
    if (audioRef.current && currentTrack?.url) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play().catch(() => {/* autoplay block ignored */})
      }
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
      setDuration(audioRef.current.duration)
    }
  }

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

  return (
    <div className="music-player-container">
      {/* Hidden global audio lives outside; we only show UI here */}
      {/* Playback persists when minimized because audio element is not unmounted */}

      {/* Now Playing */}
      <div className="music-player-header">
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
          <button 
            onClick={() => setShuffle(!shuffle)}
            className="control-btn"
            style={{ opacity: shuffle ? 1 : 0.5 }}
            title="Shuffle"
          >
            <ShuffleIcon size={20} />
          </button>
          <button onClick={playPrev} disabled={!currentTrack} className="control-btn">
            <SkipBackIcon size={20} />
          </button>
          <button onClick={togglePlay} disabled={!currentTrack} className="control-btn play-btn" title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
          </button>
          <button onClick={playNext} disabled={!currentTrack} className="control-btn">
            <SkipForwardIcon size={20} />
          </button>
          <button 
            onClick={cycleRepeat}
            className="control-btn"
            style={{ opacity: repeat !== 'off' ? 1 : 0.5 }}
            title={repeat === 'off' ? 'Repeat Off' : repeat === 'all' ? 'Repeat All' : 'Repeat One'}
          >
            {repeat === 'one' ? <RepeatOneIcon size={20} /> : <RepeatIcon size={20} />}
          </button>
          <div className="volume-control">
            <VolumeIcon size={20} />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              style={{ width: 100 }}
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
          <button onClick={() => setShowPlaylistManager(!showPlaylistManager)}>
            {showPlaylistManager ? '❌' : '➕'}
          </button>
        </div>
        
        {showPlaylistManager && (
          <div className="playlist-manager">
            <div className="playlist-manager-title">Create New Playlist</div>
            <div className="playlist-create-row">
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Playlist name..."
                className="playlist-name-input"
                onKeyPress={(e) => e.key === 'Enter' && createPlaylist()}
              />
              <button onClick={createPlaylist} className="playlist-create-btn">Create</button>
            </div>
            {currentPlaylistId !== 'default' && (
              <button 
                onClick={() => deletePlaylist(currentPlaylistId)}
                className="delete-playlist-btn"
              >
                <RecycleBinIcon size={14} /> Delete Current Playlist
              </button>
            )}
          </div>
        )}
      </div>

      {/* Playlist */}
      <div className="track-list-container">
        <div className="track-list-header">
          📀 {currentPlaylist?.name || 'Playlist'} ({tracks.length} tracks)
        </div>
        {tracks.map(track => (
          <div
            key={track.id}
            onClick={() => playTrack(track)}
            className={`track-item ${currentTrack?.id === track.id ? 'active' : ''}`}
          >
            <div className="track-icon">
              {currentTrack?.id === track.id && isPlaying ? <VolumeIcon size={16} /> : <NoteIcon size={16} />}
            </div>
            <div className="track-details">
              <div className="track-details-title">{track.title}</div>
              <div className="track-details-artist">{track.artist}</div>
            </div>
            <div className="track-duration">{track.duration}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
