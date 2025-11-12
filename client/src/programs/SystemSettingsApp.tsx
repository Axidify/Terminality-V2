import React, { useState, useEffect } from 'react'

import { useTheme, themes } from '../os/ThemeContext'
import { useWindowManager } from '../os/WindowManager'
import { saveDesktopState, getCachedDesktop } from '../services/saveService'
import { VERSION, BUILD_DATE } from '../version'
import { fetchAndParseChangelog, ParsedChangelog } from '../services/changelogParser'
import './SystemSettingsApp.css'

type Tab = 'themes' | 'wallpapers' | 'specs' | 'about'

interface ComputerSpecs {
  cpu: { name: string; level: number; maxLevel: number; speed: string }
  ram: { name: string; level: number; maxLevel: number; size: string }
  gpu: { name: string; level: number; maxLevel: number; model: string }
  storage: { name: string; level: number; maxLevel: number; capacity: string }
}

const wallpapers = [
  { id: 'default', name: 'Classic Grid', gradient: 'radial-gradient(circle at 20% 50%, rgba(0, 50, 25, 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(0, 75, 50, 0.05) 0%, transparent 50%), linear-gradient(180deg, #050505 0%, #000000 100%)' },
  { id: 'matrix', name: 'Matrix Rain', gradient: 'linear-gradient(180deg, #000d00 0%, #000000 100%)' },
  { id: 'cyber', name: 'Cyber Grid', gradient: 'linear-gradient(45deg, #050010 0%, #000208 50%, #000810 100%)' },
  { id: 'neon', name: 'Neon City', gradient: 'radial-gradient(circle at 30% 40%, rgba(255, 0, 150, 0.08) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(0, 255, 255, 0.05) 0%, transparent 50%), linear-gradient(180deg, #05000a 0%, #000000 100%)' },
  { id: 'sunset', name: 'Digital Sunset', gradient: 'linear-gradient(180deg, #0d0018 0%, #180008 50%, #000000 100%)' },
  { id: 'ocean', name: 'Deep Ocean', gradient: 'radial-gradient(circle at 50% 30%, rgba(0, 50, 100, 0.1) 0%, transparent 60%), linear-gradient(180deg, #000208 0%, #000005 100%)' },
  { id: 'minimal', name: 'Minimal Dark', gradient: 'linear-gradient(180deg, #050505 0%, #000000 100%)' },
  { id: 'retro', name: 'Retro Wave', gradient: 'linear-gradient(180deg, #150028 0%, #280018 50%, #0d0000 100%)' }
]

const getInitialSpecs = (): ComputerSpecs => {
  const cached = getCachedDesktop()?.computerSpecs
  if (cached) return cached as ComputerSpecs
  return {
    cpu: { name: 'CPU', level: 1, maxLevel: 10, speed: '1.5 GHz' },
    ram: { name: 'RAM', level: 1, maxLevel: 10, size: '2 GB' },
    gpu: { name: 'GPU', level: 1, maxLevel: 10, model: 'Integrated' },
    storage: { name: 'Storage', level: 1, maxLevel: 10, capacity: '128 GB' }
  }
}

const calculateUpgradeCost = (currentLevel: number): number => {
  return Math.floor(100 * Math.pow(1.5, currentLevel - 1))
}

const getSpecValue = (component: string, level: number): string => {
  const values: Record<string, string[]> = {
    cpu: ['1.5 GHz', '2.0 GHz', '2.5 GHz', '3.0 GHz', '3.5 GHz', '4.0 GHz', '4.5 GHz', '5.0 GHz', '5.5 GHz', '6.0 GHz'],
    ram: ['2 GB', '4 GB', '8 GB', '16 GB', '32 GB', '64 GB', '128 GB', '256 GB', '512 GB', '1 TB'],
    gpu: ['Integrated', 'GTX 750', 'GTX 1050', 'GTX 1660', 'RTX 2060', 'RTX 3060', 'RTX 3080', 'RTX 4070', 'RTX 4090', 'Quantum X1'],
    storage: ['128 GB', '256 GB', '512 GB', '1 TB', '2 TB', '4 TB', '8 TB', '16 TB', '32 TB', '64 TB']
  }
  return values[component]?.[level - 1] || ''
}

interface SystemSettingsAppProps {
  payload?: { tab?: Tab }
}

export const SystemSettingsApp: React.FC<SystemSettingsAppProps> = ({ payload }) => {
  const [activeTab, setActiveTab] = useState<Tab>(payload?.tab || 'themes')
  const { currentTheme: _currentTheme, themeName, setTheme } = useTheme()
  const wm = useWindowManager()
  const [previewTheme, setPreviewTheme] = useState<string>(themeName)
  const [wallpaper, setWallpaper] = useState(() => getCachedDesktop()?.wallpaper || 'default')
  const [specs, _setSpecs] = useState<ComputerSpecs>(getInitialSpecs)
  const [changelog, setChangelog] = useState<ParsedChangelog>({ entries: [], latest: null })
  const [copyFeedback, setCopyFeedback] = useState<string>('')

  useEffect(() => {
    saveDesktopState({ computerSpecs: specs }).catch(() => {})
  }, [specs])

  // Load changelog on component mount
  useEffect(() => {
    fetchAndParseChangelog().then(data => {
      setChangelog(data)
    })
  }, [])

  const copyVersionInfo = async () => {
    const versionInfo = `Terminality OS v${VERSION} (Built: ${BUILD_DATE})`
    try {
      await navigator.clipboard.writeText(versionInfo)
      setCopyFeedback('Version info copied!')
      setTimeout(() => setCopyFeedback(''), 2000)
    } catch (err) {
      setCopyFeedback('Failed to copy')
      setTimeout(() => setCopyFeedback(''), 2000)
    }
  }

  const [updateFeedback, setUpdateFeedback] = useState<string>('')
  const [contributors, setContributors] = useState<string[]>([]) // scaffold for contributors list

  const checkForUpdates = async () => {
    setUpdateFeedback('Checking...')
    try {
      const data = await fetchAndParseChangelog()
      setChangelog(data)
      setUpdateFeedback(data.latest ? `Latest: v${data.latest.version}` : 'No updates found')
    } catch (err) {
      setUpdateFeedback('Failed to check updates')
    }
    setTimeout(() => setUpdateFeedback(''), 2000)
  }

  const applyTheme = () => {
    setTheme(previewTheme as keyof typeof themes)
  }

  const applyWallpaper = (id: string) => {
    setWallpaper(id)
    saveDesktopState({ wallpaper: id }).catch(() => {})
    const selectedWallpaper = wallpapers.find(w => w.id === id)
    if (selectedWallpaper) {
      const desktopBg = document.querySelector('.desktop-bg') as HTMLElement
      if (desktopBg) {
        desktopBg.style.background = selectedWallpaper.gradient
      }
    }
  }

  return (
    <div className="system-settings">
      <div className="settings-tabs">
        <button 
          className={`tab ${activeTab === 'themes' ? 'active' : ''}`}
          onClick={() => setActiveTab('themes')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v6m0 6v6m5.2-13.2l-4.2 4.2m0 6l4.2 4.2M23 12h-6m-6 0H1m18.2 5.2l-4.2-4.2m0-6l4.2-4.2"/>
          </svg>
          Themes
        </button>
        <button 
          className={`tab ${activeTab === 'wallpapers' ? 'active' : ''}`}
          onClick={() => setActiveTab('wallpapers')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
          Wallpapers
        </button>
        <button 
          className={`tab ${activeTab === 'specs' ? 'active' : ''}`}
          onClick={() => setActiveTab('specs')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          System
        </button>
        <button 
          className={`tab ${activeTab === 'about' ? 'active' : ''}`}
          onClick={() => setActiveTab('about')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          About
        </button>
      </div>

      <div className="settings-content">
        {activeTab === 'themes' && (
          <div className="themes-panel">
            <h2>Choose Theme</h2>
            <div className="theme-preview-box" style={{
              background: themes[previewTheme].colors.background,
              border: `2px solid ${themes[previewTheme].colors.border}`,
              color: themes[previewTheme].colors.text
            }}>
              <div className="preview-header" style={{ 
                borderBottom: `1px solid ${themes[previewTheme].colors.border}` 
              }}>
                <span>Preview - {themes[previewTheme].name}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ 
                    width: '12px', 
                    height: '12px', 
                    background: themes[previewTheme].colors.primary,
                    borderRadius: '50%'
                  }} />
                  <div style={{ 
                    width: '12px', 
                    height: '12px', 
                    background: themes[previewTheme].colors.secondary,
                    borderRadius: '50%'
                  }} />
                  {themes[previewTheme].colors.accent && (
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      background: themes[previewTheme].colors.accent,
                      borderRadius: '50%'
                    }} />
                  )}
                </div>
              </div>
              <div className="preview-content">
                <p style={{ color: themes[previewTheme].colors.text }}>
                  Primary text in {themes[previewTheme].name}
                </p>
                <p style={{ color: themes[previewTheme].colors.textDim }}>
                  Secondary text example
                </p>
                <button style={{
                  background: themes[previewTheme].colors.surface,
                  color: themes[previewTheme].colors.primary,
                  border: `1px solid ${themes[previewTheme].colors.border}`,
                  padding: '6px 12px',
                  marginTop: '8px',
                  marginRight: '8px',
                  cursor: 'pointer'
                }}>
                  Primary Button
                </button>
                {themes[previewTheme].colors.accent && (
                  <button style={{
                    background: themes[previewTheme].colors.surface,
                    color: themes[previewTheme].colors.accent,
                    border: `1px solid ${themes[previewTheme].colors.border}`,
                    padding: '6px 12px',
                    marginTop: '8px',
                    cursor: 'pointer'
                  }}>
                    Accent Button
                  </button>
                )}
              </div>
            </div>
            
            <div className="theme-grid">
              {Object.entries(themes).map(([key, theme]) => (
                <div
                  key={key}
                  className={`theme-card ${previewTheme === key ? 'selected' : ''}`}
                  onClick={() => setPreviewTheme(key)}
                  style={{
                    background: theme.colors.surface,
                    border: `2px solid ${previewTheme === key ? theme.colors.primary : theme.colors.border}`
                  }}
                >
                  <div className="theme-colors">
                    <div style={{ background: theme.colors.primary }} />
                    <div style={{ background: theme.colors.secondary }} />
                    {theme.colors.accent && <div style={{ background: theme.colors.accent }} />}
                    {!theme.colors.accent && <div style={{ background: theme.colors.text }} />}
                  </div>
                  <div className="theme-name" style={{ color: theme.colors.text }}>
                    {theme.name}
                  </div>
                  {themeName === key && <div className="theme-badge">ACTIVE</div>}
                </div>
              ))}
            </div>
            
            <button 
              className="apply-button" 
              onClick={applyTheme}
              disabled={previewTheme === themeName}
            >
              Apply Theme
            </button>
          </div>
        )}

        {activeTab === 'wallpapers' && (
          <div className="wallpapers-panel">
            <h2>Choose Wallpaper</h2>
            <div className="wallpaper-grid">
              {wallpapers.map(wp => (
                <div
                  key={wp.id}
                  className={`wallpaper-card ${wallpaper === wp.id ? 'selected' : ''}`}
                  onClick={() => applyWallpaper(wp.id)}
                >
                  <div className="wallpaper-preview" style={{ background: wp.gradient }} />
                  <div className="wallpaper-name">{wp.name}</div>
                  {wallpaper === wp.id && <div className="wallpaper-badge">ACTIVE</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'specs' && (
          <div className="specs-panel">
            <h2>Computer Specifications</h2>
            <p className="specs-info">
              💡 Visit the PC Store to upgrade your hardware and check your wallet at AXI Bank
            </p>
            
            <div className="specs-grid">
                {Object.entries(specs).map(([key, comp]) => {
                const _cost = calculateUpgradeCost(comp.level)
                const _canUpgrade = comp.level < comp.maxLevel
                const displayValue = getSpecValue(key, comp.level)
                
                return (
                  <div key={key} className="spec-card">
                    <div className="spec-header">
                      <h3>{comp.name}</h3>
                      <span className="spec-level">Level {comp.level}/{comp.maxLevel}</span>
                    </div>
                    <div className="spec-value">{displayValue}</div>
                    <div className="spec-bar">
                      <div 
                        className="spec-bar-fill" 
                        style={{ width: `${(comp.level / comp.maxLevel) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            
            <div className="specs-info">
              <p>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Want to upgrade your system?
              </p>
              <p>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
                  <circle cx="9" cy="21" r="1"/>
                  <circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                Visit the <strong>AXI PC Store</strong> to purchase new components!
              </p>
              <button 
                className="visit-store-btn"
                onClick={() => {
                  wm.open('browser', { 
                    title: 'Browser - AXI PC Store', 
                    width: 1200, 
                    height: 800,
                    payload: { initialUrl: 'https://axi-pcstore.com' }
                  })
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
                  <circle cx="9" cy="21" r="1"/>
                  <circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                Open PC Store
              </button>
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="about-panel">
            <div className="about-header">
              <svg className="about-logo" width="80" height="80" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <polygon 
                  points="50,5 90,25 90,65 50,85 10,65 10,25" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                />
                <circle cx="50" cy="30" r="3" fill="currentColor" />
                <circle cx="70" cy="45" r="3" fill="currentColor" />
                <circle cx="50" cy="60" r="3" fill="currentColor" />
                <circle cx="30" cy="45" r="3" fill="currentColor" />
                <line x1="50" y1="30" x2="70" y2="45" stroke="currentColor" strokeWidth="1.5" />
                <line x1="70" y1="45" x2="50" y2="60" stroke="currentColor" strokeWidth="1.5" />
                <line x1="50" y1="60" x2="30" y2="45" stroke="currentColor" strokeWidth="1.5" />
                <line x1="30" y1="45" x2="50" y2="30" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="50" cy="45" r="8" fill="currentColor" />
              </svg>
              <h1>Terminality OS</h1>
              <div className="version-info">
                <p className="version">Version {VERSION}</p>
                <button className="copy-version-btn" onClick={copyVersionInfo} title="Copy version info to clipboard">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                  </svg>
                  <span>{copyFeedback || 'Copy'}</span>
                </button>
              </div>
              <p className="tagline">A Retro-Futuristic Operating System Simulation</p>
            </div>

            <div className="about-content-grid">
              {/* Latest release highlight */}
              {changelog.latest && (
                <div className="about-section about-highlight" style={{ gridColumn: '1 / -1' }}>
                  <h3>What’s New</h3>
                  <p style={{ marginTop: 4 }}>{changelog.latest.summary || (changelog.latest.added[0] ?? '')}</p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="small" onClick={() => { /* scroll to changelog */ document.querySelector('.changelog-section')?.scrollIntoView({ behavior: 'smooth' }) }}>View Changelog</button>
                    <button className="small" onClick={checkForUpdates} title="Check for new updates">Check for updates</button>
                    {updateFeedback && <span style={{ marginLeft: 8 }}>{updateFeedback}</span>}
                  </div>
                </div>
              )}
              <div className="about-section about-description">
                <h2>About Terminality</h2>
                <p>
                  Terminality is an immersive single-player mystery game that blends puzzle solving, 
                  deep online investigations, and narrative exploration within a retro terminal-based 
                  operating system simulation. Uncover secrets, solve cryptic puzzles, and navigate 
                  through a mysterious digital world shrouded in intrigue.
                </p>
                <p>
                  Why this game exists: Terminality was created to celebrate the charm of retro
                  computing and to explore interactive storytelling in a simulated OS. It was built
                  as a creative exercise to blend puzzles with a narrative that rewards curiosity and
                  thoughtful investigation.
                </p>
                <p>
                  Experience a fully-functional desktop environment with authentic window management, 
                  file systems, applications, and network simulations—all running in your browser.
                </p>
              </div>

              <div className="about-section about-system-info">
                <h2>System Information</h2>
                <div className="info-table">
                  <div className="info-row">
                    <span className="info-label">Version</span>
                    <span className="info-value">{VERSION}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Build Date</span>
                    <span className="info-value">{BUILD_DATE}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Architecture</span>
                    <span className="info-value">Web-Based (x64 Simulation)</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Kernel</span>
                    <span className="info-value">React 18.3.1</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Runtime</span>
                    <span className="info-value">Node.js Backend + Vite Frontend</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Graphics Engine</span>
                    <span className="info-value">CSS3 + SVG + Canvas</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">License</span>
                    <span className="info-value">MIT License</span>
                  </div>
                </div>
              </div>

              <div className="about-section about-features">
                <h2>Key Features</h2>
                <div className="features-grid">
                  <div className="feature-item">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <path d="M9 3v18"/>
                    </svg>
                    <div>
                      <strong>Multi-Window System</strong>
                      <p>Drag, resize, minimize, and maximize windows with full desktop management</p>
                    </div>
                  </div>
                  <div className="feature-item">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                      <polyline points="13 2 13 9 20 9"/>
                    </svg>
                    <div>
                      <strong>Virtual Filesystem</strong>
                      <p>Navigate folders, create files, and manage your virtual storage</p>
                    </div>
                  </div>
                  <div className="feature-item">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="4 17 10 11 4 5"/>
                      <line x1="12" y1="19" x2="20" y2="19"/>
                    </svg>
                    <div>
                      <strong>Terminal Emulator</strong>
                      <p>Execute commands, run scripts, and explore the command-line interface</p>
                    </div>
                  </div>
                  <div className="feature-item">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2"/>
                      <line x1="8" y1="21" x2="16" y2="21"/>
                      <line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                    <div>
                      <strong>Web Browser</strong>
                      <p>Browse simulated websites with realistic social media and news platforms</p>
                    </div>
                  </div>
                  <div className="feature-item">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18V5l12-2v13"/>
                      <circle cx="6" cy="18" r="3"/>
                      <circle cx="18" cy="16" r="3"/>
                    </svg>
                    <div>
                      <strong>Music Player</strong>
                      <p>Play tracks, create playlists, and control playback across the desktop</p>
                    </div>
                  </div>
                  <div className="feature-item">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M12 1v6m0 6v6m5.2-13.2l-4.2 4.2m0 6l4.2 4.2M23 12h-6m-6 0H1m18.2 5.2l-4.2-4.2m0-6l4.2-4.2"/>
                    </svg>
                    <div>
                      <strong>17 Color Themes</strong>
                      <p>Customize your experience with classic green, cyber blue, neon pink, and more</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="about-section about-tech">
                <h2>Technology Stack</h2>
                <div className="tech-stack">
                  <div className="tech-category">
                    <h3>Frontend</h3>
                    <ul>
                      <li>React 18 with TypeScript</li>
                      <li>Vite for fast development</li>
                      <li>CSS3 with CSS Variables</li>
                      <li>Custom window management</li>
                    </ul>
                  </div>
                  <div className="tech-category">
                    <h3>Backend</h3>
                    <ul>
                      <li>Node.js + Express</li>
                      <li>Prisma ORM</li>
                      <li>SQLite Database</li>
                      <li>JWT Authentication</li>
                    </ul>
                  </div>
                  <div className="tech-category">
                    <h3>Features</h3>
                    <ul>
                      <li>Session persistence</li>
                      <li>User management</li>
                      <li>State synchronization</li>
                      <li>OAuth integration</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="about-section about-credits">
                <h2>Credits & License</h2>
                <div className="credits-content">
                  <p>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <strong>Created by:</strong> Axidify
                  </p>
                  <p>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
                      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
                    </svg>
                    <strong>Repository:</strong> github.com/Axidify/Terminality-V2
                  </p>
                  <div className="contributors-scaffold">
                    <h3>Contributors</h3>
                    {contributors.length === 0 ? (
                      <p style={{ color: 'var(--color-textDim)' }}>No contributors yet — this is a scaffold for contributor profiles.</p>
                    ) : (
                      <ul>
                        {contributors.map(c => <li key={c}>{c}</li>)}
                      </ul>
                    )}
                    <button className="small" onClick={() => wm.open('browser', { title: 'Contribute - GitHub', width: 1000, height: 700, payload: { initialUrl: 'https://github.com/Axidify/Terminality-V2' } })}>Contribute on GitHub</button>
                  </div>
                  <p>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <strong>License:</strong> MIT License - Open source and free to use
                  </p>
                  <p className="copyright">
                    © 2025 Terminality OS. All rights reserved.<br/>
                    Designed and built with passion for retro computing and cyberpunk aesthetics.
                  </p>
                </div>
              </div>
            </div>

            <div className="about-section about-support">
              <h2>Need Help?</h2>
              <div className="support-content">
                <p>
                  For documentation, updates, and support, visit our GitHub repository or check the in-app help system.
                </p>
                <div className="support-links">
                  <button className="support-btn" onClick={() => wm.open('browser', { title: 'Browser - Documentation', width: 1200, height: 800, payload: { initialUrl: 'https://home.axi' } })}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    Documentation
                  </button>
                  <button className="support-btn" onClick={() => wm.open('terminal', { title: 'Terminal', width: 800, height: 600 })}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="4 17 10 11 4 5"/>
                      <line x1="12" y1="19" x2="20" y2="19"/>
                    </svg>
                    Open Terminal
                  </button>
                  <button className="support-btn" onClick={() => wm.open('browser', { title: 'GitHub - Issues', width: 1000, height: 700, payload: { initialUrl: 'https://github.com/Axidify/Terminality-V2/issues' } })}>
                    Report an issue
                  </button>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="support-btn" onClick={() => wm.open('browser', { title: 'Sponsor', width: 1000, height: 700, payload: { initialUrl: 'https://github.com/sponsors/Axidify' } })}>Sponsor</button>
                    <button className="support-btn" onClick={() => wm.open('browser', { title: 'Donate', width: 1000, height: 700, payload: { initialUrl: 'https://www.example.com/donate' } })}>Donate</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamically render changelog from CHANGELOG.md */}
            {changelog.entries.length > 0 ? (
              changelog.entries.map((entry, idx) => (
                <div className="changelog-section" key={entry.version}>
                  <h2>What&apos;s New in v{entry.version}</h2>
                  <div className="changelog-content compact">
                    {entry.added.length > 0 && (
                      <>
                        {entry.added.map((item, i) => (
                          <div className="changelog-item" key={`added-${i}`}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                            </svg>
                            <span dangerouslySetInnerHTML={{ __html: item }} />
                          </div>
                        ))}
                      </>
                    )}
                    {entry.changed.length > 0 && (
                      <>
                        {entry.changed.map((item, i) => (
                          <div className="changelog-item" key={`changed-${i}`}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 7h16M4 12h16M4 17h16"/>
                            </svg>
                            <span dangerouslySetInnerHTML={{ __html: item }} />
                          </div>
                        ))}
                      </>
                    )}
                    {entry.fixed.length > 0 && (
                      <>
                        {entry.fixed.map((item, i) => (
                          <div className="changelog-item" key={`fixed-${i}`}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 2l3 7h7l-5 4 2 7-6-4-6 4 2-7-5-4h7z"/>
                            </svg>
                            <span dangerouslySetInnerHTML={{ __html: item }} />
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="changelog-section">
                <h2>Changelog</h2>
                <p style={{ color: 'var(--color-textDim)', fontSize: '14px' }}>Loading changelog...</p>
              </div>
            )}

            <div className="changelog-section">
              <h2>Version History</h2>
              <div className="version-history">
                {changelog.entries.map(entry => (
                  <div className="version-item" key={entry.version}>
                    <strong>v{entry.version}</strong> <span className="version-date">({entry.date})</span>
                    <p>
                      {entry.added.length > 0 && `${entry.added.length} additions`}
                      {entry.added.length > 0 && (entry.changed.length > 0 || entry.fixed.length > 0) && ', '}
                      {entry.changed.length > 0 && `${entry.changed.length} changes`}
                      {entry.changed.length > 0 && entry.fixed.length > 0 && ', '}
                      {entry.fixed.length > 0 && `${entry.fixed.length} fixes`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
