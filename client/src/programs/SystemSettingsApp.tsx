import React, { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { useTheme, themes } from '../os/ThemeContext'
import { useUser } from '../os/UserContext'
import { useWindowManager } from '../os/WindowManager'
import { fetchAboutContent, updateAboutContent, FALLBACK_ABOUT_CONTENT, AboutContent } from '../services/aboutService'
import { fetchChangelog, fetchChangelogMarkdown } from '../services/changelogService'
import { saveDesktopState, getCachedDesktop } from '../services/saveService'
import { VERSION, BUILD_DATE } from '../version'

import type { ChangelogResponse } from '../services/changelogService'
import type { Components } from 'react-markdown'
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

const SettingsIcon: React.FC = () => (
  <svg className="settings-logo" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="15" stroke="currentColor" strokeWidth="3" fill="rgba(0, 255, 65, 0.05)"/>
    <circle cx="50" cy="20" r="4" fill="currentColor"/>
    <circle cx="50" cy="80" r="4" fill="currentColor"/>
    <circle cx="20" cy="50" r="4" fill="currentColor"/>
    <circle cx="80" cy="50" r="4" fill="currentColor"/>
    <circle cx="30" cy="30" r="4" fill="currentColor"/>
    <circle cx="70" cy="70" r="4" fill="currentColor"/>
    <circle cx="70" cy="30" r="4" fill="currentColor"/>
    <circle cx="30" cy="70" r="4" fill="currentColor"/>
  </svg>
)

export const SystemSettingsApp: React.FC<SystemSettingsAppProps> = ({ payload }) => {
  const [activeTab, setActiveTab] = useState<Tab>(payload?.tab || 'themes')
  const { currentTheme: _currentTheme, themeName, setTheme } = useTheme()
  const wm = useWindowManager()
  const { isAdmin } = useUser()
  const [previewTheme, setPreviewTheme] = useState<string>(themeName)
  const [wallpaper, setWallpaper] = useState(() => getCachedDesktop()?.wallpaper || 'default')
  const [specs, _setSpecs] = useState<ComputerSpecs>(getInitialSpecs)
  const [changelog, setChangelog] = useState<ChangelogResponse>({ entries: [], latest: null })
  const [isChangelogLoading, setIsChangelogLoading] = useState<boolean>(false)
  const [changelogError, setChangelogError] = useState('')
  const [changelogMarkdown, setChangelogMarkdown] = useState('')
  const [isChangelogMarkdownLoading, setIsChangelogMarkdownLoading] = useState(true)
  const [changelogMarkdownError, setChangelogMarkdownError] = useState('')
  const [copyFeedback, setCopyFeedback] = useState<string>('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const aboutEditingRef = useRef(false)
  const [aboutContent, setAboutContent] = useState<AboutContent>(FALLBACK_ABOUT_CONTENT)
  const [aboutStatus, setAboutStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [aboutError, setAboutError] = useState('')
  const [isEditingAbout, setIsEditingAbout] = useState(false)
  const [draftAbout, setDraftAbout] = useState<AboutContent>(FALLBACK_ABOUT_CONTENT)
  const [isSavingAbout, setIsSavingAbout] = useState(false)
  const [aboutSaveFeedback, setAboutSaveFeedback] = useState('')

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const container = containerRef.current
    if (container) {
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left + container.scrollLeft
      const y = e.clientY - rect.top + container.scrollTop
      setContextMenu({ x, y })
    } else {
      setContextMenu({ x: e.clientX, y: e.clientY })
    }
  }

  const closeContextMenu = () => setContextMenu(null)

  React.useEffect(() => {
    const handleClick = () => closeContextMenu()
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // Generate particle positions once
  const particles = React.useMemo(() => (
    Array.from({ length: 12 }).map((_, i) => ({
      key: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 5}s`,
      animationDuration: `${10 + Math.random() * 10}s`
    }))
  ), [])

  const markdownComponents = React.useMemo<Components>(() => ({
    a: ({ node: _node, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown; children?: React.ReactNode }) => (
      <a {...props} target="_blank" rel="noreferrer">
        {children ?? props.href}
      </a>
    )
  }), [])

  const loadAboutContent = React.useCallback(async () => {
    setAboutStatus('loading')
    setAboutError('')
    try {
      const content = await fetchAboutContent()
      setAboutContent(content)
      if (!aboutEditingRef.current) {
        setDraftAbout(content)
      }
      setAboutStatus('idle')
    } catch (err) {
      setAboutStatus('error')
      const message = err instanceof Error ? err.message : 'Failed to load About content'
      setAboutError(message)
    }
  }, [])

  useEffect(() => {
    loadAboutContent()
  }, [loadAboutContent])

  useEffect(() => {
    saveDesktopState({ computerSpecs: specs }).catch(() => {})
  }, [specs])

  const applyChangelogData = React.useCallback((data: ChangelogResponse) => {
    setChangelog(data)
  }, [])

  const loadChangelogMarkdown = React.useCallback(async () => {
    setIsChangelogMarkdownLoading(true)
    setChangelogMarkdownError('')
    try {
      const markdown = await fetchChangelogMarkdown()
      setChangelogMarkdown(markdown)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load full changelog'
      setChangelogMarkdownError(message)
    } finally {
      setIsChangelogMarkdownLoading(false)
    }
  }, [])

  const loadChangelog = React.useCallback(async () => {
    setIsChangelogLoading(true)
    setChangelogError('')
    try {
      const data = await fetchChangelog()
      applyChangelogData(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load changelog'
      setChangelogError(message)
    } finally {
      setIsChangelogLoading(false)
    }
  }, [applyChangelogData])

  useEffect(() => {
    loadChangelog()
    loadChangelogMarkdown()
  }, [loadChangelog, loadChangelogMarkdown])

  const displayVersion = React.useMemo(() => {
    return changelog.latest?.version || VERSION
  }, [changelog.latest])

  const copyVersionInfo = async () => {
    const versionInfo = `Terminality OS v${displayVersion} (Built: ${BUILD_DATE})`
    try {
      await navigator.clipboard.writeText(versionInfo)
      setCopyFeedback('Version info copied!')
      setTimeout(() => setCopyFeedback(''), 2000)
    } catch (_err) {
      setCopyFeedback('Failed to copy')
      setTimeout(() => setCopyFeedback(''), 2000)
    }
  }

  const [updateFeedback, setUpdateFeedback] = useState<string>('')


  const systemInfoItems = [
    { label: 'Version', value: displayVersion },
    { label: 'Build Date', value: BUILD_DATE },
    { label: 'Architecture', value: 'Web-Based (x64 Simulation)' },
    { label: 'Frontend', value: 'React 18 + TypeScript + Vite' },
    { label: 'Backend', value: 'Node.js + Express + Prisma' },
    { label: 'Database', value: 'SQLite with JWT Auth' },
    { label: 'License', value: 'MIT License' }
  ]

  const featureItems: Array<{ key: string; title: string; description: string; icon: React.ReactNode }> = [
    {
      key: 'multi-window',
      title: 'Multi-Window System',
      description: 'Drag, resize, minimize, and maximize windows with full desktop management',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18" />
        </svg>
      )
    },
    {
      key: 'filesystem',
      title: 'Virtual Filesystem',
      description: 'Navigate folders, create files, and manage your virtual storage',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <polyline points="13 2 13 9 20 9" />
        </svg>
      )
    },
    {
      key: 'terminal',
      title: 'Terminal Emulator',
      description: 'Execute commands, run scripts, and explore the command-line interface',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      )
    },
    {
      key: 'browser',
      title: 'Web Browser',
      description: 'Browse simulated websites with realistic social media and news platforms',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      )
    },
    {
      key: 'music',
      title: 'Music Player',
      description: 'Play tracks, create playlists, and control playback across the desktop',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      )
    },
    {
      key: 'themes',
      title: '17 Color Themes',
      description: 'Customize your experience with classic green, cyber blue, neon pink, and more',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v6m0 6v6m5.2-13.2l-4.2 4.2m0 6l4.2 4.2M23 12h-6m-6 0H1m18.2 5.2l-4.2-4.2m0-6l4.2-4.2" />
        </svg>
      )
    }
  ]

  const projectFacts: Array<{ key: string; label: string; value: string; icon: React.ReactNode }> = [
    {
      key: 'creator',
      label: 'Created by:',
      value: 'Axidify',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )
    },
    {
      key: 'repository',
      label: 'Repository:',
      value: 'github.com/Axidify/Terminality-V2',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
        </svg>
      )
    },
    {
      key: 'license',
      label: 'License:',
      value: 'MIT License - Open source and free to use',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      )
    }
  ]

  const supportActions: Array<{ key: string; label: string; icon: React.ReactNode; action: () => void }> = [
    {
      key: 'docs',
      label: 'Documentation',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      action: () => wm.open('browser', { title: 'Browser - Documentation', width: 1200, height: 800, payload: { initialUrl: 'https://home.axi' } })
    },
    {
      key: 'issues',
      label: 'Report an Issue',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
      action: () => wm.open('browser', { title: 'GitHub - Issues', width: 1000, height: 700, payload: { initialUrl: 'https://github.com/Axidify/Terminality-V2/issues' } })
    },
    {
      key: 'contribute',
      label: 'Contribute',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
        </svg>
      ),
      action: () => wm.open('browser', { title: 'Contribute - GitHub', width: 1000, height: 700, payload: { initialUrl: 'https://github.com/Axidify/Terminality-V2' } })
    },
    {
      key: 'terminal',
      label: 'Open Terminal',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      ),
      action: () => wm.open('terminal', { title: 'Terminal', width: 800, height: 600 })
    }
  ]

  const checkForUpdates = React.useCallback(async () => {
    setUpdateFeedback('Checking...')
    try {
      const data = await fetchChangelog()
      applyChangelogData(data)
      await loadChangelogMarkdown()
      setUpdateFeedback(data.latest ? `Latest: v${data.latest.version}` : 'No releases yet')
    } catch (_err) {
      setUpdateFeedback('Failed to check updates')
    }
    setTimeout(() => setUpdateFeedback(''), 2000)
  }, [applyChangelogData, loadChangelogMarkdown])


  const handleDraftChange = (field: keyof AboutContent, value: string) => {
    setDraftAbout(prev => ({ ...prev, [field]: value }))
  }

  const startAboutEdit = () => {
    setDraftAbout(aboutContent)
    setIsEditingAbout(true)
    aboutEditingRef.current = true
    setAboutSaveFeedback('')
  }

  const cancelAboutEdit = () => {
    setIsEditingAbout(false)
    aboutEditingRef.current = false
    setDraftAbout(aboutContent)
    setAboutSaveFeedback('')
  }

  const handleSaveAbout = async () => {
    setIsSavingAbout(true)
    setAboutSaveFeedback('')
    try {
      const updated = await updateAboutContent(draftAbout)
      setAboutContent(updated)
      setAboutSaveFeedback('Changes saved')
      setIsEditingAbout(false)
      aboutEditingRef.current = false
      setTimeout(() => setAboutSaveFeedback(''), 2500)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save changes'
      setAboutSaveFeedback(message)
    } finally {
      setIsSavingAbout(false)
    }
  }

  const refreshAboutContent = () => {
    if (isEditingAbout) return
    loadAboutContent()
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
  <div className="settings-root" ref={containerRef} onContextMenu={handleContextMenu}>
      {/* Background effects */}
      <div className="settings-bg-grid" />
      <div className="settings-scanlines" />
      {particles.map(p => (
        <div key={p.key} className="settings-particle" style={{
          left: p.left,
          top: p.top,
          animationDelay: p.animationDelay,
          animationDuration: p.animationDuration
        }} />
      ))}

      <div className="system-settings">
        {/* Header */}
        <div className="settings-header">
          <div className="settings-logo-container">
            <SettingsIcon />
          </div>
          <div className="settings-title-group">
            <h1 className="settings-title">
              <span className="settings-bracket">[</span>
              SYSTEM SETTINGS
              <span className="settings-bracket">]</span>
            </h1>
            <div className="settings-subtitle">System Configuration</div>
          </div>
        </div>

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
              {Object.entries(themes)
                .sort(([aKey], [bKey]) => (aKey === themeName ? -1 : bKey === themeName ? 1 : 0))
                .map(([key, theme]) => (
                <div
                  key={key}
                  className={`theme-card ${previewTheme === key ? 'selected' : ''}`}
                  onClick={() => setPreviewTheme(key)}
                  style={{
                    background: theme.colors.surface,
                    border: `2px solid ${previewTheme === key ? theme.colors.primary : theme.colors.border}`
                  }}
                >
                  {themeName === key && <div className="theme-badge">ACTIVE</div>}
                  <div className="theme-colors">
                    <div style={{ background: theme.colors.primary }} />
                    <div style={{ background: theme.colors.secondary }} />
                    {theme.colors.accent && <div style={{ background: theme.colors.accent }} />}
                    {!theme.colors.accent && <div style={{ background: theme.colors.text }} />}
                  </div>
                  <div className="theme-name" style={{ color: theme.colors.text }}>
                    {theme.name}
                  </div>
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
              <div className="about-logo-container">
                <svg className="about-logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
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
              </div>

              <h1 className="about-brand-title">TERMINALITY</h1>
              <p className="about-brand-subtitle">OPERATING SYSTEM</p>

              <div className="about-divider"></div>

              <div className="about-version-info">
                <p className="about-version">v{displayVersion}</p>
              </div>

              <p className="about-tagline">{aboutContent.heroTagline}</p>
            </div>

            {isAdmin && (
              <div className="about-admin-controls">
                {!isEditingAbout ? (
                  <div className="about-admin-bar">
                    <span>Dynamic copy updates instantly from the server.</span>
                    <div className="about-admin-actions">
                      <button
                        className="about-admin-button ghost"
                        onClick={refreshAboutContent}
                        disabled={aboutStatus === 'loading'}
                      >
                        {aboutStatus === 'loading' ? 'Refreshing…' : 'Refresh Content'}
                      </button>
                      <button className="about-admin-button" onClick={startAboutEdit}>
                        Edit About Content
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="about-admin-form">
                    <div className="about-admin-grid">
                      <label>
                        <span>Hero Title</span>
                        <input
                          type="text"
                          value={draftAbout.heroTitle}
                          onChange={(e) => handleDraftChange('heroTitle', e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Hero Tagline</span>
                        <input
                          type="text"
                          value={draftAbout.heroTagline}
                          onChange={(e) => handleDraftChange('heroTagline', e.target.value)}
                        />
                      </label>
                      <label className="wide">
                        <span>Intro Paragraph</span>
                        <textarea
                          rows={3}
                          value={draftAbout.introParagraph}
                          onChange={(e) => handleDraftChange('introParagraph', e.target.value)}
                        />
                      </label>
                      <label>
                        <span>What&apos;s New Heading</span>
                        <input
                          type="text"
                          value={draftAbout.whatsNewHeading}
                          onChange={(e) => handleDraftChange('whatsNewHeading', e.target.value)}
                        />
                      </label>
                      <label className="wide">
                        <span>What&apos;s New Body</span>
                        <textarea
                          rows={3}
                          value={draftAbout.whatsNewBody}
                          onChange={(e) => handleDraftChange('whatsNewBody', e.target.value)}
                        />
                      </label>
                      <label className="wide">
                        <span>Closing Paragraph</span>
                        <textarea
                          rows={3}
                          value={draftAbout.outroParagraph}
                          onChange={(e) => handleDraftChange('outroParagraph', e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="about-admin-actions">
                      <button
                        className="about-admin-button"
                        onClick={handleSaveAbout}
                        disabled={isSavingAbout}
                      >
                        {isSavingAbout ? 'Saving…' : 'Save Changes'}
                      </button>
                      <button className="about-admin-button ghost" onClick={cancelAboutEdit}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {aboutSaveFeedback && (
                  <div className="about-admin-feedback">{aboutSaveFeedback}</div>
                )}
              </div>
            )}

            {(aboutStatus === 'loading' || aboutStatus === 'error') && (
              <div className={`about-status-message ${aboutStatus}`}>
                {aboutStatus === 'loading' ? 'Refreshing About content…' : `Using cached About content. ${aboutError}`}
              </div>
            )}

            <div className="about-content-grid">
              <div className="about-section about-description">
                <h2>About Terminality</h2>
                <p>{aboutContent.introParagraph}</p>
                <p className="about-whatsnew">
                  <strong>{aboutContent.whatsNewHeading}:</strong> {aboutContent.whatsNewBody}
                </p>
                <p>{aboutContent.outroParagraph}</p>
              </div>

              <div className="about-section about-system-info">
                <h2>System Information</h2>
                <div className="info-table">
                  {systemInfoItems.map((item) => (
                    <div className="info-row" key={item.label}>
                      <span className="info-label">{item.label}</span>
                      <span className="info-value">{item.value}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="about-admin-button ghost"
                  style={{ marginTop: '12px' }}
                  onClick={() => { void copyVersionInfo() }}
                >
                  Copy Version Info
                </button>
                {copyFeedback && (
                  <div className="about-copy-feedback" role="status" aria-live="polite">
                    {copyFeedback}
                  </div>
                )}
              </div>

              <div className="about-section about-features">
                <h2>Key Features</h2>
                <div className="features-grid">
                  {featureItems.map((feature) => (
                    <div className="feature-item" key={feature.key}>
                      {feature.icon}
                      <div>
                        <strong>{feature.title}</strong>
                        <p>{feature.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="about-section about-resources" style={{ gridColumn: '1 / -1', marginTop: '32px' }}>
                <h2>Resources & Support</h2>
                <div className="resources-content">
                  <div className="resource-group">
                    <h3>Project Information</h3>
                    {projectFacts.map((fact) => (
                      <p key={fact.key}>
                        {fact.icon}
                        <strong>{fact.label}</strong> {fact.value}
                      </p>
                    ))}
                    <p className="copyright">
                      © 2025 Terminality OS. Designed with passion for retro computing.
                    </p>
                  </div>
                  
                  <div className="resource-group">
                    <h3>Get Help & Contribute</h3>
                    <p style={{ marginBottom: '12px' }}>
                      For documentation, updates, and support, visit our GitHub repository.
                    </p>
                    <div className="support-links">
                      {supportActions.map((action) => (
                        <button className="support-btn" key={action.key} onClick={action.action}>
                          {action.icon}
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="changelog-panel">
              <div className="changelog-panel-header">
                <div>
                  <h2>Changelog & Release Notes</h2>
                  <p>Rendered straight from <code>CHANGELOG.md</code> with full markdown formatting.</p>
                </div>
                <div className="changelog-panel-actions">
                  <button className="support-btn" onClick={checkForUpdates} disabled={isChangelogLoading || isChangelogMarkdownLoading}>
                    {(isChangelogLoading || isChangelogMarkdownLoading) ? 'Refreshing…' : 'Refresh'}
                  </button>
                  {updateFeedback && <span className="changelog-status-text">{updateFeedback}</span>}
                </div>
              </div>

              {(changelogError || changelogMarkdownError) && (
                <div className="changelog-alert error">
                  {changelogError || changelogMarkdownError}
                </div>
              )}

              {(isChangelogMarkdownLoading && !changelogMarkdownError) && (
                <div className="changelog-alert">Loading changelog…</div>
              )}

              {(!isChangelogMarkdownLoading && !changelogMarkdownError && changelogMarkdown) && (
                <div className="changelog-markdown-content" role="region" aria-label="Rendered changelog">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {changelogMarkdown}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="settings-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="context-menu-item" onClick={() => { window.location.reload(); closeContextMenu() }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
              <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
            </svg>
            Refresh Settings
          </div>
          <div className="context-menu-divider" />
          <div className="context-menu-item" onClick={() => { alert(`System Settings v${VERSION}\nConfiguration Manager`); closeContextMenu() }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
            </svg>
            About Settings
          </div>
        </div>
      )}
    </div>
  )
}
