const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const bodyParser = require('body-parser')

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
app.use(bodyParser.json())

// Simple in-memory users and tokens (for dev only)
const users = [{ id: 1, username: 'player1', password: 'password', role: 'user' }, { id: 2, username: 'admin', password: 'admin', role: 'admin' }]
const tokens = new Map() // token -> userId
let nextTokenId = 1

app.get('/api/state', async (req, res) => {
  try {
    if (!savedState) savedState = await readState()
    res.json({ session_id: 1, state: savedState })
  } catch (e) {
    console.error('[api/state][get] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Basic health endpoint for readiness/liveness checks and monitoring
app.get('/health', (req, res) => {
  const uptime = process.uptime()
  const mem = process.memoryUsage()
  const stateVersion = savedState && savedState.version ? savedState.version : null
  res.json({ status: 'ok', uptime_secs: Math.floor(uptime), mem: { rss: mem.rss }, stateVersion, timestamp: new Date().toISOString() })
})

app.put('/api/state', async (req, res) => {
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
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ message: 'Missing username or password' })
  try {
    if (prisma) {
      const existing = await prisma.user.findUnique({ where: { username } })
      if (existing) return res.status(409).json({ message: 'User exists' })
      const created = await prisma.user.create({ data: { username, password, role: 'user' } })
      const token = `token-${Date.now()}-${created.id}`
      await prisma.token.create({ data: { token, userId: created.id } })
      return res.json({ token })
    }
    const existing = users.find(u => u.username === username)
    if (existing) return res.status(409).json({ message: 'User exists' })
    const id = users.length + 1
    users.push({ id, username, password, role: 'user' })
    const token = `token-${nextTokenId++}`
    tokens.set(token, id)
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
      if (!user || user.password !== password) return res.status(401).json({ message: 'Invalid credentials' })
      const token = `token-${Date.now()}-${user.id}`
      await prisma.token.create({ data: { token, userId: user.id } })
      return res.json({ token })
    }
    const u = users.find(x => x.username === username && x.password === password)
    if (!u) return res.status(401).json({ message: 'Invalid credentials' })
    const token = `token-${nextTokenId++}`
    tokens.set(token, u.id)
    res.json({ token })
  } catch (e) {
    console.error('[auth][login] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

app.get('/api/auth/me', async (req, res) => {
  const auth = req.headers['authorization'] || ''
  const token = String(auth).replace(/^Bearer\s+/i, '')
  try {
    if (prisma) {
      const tk = await prisma.token.findUnique({ where: { token }, include: { user: true } })
      if (!tk || !tk.user) return res.status(401).json({ message: 'Invalid token' })
      return res.json({ id: tk.user.id, username: tk.user.username })
    }
    const id = tokens.get(token)
    if (!id) return res.status(401).json({ message: 'Invalid token' })
    const user = users.find(u => u.id === id)
    if (!user) return res.status(401).json({ message: 'Invalid token' })
    res.json({ id: user.id, username: user.username })
  } catch (e) {
    console.error('[auth][me] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/command', (req, res) => {
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

// Admin endpoints (basic)
app.get('/api/admin/users', async (req, res) => {
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

app.patch('/api/admin/users/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  try {
    if (prisma) {
      const user = await prisma.user.update({ where: { id }, data: req.body })
      return res.json({ id: user.id, username: user.username, role: user.role })
    }
    const user = users.find(u => u.id === id)
    if (!user) return res.status(404).json({ message: 'Not found' })
    Object.assign(user, req.body)
    res.json(user)
  } catch (e) {
    console.error('[admin][user][patch] error', e)
    res.status(500).json({ message: 'Server error' })
  }
})

app.delete('/api/admin/users/:id', async (req, res) => {
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

// fallback
app.use((req, res) => {
  res.status(404).json({ message: 'Not found' })
})

const server = app.listen(DEFAULT_PORT, () => {
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

// Graceful shutdown so nodemon restarts cleanly
process.on('SIGINT', async () => {
  console.log('[server] SIGINT received, shutting down')
  try { if (prisma) await prisma.$disconnect() } catch (e) { /* ignore */ }
  server.close(() => process.exit(0))
})
process.on('SIGTERM', async () => {
  console.log('[server] SIGTERM received, shutting down')
  try { if (prisma) await prisma.$disconnect() } catch (e) { /* ignore */ }
  server.close(() => process.exit(0))
})
