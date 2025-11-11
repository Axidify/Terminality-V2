const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const bodyParser = require('body-parser')

const DEFAULT_STATE_PATH = path.join(__dirname, 'state.json')
const DEFAULT_PORT = parseInt(process.env.PORT || '3000', 10)

function readState() {
  try {
    const raw = fs.readFileSync(DEFAULT_STATE_PATH, 'utf8')
    return JSON.parse(raw)
  } catch (e) {
    return { version: 1, desktop: {}, story: {} }
  }
}

function writeState(s) {
  fs.writeFileSync(DEFAULT_STATE_PATH, JSON.stringify(s, null, 2), 'utf8')
}

let savedState = readState()

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

app.get('/api/state', (req, res) => {
  res.json({ session_id: 1, state: savedState })
})

// Basic health endpoint for readiness/liveness checks and monitoring
app.get('/health', (req, res) => {
  const uptime = process.uptime()
  const mem = process.memoryUsage()
  const stateVersion = savedState && savedState.version ? savedState.version : null
  res.json({ status: 'ok', uptime_secs: Math.floor(uptime), mem: { rss: mem.rss }, stateVersion, timestamp: new Date().toISOString() })
})

app.put('/api/state', (req, res) => {
  const incoming = req.body && req.body.state
  if (!incoming) return res.status(400).json({ message: 'state missing' })
  savedState = incoming
  writeState(savedState)
  res.json({ session_id: 1, state: savedState })
})

app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ message: 'Missing username or password' })
  const existing = users.find(u => u.username === username)
  if (existing) return res.status(409).json({ message: 'User exists' })
  const id = users.length + 1
  users.push({ id, username, password, role: 'user' })
  const token = `token-${nextTokenId++}`
  tokens.set(token, id)
  res.json({ token })
})

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {}
  const u = users.find(x => x.username === username && x.password === password)
  if (!u) return res.status(401).json({ message: 'Invalid credentials' })
  const token = `token-${nextTokenId++}`
  tokens.set(token, u.id)
  res.json({ token })
})

app.get('/api/auth/me', (req, res) => {
  const auth = req.headers['authorization'] || ''
  const token = String(auth).replace(/^Bearer\s+/i, '')
  const id = tokens.get(token)
  if (!id) return res.status(401).json({ message: 'Invalid token' })
  const user = users.find(u => u.id === id)
  if (!user) return res.status(401).json({ message: 'Invalid token' })
  res.json({ id: user.id, username: user.username })
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
app.get('/api/admin/users', (req, res) => {
  res.json(users.map(u => ({ id: u.id, username: u.username, role: u.role })))
})

app.patch('/api/admin/users/:id', (req, res) => {
  const id = parseInt(req.params.id, 10)
  const user = users.find(u => u.id === id)
  if (!user) return res.status(404).json({ message: 'Not found' })
  Object.assign(user, req.body)
  res.json(user)
})

app.delete('/api/admin/users/:id', (req, res) => {
  const id = parseInt(req.params.id, 10)
  const idx = users.findIndex(u => u.id === id)
  if (idx === -1) return res.status(404).json({ message: 'Not found' })
  users.splice(idx, 1)
  res.json({ message: 'Deleted' })
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
process.on('SIGINT', () => {
  console.log('[server] SIGINT received, shutting down')
  server.close(() => process.exit(0))
})
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received, shutting down')
  server.close(() => process.exit(0))
})
