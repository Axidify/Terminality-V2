import React, { useState, useEffect, useRef } from 'react'
import { sounds } from '../SoundEffects'
import { register } from '../../services/auth'
import { getCachedDesktop } from '../../services/saveService'
import './OnboardingPage.css'

interface Props {
  onComplete: () => void
  onBack: () => void
}

type Step = 'welcome' | 'terms' | 'account' | 'complete'

export const OnboardingPage: React.FC<Props> = ({ onComplete, onBack }) => {
  const [step, setStep] = useState<Step>('welcome')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Audio context refs for ambient music
  const audioContextRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const intervalRef = useRef<number | null>(null)
  const padIntervalRef = useRef<number | null>(null)
  
  // Generate particle positions once and keep them stable
  const particlesRef = React.useRef<Array<{left: string; top: string; width: string; height: string; delay: string; duration: string}>>(
    Array.from({ length: 30 }, () => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      width: `${2 + Math.random() * 3}px`,
      height: `${2 + Math.random() * 3}px`,
      delay: `${Math.random() * 15}s`,
      duration: `${10 + Math.random() * 10}s`
    }))
  )

  // Initialize ambient music
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

    // Fade in
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
        gain.gain.linearRampToValueAtTime(0.08, t + 2)
        gain.gain.linearRampToValueAtTime(0.06, t + 10)
        gain.gain.linearRampToValueAtTime(0, t + 12)
        osc.start(t)
        osc.stop(t + 12.5)
      })
    }
    playChord()
    intervalRef.current = setInterval(playChord, 12000)
    
    // Bell tones
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
        gain.gain.linearRampToValueAtTime(0.06, t + 0.1)
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

  // Disable right-click on onboarding
  useEffect(() => {
    const handler = (e: MouseEvent) => e.preventDefault()
    document.addEventListener('contextmenu', handler, { capture: true })
    return () => document.removeEventListener('contextmenu', handler, { capture: true } as any)
  }, [])

  // Lock body & root scroll while onboarding is displayed
  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
    }
  }, [])

  const handleNext = () => {
    sounds.click()
    if (step === 'welcome') setStep('terms')
    else if (step === 'terms') {
      if (!acceptedTerms) {
        setError('You must accept the terms to continue')
        return
      }
      setError(null)
      setStep('account')
    }
  }

  const handleCreateAccount = async () => {
    setError(null)
    
    if (!username || !password) {
      setError('Username and password are required')
      return
    }
    
    if (username.length < 3) {
      setError('Username must be at least 3 characters')
      return
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setBusy(true)
    try {
      await register(username, password)
      sounds.login()
      setStep('complete')
      setTimeout(() => {
        onComplete()
      }, 2000)
    } catch (e: any) {
      setError(e?.message || 'Registration failed')
      sounds.error()
    } finally {
      setBusy(false)
    }
  }

  const handleBack = () => {
    sounds.click()
    if (step === 'terms') setStep('welcome')
    else if (step === 'account') setStep('terms')
    else onBack()
  }

  const getStepNumber = () => {
    const steps: Step[] = ['welcome', 'terms', 'account', 'complete']
    return steps.indexOf(step) + 1
  }

  return (
    <div className="onboarding-page" onContextMenu={(e) => e.preventDefault()}>
      <div className="onboarding-container">
        {/* Header */}
        <div className="onboarding-header">
          <div className="onboarding-logo">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <polygon 
                className="onboarding-logo-hex"
                points="50,5 90,25 90,65 50,85 10,65 10,25" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
              />
              <circle className="onboarding-logo-node" cx="50" cy="30" r="3" fill="currentColor" />
              <circle className="onboarding-logo-node" cx="70" cy="45" r="3" fill="currentColor" />
              <circle className="onboarding-logo-node" cx="50" cy="60" r="3" fill="currentColor" />
              <circle className="onboarding-logo-node" cx="30" cy="45" r="3" fill="currentColor" />
              <line className="onboarding-logo-line" x1="50" y1="30" x2="70" y2="45" stroke="currentColor" strokeWidth="1.5" />
              <line className="onboarding-logo-line" x1="70" y1="45" x2="50" y2="60" stroke="currentColor" strokeWidth="1.5" />
              <line className="onboarding-logo-line" x1="50" y1="60" x2="30" y2="45" stroke="currentColor" strokeWidth="1.5" />
              <line className="onboarding-logo-line" x1="30" y1="45" x2="50" y2="30" stroke="currentColor" strokeWidth="1.5" />
              <circle className="onboarding-logo-core" cx="50" cy="45" r="8" fill="currentColor" />
            </svg>
          </div>
          <h1 className="onboarding-brand-title">TERMINALITY</h1>
          <p className="onboarding-brand-subtitle">OPERATING SYSTEM</p>
          <div className="onboarding-divider"></div>
        </div>

        {/* Progress Indicator */}
        {step !== 'complete' && (
          <div className="onboarding-progress">
            <div className="progress-steps">
              {['Welcome', 'Terms', 'Account'].map((label, idx) => (
                <div key={label} className={`progress-step ${idx < getStepNumber() - 1 ? 'completed' : ''} ${idx === getStepNumber() - 1 ? 'active' : ''}`}>
                  <div className="step-number">{idx + 1}</div>
                  <div className="step-label">{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className="onboarding-content">
          {step === 'welcome' && (
            <div className="onboarding-step welcome-step">
              <h2>Welcome to Terminality OS</h2>
              <p className="step-description">
                Experience a revolutionary operating system that combines modern design with powerful terminal capabilities.
              </p>
              <div className="feature-list">
                <div className="feature-item">
                  <svg className="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                  </svg>
                  <div className="feature-text">
                    <h3>File Management</h3>
                    <p>Organize your files with an intuitive explorer</p>
                  </div>
                </div>
                <div className="feature-item">
                  <svg className="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  <div className="feature-text">
                    <h3>Integrated Terminal</h3>
                    <p>Full terminal access with command history</p>
                  </div>
                </div>
                <div className="feature-item">
                  <svg className="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  <div className="feature-text">
                    <h3>Customizable Themes</h3>
                    <p>Personalize your workspace with multiple themes</p>
                  </div>
                </div>
                <div className="feature-item">
                  <svg className="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                  <div className="feature-text">
                    <h3>Secure & Private</h3>
                    <p>Your data is encrypted and protected</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'terms' && (
            <div className="onboarding-step terms-step">
              <h2>Terms of Service</h2>
              <div className="terms-content">
                <h3>1. Acceptance of Terms</h3>
                <p>
                  By creating an account, you agree to these terms. This is a demonstration OS for educational purposes.
                </p>
                
                <h3>2. User Responsibilities</h3>
                <p>
                  You are responsible for maintaining account security. Choose a strong password and keep it confidential.
                </p>
                
                <h3>3. Data & Privacy</h3>
                <p>
                  Your data is stored locally and on our servers. We do not sell or share personal information.
                </p>
                
                <h3>4. Disclaimer</h3>
                <p>
                  This software is provided "as is" without warranty. Use at your own risk.
                </p>
              </div>
              
              <label className="terms-checkbox">
                <input 
                  type="checkbox" 
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                />
                <span>I have read and accept the Terms of Service</span>
              </label>
            </div>
          )}

          {step === 'account' && (
            <div className="onboarding-step account-step">
              <h2>Create Your Account</h2>
              <p className="step-description">
                Choose a username and password to secure your account.
              </p>
              
              <div className="account-form">
                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a username (min 3 characters)"
                    disabled={busy}
                    autoComplete="username"
                    autoFocus
                  />
                </div>
                
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password (min 6 characters)"
                    disabled={busy}
                    autoComplete="new-password"
                  />
                </div>
                
                <div className="form-group">
                  <label>Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    disabled={busy}
                    autoComplete="new-password"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !busy) handleCreateAccount()
                    }}
                  />
                </div>
                
                {error && <div className="onboarding-error">{error}</div>}
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="onboarding-step complete-step">
              <div className="success-icon">✓</div>
              <h2>Account Created!</h2>
              <p className="step-description">
                Welcome to Terminality OS, <strong>{username}</strong>!
              </p>
              <p className="step-description">
                Preparing your workspace...
              </p>
              <div className="loading-spinner"></div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        {step !== 'complete' && (
          <div className="onboarding-actions">
            <button 
              className="onboarding-btn btn-secondary" 
              onClick={handleBack}
              disabled={busy}
            >
              {step === 'welcome' ? 'Back to Login' : 'Back'}
            </button>
            
            {step === 'welcome' && (
              <button className="onboarding-btn btn-primary" onClick={handleNext}>
                Get Started →
              </button>
            )}
            
            {step === 'terms' && (
              <button 
                className="onboarding-btn btn-primary" 
                onClick={handleNext}
                disabled={!acceptedTerms}
              >
                Continue →
              </button>
            )}
            
            {step === 'account' && (
              <button 
                className="onboarding-btn btn-primary" 
                onClick={handleCreateAccount}
                disabled={busy}
              >
                {busy ? 'Creating Account...' : 'Create Account'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Background particles */}
      <div className="onboarding-particles">
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
