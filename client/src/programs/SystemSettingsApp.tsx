import React, { useState, useEffect } from 'react'

import { useTheme, themes } from '../os/ThemeContext'
import { useWindowManager } from '../os/WindowManager'
import { saveDesktopState, getCachedDesktop } from '../services/saveService'
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

export const SystemSettingsApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('themes')
  const { currentTheme: _currentTheme, themeName, setTheme } = useTheme()
  const wm = useWindowManager()
  const [previewTheme, setPreviewTheme] = useState<string>(themeName)
  const [wallpaper, setWallpaper] = useState(() => getCachedDesktop()?.wallpaper || 'default')
  const [specs, _setSpecs] = useState<ComputerSpecs>(getInitialSpecs)

  useEffect(() => {
    saveDesktopState({ computerSpecs: specs }).catch(() => {})
  }, [specs])

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
          What&apos;s New
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
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <h1>Terminality OS</h1>
              <p className="version">Version 0.5.3</p>
              <p className="release-date">Released November 10, 2025</p>
            </div>

            <div className="changelog-section">
              <h2>What&apos;s New in v0.5.3</h2>
              <div className="changelog-content compact">
                <div className="changelog-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span><strong>System Monitor</strong>: Collapse/expand feature & improved z-index</span>
                </div>
              </div>
            </div>

            <div className="changelog-section">
              <h2>What&apos;s New in v0.5.2</h2>
              <div className="changelog-content compact">
                <div className="changelog-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  <span><strong>Particles</strong>: 40 ambient effects on login screen</span>
                </div>
                <div className="changelog-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                  </svg>
                  <span><strong>Audio</strong>: Improved context error handling</span>
                </div>
              </div>
            </div>

            <div className="changelog-section">
              <h2>What&apos;s New in v0.5.1</h2>
              <div className="changelog-content compact">
                <div className="changelog-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                  <span><strong>System Monitor</strong>: Compact width & minimal design</span>
                </div>
              </div>
            </div>

            <div className="changelog-section">
              <h2>Previous Releases</h2>
              <div className="changelog-content">
                <div className="changelog-category">
                  <h3>v0.4.0 - November 10, 2025</h3>
                  <ul>
                    <li><strong>Immersive Article System</strong>: Full article pages with detailed content</li>
                    <li><strong>Category Navigation</strong>: Dedicated pages for World, Tech, Business, Gaming</li>
                    <li><strong>Browser Scroll Behavior</strong>: Auto scroll to top on navigation</li>
                  </ul>
                </div>
                <div className="changelog-category">
                  <h3>v0.3.0 - November 10, 2025</h3>
                  <ul>
                    <li><strong>Home Website</strong>: New fake news homepage with breaking news, trending topics, weather widget, and market overview</li>
                    <li><strong>Changelog System</strong>: Version tracking and changelog integrated into About section</li>
                    <li><strong>Modern File Explorer</strong>: Windows/Mac-style UI with large folder/file icons, back/refresh buttons, and improved navigation</li>
                    <li><strong>SVG Icon System</strong>: Complete monotone SVG icon replacement across all applications</li>
                  </ul>
                </div>

                <div className="changelog-category">
                  <h3>🐛 Fixed</h3>
                  <ul>
                    <li><strong>Sticky Headers</strong>: All website headers now properly stick to top while scrolling</li>
                    <li><strong>Browser Layout</strong>: Fixed toolbar and bookmark bar staying fixed while viewport scrolls</li>
                    <li><strong>ThreadIt Alignment</strong>: Create Post and Log In buttons now properly aligned to right edge</li>
                  </ul>
                </div>
              </div>

              <div className="version-history">
                <h2>Version History</h2>
                <div className="version-item">
                  <strong>v0.5.3</strong> <span className="version-date">(Nov 10, 2025)</span>
                  <p>System monitor collapse/expand feature, improved z-index layering</p>
                </div>
                <div className="version-item">
                  <strong>v0.5.2</strong> <span className="version-date">(Nov 10, 2025)</span>
                  <p>Login screen particle effects, improved audio context handling</p>
                </div>
                <div className="version-item">
                  <strong>v0.5.1</strong> <span className="version-date">(Nov 10, 2025)</span>
                  <p>Streamlined system monitor with minimal design and compact width</p>
                </div>
                <div className="version-item">
                  <strong>v0.5.0</strong> <span className="version-date">(Nov 10, 2025)</span>
                  <p>17 themes with dual-tone colors, snap-to-edge system monitor, theme-aware UI elements</p>
                </div>
                <div className="version-item">
                  <strong>v0.4.0</strong> <span className="version-date">(Nov 10, 2025)</span>
                  <p>Immersive article system, category navigation, 42 articles, scroll-to-top behavior</p>
                </div>
                <div className="version-item">
                  <strong>v0.3.0</strong> <span className="version-date">(Nov 10, 2025)</span>
                  <p>Home website, changelog system, modern file explorer, SVG icons, standardized sizing</p>
                </div>
                <div className="version-item">
                  <strong>v0.2.0</strong> <span className="version-date">(Nov 9, 2025)</span>
                  <p>Lock screen, music persistence, fake browser architecture</p>
                </div>
                <div className="version-item">
                  <strong>v0.1.0</strong> <span className="version-date">(Nov 8, 2025)</span>
                  <p>Initial release with core OS features</p>
                </div>
              </div>

              <div className="about-footer">
                <p>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
                  </svg>
                  <strong>Terminality</strong> - A cyberpunk hacking simulation OS
                </p>
                <p className="copyright">© 2025 Axidify. All rights reserved.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
