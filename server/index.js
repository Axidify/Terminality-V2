// Load env vars early
try { require('dotenv').config() } catch {}
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const fs = require('fs')
const path = require('path')
const bodyParser = require('body-parser')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { OAuth2Client } = require('google-auth-library')
const cookieParser = require('cookie-parser')
const rateLimit = require('express-rate-limit')

const DEFAULT_STATE_PATH = path.join(__dirname, 'state.json')
// Use Prisma for persistence when available
let prisma = null
try {
  const { PrismaClient } = require('@prisma/client')
  prisma = new PrismaClient()
} catch (e) {
  // Prisma client might not be generated yet; fall back to file-based persistence
  prisma = null
}
const DEFAULT_PORT = parseInt(process.env.PORT || '3000', 10)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || null
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || null
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || null
const CLIENT_FRONTEND_URL = process.env.CLIENT_FRONTEND_URL || process.env.VITE_CLIENT_URL || 'http://localhost:5173'
const SERVER_HOST = process.env.HOST || '0.0.0.0'
const SERVER_PUBLIC_URL = process.env.SERVER_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || null
// Client to verify ID tokens (no secret required)
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null
// Full OAuth2 client (authorization code exchange)
const googleOauthClient = (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI)
  ? new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)
  : null

// In-memory presence tracking (dev only)
// Track presence per room: room -> Map(userId -> lastSeenMs)
const presenceByRoom = new Map()
const PRESENCE_TTL_MS = 8000
function getPresenceMap(room) {
  const r = String(room || 'general')
  if (!presenceByRoom.has(r)) presenceByRoom.set(r, new Map())
  return presenceByRoom.get(r)
}

let savedState = null

const DEFAULT_ABOUT_CONTENT = {
  heroTitle: 'Terminality OS',
  heroTagline: 'A Retro-Futuristic Operating System Simulation',
  introParagraph: 'Terminality is an immersive single-player mystery game that blends puzzle solving, deep online investigations, and narrative exploration within a retro terminal-based operating system simulation. Uncover secrets, solve cryptic puzzles, and navigate through a mysterious digital world shrouded in intrigue.',
  whatsNewHeading: "What's new in this release",
  whatsNewBody: 'Online Chat received a major update — notifications now carry actionable intents so clicking a chat notification opens and focuses the Online Chat window and jumps directly to the target room or DM. The chat UI was streamlined for faster messaging, and DMs plus presence indicators have been added. See the changelog for full details.',
  outroParagraph: 'Experience a fully-functional desktop environment with authentic window management, file systems, applications, and network simulations—all running in your browser.'
}

const CHANGELOG_SECTION_KEYS = ['added', 'changed', 'fixed', 'breaking']
const MAX_SECTION_ITEMS = 40
const DEFAULT_CHANGELOG = { entries: [] }

function sanitizeChangelogText(value, maxLen = 1200) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/\u0000/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen)
}

function sanitizeVersionString(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!/^\d+\.\d+\.\d+$/.test(normalized)) return null
  return normalized
}

function sanitizeDateString(value) {
  if (typeof value !== 'string') return new Date().toISOString().slice(0, 10)
  const normalized = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return new Date().toISOString().slice(0, 10)
  return normalized
}

function normalizeSectionList(sectionArray) {
  if (!Array.isArray(sectionArray)) return []
  const cleaned = []
  for (const raw of sectionArray) {
    const text = sanitizeChangelogText(raw || '', 800)
    if (text) cleaned.push(text)
    if (cleaned.length >= MAX_SECTION_ITEMS) break
  }
  return cleaned
}

function normalizeLinks(rawLinks) {
  if (!Array.isArray(rawLinks)) return []
  const cleaned = []
  for (const raw of rawLinks) {
    if (!raw || typeof raw !== 'object') continue
    const label = sanitizeChangelogText(raw.label || '', 80)
    const url = typeof raw.url === 'string' ? raw.url.trim() : ''
    if (!label || !/^https?:\/\//i.test(url)) continue
    cleaned.push({ label, url })
    if (cleaned.length >= 5) break
  }
  return cleaned
}

function normalizeChangelogEntry(rawEntry) {
  if (!rawEntry || typeof rawEntry !== 'object') return null
  const version = sanitizeVersionString(rawEntry.version)
  if (!version) return null
  const date = sanitizeDateString(rawEntry.date)
  const summary = sanitizeChangelogText(rawEntry.summary || '', 800)
  const highlight = sanitizeChangelogText(rawEntry.highlight || '', 1600)
  const spotlight = sanitizeChangelogText(rawEntry.spotlight || '', 1600)
  const tags = Array.isArray(rawEntry.tags) ? rawEntry.tags.map(tag => sanitizeChangelogText(tag || '', 48)).filter(Boolean).slice(0, 6) : []
  const sections = {}
  for (const key of CHANGELOG_SECTION_KEYS) {
    sections[key] = normalizeSectionList(rawEntry.sections && rawEntry.sections[key])
  }
  const links = normalizeLinks(rawEntry.links)
  return {
    version,
    date,
    summary,
    highlight,
    spotlight,
    sections,
    tags,
    links
  }
}

function compareVersions(a, b) {
  const split = (val) => val.split('.').map(num => parseInt(num, 10) || 0)
  const [aMajor, aMinor, aPatch] = split(a)
  const [bMajor, bMinor, bPatch] = split(b)
  if (aMajor !== bMajor) return aMajor - bMajor
  if (aMinor !== bMinor) return aMinor - bMinor
  return aPatch - bPatch
}

function normalizeChangelog(changelog) {
  const entriesInput = changelog && Array.isArray(changelog.entries) ? changelog.entries : []
  const seen = new Map()
  for (const rawEntry of entriesInput) {
    const entry = normalizeChangelogEntry(rawEntry)
    if (!entry) continue
    if (!seen.has(entry.version)) {
      seen.set(entry.version, entry)
    }
  }
  const entries = Array.from(seen.values()).sort((a, b) => {
    const versionDiff = compareVersions(b.version, a.version)
    if (versionDiff !== 0) return versionDiff
    return b.date.localeCompare(a.date)
  })
  return { entries }
}

function ensureChangelogState() {
  if (!savedState.changelog) {
    savedState.changelog = { entries: [] }
  }
  savedState.changelog = normalizeChangelog(savedState.changelog)
}

function getChangelogState() {
  ensureStateShape()
  ensureChangelogState()
  return savedState.changelog
}

function upsertChangelogEntry(rawEntry, originalVersion) {
  const normalized = normalizeChangelogEntry(rawEntry)
  if (!normalized) return { error: 'Invalid entry' }
  const changelog = getChangelogState()
  const entries = [...changelog.entries]
  const targetVersion = originalVersion || normalized.version
  const existingIndex = entries.findIndex(entry => entry.version === targetVersion)
  if (originalVersion && existingIndex === -1) {
    return { error: 'Not found' }
  }
  if (!originalVersion && entries.find(entry => entry.version === normalized.version)) {
    return { error: 'Duplicate version' }
  }
  if (originalVersion && normalized.version !== originalVersion) {
    const versionTaken = entries.some((entry, idx) => entry.version === normalized.version && idx !== existingIndex)
    if (versionTaken) return { error: 'Duplicate version' }
  }
  if (existingIndex >= 0) {
    entries.splice(existingIndex, 1, normalized)
  } else {
    entries.unshift(normalized)
  }
  savedState.changelog = normalizeChangelog({ entries })
  return { entry: normalized, changelog: savedState.changelog }
}

function deleteChangelogEntry(version) {
  const changelog = getChangelogState()
  const entries = changelog.entries.filter(entry => entry.version !== version)
  if (entries.length === changelog.entries.length) return false
  savedState.changelog = normalizeChangelog({ entries })
  return true
}

function buildChangelogResponse() {
  const { entries } = getChangelogState()
  return { entries, latest: entries[0] || null }
}

async function readState() {
  if (prisma) {
    try {
      const row = await prisma.state.findUnique({ where: { id: 1 } })
      if (row) return JSON.parse(row.data)
      // create default
      const defaultState = { version: 1, desktop: {}, story: {} }
      await prisma.state.create({ data: { id: 1, data: JSON.stringify(defaultState) } })
      return defaultState
    } catch (e) {
      console.warn('[prisma] read error, falling back to file:', e)
      // fall through to file
    }
  }
  try {
    const raw = fs.readFileSync(DEFAULT_STATE_PATH, 'utf8')
    return JSON.parse(raw)
  } catch (e) {
    return { version: 1, desktop: {}, story: {} }
  }
}

function sanitizeUsername(s) {
  if (!s) return null
  // Normalize: lowercase, replace non alpha-numeric with underscore, trim
  return String(s).normalize('NFKD').replace(/[\s]+/g, '_').replace(/[^a-zA-Z0-9_\-\.]/g, '').toLowerCase().slice(0, 30)
}

async function writeState(s) {
  if (prisma) {
    try {
      const existing = await prisma.state.findUnique({ where: { id: 1 } })
      if (existing) {
        await prisma.state.update({ where: { id: 1 }, data: { data: JSON.stringify(s) } })
        return
      }
      await prisma.state.create({ data: { id: 1, data: JSON.stringify(s) } })
      return
    } catch (e) {
      console.warn('[prisma] write error, falling back to file:', e)
      // fall through to file
    }
  }
  fs.writeFileSync(DEFAULT_STATE_PATH, JSON.stringify(s, null, 2), 'utf8')
}

;(async () => {
  savedState = await readState()
  ensureStateShape()
  savedState.aboutContent = normalizeAboutContent(savedState.aboutContent || DEFAULT_ABOUT_CONTENT)
})()

function ensureStateShape() {
  if (!savedState) savedState = { version: 1, desktop: {}, story: {} }
  if (!savedState.desktop) savedState.desktop = {}
  if (!savedState.story) savedState.story = {}
  if (!savedState.changelog) savedState.changelog = { entries: [] }
  savedState.changelog = normalizeChangelog(savedState.changelog)
}

function sanitizeAboutField(value, fallback, maxLen = 1200) {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  return trimmed.slice(0, maxLen)
}

function normalizeAboutContent(input) {
  ensureStateShape()
  const current = savedState.aboutContent ? savedState.aboutContent : DEFAULT_ABOUT_CONTENT
  const data = { ...current, ...(input && typeof input === 'object' ? input : {}) }
  return {
    heroTitle: sanitizeAboutField(data.heroTitle, current.heroTitle, 150),
    heroTagline: sanitizeAboutField(data.heroTagline, current.heroTagline, 220),
    introParagraph: sanitizeAboutField(data.introParagraph, current.introParagraph, 2000),
    whatsNewHeading: sanitizeAboutField(data.whatsNewHeading, current.whatsNewHeading, 200),
    whatsNewBody: sanitizeAboutField(data.whatsNewBody, current.whatsNewBody, 3000),
    outroParagraph: sanitizeAboutField(data.outroParagraph, current.outroParagraph, 2000)
  }
}

function getAboutContent() {
  ensureStateShape()
  const normalized = normalizeAboutContent(savedState.aboutContent || DEFAULT_ABOUT_CONTENT)
  savedState.aboutContent = normalized
  return normalized
}

function setAboutContent(next) {
  ensureStateShape()
  const normalized = normalizeAboutContent(next)
  savedState.aboutContent = normalized
  return normalized
}

const app = express()
// Security headers
app.use(helmet({ contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false, crossOriginEmbedderPolicy: false }))
// Cookies for refresh tokens
app.use(cookieParser())
// CORS (lock to frontend in prod)
const allowedOrigin = process.env.NODE_ENV === 'production' ? (CLIENT_FRONTEND_URL) : true
app.use(cors({ origin: allowedOrigin, credentials: true }))
app.options('*', cors({ origin: allowedOrigin, credentials: true }))
// Parse JSON and URL-encoded bodies so the API accepts both JSON and x-www-form-urlencoded payloads
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// Rate limiting (prod by default; can be disabled via ENABLE_RATE_LIMIT=false)
const makeLimiter = (opts) => {
  const enable = process.env.NODE_ENV === 'production' ? (process.env.ENABLE_RATE_LIMIT !== 'false') : (process.env.ENABLE_RATE_LIMIT === 'true')
  if (!enable) return (req, _res, next) => next()
  return rateLimit({ standardHeaders: true, legacyHeaders: false, ...opts })
}
const authLimiter = makeLimiter({ windowMs: 15 * 60 * 1000, max: 100 })
const resetLimiter = makeLimiter({ windowMs: 60 * 60 * 1000, max: 10 })
const refreshLimiter = makeLimiter({ windowMs: 15 * 60 * 1000, max: 300 })

// Simple in-memory users and tokens (for dev only)
// Basic auth rate limiter for POST/LOGIN endpoints to keep safety on dev/test
// authLimiter is configured via makeLimiter above; remove hard-coded rateLimit here
const users = [{ id: 1, username: 'player1', email: 'player1@example.local', password: bcrypt.hashSync('password', 10), role: 'user' }, { id: 2, username: 'admin', email: 'admin@example.local', password: bcrypt.hashSync('admin', 10), role: 'admin' }]
const tokens = new Map() // token -> { userId, expiresAt, revoked }
let nextTokenId = 1

// Chat messages (in-memory store for MVP). Each entry: { id, userId, username, content, createdAt }
const chatMessages = []
let nextMessageId = 1

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const REFRESH_EXPIRES_IN = process.env.REFRESH_EXPIRES_IN || '30d'

function signJwt(payload, expiresIn) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn || JWT_EXPIRES_IN })
}

function decodeJwt(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (e) {
    return null
  }
}

function cookieSettings() {
  const isProd = process.env.NODE_ENV === 'production'
  return { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/' }
}

async function issueSessionTokenForUser(user) {
  const token = signJwt({ userId: user.id, username: user.username, role: user.role })
  const decoded = jwt.decode(token)
  const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : null
  if (prisma) {
    try { await prisma.token.create({ data: { token, userId: user.id, expiresAt, type: 'session' } }) } catch {}
  } else {
    tokens.set(token, { userId: user.id, expiresAt, revoked: false, type: 'session' })
  }
  return token
}

async function issueRefreshTokenForUser(user, res) {
  const refresh = signJwt({ userId: user.id, username: user.username, role: user.role, kind: 'refresh' }, REFRESH_EXPIRES_IN)
  const decoded = jwt.decode(refresh)
  const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : null
  if (prisma) {
    try { await prisma.token.create({ data: { token: refresh, userId: user.id, expiresAt, type: 'refresh' } }) } catch {}
  } else {
    tokens.set(refresh, { userId: user.id, expiresAt, revoked: false, type: 'refresh' })
  }
  res.cookie('refresh_token', refresh, cookieSettings())
}

// Protected state APIs: require authenticated session
app.get('/api/state', authMiddleware, async (req, res) => {
  try {
    if (!savedState) savedState = await readState()
    res.json({ session_id: 1, state: savedState })
  } catch (e) {
    console.error('[api/state][get] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Authentication middleware
async function authMiddleware(req, res, next) {
  const auth = req.headers['authorization'] || ''
  const token = String(auth).replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ message: 'Missing token' })
  const verified = decodeJwt(token)
  if (!verified) return res.status(401).json({ message: 'Invalid token' })
  const userId = verified.userId
  try {
    if (prisma) {
      const tk = await prisma.token.findUnique({ where: { token }, include: { user: true } })
  if (!tk || !tk.user || tk.revoked || tk.type !== 'session') return res.status(401).json({ message: 'Invalid token' })
      if (tk.expiresAt && new Date(tk.expiresAt) < new Date()) return res.status(401).json({ message: 'Token expired' })
      req.user = { id: tk.user.id, username: tk.user.username, role: tk.user.role }
      return next()
    }
    const tk = tokens.get(token)
  if (!tk || tk.revoked || tk.type !== 'session') return res.status(401).json({ message: 'Invalid token' })
    if (tk.expiresAt && new Date(tk.expiresAt) < new Date()) return res.status(401).json({ message: 'Token expired' })
    const user = users.find(u => u.id === tk.userId)
    if (!user) return res.status(401).json({ message: 'Invalid token' })
    req.user = { id: user.id, username: user.username, role: user.role }
    next()
  } catch (e) {
    console.error('[auth][middleware] error', e)
    res.status(500).json({ message: 'Server error' })
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'owner')) return res.status(403).json({ message: 'Forbidden' })
  next()
}

// Basic health endpoint for readiness/liveness checks and monitoring
app.get('/health', (req, res) => {
  const uptime = process.uptime()
  const mem = process.memoryUsage()
  const stateVersion = savedState && savedState.version ? savedState.version : null
  res.json({ status: 'ok', uptime_secs: Math.floor(uptime), mem: { rss: mem.rss }, stateVersion, timestamp: new Date().toISOString() })
})

app.put('/api/state', authMiddleware, async (req, res) => {
  try {
    const incoming = req.body && req.body.state
    if (!incoming) return res.status(400).json({ message: 'state missing' })
    const aboutContent = incoming.aboutContent || (savedState && savedState.aboutContent) || DEFAULT_ABOUT_CONTENT
    const nextChangelog = incoming.changelog || (savedState && savedState.changelog) || DEFAULT_CHANGELOG
    savedState = {
      ...incoming,
      aboutContent: normalizeAboutContent(aboutContent),
      changelog: normalizeChangelog(nextChangelog)
    }
    ensureStateShape()
    await writeState(savedState)
    res.json({ session_id: 1, state: savedState })
  } catch (e) {
    console.error('[api/state][put] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

app.get('/api/about', (req, res) => {
  try {
    const content = getAboutContent()
    res.json({ content })
  } catch (e) {
    console.error('[api/about][get] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

app.put('/api/about', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const incoming = req.body && req.body.content
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ message: 'content payload required' })
    }
    const updated = setAboutContent(incoming)
    await writeState(savedState)
    res.json({ content: updated })
  } catch (e) {
    console.error('[api/about][put] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

app.get('/api/changelog', (_req, res) => {
  try {
    res.json(buildChangelogResponse())
  } catch (e) {
    console.error('[api/changelog][get] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

app.get('/api/changelog/:version', (req, res) => {
  try {
    const { version } = req.params
    const changelog = getChangelogState()
    const entry = changelog.entries.find(item => item.version === version)
    if (!entry) return res.status(404).json({ message: 'Not found' })
    res.json({ entry })
  } catch (e) {
    console.error('[api/changelog][get:version] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/changelog', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const incoming = req.body && req.body.entry
    const result = upsertChangelogEntry(incoming)
    if (result.error) {
      const status = result.error === 'Duplicate version' ? 409 : 400
      return res.status(status).json({ message: result.error })
    }
    await writeState(savedState)
    res.json({ entry: result.entry, entries: result.changelog.entries, latest: result.changelog.entries[0] || null })
  } catch (e) {
    console.error('[api/changelog][post] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

app.put('/api/changelog/:version', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { version } = req.params
    const incoming = req.body && req.body.entry
    const result = upsertChangelogEntry(incoming, version)
    if (result.error === 'Not found') return res.status(404).json({ message: 'Not found' })
    if (result.error === 'Duplicate version') return res.status(409).json({ message: 'Duplicate version' })
    if (result.error) return res.status(400).json({ message: result.error })
    await writeState(savedState)
    res.json({ entry: result.entry, entries: result.changelog.entries, latest: result.changelog.entries[0] || null })
  } catch (e) {
    console.error('[api/changelog][put] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

app.delete('/api/changelog/:version', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { version } = req.params
    const removed = deleteChangelogEntry(version)
    if (!removed) return res.status(404).json({ message: 'Not found' })
    await writeState(savedState)
    res.json(buildChangelogResponse())
  } catch (e) {
    console.error('[api/changelog][delete] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { username, password, email } = req.body || {}
  if (!username || !password) return res.status(400).json({ message: 'Missing username or password' })
  try {
    if (prisma) {
      const existing = await prisma.user.findUnique({ where: { username } })
      if (existing) return res.status(409).json({ message: 'User exists' })
      const hashed = await bcrypt.hash(password, 10)
      const created = await prisma.user.create({ data: { username, email, password: hashed, role: 'user' } })
      const token = await issueSessionTokenForUser(created)
      await issueRefreshTokenForUser(created, res)
      return res.json({ access_token: token })
    }
    const existing = users.find(u => u.username === username)
    if (existing) return res.status(409).json({ message: 'User exists' })
  const id = users.length + 1
  const hashed = await bcrypt.hash(password, 10)
  const user = { id, username, email, password: hashed, role: 'user' }
  users.push(user)
    const token = await issueSessionTokenForUser(user)
    await issueRefreshTokenForUser(user, res)
    res.json({ access_token: token })
  } catch (e) {
    console.error('[auth][register] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body || {}
  try {
    if (prisma) {
      const user = await prisma.user.findUnique({ where: { username } })
      if (!user) return res.status(401).json({ message: 'Invalid credentials' })
      const ok = await bcrypt.compare(password, user.password)
      if (!ok) return res.status(401).json({ message: 'Invalid credentials' })
      const token = await issueSessionTokenForUser(user)
      await issueRefreshTokenForUser(user, res)
      return res.json({ access_token: token })
    }
    const u = users.find(x => x.username === username)
    if (!u) return res.status(401).json({ message: 'Invalid credentials' })
    const ok = await bcrypt.compare(password, u.password)
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' })
    if (!u) return res.status(401).json({ message: 'Invalid credentials' })
  const token = await issueSessionTokenForUser(u)
  await issueRefreshTokenForUser(u, res)
  res.json({ access_token: token })
  } catch (e) {
    console.error('[auth][login] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Google ID token authentication helper
// POST /api/auth/google expects { id_token }
app.post('/api/auth/google', authLimiter, async (req, res) => {
  const { id_token } = req.body || {}
  if (!id_token) return res.status(400).json({ message: 'id_token required' })
  try {
    // Verify the ID token (prefer proper OIDC verification via google-auth-library)
    let info
    if (googleClient) {
      const ticket = await googleClient.verifyIdToken({ idToken: id_token, audience: GOOGLE_CLIENT_ID })
      info = ticket.getPayload()
    } else {
      // Fallback to tokeninfo endpoint when GOOGLE_CLIENT_ID not configured
      const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`
      const resp = await fetch(verifyUrl)
      if (!resp.ok) return res.status(401).json({ message: 'Invalid id_token' })
      info = await resp.json()
    }
    const { email, sub: providerId, name } = info || {}
    if (!email) return res.status(400).json({ message: 'email required from token' })

    // Find or create a local user record
    if (prisma) {
      let user = await prisma.user.findUnique({ where: { email } })
      if (!user) {
        // Try to construct a friendly username from name or email local part
        const preferred = sanitizeUsername(name) || sanitizeUsername((email || '').split('@')[0]) || `google_${providerId}`
        // Ensure uniqueness, fallback to provider id if name taken
        const exists = await prisma.user.findUnique({ where: { username: preferred } })
        const usernameToUse = exists ? `google_${providerId}` : preferred
        user = await prisma.user.create({ data: { username: usernameToUse, email, password: 'oauth', role: 'user' } })
      }
      // Create session token and refresh cookie
      const token = await issueSessionTokenForUser(user)
      await issueRefreshTokenForUser(user, res)
      return res.json({ access_token: token })
    }
    // Fallback in-memory users
    let user = users.find(u => u.email === email)
    if (!user) {
      const id = users.length + 1
      const preferred = sanitizeUsername(name) || sanitizeUsername((email || '').split('@')[0]) || `google_${providerId}`
      const exists = users.find(u => u.username === preferred)
      const username = exists ? `google_${providerId}` : preferred
      user = { id, username, email, password: 'oauth', role: 'user' }
      users.push(user)
    }
    const token = await issueSessionTokenForUser(user)
    await issueRefreshTokenForUser(user, res)
    res.json({ access_token: token })
  } catch (e) {
    console.error('[auth][google] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Chat endpoints
const chatLimiter = rateLimit({ windowMs: 15 * 1000, max: 60, standardHeaders: true, legacyHeaders: false })
const limiterKeyForUser = (req) => {
  if (req && req.user && req.user.id) return `user:${req.user.id}`
  return req.ip || req.headers['x-forwarded-for'] || 'unknown'
}
const chatMessageLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: limiterKeyForUser,
  message: { message: 'Too many messages sent too quickly. Please slow down.' }
})
const chatTypingLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: limiterKeyForUser,
  message: { message: 'Typing notifications throttled. Give it a moment.' }
})
function sanitizeMessageContent(s) {
  if (!s) return ''
  // Coerce to string, limit length, strip most control chars except newline and tab
  let v = String(s).slice(0, 1000)
  v = v.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  return v
}

// Simple SSE hub per room
const sseClients = new Map() // room -> Set(res)

function parseDmRoom(room) {
  const m = /^dm:(\d+):(\d+)$/.exec(String(room || ''))
  if (!m) return null
  const a = parseInt(m[1], 10)
  const b = parseInt(m[2], 10)
  if (isNaN(a) || isNaN(b)) return null
  return [a, b]
}

function userAuthorizedForRoom(userId, room) {
  const pair = parseDmRoom(room)
  if (!pair) return true // public rooms are open to authenticated users
  const [a, b] = pair
  return userId === a || userId === b
}

async function authenticateFromRequest(req) {
  // Prefer Authorization header, else support token query param for EventSource
  const auth = req.headers['authorization'] || ''
  const bearerToken = String(auth).replace(/^Bearer\s+/i, '')
  const qpToken = typeof req.query.token === 'string' ? req.query.token : null
  const token = bearerToken || qpToken
  if (!token) return null
  const verified = decodeJwt(token)
  if (!verified) return null
  const userId = verified.userId
  if (prisma) {
    const tk = await prisma.token.findUnique({ where: { token }, include: { user: true } })
    if (!tk || !tk.user || tk.revoked || tk.type !== 'session') return null
    if (tk.expiresAt && new Date(tk.expiresAt) < new Date()) return null
    return { id: tk.user.id, username: tk.user.username, role: tk.user.role }
  }
  const tk = tokens.get(token)
  if (!tk || tk.revoked || tk.type !== 'session') return null
  if (tk.expiresAt && new Date(tk.expiresAt) < new Date()) return null
  const user = users.find(u => u.id === tk.userId)
  if (!user) return null
  return { id: user.id, username: user.username, role: user.role }
}

function sseAddClient(room, res) {
  if (!sseClients.has(room)) sseClients.set(room, new Set())
  sseClients.get(room).add(res)
}

function sseRemoveClient(room, res) {
  const set = sseClients.get(room)
  if (set) {
    set.delete(res)
    if (set.size === 0) sseClients.delete(room)
  }
}

function sseBroadcast(room, payload) {
  const set = sseClients.get(room)
  if (!set || set.size === 0) return
  const data = `data: ${JSON.stringify(payload)}\n\n`
  for (const res of set) {
    try { res.write(data) } catch (e) { /* ignore broken pipe */ }
  }
}

function sseBroadcastAll(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`
  for (const [room, set] of sseClients.entries()) {
    for (const res of set) {
      try { res.write(data) } catch (e) { /* ignore broken pipe */ }
    }
  }
}

// GET /api/chat/stream?room=general&token=... (SSE)
app.get('/api/chat/stream', async (req, res) => {
  try {
    const user = await authenticateFromRequest(req)
    if (!user) return res.status(401).end()
    const room = String(req.query.room || 'general')
    // Authorize DM rooms
    if (!userAuthorizedForRoom(user.id, room)) return res.status(403).end()
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    })
    res.write(': connected\n\n')
    sseAddClient(room, res)
    const hb = setInterval(() => { try { res.write(`: hb ${Date.now()}\n\n`) } catch {} }, 25000)
    req.on('close', () => { clearInterval(hb); sseRemoveClient(room, res) })
  } catch (e) {
    console.error('[chat][stream] error', e)
    res.status(500).end()
  }
})
// GET messages for a room: /api/chat/messages?room=general&afterId=0&limit=50
app.get('/api/chat/messages', authMiddleware, async (req, res) => {
  const room = String(req.query.room || 'general')
  const afterId = parseInt(String(req.query.afterId || '0'), 10)
  const beforeId = parseInt(String(req.query.beforeId || '0'), 10)
  const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 200)
  try {
    // DM rooms allowed only for participants
    if (!userAuthorizedForRoom(req.user.id, room)) return res.status(403).json({ message: 'Forbidden' })
    if (prisma) {
      const where = { room }
      if (afterId) {
        Object.assign(where, { id: { gt: afterId } })
        const msgs = await prisma.message.findMany({ where, include: { user: true }, orderBy: [{ id: 'asc' }], take: limit })
        return res.json(msgs)
      }
      if (beforeId) {
        Object.assign(where, { id: { lt: beforeId } })
        // fetch older in desc then reverse to keep asc rendering
        const older = await prisma.message.findMany({ where, include: { user: true }, orderBy: [{ id: 'desc' }], take: limit })
        return res.json(older.reverse())
      }
      const msgs = await prisma.message.findMany({ where, include: { user: true }, orderBy: [{ id: 'asc' }], take: limit })
      return res.json(msgs)
    }
    return res.status(500).json({ message: 'DB not available' })
  } catch (e) {
    console.error('[chat][get messages] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// POST a message. Requires auth
app.post('/api/chat/messages', authMiddleware, chatMessageLimiter, async (req, res) => {
  const { room = 'general', content } = req.body || {}
  const clean = sanitizeMessageContent(content)
  if (!clean || !clean.trim()) return res.status(400).json({ message: 'Missing content' })
  try {
    if (!userAuthorizedForRoom(req.user.id, room)) return res.status(403).json({ message: 'Forbidden' })
    if (prisma) {
      const created = await prisma.message.create({ data: { content: clean, room: String(room), userId: req.user.id } })
      const withUser = await prisma.message.findUnique({ where: { id: created.id }, include: { user: true } })
      // Broadcast to room listeners
      try { sseBroadcast(String(room), { type: 'message', message: withUser }) } catch {}
      return res.json(withUser)
    }
    return res.status(500).json({ message: 'DB not available' })
  } catch (e) {
    console.error('[chat][post message] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// GET users and simple online presence
app.get('/api/chat/users', async (req, res) => {
  try {
    if (prisma) {
      const all = await prisma.user.findMany({ select: { id: true, username: true, role: true } })
      const now = Date.now()
      const room = String(req.query.room || 'general')
      const roomPresence = getPresenceMap(room)
      // For DM rooms, restrict listing to the two participants only
      const dmPair = parseDmRoom(room)
      const base = dmPair ? all.filter(u => u.id === dmPair[0] || u.id === dmPair[1]) : all
      const result = base.map(u => ({ ...u, online: !!(roomPresence.get(u.id) && (now - roomPresence.get(u.id) < PRESENCE_TTL_MS)) }))
      const onlineOnly = String(req.query.onlineOnly || '').toLowerCase() === '1' || String(req.query.onlineOnly || '').toLowerCase() === 'true'
      return res.json(onlineOnly ? result.filter(u => u.online) : result)
    }
    return res.status(500).json({ message: 'DB not available' })
  } catch (e) {
    console.error('[chat][users] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Ping endpoint updates presence (per room)
app.post('/api/chat/ping', authMiddleware, async (req, res) => {
  try {
    const room = String((req.body && req.body.room) || 'general')
    if (!userAuthorizedForRoom(req.user.id, room)) return res.status(403).json({ message: 'Forbidden' })
    const pres = getPresenceMap(room)
    pres.set(req.user.id, Date.now())
    // broadcast presence heartbeat to the specific room
    try { sseBroadcast(room, { type: 'presence', user: { id: req.user.id, username: req.user.username }, ts: Date.now() }) } catch {}
    res.json({ message: 'pong' })
  } catch (e) {
    console.error('[chat][ping] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// OAuth 2.0 Authorization Code flow (redirect-based)
// Starts the Google OAuth flow by redirecting to Google's consent screen
app.get('/api/auth/oauth/google', authLimiter, async (req, res) => {
  try {
    if (!googleOauthClient) return res.status(500).json({ message: 'OAuth not configured' })
    const state = typeof req.query.state === 'string' ? req.query.state : undefined
    const url = googleOauthClient.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['openid', 'email', 'profile'],
      include_granted_scopes: true,
      state
    })
    res.redirect(url)
  } catch (e) {
    console.error('[auth][oauth][google][start] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Handles the OAuth callback, exchanges the code for tokens, verifies id_token,
// issues a local JWT, and redirects to the frontend with the token
app.get('/api/auth/oauth/google/callback', authLimiter, async (req, res) => {
  try {
    if (!googleOauthClient) return res.status(500).json({ message: 'OAuth not configured' })
    const code = String(req.query.code || '')
    const state = typeof req.query.state === 'string' ? req.query.state : ''
    if (!code) return res.status(400).json({ message: 'Missing code' })

    const { tokens } = await googleOauthClient.getToken(code)
    // tokens.id_token should be present for OIDC scopes
    if (!tokens || !tokens.id_token) return res.status(401).json({ message: 'No id_token in response' })

    const ticket = await googleOauthClient.verifyIdToken({ idToken: tokens.id_token, audience: GOOGLE_CLIENT_ID })
    const info = ticket.getPayload()
  const { email, sub: providerId, name } = info || {}
    if (!email) return res.status(400).json({ message: 'email required from token' })

    let accessToken
    if (prisma) {
      let user = await prisma.user.findUnique({ where: { email } })
      if (!user) {
        const preferred = sanitizeUsername(name) || sanitizeUsername((email || '').split('@')[0]) || `google_${providerId}`
        const exists = await prisma.user.findUnique({ where: { username: preferred } })
        const usernameToUse = exists ? `google_${providerId}` : preferred
        user = await prisma.user.create({ data: { username: usernameToUse, email, password: 'oauth', role: 'user' } })
      }
      const jwtToken = await issueSessionTokenForUser(user)
      await issueRefreshTokenForUser(user, res)
      accessToken = jwtToken
    } else {
      let user = users.find(u => u.email === email)
      if (!user) {
        const id = users.length + 1
        const preferred = sanitizeUsername(name) || sanitizeUsername((email || '').split('@')[0]) || `google_${providerId}`
        const exists = users.find(u => u.username === preferred)
        const username = exists ? `google_${providerId}` : preferred
        user = { id, username, email, password: 'oauth', role: 'user' }
        users.push(user)
      }
      const jwtToken = await issueSessionTokenForUser(user)
      await issueRefreshTokenForUser(user, res)
      accessToken = jwtToken
    }

    // Redirect back to the frontend with the token. Prefer hash to avoid logs capturing query
  const redirectBase = CLIENT_FRONTEND_URL || 'http://localhost:5173'
    const dest = new URL(redirectBase)
  // Ensure we land on the app route so the client shows the LockScreen immediately
  dest.pathname = '/app'
    // Preserve state by appending it
    if (state) dest.searchParams.set('state', state)
    // Use hash fragment for token
    dest.hash = `access_token=${encodeURIComponent(accessToken)}`
    return res.redirect(dest.toString())
  } catch (e) {
    console.error('[auth][oauth][google][callback] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

app.get('/api/auth/me', async (req, res) => {
  const auth = req.headers['authorization'] || ''
  const token = String(auth).replace(/^Bearer\s+/i, '')
  try {
    const verified = decodeJwt(token)
    if (!verified) return res.status(401).json({ message: 'Invalid token' })
    const userId = verified.userId
    if (prisma) {
      const tk = await prisma.token.findUnique({ where: { token }, include: { user: true } })
      if (!tk || !tk.user || tk.revoked) return res.status(401).json({ message: 'Invalid token' })
      if (tk.expiresAt && new Date(tk.expiresAt) < new Date()) return res.status(401).json({ message: 'Token expired' })
      const user = tk.user
      // Build a friendlier display name for OAuth-created users
      const displayName = user.username && user.username.startsWith('google_')
        ? (user.email ? user.email.split('@')[0] : user.username)
        : user.username
      return res.json({ id: user.id, username: user.username, display_name: displayName, is_admin: user.role === 'admin' })
    }
    const tk = tokens.get(token)
    if (!tk || tk.revoked) return res.status(401).json({ message: 'Invalid token' })
    if (tk.expiresAt && new Date(tk.expiresAt) < new Date()) return res.status(401).json({ message: 'Token expired' })
    const user = users.find(u => u.id === tk.userId)
    if (!user) return res.status(401).json({ message: 'Invalid token' })
    const displayName = user.username && user.username.startsWith('google_')
      ? (user.email ? user.email.split('@')[0] : user.username)
      : user.username
    res.json({ id: user.id, username: user.username, display_name: displayName, is_admin: user.role === 'admin' })
  } catch (e) {
    console.error('[auth][me] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Refresh access token using HttpOnly refresh cookie
app.post('/api/auth/refresh', refreshLimiter, async (req, res) => {
  try {
    const refresh = req.cookies && req.cookies['refresh_token']
    if (!refresh) return res.status(401).json({ message: 'No refresh token' })
    const verified = decodeJwt(refresh)
    if (!verified || verified.kind !== 'refresh') return res.status(401).json({ message: 'Invalid token' })
    if (prisma) {
      const tk = await prisma.token.findUnique({ where: { token: refresh }, include: { user: true } })
      if (!tk || !tk.user || tk.revoked || tk.type !== 'refresh') return res.status(401).json({ message: 'Invalid token' })
      if (tk.expiresAt && new Date(tk.expiresAt) < new Date()) return res.status(401).json({ message: 'Token expired' })
      const user = tk.user
      // Rotate refresh: revoke old, issue new
      await prisma.token.update({ where: { id: tk.id }, data: { revoked: true } })
      await issueRefreshTokenForUser(user, res)
      const access = await issueSessionTokenForUser(user)
      return res.json({ access_token: access })
    }
    // In-memory fallback
    const tk = tokens.get(refresh)
    if (!tk || tk.revoked || tk.type !== 'refresh') return res.status(401).json({ message: 'Invalid token' })
    if (tk.expiresAt && new Date(tk.expiresAt) < new Date()) return res.status(401).json({ message: 'Token expired' })
    const user = users.find(u => u.id === tk.userId)
    if (!user) return res.status(401).json({ message: 'Invalid token' })
    tk.revoked = true
    await issueRefreshTokenForUser(user, res)
    const access = await issueSessionTokenForUser(user)
    return res.json({ access_token: access })
  } catch (e) {
    console.error('[auth][refresh] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Update profile (username or password). Requires current session token
app.patch('/api/auth/me', authMiddleware, async (req, res) => {
  const { username, password, oldPassword } = req.body || {}
  try {
    if (prisma) {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } })
      if (!user) return res.status(404).json({ message: 'Not found' })
      if (password) {
        // require old password to change
        if (!oldPassword) return res.status(400).json({ message: 'oldPassword required' })
        const ok = await bcrypt.compare(oldPassword, user.password)
        if (!ok) return res.status(401).json({ message: 'Invalid credentials' })
        const hashed = await bcrypt.hash(password, 10)
        await prisma.user.update({ where: { id: user.id }, data: { password: hashed } })
        return res.json({ message: 'Password updated' })
      }
      if (username) {
        await prisma.user.update({ where: { id: user.id }, data: { username } })
        return res.json({ message: 'Username updated' })
      }
      res.json({ message: 'No changes' })
    } else {
      const user = users.find(u => u.id === req.user.id)
      if (!user) return res.status(404).json({ message: 'Not found' })
      if (password) {
        if (!oldPassword) return res.status(400).json({ message: 'oldPassword required' })
        const ok = await bcrypt.compare(oldPassword, user.password)
        if (!ok) return res.status(401).json({ message: 'Invalid credentials' })
        const hashed = await bcrypt.hash(password, 10)
        Object.assign(user, { password: hashed })
        return res.json({ message: 'Password updated' })
      }
      if (username) { Object.assign(user, { username }); return res.json({ message: 'Username updated' }) }
      res.json({ message: 'No changes' })
    }
  } catch (e) {
    console.error('[auth][me][patch] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Password reset: request creates a reset token and (for dev) returns it; confirm consumes the token to update password
app.post('/api/auth/reset/request', resetLimiter, async (req, res) => {
  const { username, email } = req.body || {}
  console.log('[auth/reset/request] body:', req.body)
  const lookup = username || email
  if (!lookup) return res.status(400).json({ message: 'username or email required' })
  try {
    if (prisma) {
      const user = username ? await prisma.user.findUnique({ where: { username } }) : await prisma.user.findUnique({ where: { email } })
      if (!user) return res.status(404).json({ message: 'Not found' })
      const token = signJwt({ userId: user.id, username: user.username, role: user.role }, '1h')
      const decoded = jwt.decode(token)
      const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : null
      await prisma.token.create({ data: { token, userId: user.id, expiresAt, type: 'reset' } })
      // For dev, return the reset token so UI can simulate email delivery
      return res.json({ reset_token: token })
    }
  const user = users.find(u => (username && u.username === username) || (email && u.email === email))
    if (!user) return res.status(404).json({ message: 'Not found' })
    const token = signJwt({ userId: user.id, username: user.username, role: user.role }, '1h')
    const decoded = jwt.decode(token)
    const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : null
    tokens.set(token, { userId: user.id, expiresAt, revoked: false, type: 'reset' })
    return res.json({ reset_token: token })
  } catch (e) {
    console.error('[auth][reset][request] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/auth/reset/confirm', resetLimiter, async (req, res) => {
  const { token, password } = req.body || {}
  if (!token || !password) return res.status(400).json({ message: 'token and password required' })
  try {
    if (prisma) {
      const tk = await prisma.token.findUnique({ where: { token }, include: { user: true } })
      if (!tk || !tk.user || tk.revoked || tk.type !== 'reset') return res.status(401).json({ message: 'Invalid token' })
      if (tk.expiresAt && new Date(tk.expiresAt) < new Date()) return res.status(401).json({ message: 'Token expired' })
      const hashed = await bcrypt.hash(password, 10)
      await prisma.user.update({ where: { id: tk.user.id }, data: { password: hashed } })
      await prisma.token.updateMany({ where: { userId: tk.user.id, type: 'reset' }, data: { revoked: true } })
      return res.json({ message: 'Password reset' })
    }
    const tk = tokens.get(token)
    if (!tk || tk.revoked || tk.type !== 'reset') return res.status(401).json({ message: 'Invalid token' })
    if (tk.expiresAt && new Date(tk.expiresAt) < new Date()) return res.status(401).json({ message: 'Token expired' })
    const user = users.find(u => u.id === tk.userId)
    if (!user) return res.status(404).json({ message: 'Not found' })
    const hashed = await bcrypt.hash(password, 10)
    user.password = hashed
    // revoke all reset tokens for user in fallback
    for (const [k, v] of tokens.entries()) { if (v.userId === user.id && v.type === 'reset') v.revoked = true }
    return res.json({ message: 'Password reset' })
  } catch (e) {
    console.error('[auth][reset][confirm] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Add a logout endpoint to revoke a token
app.post('/api/auth/logout', async (req, res) => {
  const auth = req.headers['authorization'] || ''
  const token = String(auth).replace(/^Bearer\s+/i, '')
  try {
    if (!token) return res.status(400).json({ message: 'Token required' })
    if (prisma) {
      // Revoke access token
      const updated = await prisma.token.updateMany({ where: { token }, data: { revoked: true } })
      // Attempt to revoke refresh tokens for this user as well
      try {
        const tk = await prisma.token.findUnique({ where: { token }, include: { user: true } })
        if (tk && tk.user) {
          await prisma.token.updateMany({ where: { userId: tk.user.id, type: 'refresh' }, data: { revoked: true } })
        }
      } catch {}
      res.clearCookie('refresh_token', { path: '/' })
      return res.json({ message: 'Logged out' })
    }
    const tk = tokens.get(token)
    if (tk) tk.revoked = true
    // Best-effort revoke refresh tokens in memory
    for (const [k, v] of tokens.entries()) { if (v.userId === (tk && tk.userId) && v.type === 'refresh') v.revoked = true }
    res.clearCookie('refresh_token', { path: '/' })
    res.json({ message: 'Logged out' })
  } catch (e) {
    console.error('[auth][logout] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Protected command execution endpoint
app.post('/api/command', authMiddleware, (req, res) => {
  const { command } = req.body || {}
  if (!command) return res.status(400).json({ message: 'command required' })
  // Minimal command handling for dev convenience
  let output = ''
  if (command === 'help') output = 'help: available commands: help, echo <text>, date'
  else if (command.startsWith('echo ')) output = command.slice(5)
  else if (command === 'date') output = new Date().toString()
  else output = `Unknown command: ${command}`
  res.json({ output })
})

// Minimal chat API (MVP)
// GET /api/chat: returns the last 50 messages
app.get('/api/chat', authMiddleware, async (req, res) => {
  try {
    const last = 50
    const msgs = chatMessages.slice(-last).map(m => ({ id: m.id, userId: m.userId, username: m.username, content: m.content, createdAt: m.createdAt }))
    return res.json(msgs)
  } catch (e) {
    console.error('[chat][get] error', e)
    return res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/chat: post a new message
app.post('/api/chat', authLimiter, authMiddleware, async (req, res) => {
  try {
    const { content } = req.body || {}
    if (!content || typeof content !== 'string' || content.trim().length === 0) return res.status(400).json({ message: 'content required' })
    if (content.length > 1000) return res.status(400).json({ message: 'content too long' })
    const m = { id: nextMessageId++, userId: req.user.id, username: req.user.username, content: String(content).slice(0, 1000), createdAt: new Date().toISOString() }
    chatMessages.push(m)
    // Optionally persist to Prisma in a follow-up PR
    return res.json(m)
  } catch (e) {
    console.error('[chat][post] error', e)
    return res.status(500).json({ message: 'Server error' })
  }
})

// Typing indicator endpoint - broadcasts to all room listeners
app.post('/api/chat/typing', authMiddleware, chatTypingLimiter, async (req, res) => {
  try {
    const { room = 'general' } = req.body || {}
    if (!userAuthorizedForRoom(req.user.id, room)) return res.status(403).json({ message: 'Forbidden' })
    sseBroadcast(String(room), { type: 'typing', user: { id: req.user.id, username: req.user.username }, ts: Date.now() })
    res.json({ ok: true })
  } catch (e) {
    console.error('[chat][typing] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// List recent DM rooms for the current user with latest message info
app.get('/api/chat/dm-list', authMiddleware, async (req, res) => {
  try {
    if (!prisma) return res.status(500).json({ message: 'DB not available' })
    // Fetch recent messages in DM rooms to build a latest map per room
    const recent = await prisma.message.findMany({
      where: { room: { startsWith: 'dm:' } },
      select: { id: true, room: true, createdAt: true },
      orderBy: [{ id: 'desc' }],
      take: 500
    })
    const latestByRoom = new Map()
    for (const m of recent) {
      if (!latestByRoom.has(m.room)) latestByRoom.set(m.room, m)
    }
    const items = []
    for (const [room, m] of latestByRoom.entries()) {
      const pair = parseDmRoom(room)
      if (!pair) continue
      const [a, b] = pair
      if (req.user.id !== a && req.user.id !== b) continue
      const peerId = req.user.id === a ? b : a
      items.push({ room, peerId, latestId: m.id, latestAt: m.createdAt })
    }
    const peerIds = [...new Set(items.map(x => x.peerId))]
    const peers = peerIds.length ? await prisma.user.findMany({ where: { id: { in: peerIds } }, select: { id: true, username: true } }) : []
    const nameById = new Map(peers.map(p => [p.id, p.username]))
    const result = items.map(x => ({ room: x.room, peer: { id: x.peerId, username: nameById.get(x.peerId) || `user${x.peerId}` }, latestId: x.latestId, latestAt: x.latestAt }))
    res.json(result)
  } catch (e) {
    console.error('[chat][dm-list] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Delete a message (owner or admin)
app.delete('/api/chat/messages/:id', chatLimiter, authMiddleware, async (req, res) => {
  // Message deletion is disabled by product decision
  return res.status(405).json({ message: 'Deleting messages is not allowed' })
})

// Admin endpoints (basic)
app.get('/api/admin/users', authMiddleware, requireAdmin, async (req, res) => {
  try {
    if (prisma) {
      const users = await prisma.user.findMany({ select: { id: true, username: true, role: true } })
      return res.json(users)
    }
    return res.json(users.map(u => ({ id: u.id, username: u.username, role: u.role })))
  } catch (e) {
    console.error('[admin][users] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

app.patch('/api/admin/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10)
  try {
    const updateData = { ...req.body }
    // Hash password if provided
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10)
    }
    
    if (prisma) {
      const user = await prisma.user.update({ where: { id }, data: updateData })
      return res.json({ id: user.id, username: user.username, role: user.role })
    }
    const user = users.find(u => u.id === id)
    if (!user) return res.status(404).json({ message: 'Not found' })
    Object.assign(user, updateData)
    res.json(user)
  } catch (e) {
    console.error('[admin][user][patch] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

app.delete('/api/admin/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10)
  try {
    if (prisma) {
      await prisma.user.delete({ where: { id } })
      return res.json({ message: 'Deleted' })
    }
    const idx = users.findIndex(u => u.id === id)
    if (idx === -1) return res.status(404).json({ message: 'Not found' })
    users.splice(idx, 1)
    res.json({ message: 'Deleted' })
  } catch (e) {
    console.error('[admin][user][delete] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Dev-only admin creation endpoint - only permitted outside of production.
app.post('/api/admin/create', async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ message: 'Not allowed in production' })
  const { username = 'admin', password = 'admin', secret } = req.body || {}
  if (process.env.DEV_ADMIN_SECRET && process.env.DEV_ADMIN_SECRET !== secret) {
    return res.status(403).json({ message: 'Invalid secret' })
  }
  try {
    if (prisma) {
      let user = await prisma.user.findUnique({ where: { username } })
      if (user) {
        user = await prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } })
        return res.json({ id: user.id, username: user.username, role: user.role })
      }
      const hashed = await bcrypt.hash(password, 10)
      user = await prisma.user.create({ data: { username, password: hashed, role: 'admin' } })
      return res.json({ id: user.id, username: user.username, role: user.role })
    }
    let user = users.find(u => u.username === username)
    if (user) {
      user.role = 'admin'
      return res.json(user)
    }
    const id = users.length + 1
    const hashed = await bcrypt.hash(password, 10)
    users.push({ id, username, password: hashed, role: 'admin' })
    res.json({ id, username, role: 'admin' })
  } catch (e) {
    console.error('[admin][create] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: create a new user (admin-only)
app.post('/api/admin/users', authMiddleware, requireAdmin, async (req, res) => {
  const { username, password, email, role = 'user' } = req.body || {}
  if (!username || !password) return res.status(400).json({ message: 'Missing username or password' })
  try {
    if (prisma) {
      const exists = await prisma.user.findUnique({ where: { username } })
      if (exists) return res.status(409).json({ message: 'User exists' })
      const hashed = await bcrypt.hash(password, 10)
      const user = await prisma.user.create({ data: { username, password: hashed, email, role } })
      return res.json({ id: user.id, username: user.username, role: user.role })
    }
    return res.status(500).json({ message: 'DB not available' })
  } catch (e) {
    console.error('[admin][users][create] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// fallback
app.use((req, res) => {
  res.status(404).json({ message: 'Not found' })
})

let server = null
if (require.main === module) {
  const envLabel = process.env.NODE_ENV || 'development'
  server = app.listen(DEFAULT_PORT, SERVER_HOST, () => {
    console.log(`[server] Terminality API listening on ${SERVER_HOST}:${DEFAULT_PORT} (env=${envLabel})`)
    if (SERVER_PUBLIC_URL) {
      console.log(`[server] Public URL: ${SERVER_PUBLIC_URL}`)
    } else if (envLabel !== 'production') {
      console.log(`[server] Local URL: http://localhost:${DEFAULT_PORT}`)
    }
  })

  server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`[server] Port ${DEFAULT_PORT} already in use. Please stop other servers or set PORT env var.`)
    process.exit(1)
  }
  console.error('[server] Unhandled server error:', err)
  process.exit(1)
})
}

// Graceful shutdown so nodemon restarts cleanly
process.on('SIGINT', async () => {
  console.log('[server] SIGINT received, shutting down')
  try { if (prisma) await prisma.$disconnect() } catch (e) { /* ignore */ }
  if (server) server.close(() => process.exit(0))
})
process.on('SIGTERM', async () => {
  console.log('[server] SIGTERM received, shutting down')
  try { if (prisma) await prisma.$disconnect() } catch (e) { /* ignore */ }
  if (server) server.close(() => process.exit(0))
})

module.exports = { app, prisma }
