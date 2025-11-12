import React from 'react'

export interface ModularAppManifest {
  id: string
  name: string
  description?: string
  version?: string
  icon?: React.ReactNode | string
  component: React.ComponentType<any>
}

export type PluginRegistry = Record<string, ModularAppManifest>

export default ModularAppManifest
