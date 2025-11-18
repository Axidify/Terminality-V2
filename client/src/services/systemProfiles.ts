import { apiRequest } from './api'

import type {
  ResolutionContext,
  SystemDefinition,
  TerminalHostConfig,
  ToolBindingConfig
} from '../systemDefinitions/types'

export interface FileSystemNode {
  type: 'dir' | 'file'
  name: string
  path: string
  children?: string[]
  content?: string
}

export interface SystemProfileDTO {
  id: string
  label: string
  description?: string
  identifiers?: {
    ips?: string[]
    hostnames?: string[]
  }
  metadata?: {
    username?: string
    startingPath?: string
    footprint?: string
    hostConfig?: TerminalHostConfig
    toolBindings?: ToolBindingConfig
    scopeBindings?: ResolutionContext
  }
  filesystem: Record<string, FileSystemNode>
}

export type SystemTemplateDTO = SystemProfileDTO

export interface SystemProfilesResponse {
  profiles: SystemProfileDTO[]
  templates: SystemTemplateDTO[]
  lastUpdated: string
  systemDefinitions?: SystemDefinition[]
  systemDefinitionTemplates?: SystemDefinition[]
}

export async function listSystemProfiles(): Promise<SystemProfilesResponse> {
  return apiRequest<SystemProfilesResponse>('/api/terminal-systems')
}

export async function getSystemProfile(id: string, options: { template?: boolean } = {}) {
  const query = options.template ? '?template=true' : ''
  return apiRequest<{ profile: SystemProfileDTO }>(`/api/terminal-systems/${id}${query}`)
}

export async function saveSystemProfile(profile: SystemProfileDTO, options: { template?: boolean } = {}) {
  return apiRequest<{ profile: SystemProfileDTO }>('/api/terminal-systems', {
    method: 'POST',
    auth: true,
    body: { profile, template: !!options.template }
  })
}

export async function updateSystemProfile(id: string, profile: SystemProfileDTO, options: { template?: boolean } = {}) {
  return apiRequest<{ profile: SystemProfileDTO }>(`/api/terminal-systems/${id}`, {
    method: 'PUT',
    auth: true,
    body: { profile, template: !!options.template }
  })
}

export async function deleteSystemProfile(id: string, options: { template?: boolean } = {}) {
  return apiRequest<{ profile: SystemProfileDTO }>(`/api/terminal-systems/${id}${options.template ? '?template=true' : ''}`, {
    method: 'DELETE',
    auth: true
  })
}
