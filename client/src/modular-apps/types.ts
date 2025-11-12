import React from 'react'

export interface ModularAppManifest {
  id: string
  name: string
  description?: string
  version?: string
  icon?: React.ReactNode | string
  component: React.ComponentType<any>
  author?: string
  category?: 'utilities' | 'productivity' | 'games' | 'media' | 'social' | 'other'
  rating?: number // 0-5
  downloads?: number
  screenshots?: string[] // URLs to screenshots
  featured?: boolean
}

export type PluginRegistry = Record<string, ModularAppManifest>

export default ModularAppManifest
