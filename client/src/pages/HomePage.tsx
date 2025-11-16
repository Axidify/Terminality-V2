import React, { useState, useEffect } from 'react'

import GoogleSignInButton from '../os/components/GoogleSignInButton'
import Icon from '../os/components/icons/Icon'
import { useUser } from '../os/UserContext'
import { apiRequest } from '../services/api'
import { loginWithGoogle } from '../services/auth'
import { saveDesktopState } from '../services/saveService'

import './HomePage.css'

export const HomePage: React.FC = () => {
  const [isExiting, setIsExiting] = useState(false)
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const [backendStatus, setBackendStatus] = useState<'unknown'|'online'|'offline'>('unknown')

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

  // Backend health check: poll /health to display online/offline status
  useEffect(() => {
    let mounted = true
    const check = async () => {
      try {
        await apiRequest('/health')
        if (mounted) setBackendStatus('online')
      } catch (_err) {
        if (mounted) setBackendStatus('offline')
      }
    }
    // initial check
    check()
    const id = setInterval(check, 10000)
    const handleOnline = () => check()
    const handleVisibility = () => { if (document.visibilityState === 'visible') check() }
    window.addEventListener('online', handleOnline)
    window.addEventListener('visibilitychange', handleVisibility)
    return () => { mounted = false; clearInterval(id); window.removeEventListener('online', handleOnline); window.removeEventListener('visibilitychange', handleVisibility) }
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Handle OAuth2 redirect hash fragment: #access_token=... (optional state preserved in search params)
  useEffect(() => {
    const hash = window.location.hash || ''
    if (hash.startsWith('#')) {
      setIsExiting(true)
      const frag = new URLSearchParams(hash.slice(1))
      const token = frag.get('access_token')
      if (token) {
        try {
          // Do NOT store the access token in localStorage.
          // The refresh cookie issued by the server will allow on-demand token refresh.
          // Clean hash from URL to avoid repeated processing
          history.replaceState(null, document.title, window.location.pathname + window.location.search)
          // Lock state then navigate
          ;(async () => {
            try {
              await saveDesktopState({ isLocked: true })
            } catch (err) {
              console.warn('[home] failed to persist lock state before redirect', err)
            }
            setTimeout(() => { window.location.href = '/app' }, 400)
          })()
        } catch (e) {
          console.error('[oauth][token][store] error', e)
        }
      }
    }
  }, [])

  // features array removed (replaced with game-focused feature cards)

  // Authentication for HomePage (moved from LockScreen)
  const { user, login: ctxLogin } = useUser()
  const [hpUsername, setHpUsername] = useState('')
  const [hpPassword, setHpPassword] = useState('')
  const [hpBusy, setHpBusy] = useState(false)
  const [hpError, setHpError] = useState<string | null>(null)
  const hpGoogleBusy = false
  const [hpGoogleError, setHpGoogleError] = useState<string | null>(null)

  const submitHomeLogin = async () => {
    setHpError(null)
    setHpBusy(true)
    try {
      await ctxLogin(hpUsername, hpPassword)
      // After successful auth, ensure the OS starts at the Lock screen
      await saveDesktopState({ isLocked: true })
      setIsExiting(true)
      setTimeout(() => { window.location.href = '/app' }, 500)
    } catch (e: any) {
      setHpError(e?.message || 'Authentication failed')
    } finally {
      setHpBusy(false)
    }
  }

  // Guard navigation to OS routes behind auth
  const guardNav = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (!user) {
      e.preventDefault()
      setHpError('Please authenticate to access the system')
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } catch (err) {
        console.warn('[home] failed to scroll to top after auth guard', err)
      }
    }
  }

  return (
    <div className={`home-page ${isExiting ? 'exiting' : ''}`}>
      {/* Background grid and scanlines */}
      <div className="home-bg-grid"></div>
      <div className="home-scanlines"></div>

      {/* Particles */}
      <div className="home-particles">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="home-particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 10}s`,
              animationDuration: `${8 + Math.random() * 6}s`
            }}
          />
        ))}
      </div>

      {/* Hero Section */}
      <section className="home-hero">
        <div className="home-hero-content">
          {/* Logo */}
          <div className="home-logo-wrapper">
            <svg className="home-logo-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <polygon 
                className="home-logo-hex"
                points="50,5 90,25 90,65 50,85 10,65 10,25" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
              />
              <circle className="home-logo-node" cx="50" cy="30" r="3" fill="currentColor" />
              <circle className="home-logo-node" cx="70" cy="45" r="3" fill="currentColor" />
              <circle className="home-logo-node" cx="50" cy="60" r="3" fill="currentColor" />
              <circle className="home-logo-node" cx="30" cy="45" r="3" fill="currentColor" />
              <line className="home-logo-line" x1="50" y1="30" x2="70" y2="45" stroke="currentColor" strokeWidth="1.5" />
              <line className="home-logo-line" x1="70" y1="45" x2="50" y2="60" stroke="currentColor" strokeWidth="1.5" />
              <line className="home-logo-line" x1="50" y1="60" x2="30" y2="45" stroke="currentColor" strokeWidth="1.5" />
              <line className="home-logo-line" x1="30" y1="45" x2="50" y2="30" stroke="currentColor" strokeWidth="1.5" />
              <circle className="home-logo-core" cx="50" cy="45" r="8" fill="currentColor" />
            </svg>
          </div>

          <h1 className="home-brand-title">TERMINALITY</h1>
          <p className="home-brand-subtitle">OPERATING SYSTEM</p>

          <div className="home-divider"></div>

          <div className="home-system-info">
            <div className="home-time">{time}</div>
            <div className="home-date">{date}</div>
          </div>

          <p className="home-tagline">
            CLASSIFIED BRIEFING TERMINAL<br />
            Access Level: INVESTIGATOR
          </p>

          <div className="home-auth-form">
            <input
              className="home-auth-input"
              disabled={hpBusy}
              value={hpUsername}
              onChange={e => setHpUsername(e.target.value)}
              placeholder="AGENT ID"
              autoComplete="username"
              onKeyDown={e => e.key === 'Enter' && !hpBusy && submitHomeLogin()}
            />
            <input
              className="home-auth-input"
              disabled={hpBusy}
              type="password"
              value={hpPassword}
              onChange={e => setHpPassword(e.target.value)}
              placeholder="SECURITY CODE"
              autoComplete="current-password"
              onKeyDown={e => e.key === 'Enter' && !hpBusy && submitHomeLogin()}
            />
            {hpError && <div className="home-auth-error">{hpError}</div>}
            <div className="home-button-group">
              <button onClick={submitHomeLogin} className="home-btn home-btn-primary" disabled={hpBusy || !hpUsername || !hpPassword}>
                <span className="home-btn-text">AUTHENTICATE</span>
                <span className="home-btn-arrow"><Icon name="arrow-right" size={14} /></span>
              </button>
              <a href="/reset" className="home-forgot-link">Forgot password?</a>
              {/* Google Sign-in */}
              <GoogleSignInButton
                onSuccess={async (idToken: string) => { await loginWithGoogle(idToken); await saveDesktopState({ isLocked: true }); window.location.href = '/app' }}
                onError={(e: unknown) => setHpGoogleError(String(e))}
                disabled={hpGoogleBusy}
              />
            </div>
          </div>
          {hpGoogleError && <div className="home-auth-error">{hpGoogleError}</div>}
        </div>
      </section>

      {/* Features Section */}
      <section className="home-features">
        <div className="home-section-header">
          <h2 className="home-section-title">ACTIVE INVESTIGATIONS</h2>
          <div className="home-section-divider"></div>
        </div>

        <div className="home-features-grid">
          <div className="home-feature-item">
            <div className="home-feature-icon">
              <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true" focusable="false">
                <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <rect x="16.5" y="16" width="6" height="1.8" rx="0.9" transform="rotate(45 16.5 16)" fill="currentColor" />
              </svg>
            </div>
            <div className="home-feature-title">Solve Mysteries</div>
            <div className="home-feature-desc">Uncover clues using desktop tools</div>
          </div>
          <div className="home-feature-item">
            <div className="home-feature-icon">
              <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true" focusable="false">
                <rect x="3" y="4" width="18" height="12" rx="1" stroke="currentColor" strokeWidth="1.4" fill="none" />
                <rect x="7" y="17" width="10" height="1.6" rx="0.8" fill="currentColor" />
              </svg>
            </div>
            <div className="home-feature-title">Use Hacking Tools</div>
            <div className="home-feature-desc">Analyze files, emails, networks</div>
          </div>
          <div className="home-feature-item">
            <div className="home-feature-icon">
              <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true" focusable="false">
                <rect x="4" y="12" width="3" height="8" fill="currentColor" />
                <rect x="9" y="8" width="3" height="12" fill="currentColor" />
                <rect x="14" y="4" width="3" height="16" fill="currentColor" />
              </svg>
            </div>
            <div className="home-feature-title">Track Progress</div>
            <div className="home-feature-desc">Monitor case status in real-time</div>
          </div>
          <div className="home-feature-item">
            <div className="home-feature-icon">
              <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true" focusable="false">
                <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.4" fill="none" />
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.4" fill="none" />
                <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
            <div className="home-feature-title">Multiple Cases</div>
            <div className="home-feature-desc">Tackle diverse investigations</div>
          </div>
          <div className="home-feature-item">
            <div className="home-feature-icon">
              <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true" focusable="false">
                <path d="M7 4v2a3 3 0 0 0 3 3h4a3 3 0 0 0 3-3V4" stroke="currentColor" strokeWidth="1.4" fill="none"/>
                <path d="M6 19a6 6 0 0 0 12 0" stroke="currentColor" strokeWidth="1.4" fill="none"/>
              </svg>
            </div>
            <div className="home-feature-title">Unlock Achievements</div>
            <div className="home-feature-desc">Master investigator rank awaits</div>
          </div>
          <div className="home-feature-item">
            <div className="home-feature-icon">
              <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true" focusable="false">
                <polyline points="13 2 3 14 12 14 11 22 21 10 12 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="home-feature-title">Real-Time Gameplay</div>
            <div className="home-feature-desc">Dynamic puzzle environments</div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="home-about">
        <div className="home-section-header">
          <h2 className="home-section-title">CLASSIFIED DOSSIER</h2>
          <div className="home-section-divider"></div>
        </div>

        <div className="home-about-content">
          <div className="home-about-box">
            <h3>Welcome, Agent</h3>
            <p>
              You have been recruited into TERMINALITY—a covert investigation network. Your mission: 
              solve mysteries using a network of interconnected tools and databases. Each case presents unique challenges, 
              from cryptographic puzzles to digital forensics. Every decision matters. Every clue is critical. 
              Can you crack the case before time runs out?
            </p>
          </div>

          <div className="home-stats-grid">
            <div className="home-stat-card">
              <div className="home-stat-number">∞</div>
              <div className="home-stat-label">CASES</div>
            </div>
            <div className="home-stat-card">
              <div className="home-stat-number">10+</div>
              <div className="home-stat-label">TOOLS</div>
            </div>
            <div className="home-stat-card">
              <div className="home-stat-number">LIVE</div>
              <div className="home-stat-label">STATUS</div>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="home-tech">
        <div className="home-section-header">
          <h2 className="home-section-title">INVESTIGATOR TOOLKIT</h2>
          <div className="home-section-divider"></div>
        </div>

        <div className="home-tech-grid">
          <div className="home-tech-item">
            <h4>Analysis Tools</h4>
            <ul>
              <li>File Inspector</li>
              <li>Email Analyzer</li>
              <li>Network Monitor</li>
            </ul>
          </div>
          <div className="home-tech-item">
            <h4>Communications</h4>
            <ul>
              <li>Secure Chat</li>
              <li>Message Decoder</li>
              <li>Call Logs</li>
            </ul>
          </div>
          <div className="home-tech-item">
            <h4>Case Management</h4>
            <ul>
              <li>Clue Board</li>
              <li>Timeline Tracker</li>
              <li>Evidence Locker</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="home-cta">
        <h2 className="home-cta-title">THE INVESTIGATION AWAITS</h2>
        <p className="home-cta-subtitle">Are you ready to take on the case? Solve mysteries. Uncover the truth. Become a master investigator.</p>
        <a href="/app" className="home-btn home-btn-large home-btn-primary" onClick={guardNav}>
          <span className="home-btn-text">ACCESS CASE FILES</span>
          <span className="home-btn-arrow">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
              <path d="M5 12h11M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </span>
        </a>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="home-footer-content">
          <p className="home-footer-text">© 2025 TERMINALITY INVESTIGATIVE NETWORK. Authorized Access Only.</p>
          <div className="home-footer-links">
            <a href="https://github.com/Axidify/Terminality-V2" target="_blank" rel="noopener noreferrer">GITHUB</a>
            <span className="home-footer-sep">◆</span>
            <a href="https://github.com/Axidify/Terminality-V2/issues" target="_blank" rel="noopener noreferrer">BUG REPORTS</a>
            <span className="home-footer-sep">◆</span>
            <a href="https://github.com/Axidify/Terminality-V2/discussions" target="_blank" rel="noopener noreferrer">SUPPORT</a>
          </div>
        </div>
      </footer>

      {/* Status bar */}
      <div className={`home-status-bar ${scrolled ? 'scrolled' : ''}`}>
        <span className={`home-status-label ${backendStatus}`} role="status" aria-live="polite">
          <span className={`home-status-indicator ${backendStatus}`} aria-hidden="true" />
          {backendStatus === 'online' ? 'SYSTEM ONLINE' : backendStatus === 'offline' ? 'SYSTEM OFFLINE' : 'SYSTEM STATUS UNKNOWN'}
        </span>
      </div>
    </div>
  )
}
