import React from 'react'

import { usePluginManager } from '../modular-apps/PluginManager'

export const PluginHost: React.FC<{ pluginId?: string }> = ({ pluginId }) => {
  const pm = usePluginManager()
  const Comp = pm.getComponent(pluginId || '')
  if (!Comp) return <div style={{ padding: 12 }}>Plugin not found: {pluginId}</div>
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <Comp />
    </div>
  )
}

export default PluginHost
