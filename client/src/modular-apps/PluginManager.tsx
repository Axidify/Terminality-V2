import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

import registerAllBuiltin from './registerPlugins'
import { ModularAppManifest } from './types'
import { saveDesktopState, getCachedDesktop } from '../services/saveService'

interface PluginManagerContextValue {
  register: (manifest: ModularAppManifest) => void
  available: ModularAppManifest[]
  installedIds: string[]
  install: (id: string) => Promise<void>
  uninstall: (id: string) => Promise<void>
  isInstalled: (id: string) => boolean
  getComponent: (id: string) => React.ComponentType<any> | undefined
}

const PluginManagerContext = createContext<PluginManagerContextValue | undefined>(undefined)

export const PluginManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [registry, setRegistry] = useState<Record<string, ModularAppManifest>>({})
  const [available, setAvailable] = useState<ModularAppManifest[]>([])
  const [installedIds, setInstalledIds] = useState<string[]>(() => getCachedDesktop()?.installedTools || [])

  useEffect(() => {
    setInstalledIds(getCachedDesktop()?.installedTools || [])
  }, [])

  useEffect(() => {
    // persist installed plugin ids to desktop state
    saveDesktopState({ installedTools: installedIds }).catch(() => {})
  }, [installedIds])

  const register = useCallback((manifest: ModularAppManifest) => {
    setRegistry(prev => {
      if (prev[manifest.id]) return prev
      const next = { ...prev, [manifest.id]: manifest }
      setAvailable(Object.values(next))
      return next
    })
  }, [])

  useEffect(() => {
    // Register built-in plugins present in the bundle
    try {
      registerAllBuiltin().forEach(m => register(m))
    } catch { /* no-op */ }
  }, [register])

  const install = useCallback(async (id: string) => {
    setInstalledIds(prev => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      // Save will be handled by effect
      return next
    })
  }, [])

  const uninstall = useCallback(async (id: string) => {
    setInstalledIds(prev => prev.filter(x => x !== id))
  }, [])

  const isInstalled = useCallback((id: string) => installedIds.includes(id), [installedIds])

  const getComponent = useCallback((id: string) => registry[id]?.component, [registry])

  return (
    <PluginManagerContext.Provider value={{ register, available, installedIds, install, uninstall, isInstalled, getComponent }}>
      {children}
    </PluginManagerContext.Provider>
  )
}

export function usePluginManager() {
  const ctx = useContext(PluginManagerContext)
  if (!ctx) throw new Error('usePluginManager must be used inside PluginManagerProvider')
  return ctx
}
