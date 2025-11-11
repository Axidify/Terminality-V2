import React, { useState, useEffect } from 'react'
import './HomePage.css'

interface Feature {
  icon: React.ReactNode
  title: string
  description: string
}

export const HomePage: React.FC = () => {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const features: Feature[] = [
    {
      icon: (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
      title: 'Immersive OS Desktop',
      description: 'A fully functional cyberpunk-themed operating system with draggable windows, taskbar, and system utilities.'
    },
    {
      icon: (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      title: 'Multiple Applications',
      description: 'Terminal, File Explorer, Chat, Email, Music Player, Notepad, Admin Panel, and more built-in programs.'
    },
    {
      icon: (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ),
      title: '17 Themes',
      description: 'Customize your experience with dual-tone color themes designed for immersive cyberpunk aesthetics.'
    },
    {
      icon: (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
        </svg>
      ),
      title: 'Open Source',
      description: 'Built with React and TypeScript. Fork, modify, and contribute to this educational hacking simulator.'
    },
    {
      icon: (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="9" y1="9" x2="15" y2="9" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      ),
      title: 'Persistent Storage',
      description: 'Desktop state, file contents, and settings are saved and restored across sessions.'
    },
    {
      icon: (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
          <line x1="12" y1="6" x2="12" y2="12" />
          <line x1="12" y1="12" x2="16" y2="16" />
        </svg>
      ),
      title: 'Responsive Design',
      description: 'Works seamlessly across desktop browsers with intuitive mouse and keyboard interactions.'
    }
  ]

  return (
    <div className="homepage">
      {/* Navigation */}
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="navbar-container">
          <div className="navbar-logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span>Terminality</span>
          </div>
          <div className="navbar-links">
            <a href="#features">Features</a>
            <a href="#about">About</a>
            <a href="#screenshots">Showcase</a>
            <a href="#cta" className="btn-launch">
              Launch OS
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">
            Welcome to <span className="gradient-text">Terminality</span>
          </h1>
          <p className="hero-subtitle">
            A cyberpunk-themed, fully interactive operating system simulator built with React and TypeScript.
          </p>
          <p className="hero-description">
            Experience a fictional hacking interface with draggable windows, multiple applications, persistent storage, and 17 immersive themes. Designed for education, creativity, and fun.
          </p>
          <div className="hero-buttons">
            <a href="/app" className="btn btn-primary">
              Enter OS
            </a>
            <a href="https://github.com/Axidify/Terminality-V2" target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              GitHub Repository
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-matrix">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="matrix-char">
                {String.fromCharCode(Math.random() * 93 + 33)}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features" id="features">
        <div className="section-container">
          <h2 className="section-title">Key Features</h2>
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="about" id="about">
        <div className="section-container">
          <h2 className="section-title">About Terminality</h2>
          <div className="about-content">
            <div className="about-text">
              <h3>A Hacking Simulator for the Modern Era</h3>
              <p>
                Terminality is an educational project that reimagines what a fictional operating system could look like. Inspired by cyberpunk aesthetics and hacking interfaces from popular media, it combines cutting-edge web technologies with creative design.
              </p>
              <h3>Built For Exploration</h3>
              <p>
                Every window can be dragged, resized, and minimized. Every application is functional—write notes, explore files, send messages, and manage your virtual system. Your desktop state persists, so your work is always saved.
              </p>
              <h3>Technologies</h3>
              <p>
                Built with <strong>React 18</strong>, <strong>TypeScript</strong>, <strong>Vite</strong>, and styled with modern CSS. Tested with <strong>Vitest</strong> and <strong>@testing-library/react</strong>. The entire codebase is production-grade and follows best practices for code quality, accessibility, and maintainability.
              </p>
            </div>
            <div className="about-stats">
              <div className="stat">
                <div className="stat-number">17</div>
                <div className="stat-label">Themes</div>
              </div>
              <div className="stat">
                <div className="stat-number">10+</div>
                <div className="stat-label">Applications</div>
              </div>
              <div className="stat">
                <div className="stat-number">100%</div>
                <div className="stat-label">Responsive</div>
              </div>
              <div className="stat">
                <div className="stat-number">∞</div>
                <div className="stat-label">Extensible</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Screenshots Section */}
      <section className="screenshots" id="screenshots">
        <div className="section-container">
          <h2 className="section-title">Experience the Interface</h2>
          <div className="screenshots-grid">
            <div className="screenshot-card">
              <div className="screenshot-preview desktop-preview" />
              <h3>Desktop View</h3>
              <p>The main OS interface with customizable wallpapers and theme system.</p>
            </div>
            <div className="screenshot-card">
              <div className="screenshot-preview terminal-preview" />
              <h3>Terminal Application</h3>
              <p>A fully functional terminal for running simulated system commands.</p>
            </div>
            <div className="screenshot-card">
              <div className="screenshot-preview apps-preview" />
              <h3>Multiple Applications</h3>
              <p>Email, chat, music player, notepad, and more built-in programs.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="tech-stack">
        <div className="section-container">
          <h2 className="section-title">Tech Stack</h2>
          <div className="tech-grid">
            <div className="tech-item">
              <h4>Frontend</h4>
              <ul>
                <li>React 18.3</li>
                <li>TypeScript 5.6</li>
                <li>Vite 5.4</li>
              </ul>
            </div>
            <div className="tech-item">
              <h4>Testing</h4>
              <ul>
                <li>Vitest 2.x</li>
                <li>@testing-library/react</li>
                <li>jsdom</li>
              </ul>
            </div>
            <div className="tech-item">
              <h4>Quality & Linting</h4>
              <ul>
                <li>ESLint 8 + TypeScript</li>
                <li>Prettier 3</li>
                <li>CI/CD via GitHub Actions</li>
              </ul>
            </div>
            <div className="tech-item">
              <h4>Styling</h4>
              <ul>
                <li>CSS3 Grid & Flexbox</li>
                <li>CSS Variables</li>
                <li>Responsive Design</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta" id="cta">
        <div className="section-container">
          <h2>Ready to Enter the System?</h2>
          <p>Launch the Terminality OS and experience a cyberpunk-themed interface like never before.</p>
          <a href="/app" className="btn btn-large btn-primary">
            Launch OS Now
          </a>
          <p className="cta-secondary">
            Or explore the source code on{' '}
            <a href="https://github.com/Axidify/Terminality-V2" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <p>&copy; 2025 Terminality. An open-source cyberpunk OS simulator.</p>
          <div className="footer-links">
            <a href="https://github.com/Axidify/Terminality-V2" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a href="https://github.com/Axidify/Terminality-V2/issues" target="_blank" rel="noopener noreferrer">
              Report Issue
            </a>
            <a href="https://github.com/Axidify/Terminality-V2/discussions" target="_blank" rel="noopener noreferrer">
              Discussions
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
