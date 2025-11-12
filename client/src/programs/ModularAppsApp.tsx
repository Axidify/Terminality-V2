import React from 'react'
import { usePluginManager } from '../modular-apps/PluginManager'
import { useWindowManager } from '../os/WindowManager'
import './ModularAppsApp.css'

export const ModularAppsApp: React.FC = () => {
  const pm = usePluginManager()
  const wm = useWindowManager()

  const handleInstall = (id: string) => {
    pm.install(id)
  }
  const handleUninstall = (id: string) => {
    pm.uninstall(id)
  }
  const handleOpen = (id: string) => {
    wm.open('modular-plugin', { title: pm.available.find(p => p.id === id)?.name || id, payload: { pluginId: id } })
  }

  return (
    <div className="modular-apps-root">
      <h2>Modular Apps</h2>
      <p>Install/uninstall and open experimental modular desktop apps.</p>
      <div className="plugin-list">
        {pm.available.map(p => (
          <div key={p.id} className="plugin-item">
            <div className="plugin-meta">
              <div className="plugin-name">{p.name}</div>
              <div className="plugin-desc">{p.description}</div>
            </div>
            <div className="plugin-actions">
              {pm.isInstalled(p.id) ? (
                <>
                  <button onClick={() => handleOpen(p.id)}>Open</button>
                  <button onClick={() => handleUninstall(p.id)}>Uninstall</button>
                </>
              ) : (
                <button onClick={() => handleInstall(p.id)}>Install</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ModularAppsApp
