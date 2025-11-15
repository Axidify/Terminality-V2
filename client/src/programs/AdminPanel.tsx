import React, { useState } from 'react'

import { getCachedDesktop } from '../services/saveService'
import './AdminPanel.css'

export const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'quests' | 'logs'>('quests')
  const initialDesktop = getCachedDesktop()

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1 className="admin-title">[ GAME DESIGNER CONSOLE ]</h1>
        <div className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === 'quests' ? 'active' : ''}`}
            onClick={() => setActiveTab('quests')}
          >
            Quests
          </button>
          <button
            className={`admin-tab ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            Debug Logs
          </button>
        </div>
      </div>

      <div className="admin-content">
        {activeTab === 'quests' && (
          <div className="admin-section">
            <h2>Quest Authoring</h2>
            <p className="admin-empty-state">
              Quest authoring tools have been retired from this build. Hook into the new TerminalApp scan
              workflow to script narrative beats instead.
            </p>
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
      </div>
    </div>
  )
}
