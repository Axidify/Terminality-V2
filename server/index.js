// Load env vars early
try { require('dotenv').config() } catch {}
const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const bodyParser = require('body-parser')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { OAuth2Client } = require('google-auth-library')
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
// Client to verify ID tokens (no secret required)
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null
// Full OAuth2 client (authorization code exchange)
const googleOauthClient = (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI)
  ? new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)
  : null

// In-memory presence tracking (dev only) — userId -> timestamp ms
const presence = new Map()

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

let savedState = null
;(async () => {
  savedState = await readState()
})()

const app = express()
// Enable CORS and credentials for dev; this ensures the client can send cookies / credentials
app.use(cors({ origin: true, credentials: true }))
// Ensure preflight requests allow credentials as well
app.options('*', cors({ origin: true, credentials: true }))
// Parse JSON and URL-encoded bodies so the API accepts both JSON and x-www-form-urlencoded payloads
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// Simple in-memory users and tokens (for dev only)
// Basic auth rate limiter for POST/LOGIN endpoints to keep safety on dev/test
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false })
const users = [{ id: 1, username: 'player1', email: 'player1@example.local', password: bcrypt.hashSync('password', 10), role: 'user' }, { id: 2, username: 'admin', email: 'admin@example.local', password: bcrypt.hashSync('admin', 10), role: 'admin' }]
const tokens = new Map() // token -> { userId, expiresAt, revoked }
let nextTokenId = 1

// Chat messages (in-memory store for MVP). Each entry: { id, userId, username, content, createdAt }
const chatMessages = []
let nextMessageId = 1

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

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
    savedState = incoming
    await writeState(savedState)
    res.json({ session_id: 1, state: savedState })
  } catch (e) {
    console.error('[api/state][put] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/auth/register', async (req, res) => {
  const { username, password, email } = req.body || {}
  if (!username || !password) return res.status(400).json({ message: 'Missing username or password' })
  try {
    if (prisma) {
      const existing = await prisma.user.findUnique({ where: { username } })
      if (existing) return res.status(409).json({ message: 'User exists' })
      const hashed = await bcrypt.hash(password, 10)
      const created = await prisma.user.create({ data: { username, email, password: hashed, role: 'user' } })
      const token = signJwt({ userId: created.id, username: created.username, role: created.role })
      const decoded = jwt.decode(token)
      const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : null
      try {
        await prisma.token.create({ data: { token, userId: created.id, expiresAt, type: 'session' } })
      } catch (err) {
        // If token already exists (unlikely but possible in tests), ignore and proceed
        if (err && err.code === 'P2002') {
          console.warn('[prisma] token already exists, skipping insert')
        } else {
          throw err
        }
      }
      return res.json({ access_token: token })
    }
    const existing = users.find(u => u.username === username)
    if (existing) return res.status(409).json({ message: 'User exists' })
  const id = users.length + 1
  const hashed = await bcrypt.hash(password, 10)
  users.push({ id, username, email, password: hashed, role: 'user' })
    const token = signJwt({ userId: id, username, role: 'user' })
    const decoded = jwt.decode(token)
    const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : null
  tokens.set(token, { userId: id, expiresAt, revoked: false, type: 'session' })
    res.json({ token })
  } catch (e) {
    console.error('[auth][register] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {}
  try {
    if (prisma) {
      const user = await prisma.user.findUnique({ where: { username } })
      if (!user) return res.status(401).json({ message: 'Invalid credentials' })
      const ok = await bcrypt.compare(password, user.password)
      if (!ok) return res.status(401).json({ message: 'Invalid credentials' })
      const token = signJwt({ userId: user.id, username: user.username, role: user.role })
      const decoded = jwt.decode(token)
      const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : null
      try {
        await prisma.token.create({ data: { token, userId: user.id, expiresAt, type: 'session' } })
      } catch (err) {
        if (err && err.code === 'P2002') {
          console.warn('[prisma] token already exists, skipping insert')
        } else {
          throw err
        }
      }
      return res.json({ access_token: token })
    }
    const u = users.find(x => x.username === username)
    if (!u) return res.status(401).json({ message: 'Invalid credentials' })
    const ok = await bcrypt.compare(password, u.password)
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' })
    if (!u) return res.status(401).json({ message: 'Invalid credentials' })
  const token = signJwt({ userId: u.id, username: u.username, role: u.role })
    const decoded = jwt.decode(token)
    const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : null
  tokens.set(token, { userId: u.id, expiresAt, revoked: false, type: 'session' })
  res.json({ access_token: token })
  } catch (e) {
    console.error('[auth][login] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Google ID token authentication helper
// POST /api/auth/google expects { id_token }
app.post('/api/auth/google', async (req, res) => {
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
      // Create session token
      const token = signJwt({ userId: user.id, username: user.username, role: user.role })
      const decoded = jwt.decode(token)
      const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : null
      try { await prisma.token.create({ data: { token, userId: user.id, expiresAt, type: 'session' } }) } catch (err) {}
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
    const token = signJwt({ userId: user.id, username: user.username, role: user.role })
    const decoded = jwt.decode(token)
    const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : null
    tokens.set(token, { userId: user.id, expiresAt, revoked: false, type: 'session' })
    res.json({ access_token: token })
  } catch (e) {
    console.error('[auth][google] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Chat endpoints
const chatLimiter = rateLimit({ windowMs: 15 * 1000, max: 60, standardHeaders: true, legacyHeaders: false })
function sanitizeMessageContent(s) {
  if (!s) return ''
  // Coerce to string, limit length, strip most control chars except newline and tab
  let v = String(s).slice(0, 1000)
  v = v.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  return v
}

// Simple SSE hub per room
const sseClients = new Map() // room -> Set(res)

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

// GET /api/chat/stream?room=general&token=... (SSE)
app.get('/api/chat/stream', async (req, res) => {
  try {
    const user = await authenticateFromRequest(req)
    if (!user) return res.status(401).end()
    const room = String(req.query.room || 'general')
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
app.get('/api/chat/messages', async (req, res) => {
  const room = String(req.query.room || 'general')
  const afterId = parseInt(String(req.query.afterId || '0'), 10)
  const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 200)
  try {
    if (prisma) {
      const where = { room }
      if (afterId) where.id = { gt: afterId }
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
app.post('/api/chat/messages', chatLimiter, authMiddleware, async (req, res) => {
  const { room = 'general', content } = req.body || {}
  const clean = sanitizeMessageContent(content)
  if (!clean || !clean.trim()) return res.status(400).json({ message: 'Missing content' })
  try {
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
      const users = all.map(u => ({ ...u, online: !!(presence.get(u.id) && (now - presence.get(u.id) < 30000)) }))
      return res.json(users)
    }
    return res.status(500).json({ message: 'DB not available' })
  } catch (e) {
    console.error('[chat][users] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Ping endpoint updates presence
app.post('/api/chat/ping', authMiddleware, async (req, res) => {
  try {
    presence.set(req.user.id, Date.now())
    res.json({ message: 'pong' })
  } catch (e) {
    console.error('[chat][ping] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// OAuth 2.0 Authorization Code flow (redirect-based)
// Starts the Google OAuth flow by redirecting to Google's consent screen
app.get('/api/auth/oauth/google', async (req, res) => {
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
app.get('/api/auth/oauth/google/callback', async (req, res) => {
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
      const jwtToken = signJwt({ userId: user.id, username: user.username, role: user.role })
      const decoded = jwt.decode(jwtToken)
      const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : null
      try { await prisma.token.create({ data: { token: jwtToken, userId: user.id, expiresAt, type: 'session' } }) } catch {}
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
      const jwtToken = signJwt({ userId: user.id, username: user.username, role: user.role })
      const decoded = jwt.decode(jwtToken)
      const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : null
      tokens.set(jwtToken, { userId: user.id, expiresAt, revoked: false, type: 'session' })
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
app.post('/api/auth/reset/request', async (req, res) => {
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

app.post('/api/auth/reset/confirm', async (req, res) => {
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
      await prisma.token.updateMany({ where: { token }, data: { revoked: true } })
      return res.json({ message: 'Logged out' })
    }
    const tk = tokens.get(token)
    if (tk) tk.revoked = true
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
  server = app.listen(DEFAULT_PORT, () => {
    console.log(`Terminality dev api listening on http://localhost:${DEFAULT_PORT}`)
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
