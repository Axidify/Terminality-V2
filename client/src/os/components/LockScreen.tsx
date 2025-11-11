import React, { useState, useRef, useEffect } from 'react'

import { isLoggedIn } from '../../services/auth'
import { hydrateFromServer, getCachedDesktop } from '../../services/saveService'
import { useNotifications } from '../NotificationContext'
import { sounds } from '../SoundEffects'
import { useUser } from '../UserContext'
import './LockScreen.css'

interface Props {
  onUnlock: () => void
  onRegister: () => void
}

export const LockScreen: React.FC<Props> = ({ onUnlock, onRegister }) => {
  const { addNotification } = useNotifications()
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')
  const [isExiting, setIsExiting] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const intervalRef = useRef<number | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const padIntervalRef = useRef<number | null>(null)
  
  // Generate particle positions once and keep them stable
  const particlesRef = useRef<Array<{left: string; top: string; width: string; height: string; delay: string; duration: string}>>(
    Array.from({ length: 40 }, () => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      width: `${2 + Math.random() * 3}px`,
      height: `${2 + Math.random() * 3}px`,
      delay: `${Math.random() * 15}s`,
      duration: `${10 + Math.random() * 10}s`
    }))
  )

  // Initialize ambient music - changes based on currentPreview
  useEffect(() => {
    // Respect server-backed sound effects setting
    const enabled = getCachedDesktop()?.soundEffectsEnabled
    if (enabled === false) return

    // Clean up previous context
    if (intervalRef.current) { clearInterval(intervalRef.current) }
    if (padIntervalRef.current) { clearInterval(padIntervalRef.current) }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') { 
      audioContextRef.current.close() 
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    audioContextRef.current = audioContext

    // Master gain for ambient
    const masterGain = audioContext.createGain()
    masterGain.connect(audioContext.destination)
    masterGainRef.current = masterGain

    // Fade in (increased volume for Starfield)
    masterGain.gain.setValueAtTime(0, audioContext.currentTime)
    masterGain.gain.linearRampToValueAtTime(2.0, audioContext.currentTime + 2)

    const chords = [
      [220, 261.63, 329.63], // Am
      [174.61, 220, 261.63], // F
      [130.81, 164.81, 196],  // C
      [196, 246.94, 293.66]   // G
    ]
    let chordIdx = 0
    const playChord = () => {
      if (audioContext.state === 'closed') return
      const freqs = chords[chordIdx]
      chordIdx = (chordIdx + 1) % chords.length
      freqs.forEach((f, i) => {
        const osc = audioContext.createOscillator()
        const gain = audioContext.createGain()
        osc.type = 'triangle'
        osc.frequency.value = f
        osc.detune.value = (i - 1) * 8
        osc.connect(gain)
        gain.connect(masterGain)
        const t = audioContext.currentTime
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(0.08, t + 2) // Increased from 0.04
        gain.gain.linearRampToValueAtTime(0.06, t + 10) // Increased from 0.02
        gain.gain.linearRampToValueAtTime(0, t + 12)
        osc.start(t)
        osc.stop(t + 12.5)
      })
    }
    playChord()
    intervalRef.current = setInterval(playChord, 12000)
    
    // Bell tones (louder)
    const bell = (freq: number, delay: number) => {
      setTimeout(() => {
        if (audioContext.state === 'closed') return
        const osc = audioContext.createOscillator()
        const gain = audioContext.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        osc.connect(gain)
        gain.connect(masterGain)
        const t = audioContext.currentTime
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(0.06, t + 0.1) // Increased from 0.03
        gain.gain.exponentialRampToValueAtTime(0.001, t + 5)
        osc.start(t)
        osc.stop(t + 5.5)
      }, delay)
    }
    const bellSeq = () => { bell(659.25, 0); bell(783.99, 3000); bell(987.77, 6000) }
    bellSeq()
    padIntervalRef.current = setInterval(bellSeq, 18000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (padIntervalRef.current) clearInterval(padIntervalRef.current)
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close()
      }
    }
  }, [])

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }))
      setDate(now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }))
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  // Disable context menu on the login screen
  useEffect(() => {
    const handler = (e: MouseEvent) => e.preventDefault()
    document.addEventListener('contextmenu', handler, { capture: true })
    return () => document.removeEventListener('contextmenu', handler, { capture: true } as any)
  }, [])

  const handleButtonHover = () => {
    sounds.hover()
  }

  const handleUnlock = () => {
    sounds.click()
    sounds.login()
    setIsExiting(true)
    
    // Fade out ambient music over 1 second
    if (masterGainRef.current && audioContextRef.current) {
      const now = audioContextRef.current.currentTime
      masterGainRef.current.gain.cancelScheduledValues(now)
      masterGainRef.current.gain.setValueAtTime(masterGainRef.current.gain.value, now)
      masterGainRef.current.gain.linearRampToValueAtTime(0, now + 1)
    }
    
    // Add welcome notification
    setTimeout(() => {
      addNotification(
        'Welcome to Terminality OS',
        'System initialized successfully. All tools are ready.',
        'success'
      )
    }, 800)
    
    setTimeout(() => {
      onUnlock()
    }, 500) // Match animation duration
  }

  const { login: ctxLogin } = useUser()

  const submitLogin = async () => {
    setError(null)
    setBusy(true)
    try {
      await ctxLogin(username, password)
      await hydrateFromServer()
      handleUnlock()
    } catch (e: any) {
      setError(e?.message || 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    // If already logged in, hydrate and unlock automatically
    (async () => {
      if (isLoggedIn()) {
  try { await hydrateFromServer(); handleUnlock() } catch { /* ignore */ }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={`lock-screen ${isExiting ? 'exiting' : ''}`} onContextMenu={(e) => e.preventDefault()}>
      <div className="lock-screen-content">
        {/* Terminality OS Logo */}
        <div className="lock-logo-wrapper">
          <svg className="lock-logo-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <polygon 
              className="lock-logo-hex"
              points="50,5 90,25 90,65 50,85 10,65 10,25" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            />
            <circle className="lock-logo-node" cx="50" cy="30" r="3" fill="currentColor" />
            <circle className="lock-logo-node" cx="70" cy="45" r="3" fill="currentColor" />
            <circle className="lock-logo-node" cx="50" cy="60" r="3" fill="currentColor" />
            <circle className="lock-logo-node" cx="30" cy="45" r="3" fill="currentColor" />
            <line className="lock-logo-line" x1="50" y1="30" x2="70" y2="45" stroke="currentColor" strokeWidth="1.5" />
            <line className="lock-logo-line" x1="70" y1="45" x2="50" y2="60" stroke="currentColor" strokeWidth="1.5" />
            <line className="lock-logo-line" x1="50" y1="60" x2="30" y2="45" stroke="currentColor" strokeWidth="1.5" />
            <line className="lock-logo-line" x1="30" y1="45" x2="50" y2="30" stroke="currentColor" strokeWidth="1.5" />
            <circle className="lock-logo-core" cx="50" cy="45" r="8" fill="currentColor" />
          </svg>
        </div>

        <div className="lock-brand-title">TERMINALITY</div>
        <div className="lock-brand-subtitle">OPERATING SYSTEM</div>

        <div className="lock-screen-divider"></div>

        <div className="lock-screen-time">{time}</div>
        <div className="lock-screen-date">{date}</div>

        <div className="lock-auth-section">
          <div className="lock-user-label">USER AUTHENTICATION</div>
          <div className="lock-auth-form">
            <input
              disabled={busy}
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !busy && submitLogin()}
              placeholder="USERNAME"
              className="lock-input"
              autoComplete="username"
            />
            <input
              disabled={busy}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !busy && submitLogin()}
              placeholder="PASSWORD"
              className="lock-input"
              autoComplete="current-password"
            />
            {error && <div className="lock-error-message">{error}</div>}
            <div className="lock-button-group">
              <button 
                onClick={submitLogin} 
                onMouseEnter={handleButtonHover} 
                className="unlock-button unlock-button-primary" 
                disabled={busy || !username || !password}
              >
                <span className="unlock-text">LOGIN</span>
                <span className="unlock-arrow">→</span>
              </button>
              <button 
                onClick={() => { sounds.click(); onRegister(); }} 
                onMouseEnter={handleButtonHover} 
                className="unlock-button unlock-button-secondary" 
                disabled={busy}
              >
                <span className="unlock-text">CREATE ACCOUNT</span>
                <span className="unlock-arrow">★</span>
              </button>
            </div>
          </div>
        </div>

        <div className="lock-screen-status">
          <span className="status-indicator"></span>
          <span className="status-text">SECURE CONNECTION</span>
        </div>
      </div>

      {/* Ambient Particles */}
      <div className="lock-particles">
        {particlesRef.current.map((particle, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: particle.left,
              top: particle.top,
              width: particle.width,
              height: particle.height,
              animationDelay: particle.delay,
              animationDuration: particle.duration
            }}
          />
        ))}
      </div>
    </div>
  )
}
