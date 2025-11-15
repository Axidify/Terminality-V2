const fs = require('fs')
const path = require('path')

const STORE_FILE = path.join(__dirname, 'data', 'system-profiles.json')

const NODE_TYPES = new Set(['dir', 'file'])

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function ensureStoreFile() {
  if (fs.existsSync(STORE_FILE)) return
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true })
  const bootstrap = {
    version: 1,
    profiles: [createDefaultProfile()],
    templates: [createDefaultTemplate()],
    lastUpdated: new Date().toISOString()
  }
  fs.writeFileSync(STORE_FILE, JSON.stringify(bootstrap, null, 2), 'utf8')
}

function readStore() {
  ensureStoreFile()
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    parsed.version = parsed.version || 1
    parsed.profiles = Array.isArray(parsed.profiles) ? parsed.profiles : []
    parsed.templates = Array.isArray(parsed.templates) ? parsed.templates : []
    parsed.lastUpdated = parsed.lastUpdated || new Date().toISOString()
    return parsed
  } catch (err) {
    console.warn('[system-profiles] failed to read store, resetting', err)
    const fallback = {
      version: 1,
      profiles: [createDefaultProfile()],
      templates: [createDefaultTemplate()],
      lastUpdated: new Date().toISOString()
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(fallback, null, 2), 'utf8')
    return fallback
  }
}

function writeStore(store) {
  const payload = {
    version: store.version || 1,
    profiles: Array.isArray(store.profiles) ? store.profiles : [],
    templates: Array.isArray(store.templates) ? store.templates : [],
    lastUpdated: new Date().toISOString()
  }
  fs.writeFileSync(STORE_FILE, JSON.stringify(payload, null, 2), 'utf8')
  return payload
}

function createDefaultProfile() {
  return {
    id: 'atlas_relay',
    label: 'Atlas Relay',
    identifiers: { ips: ['10.23.4.8'], hostnames: [] },
    metadata: { username: 'guest', startingPath: '/home/guest', footprint: 'Legacy relay maintained by an unknown broker.' },
    filesystem: buildFilesystem([
      dir('/', ['home', 'var', 'etc']),
      dir('/home', ['guest']),
      dir('/home/guest', ['readme.txt']),
      file('/home/guest/readme.txt', 'Guest shell. Check /var/logs for rotating captures.'),
      dir('/var', ['logs']),
      dir('/var/logs', ['system.log', 'evidence.log']),
      file('/var/logs/system.log', '[2025-11-10] Relay heartbeat OK.'),
      file('/var/logs/evidence.log', 'Traceroute stack: playerid=*** :: flagged for purge.'),
      dir('/etc', ['motd']),
      file('/etc/motd', 'Atlas Relay MOTD: unauthorized access prohibited.')
    ])
  }
}

function createDefaultTemplate() {
  return {
    id: 'log_server_with_evidence',
    label: 'Log Server (Evidence)',
    description: 'Contains /var/logs with evidence.log file.',
    filesystem: createDefaultProfile().filesystem
  }
}

function dir(pathValue, childrenNames) {
  return { path: pathValue, type: 'dir', name: nameFromPath(pathValue), children: childrenNames.map(child => normalizeJoin(pathValue, child)) }
}

function file(pathValue, content) {
  return { path: pathValue, type: 'file', name: nameFromPath(pathValue), content }
}

function buildFilesystem(nodes) {
  return nodes.reduce((acc, node) => {
    acc[node.path] = node.type === 'dir'
      ? { type: 'dir', name: node.name, path: node.path, children: node.children }
      : { type: 'file', name: node.name, path: node.path, content: node.content }
    return acc
  }, {})
}

function nameFromPath(pathValue) {
  if (pathValue === '/') return ''
  const parts = pathValue.split('/').filter(Boolean)
  return parts[parts.length - 1] || ''
}

function normalizeJoin(parent, name) {
  if (!parent || parent === '/') return `/${name}`
  return `${parent.replace(/\/$/, '')}/${name}`
}

function normalizeIdentifiers(input = {}) {
  const ips = Array.isArray(input.ips) ? input.ips.filter(Boolean) : []
  const hostnames = Array.isArray(input.hostnames) ? input.hostnames.filter(Boolean) : []
  if (!ips.length && !hostnames.length) ips.push('0.0.0.0')
  return { ips, hostnames }
}

function normalizeMetadata(input = {}) {
  return {
    username: typeof input.username === 'string' && input.username.trim() ? input.username.trim() : 'guest',
    startingPath: typeof input.startingPath === 'string' && input.startingPath.trim() ? cleanPath(input.startingPath) : '/',
    footprint: typeof input.footprint === 'string' ? input.footprint.trim() : ''
  }
}

function cleanPath(value) {
  if (!value) return '/'
  if (value === '/') return '/'
  return '/' + value.split('/').filter(Boolean).join('/')
}

function normalizeFilesystem(input) {
  if (!input || typeof input !== 'object') {
    return { filesystem: buildFilesystem([dir('/', [] )]), errors: ['filesystem is required'] }
  }
  const entries = Object.entries(input)
  const normalized = {}
  const errors = []
  if (!entries.length) {
    errors.push('filesystem must contain at least root directory')
  }
  entries.forEach(([pathKey, node]) => {
    const pathValue = cleanPath(pathKey)
    const type = typeof node?.type === 'string' ? node.type.trim().toLowerCase() : ''
    if (!NODE_TYPES.has(type)) {
      errors.push(`Invalid node type for ${pathValue}`)
      return
    }
    if (type === 'dir') {
      const children = Array.isArray(node.children) ? node.children.map(child => cleanPath(child)) : []
      normalized[pathValue] = { type: 'dir', name: nameFromPath(pathValue), path: pathValue, children }
    } else {
      normalized[pathValue] = { type: 'file', name: nameFromPath(pathValue), path: pathValue, content: typeof node.content === 'string' ? node.content : '' }
    }
  })
  if (!normalized['/']) {
    errors.push('filesystem missing root directory')
  }
  return { filesystem: normalized, errors }
}

function normalizeProfilePayload(payload, { allowIdReuse = false } = {}) {
  const errors = []
  const id = typeof payload?.id === 'string' ? payload.id.trim() : ''
  if (!id) errors.push('id is required')
  const label = typeof payload?.label === 'string' ? payload.label.trim() : ''
  if (!label) errors.push('label is required')
  const identifiers = normalizeIdentifiers(payload?.identifiers)
  const metadata = normalizeMetadata(payload?.metadata)
  const { filesystem, errors: fsErrors } = normalizeFilesystem(payload?.filesystem)
  if (fsErrors.length) errors.push(...fsErrors)
  return { profile: { id, label, identifiers, metadata, filesystem }, errors }
}

function listProfiles() {
  const store = readStore()
  return clone(store.profiles)
}

function listTemplates() {
  const store = readStore()
  return clone(store.templates)
}

function listAll() {
  const store = readStore()
  return clone({ profiles: store.profiles, templates: store.templates, lastUpdated: store.lastUpdated })
}

function getProfileById(id) {
  if (!id) return null
  const store = readStore()
  return store.profiles.find(profile => profile.id === id) || null
}

function getTemplateById(id) {
  if (!id) return null
  const store = readStore()
  return store.templates.find(tpl => tpl.id === id) || null
}

function getProfileByIp(ip) {
  if (!ip) return null
  const store = readStore()
  return store.profiles.find(profile => profile.identifiers?.ips?.includes(ip)) || null
}

function createProfile(payload, { template = false } = {}) {
  const store = readStore()
  const { profile, errors } = normalizeProfilePayload(payload)
  if (errors.length) return { errors }
  const collection = template ? store.templates : store.profiles
  if (collection.some(entry => entry.id === profile.id)) {
    return { errors: ['id already exists'] }
  }
  collection.push(profile)
  const next = writeStore(store)
  return { profile: clone(profile), store: next }
}

function updateProfile(id, payload, { template = false } = {}) {
  const store = readStore()
  const collection = template ? store.templates : store.profiles
  const idx = collection.findIndex(entry => entry.id === id)
  if (idx === -1) return { errors: ['Profile not found.'] }
  const others = collection.filter(entry => entry.id !== id)
  const { profile, errors } = normalizeProfilePayload(payload, { allowIdReuse: true })
  if (errors.length) return { errors }
  if (!template && others.some(entry => entry.id === profile.id)) {
    return { errors: ['Another profile already uses that id.'] }
  }
  collection[idx] = profile
  const next = writeStore(store)
  return { profile: clone(profile), store: next }
}

function deleteProfile(id, { template = false } = {}) {
  const store = readStore()
  const collection = template ? store.templates : store.profiles
  const idx = collection.findIndex(entry => entry.id === id)
  if (idx === -1) return { errors: ['Profile not found.'] }
  const [removed] = collection.splice(idx, 1)
  const next = writeStore(store)
  return { profile: clone(removed), store: next }
}

module.exports = {
  listProfiles,
  listTemplates,
  listAll,
  getProfileById,
  getProfileByIp,
  getTemplateById,
  createProfile,
  updateProfile,
  deleteProfile
}
