import React, { useState, useMemo } from 'react'
import { usePluginManager } from '../modular-apps/PluginManager'
import { useWindowManager } from '../os/WindowManager'
import { useTheme } from '../os/ThemeContext'
import './AppStoreApp.css'

const StarIcon: React.FC<{ filled?: boolean; size?: number }> = ({ filled, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

const DownloadIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2V16M19 10L12 17L5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 21H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const categories = ['all', 'utilities', 'productivity', 'games', 'media', 'social']

export const AppStoreApp: React.FC = () => {
  const pm = usePluginManager()
  const wm = useWindowManager()
  const { themeName } = useTheme()
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const filteredApps = useMemo(() => {
    return pm.available.filter(app => {
      const matchesCategory = selectedCategory === 'all' || app.category === selectedCategory
      const matchesSearch = !searchQuery || app.name.toLowerCase().includes(searchQuery.toLowerCase()) || app.description?.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [pm.available, selectedCategory, searchQuery])

  const featuredApps = useMemo(() => filteredApps.filter(a => a.featured), [filteredApps])

  const handleInstall = (id: string) => {
    pm.install(id)
  }
  const handleUninstall = (id: string) => {
    pm.uninstall(id)
  }
  const handleOpen = (id: string) => {
    wm.open('modular-plugin', { title: pm.available.find(p => p.id === id)?.name || id, payload: { pluginId: id } })
  }

  const renderRating = (rating?: number) => {
    if (!rating) return null
    const fullStars = Math.floor(rating)
    return (
      <div className="app-rating">
        {[...Array(5)].map((_, i) => (
          <span key={i} className="star">
            <StarIcon filled={i < fullStars} size={14} />
          </span>
        ))}
        <span className="rating-text">{rating.toFixed(1)}</span>
      </div>
    )
  }

  return (
    <div className="appstore-root">
      {/* Header */}
      <div className="appstore-header">
        <h1>App Store</h1>
        <p>Discover and install modular desktop applications</p>
      </div>

      {/* Search Bar */}
      <div className="appstore-search-bar">
        <input
          type="text"
          placeholder="Search apps..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Category Filter */}
      <div className="appstore-categories">
        {categories.map(cat => (
          <button
            key={cat}
            className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Featured Section */}
      {featuredApps.length > 0 && (
        <div className="appstore-featured">
          <h2>Featured</h2>
          <div className="featured-apps">
            {featuredApps.slice(0, 3).map(app => (
              <div key={app.id} className="featured-card">
                <div className="featured-header">
                  <h3>{app.name}</h3>
                  {renderRating(app.rating)}
                </div>
                <p className="featured-desc">{app.description}</p>
                <p className="featured-author">by {app.author || 'Unknown'}</p>
                <div className="featured-footer">
                  <span className="download-count">
                    <DownloadIcon size={12} /> {app.downloads?.toLocaleString() || 0}
                  </span>
                  {pm.isInstalled(app.id) ? (
                    <div className="featured-actions">
                      <button className="btn-small open" onClick={() => handleOpen(app.id)}>Open</button>
                      <button className="btn-small uninstall" onClick={() => handleUninstall(app.id)}>Uninstall</button>
                    </div>
                  ) : (
                    <button className="btn-install" onClick={() => handleInstall(app.id)}>Install</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Apps Grid */}
      <div className="appstore-section">
        <h2>{selectedCategory === 'all' ? 'All Apps' : categories.find(c => c === selectedCategory)?.charAt(0).toUpperCase() + selectedCategory.slice(1)}</h2>
        <div className="apps-grid">
          {filteredApps.map(app => (
            <div key={app.id} className="app-card">
              <div className="app-card-header">
                <h3>{app.name}</h3>
                <span className="app-version">{app.version}</span>
              </div>

              <p className="app-description">{app.description}</p>

              <div className="app-meta">
                <div className="app-author">by {app.author || 'Unknown'}</div>
                {renderRating(app.rating)}
              </div>

              <div className="app-downloads">
                <DownloadIcon size={12} /> {app.downloads?.toLocaleString() || 0} downloads
              </div>

              <div className="app-actions">
                {pm.isInstalled(app.id) ? (
                  <>
                    <button className="btn-secondary open" onClick={() => handleOpen(app.id)}>Open</button>
                    <button className="btn-secondary uninstall" onClick={() => handleUninstall(app.id)}>Uninstall</button>
                  </>
                ) : (
                  <button className="btn-primary" onClick={() => handleInstall(app.id)}>Install</button>
                )}
              </div>
            </div>
          ))}
        </div>
        {filteredApps.length === 0 && (
          <div className="no-results">
            <p>No apps found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default AppStoreApp
