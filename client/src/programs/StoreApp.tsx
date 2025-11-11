import React from 'react'
import { getCachedDesktop, saveDesktopState } from '../services/saveService'
import './StoreApp.css'

interface Tool {
  id: string
  name: string
  desc: string
  icon: React.ReactNode
  price: number
  installed: boolean
  category: 'forensics' | 'hacking' | 'stealth' | 'analysis'
}

const cached = getCachedDesktop()
const getInstalledTools = (): string[] => cached?.installedTools ?? []
const getCurrency = (): number => cached?.playerCurrency ?? 1000
const setCurrency = (amount: number) => { saveDesktopState({ playerCurrency: amount }).catch(() => {}) }

export const StoreApp: React.FC = () => {
  const [query, setQuery] = React.useState('')
  const [currency, setCurrencyState] = React.useState(getCurrency())
  const [installedTools, setInstalledTools] = React.useState<string[]>(getInstalledTools())
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all')

  const tools: Tool[] = [
    { 
      id: 'forensic-scanner', 
      name: 'Forensic Scanner', 
      desc: 'Analyze files and recover deleted data from systems', 
      icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z"/><path d="M10 10h.01"/></svg>, 
      price: 250,
      installed: installedTools.includes('forensic-scanner'),
      category: 'forensics'
    },
    { 
      id: 'port-scanner', 
      name: 'Port Scanner', 
      desc: 'Scan network ports and detect open services', 
      icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>, 
      price: 150,
      installed: installedTools.includes('port-scanner'),
      category: 'hacking'
    },
    { 
      id: 'packet-sniffer', 
      name: 'Packet Sniffer', 
      desc: 'Intercept and analyze network traffic', 
      icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4m0 12v4m8-10h-4M8 12H4m13.66-7.66l-2.83 2.83M9.17 14.83l-2.83 2.83m9.32 0l-2.83-2.83M9.17 9.17L6.34 6.34"/></svg>, 
      price: 300,
      installed: installedTools.includes('packet-sniffer'),
      category: 'analysis'
    },
    { 
      id: 'crypto-breaker', 
      name: 'Crypto Breaker', 
      desc: 'Decrypt encrypted files and communications', 
      icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>, 
      price: 500,
      installed: installedTools.includes('crypto-breaker'),
      category: 'hacking'
    },
    { 
      id: 'trace-cleaner', 
      name: 'Trace Cleaner', 
      desc: 'Remove logs and traces of your activities', 
      icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>, 
      price: 200,
      installed: installedTools.includes('trace-cleaner'),
      category: 'stealth'
    },
    { 
      id: 'log-analyzer', 
      name: 'Log Analyzer', 
      desc: 'Parse system logs to find security events', 
      icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>, 
      price: 180,
      installed: installedTools.includes('log-analyzer'),
      category: 'forensics'
    },
    { 
      id: 'exploit-kit', 
      name: 'Exploit Kit', 
      desc: 'Advanced exploitation tools for penetration testing', 
      icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>, 
      price: 800,
      installed: installedTools.includes('exploit-kit'),
      category: 'hacking'
    },
    { 
      id: 'proxy-chain', 
      name: 'Proxy Chain', 
      desc: 'Route traffic through multiple proxies for anonymity', 
      icon: '[NET]', 
      price: 350,
      installed: installedTools.includes('proxy-chain'),
      category: 'stealth'
    },
  ]

  const handleInstall = (tool: Tool) => {
    if (tool.installed) return
    
    if (currency >= tool.price) {
      const newCurrency = currency - tool.price
      const newInstalled = [...installedTools, tool.id]
      
      setCurrency(newCurrency)
      setCurrencyState(newCurrency)
      setInstalledTools(newInstalled)
      saveDesktopState({ installedTools: newInstalled }).catch(() => {})
    } else {
      alert('Insufficient credits!')
    }
  }

  const filtered = tools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(query.toLowerCase()) || 
                          tool.desc.toLowerCase().includes(query.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="store">
      <div className="store-header">
        <div className="store-title-section">
          <div className="store-title">Terminality Store</div>
          <div className="store-currency">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            Credits: {currency}
          </div>
        </div>
        <div className="store-controls">
          <input
            className="store-search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tools..."
          />
        </div>
      </div>

      <div className="store-categories">
        {['all', 'forensics', 'hacking', 'stealth', 'analysis'].map(cat => (
          <button
            key={cat}
            className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      <div className="store-content">
        <div className="store-grid">
          {filtered.map(tool => (
            <div key={tool.id} className={`store-card ${tool.installed ? 'installed' : ''}`}>
              <div className="store-icon">{tool.icon}</div>
              <div className="store-name">{tool.name}</div>
              <div className="store-desc">{tool.desc}</div>
              <div className="store-footer">
                <div className="store-price">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
                    <line x1="12" y1="1" x2="12" y2="23"/>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                  {tool.price}
                </div>
                <button 
                  className="store-btn" 
                  onClick={() => handleInstall(tool)}
                  disabled={tool.installed || currency < tool.price}
                >
                  {tool.installed ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Installed
                    </>
                  ) : 'Install'}
                </button>
              </div>
            </div>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="store-empty">No tools found</div>
        )}
      </div>
    </div>
  )
}
