import { apiRequest } from './api'

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
  identifiers: {
    ips?: string[]
    hostnames?: string[]
  }
  metadata?: {
    username?: string
    startingPath?: string
    footprint?: string
  }
  filesystem: Record<string, FileSystemNode>
}

export interface SystemProfilesResponse {
  profiles: SystemProfileDTO[]
  templates: Array<{ id: string; label: string; description?: string; filesystem: Record<string, FileSystemNode> }>
  lastUpdated: string
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
