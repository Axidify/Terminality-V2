import { resolveSystemsForContext } from '../systemDefinitions/resolvers'

import type { ResolutionContext, SystemDefinition, TerminalHostConfig } from '../systemDefinitions/types'

export type RemoteNodeType = 'dir' | 'file'

export interface RemoteNode {
  type: RemoteNodeType
  name: string
  path: string
  children?: string[]
  content?: string
}

export interface HostDefinition {
  ip: string
  label: string
  online: boolean
  openPorts: string[]
  username: string
  startingPath: string
  footprint: string
  filesystem: Record<string, RemoteNode>
  hostConfig?: TerminalHostConfig
}

export interface HostRuntime {
  definition: HostDefinition
  nodes: Record<string, RemoteNode>
}

export interface SystemProfile {
  id: string
  label: string
  identifiers: {
    ips: string[]
    hostnames?: string[]
  }
  metadata?: {
    username?: string
    startingPath?: string
    footprint?: string
    openPorts?: string[]
    hostConfig?: TerminalHostConfig
  }
  filesystem: Record<string, RemoteNode>
}

const cloneNode = (node: RemoteNode): RemoteNode => ({
  ...node,
  children: node.children ? [...node.children] : undefined
})

const cloneFilesystem = (filesystem: Record<string, RemoteNode>) => (
  Object.entries(filesystem || {}).reduce<Record<string, RemoteNode>>((acc, [path, node]) => {
    acc[path] = cloneNode(node)
    return acc
  }, {})
)

const DEFAULT_PROFILE: SystemProfile = {
  id: 'atlas_relay',
  label: 'Atlas Relay',
  identifiers: { ips: ['10.23.4.8'], hostnames: [] },
  metadata: {
    username: 'guest',
    startingPath: '/home/guest',
    footprint: 'Legacy relay maintained by an unknown broker.',
    openPorts: ['22/tcp', '8080/tcp']
  },
  filesystem: {
    '/': { type: 'dir', name: '', path: '/', children: ['/home', '/var', '/etc'] },
    '/home': { type: 'dir', name: 'home', path: '/home', children: ['/home/guest'] },
    '/home/guest': { type: 'dir', name: 'guest', path: '/home/guest', children: ['/home/guest/readme.txt'] },
    '/home/guest/readme.txt': { type: 'file', name: 'readme.txt', path: '/home/guest/readme.txt', content: 'Guest shell. Check /var/logs for rotating captures.' },
    '/var': { type: 'dir', name: 'var', path: '/var', children: ['/var/logs'] },
    '/var/logs': { type: 'dir', name: 'logs', path: '/var/logs', children: ['/var/logs/system.log', '/var/logs/evidence.log'] },
    '/var/logs/system.log': { type: 'file', name: 'system.log', path: '/var/logs/system.log', content: '[2025-11-10] Relay heartbeat OK.' },
    '/var/logs/evidence.log': { type: 'file', name: 'evidence.log', path: '/var/logs/evidence.log', content: 'Traceroute stack: playerid=*** :: flagged for purge.' },
    '/etc': { type: 'dir', name: 'etc', path: '/etc', children: ['/etc/motd'] },
    '/etc/motd': { type: 'file', name: 'motd', path: '/etc/motd', content: 'Atlas Relay MOTD: unauthorized access prohibited.' }
  }
}

let systemProfiles: SystemProfile[] = [DEFAULT_PROFILE]

const normalizeProfiles = (profiles: SystemProfile[] | undefined) => {
  if (Array.isArray(profiles) && profiles.length) {
    systemProfiles = profiles.map(profile => ({
      ...profile,
      identifiers: {
        ips: profile.identifiers?.ips?.length ? profile.identifiers.ips : [profile.id],
        hostnames: profile.identifiers?.hostnames || []
      },
      metadata: profile.metadata || {},
      filesystem: cloneFilesystem(profile.filesystem)
    }))
  } else {
    systemProfiles = [DEFAULT_PROFILE]
  }
  hostCache.clear()
}

export const setSystemProfiles = (profiles: SystemProfile[] | undefined) => {
  normalizeProfiles(profiles)
}

const definitionToProfile = (definition: SystemDefinition): SystemProfile => ({
  id: definition.id,
  label: definition.label,
  identifiers: {
    ips: definition.network.ips.length
      ? definition.network.ips
      : definition.network.primaryIp
        ? [definition.network.primaryIp]
        : [definition.id],
    hostnames: definition.network.hostnames
  },
  metadata: {
    username: definition.credentials.username,
    startingPath: definition.credentials.startingPath,
    footprint: definition.metadata.footprint,
    openPorts: definition.host?.openPorts || [],
    hostConfig: definition.host
  },
  filesystem: cloneFilesystem((definition.filesystem?.snapshot || {}) as Record<string, RemoteNode>)
})

export const setSystemDefinitions = (definitions: SystemDefinition[] | undefined, ctx?: ResolutionContext) => {
  if (Array.isArray(definitions) && definitions.length) {
    const resolved = resolveSystemsForContext(definitions, ctx || {})
    normalizeProfiles(resolved.map(definition => definitionToProfile(definition)))
    return
  }
  normalizeProfiles(undefined)
}

const hostCache = new Map<string, HostDefinition>()

const profileToHostDefinition = (profile: SystemProfile, ip: string): HostDefinition => ({
  ip,
  label: profile.label,
  online: true,
  openPorts: profile.metadata?.hostConfig?.openPorts?.length
    ? profile.metadata.hostConfig.openPorts
    : profile.metadata?.openPorts?.length
      ? profile.metadata.openPorts
      : ['22/tcp'],
  username: profile.metadata?.username || 'guest',
  startingPath: profile.metadata?.startingPath || '/',
  footprint: profile.metadata?.footprint || '',
  filesystem: cloneFilesystem(profile.filesystem),
  hostConfig: profile.metadata?.hostConfig
})

const findProfileByIp = (ip: string) => systemProfiles.find(profile => profile.identifiers?.ips?.includes(ip))

export const getHostByIp = (ip: string) => {
  if (!ip) return undefined
  if (hostCache.has(ip)) return hostCache.get(ip)
  const profile = findProfileByIp(ip)
  if (!profile) return undefined
  const host = profileToHostDefinition(profile, ip)
  hostCache.set(ip, host)
  return host
}

export const createHostRuntime = (host: HostDefinition): HostRuntime => ({
  definition: host,
  nodes: Object.entries(host.filesystem).reduce<Record<string, RemoteNode>>((acc, [path, node]) => {
    acc[path] = cloneNode(node)
    return acc
  }, {})
})

export const listSystemProfiles = () => systemProfiles.map(profile => ({
  ...profile,
  filesystem: cloneFilesystem(profile.filesystem)
}))

const normalizePath = (input: string): string => {
  if (!input) return '/'
  const parts = input.split('/').filter(Boolean)
  const stack: string[] = []
  parts.forEach(part => {
    if (part === '.') return
    if (part === '..') {
      stack.pop()
    } else {
      stack.push(part)
    }
  })
  return '/' + stack.join('/')
}

export const resolveRemotePath = (cwd: string, target: string): string => {
  if (!target) return cwd
  if (target.startsWith('/')) return normalizePath(target)
  const combined = cwd.endsWith('/') ? `${cwd}${target}` : `${cwd}/${target}`
  return normalizePath(combined)
}

const getNode = (runtime: HostRuntime, path: string) => runtime.nodes[path]

export const listDirectory = (runtime: HostRuntime, path: string): RemoteNode[] | null => {
  const node = getNode(runtime, path)
  if (!node || node.type !== 'dir') return null
  if (!node.children) return []
  return node.children.map(childPath => runtime.nodes[childPath]).filter(Boolean)
}

export const changeDirectory = (runtime: HostRuntime, currentPath: string, target: string): string | null => {
  const nextPath = resolveRemotePath(currentPath, target)
  const node = getNode(runtime, nextPath)
  if (!node || node.type !== 'dir') return null
  return nextPath
}

export const readFile = (runtime: HostRuntime, cwd: string, target: string): { content: string; path: string } | null => {
  const path = resolveRemotePath(cwd, target)
  const node = getNode(runtime, path)
  if (!node || node.type !== 'file' || typeof node.content !== 'string') return null
  return { content: node.content, path }
}

export const removeFile = (runtime: HostRuntime, cwd: string, target: string): { success: boolean; path?: string } => {
  const path = resolveRemotePath(cwd, target)
  const node = getNode(runtime, path)
  if (!node || node.type !== 'file') return { success: false }
  const parentPath = path.split('/').slice(0, -1).join('/') || '/'
  const parent = runtime.nodes[parentPath]
  if (parent && parent.children) {
    parent.children = parent.children.filter(child => child !== path)
  }
  delete runtime.nodes[path]
  return { success: true, path }
}
