import { cloneFilesystemMap, createEmptyFilesystemMap } from '../programs/filesystemUtils'

import type {
  ResolutionContext,
  ResolvedSystemInstance,
  SystemDefinition,
  SystemResolutionInput
} from './types'
import type { FilesystemMap } from '../programs/filesystemUtils'

const SCOPE_PRIORITY: Record<SystemDefinition['scope'], number> = {
  global: 0,
  quest_template: 1,
  quest_instance: 2
}

const mergeFilesystem = (base: FilesystemMap, override?: FilesystemMap | null): FilesystemMap => {
  if (!override || Object.keys(override).length === 0) {
    return cloneFilesystemMap(base)
  }
  const snapshot = cloneFilesystemMap(base)
  Object.entries(override).forEach(([path, node]) => {
    snapshot[path] = {
      ...node,
      children: node.children ? [...node.children] : undefined,
      content: node.content
    }
  })
  return snapshot
}

const getFilesystemSnapshot = (input: SystemResolutionInput['definition']): FilesystemMap => {
  return input.filesystem?.snapshot ? cloneFilesystemMap(input.filesystem.snapshot) : createEmptyFilesystemMap()
}

export const resolveSystemInstance = ({ definition, override }: SystemResolutionInput): ResolvedSystemInstance => ({
  definition,
  filesystem: mergeFilesystem(getFilesystemSnapshot(definition), override || undefined),
  source: override && Object.keys(override).length > 0 ? 'override' : 'definition'
})

const matchesContext = (definition: SystemDefinition, ctx: ResolutionContext): boolean => {
  if (!definition.appliesTo) {
    return definition.scope === 'global'
  }
  return Object.entries(definition.appliesTo).every(([key, value]) => {
    if (!value) return true
    return ctx[key] === value
  })
}

const mergeFilesystemConfig = (
  base?: SystemDefinition['filesystem'],
  override?: SystemDefinition['filesystem']
): SystemDefinition['filesystem'] | undefined => {
  if (!base && !override) return undefined
  if (!base) {
    return override ? { ...override, snapshot: cloneFilesystemMap(override.snapshot || createEmptyFilesystemMap()) } : undefined
  }
  const snapshot = mergeFilesystem(base.snapshot || createEmptyFilesystemMap(), override?.snapshot || undefined)
  return {
    ...base,
    ...override,
    rootPath: override?.rootPath || base.rootPath,
    templateKey: override?.templateKey || base.templateKey,
    readOnly: override?.readOnly ?? base.readOnly,
    snapshot
  }
}

const mergeSystemDefinitions = (base: SystemDefinition, override: SystemDefinition): SystemDefinition => {
  const mergedFilesystem = mergeFilesystemConfig(base.filesystem, override.filesystem)
  return {
    ...base,
    ...override,
    scope: base.scope,
    kind: base.kind,
    network: {
      primaryIp: override.network?.primaryIp || base.network?.primaryIp,
      ips: override.network?.ips?.length ? override.network.ips : base.network.ips,
      hostnames: override.network?.hostnames?.length ? override.network.hostnames : base.network.hostnames
    },
    credentials: {
      username: override.credentials?.username || base.credentials.username,
      startingPath: override.credentials?.startingPath || base.credentials.startingPath,
      password: override.credentials?.password || base.credentials.password
    },
    metadata: {
      ...base.metadata,
      ...override.metadata
    },
    filesystem: mergedFilesystem,
    tools: override.tools ?? base.tools,
    host: override.host ?? base.host,
    appliesTo: override.appliesTo || base.appliesTo
  }
}

const sortOverrides = (entries: SystemDefinition[]) => (
  [...entries].sort((a, b) => SCOPE_PRIORITY[a.scope] - SCOPE_PRIORITY[b.scope])
)

export const resolveSystemsForContext = (
  systems: SystemDefinition[] = [],
  ctx: ResolutionContext = {}
): SystemDefinition[] => {
  if (!systems.length) return []

  const bases = systems.filter(def => def.scope === 'global')
  const scopedMatches = systems.filter(def => def.scope !== 'global' && matchesContext(def, ctx))

  const overridesByBase = new Map<string, SystemDefinition[]>()
  const standalone: SystemDefinition[] = []

  scopedMatches.forEach(def => {
    if (def.extendsSystemId) {
      const list = overridesByBase.get(def.extendsSystemId) || []
      list.push(def)
      overridesByBase.set(def.extendsSystemId, list)
    } else {
      standalone.push(def)
    }
  })

  const resolved: SystemDefinition[] = bases.map(base => {
    const overrides = overridesByBase.get(base.id)
    if (!overrides?.length) {
      return base
    }
    return sortOverrides(overrides).reduce<SystemDefinition>((acc, override) => (
      mergeSystemDefinitions(acc, override)
    ), base)
  })

  return resolved.concat(standalone)
}
