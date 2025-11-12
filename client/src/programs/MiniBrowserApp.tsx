import React, { useState, KeyboardEvent, useEffect, useRef } from 'react'

import { BankWebsite } from './BankWebsite'
import { HomeWebsite } from './HomeWebsite'
import { InstagramWebsite } from './InstagramWebsite'
import { PCStoreWebsite } from './PCStoreWebsite'
import { RedditWebsite } from './RedditWebsite'
import './MiniBrowserApp.css'
import { ContextMenuPortal } from '../os/components/ContextMenuPortal'
import { BackIcon, ForwardIcon, RefreshIcon, HomeIcon, InfoIcon } from '../os/components/Icons'
import { useContextMenuPosition } from '../os/hooks/useContextMenuPosition'

interface MiniBrowserAppProps {
  payload?: { initialUrl?: string }
}

const GlobeIcon: React.FC = () => (
  <svg className="browser-logo" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="3" fill="rgba(0, 255, 65, 0.05)"/>
    <ellipse cx="50" cy="50" rx="15" ry="35" stroke="currentColor" strokeWidth="2"/>
    <line x1="15" y1="50" x2="85" y2="50" stroke="currentColor" strokeWidth="2"/>
    <path d="M50 15 Q65 30 50 50 Q35 70 50 85" stroke="currentColor" strokeWidth="2" fill="none"/>
  </svg>
)

export const MiniBrowserApp: React.FC<MiniBrowserAppProps> = ({ payload }) => {
  const initialUrlValue = payload?.initialUrl || 'https://home.axi'
  const [url, setUrl] = useState(initialUrlValue)
  const [currentUrl, setCurrentUrl] = useState(initialUrlValue)
  const [canGoBack, _setCanGoBack] = useState(false)
  const [canGoForward, _setCanGoForward] = useState(false)
  const [_error, _setError] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const { ref: menuRef, pos: menuPos } = useContextMenuPosition(contextMenu?.x ?? 0, contextMenu?.y ?? 0)

  useEffect(() => {
    if (contextMenu) {
      const handler = () => setContextMenu(null)
      window.addEventListener('click', handler)
      return () => window.removeEventListener('click', handler)
    }
  }, [contextMenu])

  const bookmarks = [
    { 
      name: 'Home', 
      url: 'https://home.axi',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    },
    { 
      name: 'Bank', 
      url: 'https://axi-bank.com',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    },
    { 
      name: 'Store', 
      url: 'https://axi-pcstore.com',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
    },
    { 
      name: 'Threadit', 
      url: 'https://threadit.com',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    },
    { 
      name: 'Pictogram', 
      url: 'https://pictogram.com',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
    }
  ]

  // Check if the URL is a 'home' site (special-case homepage)
  const isHomeUrl = (testUrl: string) => {
    return testUrl.includes('home.axi') || testUrl === 'home' || testUrl === 'https://home.axi'
  }

  const navigate = (targetUrl?: string) => {
    const urlToNavigate = targetUrl || url
    let processedUrl = urlToNavigate
    
    // Specific local site handling first
    if (urlToNavigate.includes('axi-bank.com') || urlToNavigate === 'axi-bank') {
      setCurrentUrl('https://axi-bank.com')
      setUrl('https://axi-bank.com')
      scrollToTop()
      return
    }
    if (urlToNavigate.includes('axi-pcstore.com') || urlToNavigate === 'axi-pcstore') {
      setCurrentUrl('https://axi-pcstore.com')
      setUrl('https://axi-pcstore.com')
      scrollToTop()
      return
    }
    if (urlToNavigate.includes('threadit.com') || urlToNavigate === 'threadit') {
      setCurrentUrl('https://threadit.com')
      setUrl('https://threadit.com')
      scrollToTop()
      return
    }
    if (urlToNavigate.includes('pictogram.com') || urlToNavigate === 'pictogram') {
      setCurrentUrl('https://pictogram.com')
      setUrl('https://pictogram.com')
      scrollToTop()
      return
    }
    // Home URL
    if (isHomeUrl(urlToNavigate) || urlToNavigate === 'https://home.axi') {
      setCurrentUrl('https://home.axi')
      setUrl('https://home.axi')
      scrollToTop()
      return
    }
    // Add https:// if no protocol specified
    if (!urlToNavigate.startsWith('http://') && !urlToNavigate.startsWith('https://') && !urlToNavigate.startsWith('local://')) {
      processedUrl = 'https://' + urlToNavigate
      setUrl(processedUrl)
    }
    setCurrentUrl(processedUrl)
    if (!targetUrl) setUrl(processedUrl)
    scrollToTop()
  }

  const scrollToTop = () => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = 0
    }
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      navigate()
    }
  }

  const goBack = () => {
    const iframe = document.querySelector('iframe')
    if (iframe?.contentWindow) {
      iframe.contentWindow.history.back()
    }
  }

  const goForward = () => {
    const iframe = document.querySelector('iframe')
    if (iframe?.contentWindow) {
      iframe.contentWindow.history.forward()
    }
  }

  const refresh = () => {
    setCurrentUrl(currentUrl + '?' + Date.now())
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <div className="browser-root">
      {/* Background effects */}
      <div className="browser-bg-grid" />
      <div className="browser-scanlines" />
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="browser-particle" style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 5}s`,
          animationDuration: `${10 + Math.random() * 10}s`
        }} />
      ))}

      <div className="browser-container" onContextMenu={handleContextMenu}>
        {/* Header */}
        <div className="browser-header">
          <div className="browser-logo-container">
            <GlobeIcon />
          </div>
          <div className="browser-title-group">
            <h1 className="browser-title">
              <span className="browser-bracket">[</span>
              WEB BROWSER
              <span className="browser-bracket">]</span>
            </h1>
            <div className="browser-subtitle">Secure Navigation</div>
          </div>
        </div>

        {/* Browser toolbar */}
        <div className="browser-toolbar">
          <button onClick={goBack} title="Back" className="browser-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <button onClick={goForward} title="Forward" className="browser-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
          <button onClick={refresh} title="Refresh" className="browser-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
          </button>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="ENTER URL..."
            className="url-input"
          />
          <button onClick={() => navigate()} className="browser-btn browser-go-btn">
            <span className="go-bracket">[</span>GO<span className="go-bracket">]</span>
          </button>
        </div>

        {/* Bookmarks bar */}
        <div className="bookmarks-bar">
          {bookmarks.map((bookmark, idx) => (
            <button
              key={idx}
              onClick={() => navigate(bookmark.url)}
              className="bookmark-btn"
              title={bookmark.url}
            >
              {bookmark.icon}
              <span>{bookmark.name}</span>
            </button>
          ))}
        </div>

        {/* Browser viewport */}
        <div className="browser-viewport" ref={viewportRef}>
        {currentUrl.includes('home.axi') ? (
          // Home page
          <HomeWebsite onNavigate={(url) => navigate(url)} />
        ) : currentUrl.includes('axi-bank.com') ? (
          // Local Bank site
          <BankWebsite />
        ) : currentUrl.includes('axi-pcstore.com') ? (
          // Local PC Store site
          <PCStoreWebsite />
        ) : currentUrl.includes('threadit.com') ? (
          // Local Reddit-like site
          <RedditWebsite />
        ) : currentUrl.includes('pictogram.com') ? (
          // Local Instagram-like site
          <InstagramWebsite />
        ) : (
          <div className="fake-website">
            <div className="fake-website-header">
              <div className="fake-website-logo">[SITE]</div>
              <div className="fake-website-nav">
                <span>Home</span>
                <span>About</span>
                <span>Services</span>
                <span>Contact</span>
              </div>
            </div>
            <div className="fake-website-content">
              <h1>External Site Placeholder</h1>
              <p>This is a simulated external website view.</p>
              <p>URL: {currentUrl}</p>
              <div className="fake-website-info">
                <p>💡 This browser only supports local sites:</p>
                <ul>
                  <li>AXI Bank (local://axi-bank.com)</li>
                  <li>AXI PC Store (local://axi-pcstore.com)</li>
                  <li>Threadit (local://threadit.com)</li>
                  <li>Pictogram (local://pictogram.com)</li>
                </ul>
                <p>Use the bookmarks above to navigate to available sites.</p>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Status bar */}
        <div className="browser-status">
          <span className="status-url">
            <span className="status-bracket">[</span>
            URL: {currentUrl}
            <span className="status-bracket">]</span>
          </span>
          <span className="status-info">
            LOCAL SITES: BANK | STORE | THREADIT | PICTOGRAM
          </span>
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <ContextMenuPortal>
            <div
              ref={menuRef}
              className="browser-context-menu"
              style={{
                position: 'fixed',
                left: menuPos.left,
                top: menuPos.top,
                zIndex: 10001
              }}
            >
              <div className="browser-context-item" onClick={() => { goBack(); setContextMenu(null) }} style={{ opacity: canGoBack ? 1 : 0.5 }}><BackIcon size={14}/> Back</div>
              <div className="browser-context-item" onClick={() => { goForward(); setContextMenu(null) }} style={{ opacity: canGoForward ? 1 : 0.5 }}><ForwardIcon size={14}/> Forward</div>
              <div className="browser-context-item" onClick={() => { refresh(); setContextMenu(null) }}><RefreshIcon size={14}/> Refresh</div>
              <div className="browser-context-divider" />
              <div className="browser-context-item" onClick={() => { navigate('https://home.axi'); setContextMenu(null) }}><HomeIcon size={14}/> Home</div>
              <div className="browser-context-divider" />
              <div className="browser-context-item" onClick={() => { alert('Terminality Browser v1.0\nSecure browsing for local sites'); setContextMenu(null) }}><InfoIcon size={14}/> About</div>
            </div>
          </ContextMenuPortal>
        )}
      </div>
    </div>
  )
}
