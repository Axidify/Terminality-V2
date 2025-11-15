const fs = require('fs')
const path = require('path')

const ECONOMY_FILE = path.join(__dirname, 'data', 'credits-ledger.json')
const MAX_TRANSACTIONS = 500
const DEFAULT_BALANCE = 1000

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function ensureStoreFile() {
  if (fs.existsSync(ECONOMY_FILE)) return
  fs.mkdirSync(path.dirname(ECONOMY_FILE), { recursive: true })
  const bootstrap = {
    version: 1,
    balance: DEFAULT_BALANCE,
    transactions: [createBootstrapTransaction(DEFAULT_BALANCE)],
    lastUpdated: new Date().toISOString()
  }
  fs.writeFileSync(ECONOMY_FILE, JSON.stringify(bootstrap, null, 2), 'utf8')
}

function createBootstrapTransaction(amount) {
  const timestamp = new Date().toISOString()
  return {
    id: `txn_bootstrap_${Date.now()}`,
    amount,
    type: amount >= 0 ? 'credit' : 'debit',
    reason: 'Initial funding',
    balanceAfter: amount,
    timestamp
  }
}

function readStore() {
  ensureStoreFile()
  try {
    const raw = fs.readFileSync(ECONOMY_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    parsed.version = parsed.version || 1
    parsed.balance = typeof parsed.balance === 'number' ? parsed.balance : DEFAULT_BALANCE
    parsed.transactions = Array.isArray(parsed.transactions) ? parsed.transactions : []
    parsed.lastUpdated = parsed.lastUpdated || new Date().toISOString()
    return parsed
  } catch (err) {
    console.warn('[economy] failed to read ledger, resetting', err)
    const fallback = {
      version: 1,
      balance: DEFAULT_BALANCE,
      transactions: [createBootstrapTransaction(DEFAULT_BALANCE)],
      lastUpdated: new Date().toISOString()
    }
    fs.writeFileSync(ECONOMY_FILE, JSON.stringify(fallback, null, 2), 'utf8')
    return fallback
  }
}

function writeStore(store) {
  const payload = {
    version: store.version || 1,
    balance: typeof store.balance === 'number' ? store.balance : DEFAULT_BALANCE,
    transactions: Array.isArray(store.transactions) ? store.transactions.slice(0, MAX_TRANSACTIONS) : [],
    lastUpdated: new Date().toISOString()
  }
  fs.writeFileSync(ECONOMY_FILE, JSON.stringify(payload, null, 2), 'utf8')
  return payload
}

function sanitizeReason(input) {
  if (typeof input !== 'string') return 'Adjustment'
  const trimmed = input.trim()
  if (!trimmed) return 'Adjustment'
  return trimmed.slice(0, 240)
}

function sanitizeMetadata(input) {
  if (!input || typeof input !== 'object') return undefined
  try {
    const cloned = JSON.parse(JSON.stringify(input))
    const serialized = JSON.stringify(cloned)
    if (serialized.length > 3000) {
      return { truncated: true }
    }
    return cloned
  } catch {
    return undefined
  }
}

function getCreditsState() {
  const store = readStore()
  return clone({ balance: store.balance, transactions: store.transactions })
}

function applyTransaction({ amount, reason, metadata, actor, source }) {
  const numericAmount = Number(amount)
  if (!Number.isFinite(numericAmount) || numericAmount === 0) {
    return { errors: ['amount must be a non-zero number.'] }
  }
  const store = readStore()
  const nextBalance = store.balance + numericAmount
  if (nextBalance < 0) {
    return { errors: ['Insufficient credits balance.'] }
  }
  const entry = {
    id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    amount: numericAmount,
    type: numericAmount >= 0 ? 'credit' : 'debit',
    reason: sanitizeReason(reason),
    balanceAfter: nextBalance,
    timestamp: new Date().toISOString(),
    actor: actor || null,
    source: source || null,
    metadata: sanitizeMetadata(metadata)
  }
  store.balance = nextBalance
  store.transactions = [entry, ...(store.transactions || [])].slice(0, MAX_TRANSACTIONS)
  const updated = writeStore(store)
  return { balance: updated.balance, transaction: clone(entry), transactions: clone(updated.transactions) }
}

module.exports = {
  getCreditsState,
  applyTransaction
}
