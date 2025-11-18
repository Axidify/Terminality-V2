const fs = require('fs')
const path = require('path')

const TAG_FILE = path.join(__dirname, 'data', 'quest-tags.json')
const MAX_TAG_LENGTH = 64

function ensureFile() {
  if (fs.existsSync(TAG_FILE)) return
  fs.mkdirSync(path.dirname(TAG_FILE), { recursive: true })
  fs.writeFileSync(TAG_FILE, JSON.stringify({ version: 1, tags: [] }, null, 2), 'utf8')
}

function readStore() {
  ensureFile()
  try {
    const raw = fs.readFileSync(TAG_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return { version: 1, tags: [] }
    }
    if (!Array.isArray(parsed.tags)) {
      parsed.tags = []
    }
    parsed.tags = parsed.tags
      .map(tag => sanitizeTag(tag))
      .filter(Boolean)
    return { version: parsed.version || 1, tags: parsed.tags }
  } catch (err) {
    console.warn('[quest-tags] Failed to read tag store; resetting file.', err)
    const fallback = { version: 1, tags: [] }
    fs.writeFileSync(TAG_FILE, JSON.stringify(fallback, null, 2), 'utf8')
    return fallback
  }
}

function writeStore(store) {
  const tags = Array.isArray(store.tags) ? store.tags.slice().sort((a, b) => a.localeCompare(b)) : []
  const payload = { version: store.version || 1, tags }
  fs.writeFileSync(TAG_FILE, JSON.stringify(payload, null, 2), 'utf8')
  return payload
}

function sanitizeTag(value) {
  if (typeof value !== 'string') return null
  const collapsed = value.replace(/\s+/g, ' ').trim()
  if (!collapsed) return null
  return collapsed.slice(0, MAX_TAG_LENGTH)
}

function listTags() {
  const store = readStore()
  return store.tags.slice().sort((a, b) => a.localeCompare(b))
}

function addTag(tag) {
  const normalized = sanitizeTag(tag)
  if (!normalized) {
    return { errors: ['Tag is required.'] }
  }
  const key = normalized.toLowerCase()
  const store = readStore()
  const exists = store.tags.find(entry => entry.toLowerCase() === key)
  if (exists) {
    return { tag: exists, tags: store.tags.slice().sort((a, b) => a.localeCompare(b)), created: false }
  }
  store.tags.push(normalized)
  const next = writeStore(store)
  return { tag: normalized, tags: next.tags.slice(), created: true }
}

function seedTags(tags) {
  if (!Array.isArray(tags) || !tags.length) return listTags()
  const store = readStore()
  let changed = false
  tags.forEach(tag => {
    const normalized = sanitizeTag(tag)
    if (!normalized) return
    const key = normalized.toLowerCase()
    if (store.tags.find(entry => entry.toLowerCase() === key)) return
    store.tags.push(normalized)
    changed = true
  })
  if (changed) {
    writeStore(store)
    return listTags()
  }
  return store.tags.slice().sort((a, b) => a.localeCompare(b))
}

module.exports = {
  listTags,
  addTag,
  seedTags
}
