import React, { useState } from 'react'

import { getCachedDesktop, saveDesktopState } from '../services/saveService'
import './AdminPanel.css'

interface GameState {
  playerCurrency: number
  installedTools: string[]
  level: number
  experience: number
  notifications: number
}

export const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'state' | 'scenario' | 'logs' | 'config'>('state')
  const initialDesktop = getCachedDesktop()
  const [gameState, setGameState] = useState<GameState>(() => ({
    playerCurrency: initialDesktop?.playerCurrency ?? 1000,
    installedTools: initialDesktop?.installedTools ?? [],
    level: initialDesktop?.playerLevel ?? 1,
    experience: initialDesktop?.playerExperience ?? 0,
    notifications: (initialDesktop?.notifications?.length ?? 0)
  }))

  const [newCurrency, setNewCurrency] = useState(gameState.playerCurrency.toString())
  const [newLevel, setNewLevel] = useState(gameState.level.toString())
  const [scenarioName, setScenarioName] = useState('')
  const [scenarioDesc, setScenarioDesc] = useState('')

  const refreshState = () => {
    const d = getCachedDesktop()
    setGameState({
      playerCurrency: d?.playerCurrency ?? 1000,
      installedTools: d?.installedTools ?? [],
      level: d?.playerLevel ?? 1,
      experience: d?.playerExperience ?? 0,
      notifications: (d?.notifications?.length ?? 0)
    })
  }

  const updateCurrency = () => {
    const amount = parseInt(newCurrency)
    if (!isNaN(amount)) {
      saveDesktopState({ playerCurrency: amount }).then(refreshState).catch(() => {})
    }
  }

  const updateLevel = () => {
    const level = parseInt(newLevel)
    if (!isNaN(level)) {
      saveDesktopState({ playerLevel: level }).then(refreshState).catch(() => {})
    }
  }

  const resetProgress = () => {
    if (confirm('Reset all player progress? This cannot be undone.')) {
      saveDesktopState({ playerCurrency: 1000, installedTools: [], windowMemory: {}, icons: {}, playerLevel: 1, playerExperience: 0 }).then(refreshState).catch(() => {})
      alert('Progress reset complete!')
    }
  }

  const clearNotifications = () => {
    saveDesktopState({ notifications: [] }).then(refreshState).catch(() => {})
  }

  const exportState = () => {
    const d = getCachedDesktop()
    const state = {
      playerCurrency: d?.playerCurrency ?? 1000,
      installedTools: d?.installedTools ?? [],
      playerLevel: d?.playerLevel ?? 1,
      playerExperience: d?.playerExperience ?? 0,
      notifications: d?.notifications ?? [],
      windowMemory: d?.windowMemory ?? {},
      theme: d?.theme ?? 'green',
      timestamp: new Date().toISOString()
    }
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `terminality-state-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const createScenario = () => {
    if (scenarioName && scenarioDesc) {
      const d = getCachedDesktop()
      const scenarios = d?.scenarios ? [...d.scenarios] : []
      scenarios.push({
        id: Date.now().toString(),
        name: scenarioName,
        description: scenarioDesc,
        created: new Date().toISOString(),
        state: {
          playerCurrency: gameState.playerCurrency,
          installedTools: gameState.installedTools,
          level: gameState.level,
          experience: gameState.experience
        }
      })
      saveDesktopState({ scenarios }).then(() => {
        setScenarioName('')
        setScenarioDesc('')
        alert('Scenario created!')
      }).catch(() => {})
    }
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1 className="admin-title">[ GAME DESIGNER CONSOLE ]</h1>
        <div className="admin-tabs">
          <button 
            className={`admin-tab ${activeTab === 'state' ? 'active' : ''}`}
            onClick={() => setActiveTab('state')}
          >
            Game State
          </button>
          <button 
            className={`admin-tab ${activeTab === 'scenario' ? 'active' : ''}`}
            onClick={() => setActiveTab('scenario')}
          >
            Scenarios
          </button>
          <button 
            className={`admin-tab ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            Debug Logs
          </button>
          <button 
            className={`admin-tab ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            Configuration
          </button>
        </div>
      </div>

      <div className="admin-content">
        {activeTab === 'state' && (
          <div className="admin-section">
            <h2>Current Game State</h2>
            <div className="state-grid">
              <div className="state-card">
                <div className="state-label">Currency</div>
                <div className="state-value">💰 {gameState.playerCurrency}</div>
                <div className="state-controls">
                  <input 
                    type="number" 
                    value={newCurrency} 
                    onChange={(e) => setNewCurrency(e.target.value)}
                    className="state-input"
                  />
                  <button onClick={updateCurrency} className="admin-btn">Update</button>
                </div>
              </div>

              <div className="state-card">
                <div className="state-label">Level</div>
                <div className="state-value">⭐ {gameState.level}</div>
                <div className="state-controls">
                  <input 
                    type="number" 
                    value={newLevel} 
                    onChange={(e) => setNewLevel(e.target.value)}
                    className="state-input"
                  />
                  <button onClick={updateLevel} className="admin-btn">Update</button>
                </div>
              </div>

              <div className="state-card">
                <div className="state-label">Experience</div>
                <div className="state-value">📊 {gameState.experience} XP</div>
              </div>

              <div className="state-card">
                <div className="state-label">Installed Tools</div>
                <div className="state-value">🔧 {gameState.installedTools.length}</div>
                <div className="state-list">
                  {gameState.installedTools.map((tool, idx) => (
                    <div key={idx} className="tool-item">{tool}</div>
                  ))}
                </div>
              </div>

              <div className="state-card">
                <div className="state-label">Notifications</div>
                <div className="state-value">🔔 {gameState.notifications}</div>
                <button onClick={clearNotifications} className="admin-btn danger">Clear All</button>
              </div>
            </div>

            <div className="admin-actions">
              <button onClick={refreshState} className="admin-btn primary">🔄 Refresh State</button>
              <button onClick={exportState} className="admin-btn">📥 Export State</button>
              <button onClick={resetProgress} className="admin-btn danger">[DEL] Reset Progress</button>
            </div>
          </div>
        )}

        {activeTab === 'scenario' && (
          <div className="admin-section">
            <h2>Create Test Scenario</h2>
            <div className="scenario-form">
              <div className="form-group">
                <label htmlFor="scenario-name">Scenario Name</label>
                <input 
                  id="scenario-name"
                  type="text" 
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="e.g., Tutorial Complete"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="scenario-desc">Description</label>
                <textarea 
                  id="scenario-desc"
                  value={scenarioDesc}
                  onChange={(e) => setScenarioDesc(e.target.value)}
                  placeholder="Describe the scenario state..."
                  className="form-textarea"
                  rows={4}
                />
              </div>
              <button onClick={createScenario} className="admin-btn primary">💾 Save Scenario</button>
            </div>

            <div className="scenario-list">
              <h3>Saved Scenarios</h3>
              {(getCachedDesktop()?.scenarios || []).map((scenario: any) => (
                <div key={scenario.id} className="scenario-card">
                  <div className="scenario-name">{scenario.name}</div>
                  <div className="scenario-desc">{scenario.description}</div>
                  <div className="scenario-meta">
                    Created: {new Date(scenario.created).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="admin-section">
            <h2>Debug Logs</h2>
            <div className="log-console">
              <div className="log-entry">[INFO] Admin panel loaded</div>
              <div className="log-entry">[DEBUG] Server state available: {initialDesktop ? 'yes' : 'no'}</div>
              <div className="log-entry">[INFO] Theme: {initialDesktop?.theme || 'green'}</div>
              <div className="log-entry">[DEBUG] Sound effects: {initialDesktop?.soundEffectsEnabled !== false ? 'enabled' : 'disabled'}</div>
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="admin-section">
            <h2>Configuration</h2>
            <div className="config-grid">
              <div className="config-item">
                <div className="config-label">Starting Currency</div>
                <input type="number" defaultValue="1000" className="config-input" />
              </div>
              <div className="config-item">
                <div className="config-label">XP per Level</div>
                <input type="number" defaultValue="100" className="config-input" />
              </div>
              <div className="config-item">
                <div className="config-label">Tool Base Cost</div>
                <input type="number" defaultValue="150" className="config-input" />
              </div>
              <div className="config-item">
                <div className="config-label">Debug Mode</div>
                <input type="checkbox" className="config-checkbox" />
              </div>
            </div>
            <button className="admin-btn primary">💾 Save Configuration</button>
          </div>
        )}
      </div>
    </div>
  )
}
