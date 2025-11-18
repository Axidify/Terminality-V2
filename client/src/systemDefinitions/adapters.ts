import { cloneFilesystemMap, createEmptyFilesystemMap, normalizeFilesystemMap } from '../programs/filesystemUtils'

import type {
  LegacySystemDefinitionKind,
  ResolutionContext,
  SystemDefinition,
  SystemScope,
  TerminalHostConfig,
  ToolBindingConfig
} from './types'
import type { SystemProfileDTO } from '../services/systemProfiles'

const sanitizeArray = (entries: unknown): string[] => {
  if (!Array.isArray(entries)) return []
  return entries.map(item => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
}

const sanitizeFilesystem = (filesystem: SystemProfileDTO['filesystem']) => {
  if (!filesystem || typeof filesystem !== 'object') {
    return createEmptyFilesystemMap()
  }
  return normalizeFilesystemMap(filesystem)
}

const sanitizeHostConfig = (input: unknown): TerminalHostConfig | undefined => {
  if (!input || typeof input !== 'object') return undefined
  const source = input as Partial<TerminalHostConfig>
  const hostId = typeof source.hostId === 'string' ? source.hostId.trim() : ''
  if (!hostId) return undefined
  const hostConfig: TerminalHostConfig = { hostId }
  if (typeof source.address === 'string' && source.address.trim()) hostConfig.address = source.address.trim()
  if (typeof source.port === 'number' && Number.isFinite(source.port)) hostConfig.port = source.port
  if (typeof source.protocol === 'string' && ['ssh', 'ws', 'local'].includes(source.protocol)) {
    hostConfig.protocol = source.protocol as TerminalHostConfig['protocol']
  }
  if (Array.isArray(source.openPorts)) {
    const ports = source.openPorts.map(port => (typeof port === 'string' ? port.trim() : '')).filter(Boolean)
    if (ports.length) hostConfig.openPorts = ports
  }
  if (source.flags && typeof source.flags === 'object') {
    const flags = Object.entries(source.flags).reduce<Record<string, boolean>>((acc, [key, value]) => {
      if (typeof key === 'string') acc[key] = Boolean(value)
      return acc
    }, {})
    if (Object.keys(flags).length) hostConfig.flags = flags
  }
  return hostConfig
}

const sanitizeToolBindings = (input: unknown): ToolBindingConfig | undefined => {
  if (!input || typeof input !== 'object') return undefined
  const source = input as Partial<ToolBindingConfig>
  if (!Array.isArray(source.tools) || !source.tools.length) return undefined
  const tools = source.tools
    .map(tool => {
      const id = typeof tool?.id === 'string' ? tool.id.trim() : ''
      const name = typeof tool?.name === 'string' ? tool.name.trim() : ''
      const command = typeof tool?.command === 'string' ? tool.command.trim() : ''
      if (!id || !name || !command) return null
      const entry: ToolBindingConfig['tools'][number] = { id, name, command }
      if (typeof tool?.description === 'string' && tool.description.trim()) entry.description = tool.description.trim()
      if (tool?.inputSchema && typeof tool.inputSchema === 'object') entry.inputSchema = tool.inputSchema
      if (tool?.options && typeof tool.options === 'object') entry.options = tool.options
      return entry
    })
    .filter((tool): tool is ToolBindingConfig['tools'][number] => tool !== null)
  if (!tools.length) return undefined
  return { tools }
}

const sanitizeScopeBindings = (input: unknown): ResolutionContext | undefined => {
  if (!input || typeof input !== 'object') return undefined
  const normalized = Object.entries(input as Record<string, unknown>).reduce<ResolutionContext>((acc, [key, value]) => {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) acc[key] = trimmed
    }
    return acc
  }, {})
  return Object.keys(normalized).length ? normalized : undefined
}

const kindToScope = (kind: LegacySystemDefinitionKind = 'profile'): SystemScope => {
  if (kind === 'template') return 'quest_template'
  return 'global'
}

const scopeToKind = (scope: SystemScope = 'global'): LegacySystemDefinitionKind => {
  if (scope === 'quest_template') return 'template'
  return 'profile'
}

export const profileDtoToDefinition = (
  profile: SystemProfileDTO,
  kind: LegacySystemDefinitionKind = 'profile'
): SystemDefinition => {
  const ips = sanitizeArray(profile.identifiers?.ips)
  const hostnames = sanitizeArray(profile.identifiers?.hostnames)
  const username = profile.metadata?.username?.trim() || 'guest'
  const startingPath = profile.metadata?.startingPath?.trim() || '/'
  const description = profile.description?.trim() || profile.label
  const footprint = profile.metadata?.footprint?.trim() || ''
  const filesystemSnapshot = cloneFilesystemMap(sanitizeFilesystem(profile.filesystem))
  const hostConfig = sanitizeHostConfig(profile.metadata?.hostConfig)
  const toolBindings = sanitizeToolBindings(profile.metadata?.toolBindings)
  const appliesTo = sanitizeScopeBindings(profile.metadata?.scopeBindings)

  return {
    id: profile.id,
    key: profile.id,
    name: profile.label,
    label: profile.label,
    description,
    type: 'filesystem',
    scope: kindToScope(kind),
    kind,
    tags: [],
    network: {
      primaryIp: ips[0],
      ips,
      hostnames
    },
    credentials: {
      username,
      startingPath
    },
    metadata: {
      description,
      footprint,
      tags: []
    },
    filesystem: {
      rootPath: startingPath,
      readOnly: false,
      snapshot: filesystemSnapshot
    },
    ...(hostConfig ? { host: hostConfig } : {}),
    ...(toolBindings ? { tools: toolBindings } : {}),
    ...(appliesTo ? { appliesTo } : {})
  }
}

export const profilesToDefinitions = (
  profiles: SystemProfileDTO[] = [],
  kind: LegacySystemDefinitionKind
): SystemDefinition[] => profiles.map(profile => profileDtoToDefinition(profile, kind))

export const definitionToProfileDto = (definition: SystemDefinition): SystemProfileDTO => ({
  id: definition.id,
  label: definition.label || definition.name || definition.key,
  description: definition.metadata?.description || definition.description || definition.name,
  identifiers: {
    ips: definition.network?.ips || [],
    hostnames: definition.network?.hostnames || []
  },
  metadata: {
    username: definition.credentials?.username || 'guest',
    startingPath: definition.filesystem?.rootPath || definition.credentials?.startingPath || '/',
    footprint: definition.metadata?.footprint,
    ...(definition.host ? { hostConfig: definition.host } : {}),
    ...(definition.tools ? { toolBindings: definition.tools } : {}),
    ...(definition.appliesTo ? { scopeBindings: definition.appliesTo } : {})
  },
  filesystem: cloneFilesystemMap(definition.filesystem?.snapshot || createEmptyFilesystemMap())
})

export const mapScopeToKind = scopeToKind
