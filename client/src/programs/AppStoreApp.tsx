import React, { useState, useMemo } from 'react'
import { usePluginManager } from '../modular-apps/PluginManager'
import { useWindowManager } from '../os/WindowManager'
import './AppStoreApp.css'

const categories = ['all', 'utilities', 'productivity', 'games', 'media', 'social']

export const AppStoreApp: React.FC = () => {
  const pm = usePluginManager()
  const wm = useWindowManager()
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const filteredApps = useMemo(() => {
    return pm.available.filter(app => {
      const matchesCategory = selectedCategory === 'all' || app.category === selectedCategory
      const matchesSearch = !searchQuery || 
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        app.description?.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [pm.available, selectedCategory, searchQuery])

  const featuredApps = useMemo(() => filteredApps.filter(a => a.featured).slice(0, 3), [filteredApps])

  const handleInstall = (id: string) => pm.install(id)
  const handleUninstall = (id: string) => pm.uninstall(id)
  const handleOpen = (id: string) => {
    wm.open('modular-plugin', { 
      title: pm.available.find(p => p.id === id)?.name || id, 
      payload: { pluginId: id } 
    })
  }

  return (
    <div className="appstore-root">
      {/* Background effects */}
      <div className="appstore-bg-grid" />
      <div className="appstore-scanlines" />
      <div className="appstore-particles">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="appstore-particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${6 + Math.random() * 4}s`
            }}
          />
        ))}
      </div>

      {/* Header */}
      <div className="appstore-header">
        <div className="appstore-header-content">
          <svg className="appstore-logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
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
          <div className="appstore-header-text">
            <h1 className="appstore-title">APP STORE</h1>
            <p className="appstore-subtitle">MODULAR DESKTOP EXTENSIONS</p>
          </div>
        </div>
        <div className="appstore-header-divider" />
      </div>

      {/* Search */}
      <div className="appstore-search">
        <input
          type="text"
          placeholder="SEARCH APPLICATIONS..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="appstore-search-input"
        />
      </div>

      {/* Categories */}
      <div className="appstore-categories">
        {categories.map(cat => (
          <button
            key={cat}
            className={`appstore-category-btn ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            <span className="category-bracket">[</span>
            {cat.toUpperCase()}
            <span className="category-bracket">]</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="appstore-content">
        {/* Featured Section */}
        {featuredApps.length > 0 && (
          <div className="appstore-featured">
            <h2 className="appstore-section-title">
              <span className="title-bracket">{'>'}</span> FEATURED
            </h2>
            <div className="appstore-featured-grid">
              {featuredApps.map(app => (
                <div key={app.id} className="appstore-featured-card">
                  <div className="featured-card-border" />
                  <div className="featured-card-content">
                    <div className="featured-card-header">
                      <h3 className="featured-card-title">{app.name}</h3>
                      <span className="featured-card-version">v{app.version}</span>
                    </div>
                    <p className="featured-card-desc">{app.description}</p>
                    <div className="featured-card-meta">
                      <span className="featured-card-author">by {app.author || 'Unknown'}</span>
                      {app.rating && (
                        <span className="featured-card-rating">
                          ★ {app.rating.toFixed(1)}
                        </span>
                      )}
                      <span className="featured-card-downloads">
                        ↓ {app.downloads?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div className="featured-card-actions">
                      {pm.isInstalled(app.id) ? (
                        <>
                          <button className="appstore-btn primary" onClick={() => handleOpen(app.id)}>
                            OPEN
                          </button>
                          <button className="appstore-btn secondary" onClick={() => handleUninstall(app.id)}>
                            UNINSTALL
                          </button>
                        </>
                      ) : (
                        <button className="appstore-btn primary" onClick={() => handleInstall(app.id)}>
                          INSTALL
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Apps */}
        <div className="appstore-all-apps">
          <h2 className="appstore-section-title">
            <span className="title-bracket">{'>'}</span> {selectedCategory === 'all' ? 'ALL APPLICATIONS' : selectedCategory.toUpperCase()}
          </h2>
          <div className="appstore-apps-grid">
            {filteredApps.map(app => (
              <div key={app.id} className="appstore-app-card">
                <div className="app-card-border" />
                <div className="app-card-content">
                  <div className="app-card-header">
                    <h3 className="app-card-title">{app.name}</h3>
                    <span className="app-card-version">v{app.version}</span>
                  </div>
                  <p className="app-card-desc">{app.description}</p>
                  <div className="app-card-meta">
                    <span className="app-card-author">{app.author || 'Unknown'}</span>
                    {app.rating && <span className="app-card-rating">★ {app.rating.toFixed(1)}</span>}
                  </div>
                  <div className="app-card-footer">
                    <span className="app-card-downloads">↓ {app.downloads?.toLocaleString() || 0}</span>
                    <div className="app-card-actions">
                      {pm.isInstalled(app.id) ? (
                        <>
                          <button className="appstore-btn-small primary" onClick={() => handleOpen(app.id)}>
                            OPEN
                          </button>
                          <button className="appstore-btn-small secondary" onClick={() => handleUninstall(app.id)}>
                            REMOVE
                          </button>
                        </>
                      ) : (
                        <button className="appstore-btn-small primary" onClick={() => handleInstall(app.id)}>
                          INSTALL
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {filteredApps.length === 0 && (
            <div className="appstore-no-results">
              <p>{'>'} NO APPLICATIONS FOUND</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AppStoreApp
