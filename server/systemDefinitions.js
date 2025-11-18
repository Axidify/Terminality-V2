function cloneFilesystem(fsMap) {
  if (!fsMap || typeof fsMap !== 'object') return {}
  return Object.entries(fsMap).reduce((acc, [path, node]) => {
    acc[path] = {
      ...node,
      children: Array.isArray(node.children) ? [...node.children] : undefined,
      content: typeof node.content === 'string' ? node.content : undefined
    }
    return acc
  }, {})
}

function sanitizeArray(entries) {
  if (!Array.isArray(entries)) return []
  return entries.map(value => (typeof value === 'string' ? value.trim() : '')).filter(Boolean)
}

function sanitizeHostConfig(input) {
  if (!input || typeof input !== 'object') return undefined
  const hostId = typeof input.hostId === 'string' ? input.hostId.trim() : ''
  if (!hostId) return undefined
  const host = { hostId }
  if (typeof input.address === 'string' && input.address.trim()) host.address = input.address.trim()
  if (typeof input.port === 'number' && Number.isFinite(input.port)) host.port = input.port
  if (typeof input.protocol === 'string' && ['ssh', 'ws', 'local'].includes(input.protocol)) host.protocol = input.protocol
  if (Array.isArray(input.openPorts)) {
    const ports = input.openPorts.map(port => (typeof port === 'string' ? port.trim() : '')).filter(Boolean)
    if (ports.length) host.openPorts = ports
  }
  if (input.flags && typeof input.flags === 'object') {
    const flags = Object.entries(input.flags).reduce((acc, [key, value]) => {
      if (typeof key === 'string') acc[key] = !!value
      return acc
    }, {})
    if (Object.keys(flags).length) host.flags = flags
  }
  return host
}

function sanitizeToolBindings(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.tools)) return undefined
  const tools = input.tools.map(tool => {
    const id = typeof tool?.id === 'string' ? tool.id.trim() : ''
    const name = typeof tool?.name === 'string' ? tool.name.trim() : ''
    const command = typeof tool?.command === 'string' ? tool.command.trim() : ''
    if (!id || !name || !command) return null
    const entry = { id, name, command }
    if (typeof tool?.description === 'string' && tool.description.trim()) entry.description = tool.description.trim()
    if (tool?.inputSchema && typeof tool.inputSchema === 'object') entry.inputSchema = tool.inputSchema
    if (tool?.options && typeof tool.options === 'object') entry.options = tool.options
    return entry
  }).filter(Boolean)
  if (!tools.length) return undefined
  return { tools }
}

function sanitizeScopeBindings(input) {
  if (!input || typeof input !== 'object') return undefined
  const normalized = Object.entries(input).reduce((acc, [key, value]) => {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) acc[key] = trimmed
    }
    return acc
  }, {})
  return Object.keys(normalized).length ? normalized : undefined
}

function kindToScope(kind = 'profile') {
  if (kind === 'template') return 'quest_template'
  return 'global'
}

function profileToDefinition(profile, kind = 'profile') {
  if (!profile) return null
  const ips = sanitizeArray(profile.identifiers?.ips)
  const hostnames = sanitizeArray(profile.identifiers?.hostnames)
  const username = typeof profile.metadata?.username === 'string' && profile.metadata.username.trim()
    ? profile.metadata.username.trim()
    : 'guest'
  const startingPath = typeof profile.metadata?.startingPath === 'string' && profile.metadata.startingPath.trim()
    ? profile.metadata.startingPath.trim()
    : '/'
  const description = profile.description || profile.label
  const hostConfig = sanitizeHostConfig(profile.metadata?.hostConfig)
  const toolBindings = sanitizeToolBindings(profile.metadata?.toolBindings)
  const scopeBindings = sanitizeScopeBindings(profile.metadata?.scopeBindings)

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
      footprint: profile.metadata?.footprint || '',
      tags: []
    },
    filesystem: {
      rootPath: startingPath,
      readOnly: false,
      snapshot: cloneFilesystem(profile.filesystem || {})
    },
    ...(hostConfig ? { host: hostConfig } : {}),
    ...(toolBindings ? { tools: toolBindings } : {}),
    ...(scopeBindings ? { appliesTo: scopeBindings } : {})
  }
}

function profilesToDefinitions(list, kind) {
  if (!Array.isArray(list)) return []
  return list.map(profile => profileToDefinition(profile, kind)).filter(Boolean)
}

function attachDefinitionEnvelope(payload) {
  return {
    ...payload,
    systemDefinitions: profilesToDefinitions(payload.profiles, 'profile'),
    systemDefinitionTemplates: profilesToDefinitions(payload.templates, 'template')
  }
}

module.exports = {
  profileToDefinition,
  profilesToDefinitions,
  attachDefinitionEnvelope
}
