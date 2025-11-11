import React, { useState, useEffect } from 'react'

import { useUser } from '../os/UserContext'
import { hydrateFromServer } from '../services/saveService'

import './HomePage.css'

export const HomePage: React.FC = () => {
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')
  const [scrolled, setScrolled] = useState(false)

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

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const features = [
    { title: 'Immersive OS Desktop', icon: '⊞' },
    { title: '10+ Applications', icon: '⚙' },
    { title: '17 Themes', icon: '◆' },
    { title: 'Open Source', icon: '◇' },
    { title: 'Persistent Storage', icon: '◀' },
    { title: 'Responsive Design', icon: '▶' }
  ]

  // Authentication for HomePage (moved from LockScreen)
  const { login: ctxLogin } = useUser()
  const [hpUsername, setHpUsername] = useState('')
  const [hpPassword, setHpPassword] = useState('')
  const [hpBusy, setHpBusy] = useState(false)
  const [hpError, setHpError] = useState<string | null>(null)

  const submitHomeLogin = async () => {
    setHpError(null)
    setHpBusy(true)
    try {
      await ctxLogin(hpUsername, hpPassword)
      await hydrateFromServer()
      // Navigate to OS (causes App to render OSApp)
      window.location.href = '/app'
    } catch (e: any) {
      setHpError(e?.message || 'Authentication failed')
    } finally {
      setHpBusy(false)
    }
  }

  return (
    <div className="home-page">
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
            A cyberpunk-themed, fully interactive operating system simulator.<br />
            Built with React, TypeScript, and modern web technologies.
          </p>

          <div className="home-auth-form">
            <input
              className="home-auth-input"
              disabled={hpBusy}
              value={hpUsername}
              onChange={e => setHpUsername(e.target.value)}
              placeholder="USERNAME"
              autoComplete="username"
              onKeyDown={e => e.key === 'Enter' && !hpBusy && submitHomeLogin()}
            />
            <input
              className="home-auth-input"
              disabled={hpBusy}
              type="password"
              value={hpPassword}
              onChange={e => setHpPassword(e.target.value)}
              placeholder="PASSWORD"
              autoComplete="current-password"
              onKeyDown={e => e.key === 'Enter' && !hpBusy && submitHomeLogin()}
            />
            {hpError && <div className="home-auth-error">{hpError}</div>}
            <div className="home-button-group">
              <button onClick={submitHomeLogin} className="home-btn home-btn-primary" disabled={hpBusy || !hpUsername || !hpPassword}>
                <span className="home-btn-text">LOGIN</span>
                <span className="home-btn-arrow">→</span>
              </button>
              <a href="/app?onboarding=1" className="home-btn home-btn-secondary">
                <span className="home-btn-text">CREATE ACCOUNT</span>
                <span className="home-btn-arrow">★</span>
              </a>
              <a href="/app" className="home-btn home-btn-secondary">
                <span className="home-btn-text">ENTER SYSTEM</span>
                <span className="home-btn-arrow">→</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="home-features">
        <div className="home-section-header">
          <h2 className="home-section-title">KEY FEATURES</h2>
          <div className="home-section-divider"></div>
        </div>

        <div className="home-features-grid">
          {features.map((feature, index) => (
            <div key={index} className="home-feature-item">
              <div className="home-feature-icon">{feature.icon}</div>
              <div className="home-feature-title">{feature.title}</div>
            </div>
          ))}
        </div>
      </section>

      {/* About Section */}
      <section className="home-about">
        <div className="home-section-header">
          <h2 className="home-section-title">ABOUT TERMINALITY</h2>
          <div className="home-section-divider"></div>
        </div>

        <div className="home-about-content">
          <div className="home-about-box">
            <h3>A Hacking Simulator for the Modern Era</h3>
            <p>
              Terminality is an educational project that reimagines what a fictional operating system could look like. 
              Inspired by cyberpunk aesthetics and hacking interfaces from popular media, it combines cutting-edge web 
              technologies with creative design. Every window can be dragged, resized, and minimized. Every application 
              is functional—your desktop state persists across sessions.
            </p>
          </div>

          <div className="home-stats-grid">
            <div className="home-stat-card">
              <div className="home-stat-number">17</div>
              <div className="home-stat-label">THEMES</div>
            </div>
            <div className="home-stat-card">
              <div className="home-stat-number">10+</div>
              <div className="home-stat-label">APPLICATIONS</div>
            </div>
            <div className="home-stat-card">
              <div className="home-stat-number">100%</div>
              <div className="home-stat-label">RESPONSIVE</div>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="home-tech">
        <div className="home-section-header">
          <h2 className="home-section-title">TECHNOLOGY STACK</h2>
          <div className="home-section-divider"></div>
        </div>

        <div className="home-tech-grid">
          <div className="home-tech-item">
            <h4>Frontend</h4>
            <ul>
              <li>React 18.3</li>
              <li>TypeScript 5.6</li>
              <li>Vite 5.4</li>
            </ul>
          </div>
          <div className="home-tech-item">
            <h4>Testing</h4>
            <ul>
              <li>Vitest 2.x</li>
              <li>@testing-library</li>
              <li>jsdom</li>
            </ul>
          </div>
          <div className="home-tech-item">
            <h4>Quality Assurance</h4>
            <ul>
              <li>ESLint 8</li>
              <li>Prettier 3</li>
              <li>GitHub Actions CI/CD</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="home-cta">
        <h2 className="home-cta-title">READY TO ENTER THE SYSTEM?</h2>
        <p className="home-cta-subtitle">Experience a cyberpunk-themed interface like never before.</p>
        <a href="/app" className="home-btn home-btn-large">
          <span className="home-btn-text">LAUNCH OS</span>
          <span className="home-btn-arrow">→</span>
        </a>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="home-footer-content">
          <p className="home-footer-text">© 2025 TERMINALITY. An open-source cyberpunk OS simulator.</p>
          <div className="home-footer-links">
            <a href="https://github.com/Axidify/Terminality-V2" target="_blank" rel="noopener noreferrer">GITHUB</a>
            <span className="home-footer-sep">◆</span>
            <a href="https://github.com/Axidify/Terminality-V2/issues" target="_blank" rel="noopener noreferrer">ISSUES</a>
            <span className="home-footer-sep">◆</span>
            <a href="https://github.com/Axidify/Terminality-V2/discussions" target="_blank" rel="noopener noreferrer">DISCUSS</a>
          </div>
        </div>
      </footer>

      {/* Status bar */}
      <div className={`home-status-bar ${scrolled ? 'scrolled' : ''}`}>
        <span className="home-status-indicator"></span>
        <span className="home-status-text">SYSTEM ONLINE</span>
      </div>
    </div>
  )
}
