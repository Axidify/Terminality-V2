import React from 'react'
import { ModularAppManifest } from '../types'
import { usePluginManager } from '../PluginManager'

export const SamplePlugin: React.FC = () => {
  return (
    <div style={{ padding: 18 }}>
      <h3>Sample Modular App</h3>
      <p>This is a small experimental plugin to demonstrate the modular apps API.</p>
    </div>
  )
}

// Self-register on module load so the manager knows about it
export const manifest: ModularAppManifest = {
  id: 'sample-plugin',
  name: 'Sample Plugin',
  description: 'A simple sample plugin for testing the modular apps API',
  version: '0.0.1',
  component: SamplePlugin
}

export function registerSamplePlugin(register: (m: ModularAppManifest) => void) {
  register(manifest)
}
