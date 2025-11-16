const fs = require('fs')
const path = require('path')

const MAIL_FILE = path.join(__dirname, 'data', 'terminal-mail.json')
const MAIL_FOLDERS = new Set(['inbox', 'spam', 'news', 'archive'])
const MAIL_CATEGORIES = new Set(['main', 'side', 'lore', 'spam'])
const MAIL_STATUSES = new Set(['draft', 'published'])

const DEFAULT_MAIL_DEFINITIONS = [
  {
    id: 'ops_wipe_evidence',
    status: 'published',
    emailCategory: 'main',
    fromName: 'Atlas Ops',
    fromAddress: 'ops@atlasnet',
    subject: 'Directive: Wipe the Evidence',
    previewLine: 'Remote relay logs picked up your alias. Sanitize the device before audit begins.',
    body: [
      'Operator,',
      '',
      'Telemetry shows a relay in the Atlas outskirts captured your alias on a trace log. Corporate audit will hit the rack in under an hour.',
      '',
      '1) Scan 10.23.4.8 to make sure the relay is still awake.',
      '2) Connect and locate /var/logs/evidence.log.',
      '3) Delete the artifact and clear any shell history you touch.',
      '',
      'No chatter with on-site staff. Once complete, reply with DONE in the terminal log.',
      '',
      '-- Atlas Ops'
    ].join('\n'),
    inUniverseDate: '2089-06-01 14:22',
    folder: 'inbox',
    isUnreadByDefault: true,
    linkedQuestId: 'intro_001_wipe_evidence'
  },
  {
    id: 'sysadmin_maintenance',
    status: 'published',
    emailCategory: 'lore',
    fromName: 'Atlas SysAdmin',
    fromAddress: 'sysadmin@atlasnet',
    subject: 'Scheduled Maintenance Window',
    previewLine: 'Expect intermittent auth hiccups on all relay clusters tonight.',
    body: [
      'Heads up Operators,',
      '',
      'We are cycling firmware on the relay clusters between 02:00 and 04:00 local. Auth tokens may require reissue and remote shells could drop once or twice.',
      '',
      'If you are mid-run, checkpoint and resume after the window. Report any anomalies via the fault form, not over broadcast channels.',
      '',
      '-- Atlas SysAdmin'
    ].join('\n'),
    inUniverseDate: '2089-06-01 03:45',
    folder: 'inbox',
    isUnreadByDefault: true
  },
  {
    id: 'atlas_city_news',
    status: 'published',
    emailCategory: 'lore',
    fromName: 'Atlas City Newswire',
    fromAddress: 'bulletin@atlascity.news',
    subject: 'Weekly Incident Bulletin',
    previewLine: 'Downtown blackout traced to rogue maintenance drone.',
    body: [
      'Atlas City Newswire -- Incident Highlights:',
      '',
      '* Power grid glitch downtown attributed to a rogue maintenance drone.',
      '* Two municipal nodes were found serving counterfeit firmware packages.',
      '* The riverfront AR kiosk now loops a recruitment ad for "Atlas Pioneer Society."',
      '',
      'Full brief attached for those with clearance. Rumor says the Pioneer Society is not recruiting civilians.',
      '',
      '-- Automated Dispatch'
    ].join('\n'),
    inUniverseDate: '2089-05-31 18:05',
    folder: 'news',
    isUnreadByDefault: true
  },
  {
    id: 'spam_warranty',
    status: 'published',
    emailCategory: 'spam',
    fromName: 'Atlas Warranty',
    fromAddress: 'warranty@atlas-extended.biz',
    subject: 'Renew your Cortex Warranty!',
    previewLine: 'Your cortex shield coverage expires today. Act now to avoid downtime.',
    body: [
      'Dear Valued Customer,',
      '',
      'We noticed your Cortex Shield warranty expired 23 minutes ago. Renew now to receive a complimentary anti-static sleeve and priority service badge.',
      '',
      'Visit atlas-extended.biz/renew (requires biometric verification).',
      '',
      'This message auto-destructs in 18 hours or whenever legal approves.',
      '',
      '-- Totally Real Warranty Dept'
    ].join('\n'),
    inUniverseDate: '2089-05-30 09:12',
    folder: 'spam',
    isUnreadByDefault: true
  },
  {
    id: 'atlas_hr_onboarding',
    status: 'published',
    emailCategory: 'side',
    fromName: 'Atlas HR',
    fromAddress: 'hr@atlasnet',
    subject: 'Policy Reminder: Field Conduct',
    previewLine: 'Reminder that unauthorized signal injectors violate section 8.',
    body: [
      'Operator,',
      '',
      'Field reports flagged an uptick in unauthorized signal injectors. Section 8 prohibits personal hardware on municipal networks without clearance.',
      '',
      'We expect you to acknowledge this reminder by week end. Reply ACK via terminal if you understand.',
      '',
      '-- Atlas HR'
    ].join('\n'),
    inUniverseDate: '2089-05-29 11:00',
    folder: 'inbox',
    isUnreadByDefault: true
  }
]

const clone = (value) => JSON.parse(JSON.stringify(value))

function ensureMailFile() {
  if (fs.existsSync(MAIL_FILE)) return
  fs.mkdirSync(path.dirname(MAIL_FILE), { recursive: true })
  const seed = {
    version: 1,
    messages: DEFAULT_MAIL_DEFINITIONS,
    lastUpdated: new Date().toISOString()
  }
  fs.writeFileSync(MAIL_FILE, JSON.stringify(seed, null, 2), 'utf8')
}

function readStore() {
  ensureMailFile()
  try {
    const raw = fs.readFileSync(MAIL_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    const normalized = {
      version: parsed?.version || 1,
      lastUpdated: parsed?.lastUpdated || new Date().toISOString(),
      messages: Array.isArray(parsed?.messages) ? parsed.messages : []
    }
    normalized.messages = normalized.messages.map((entry) => normalizeMail(entry, [], { allowIdReuse: true }).mail)
    return normalized
  } catch (err) {
    console.warn('[terminal-mail] Failed to read mail store, resetting file.', err)
    const fallback = { version: 1, messages: DEFAULT_MAIL_DEFINITIONS, lastUpdated: new Date().toISOString() }
    fs.writeFileSync(MAIL_FILE, JSON.stringify(fallback, null, 2), 'utf8')
    return fallback
  }
}

function writeStore(store) {
  const payload = {
    version: store.version || 1,
    messages: Array.isArray(store.messages) ? store.messages : [],
    lastUpdated: new Date().toISOString()
  }
  fs.writeFileSync(MAIL_FILE, JSON.stringify(payload, null, 2), 'utf8')
  return payload
}

const normalizeId = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed
}

const normalizeText = (value, { max = 500, optional = false } = {}) => {
  if (value == null) return optional ? '' : null
  const text = String(value).trim()
  if (!text) return optional ? '' : null
  return max ? text.slice(0, max) : text
}

const normalizeBody = (value) => {
  if (value == null) return null
  const text = String(value)
  const trimmed = text.trim()
  if (!trimmed) return null
  // Cap to avoid runaway payloads
  return trimmed.slice(0, 20000)
}

const normalizeBoolean = (value, fallback = true) => {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

const normalizeEnum = (value, allowed, fallback) => {
  const token = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return allowed.has(token) ? token : fallback
}

function normalizeMail(input, existing, { allowIdReuse = false } = {}) {
  const errors = []
  const id = normalizeId(input?.id)
  if (!id) errors.push('Mail id is required.')
  if (!allowIdReuse && id && existing.some(entry => entry.id === id)) {
    errors.push(`Mail id ${id} already exists.`)
  }
  const fromName = normalizeText(input?.fromName, { max: 200 })
  if (!fromName) errors.push('fromName is required.')
  const fromAddress = normalizeText(input?.fromAddress, { max: 200 })
  if (!fromAddress) errors.push('fromAddress is required.')
  const subject = normalizeText(input?.subject, { max: 240 })
  if (!subject) errors.push('subject is required.')
  const previewLine = normalizeText(input?.previewLine ?? input?.preview, { max: 400, optional: true })
  const body = normalizeBody(input?.body)
  if (!body) errors.push('body is required.')
  const inUniverseDate = normalizeText(input?.inUniverseDate ?? input?.receivedAt, { max: 120 })
  if (!inUniverseDate) errors.push('inUniverseDate is required.')
  const folder = normalizeEnum(input?.folder, MAIL_FOLDERS, 'inbox')
  const emailCategory = normalizeEnum(input?.emailCategory ?? input?.category, MAIL_CATEGORIES, 'lore')
  const isUnreadByDefault = normalizeBoolean(input?.isUnreadByDefault, true)
  const linkedQuestId = normalizeId(input?.linkedQuestId)
  const status = normalizeEnum(input?.status, MAIL_STATUSES, 'draft')
  const safeBody = body || ''

  const mail = {
    id: id || `mail_${Date.now()}`,
    fromName: fromName || 'Unknown Sender',
    fromAddress: fromAddress || 'noreply@atlasnet',
    subject: subject || 'Untitled',
    previewLine: previewLine ?? safeBody.slice(0, 140),
    body: safeBody,
    inUniverseDate: inUniverseDate || new Date().toISOString(),
    folder,
    emailCategory,
    isUnreadByDefault,
    linkedQuestId: linkedQuestId || null,
    status
  }

  return { mail, errors }
}

function listMail(options = {}) {
  const includeDrafts = Boolean(options.includeDrafts)
  const store = readStore()
  const list = includeDrafts ? store.messages : store.messages.filter(entry => entry.status === 'published')
  return clone(list)
}

function getMailById(id, options = {}) {
  if (!id) return null
  const includeDrafts = Boolean(options.includeDrafts)
  const store = readStore()
  const entry = store.messages.find(message => message.id === id)
  if (!entry) return null
  if (!includeDrafts && entry.status === 'draft') return null
  return clone(entry)
}

function createMail(payload) {
  const store = readStore()
  const { mail, errors } = normalizeMail(payload, store.messages)
  if (errors.length) {
    return { errors }
  }
  store.messages.push(mail)
  const next = writeStore(store)
  return { mail: clone(mail), store: next }
}

function updateMail(id, payload) {
  const store = readStore()
  const idx = store.messages.findIndex(entry => entry.id === id)
  if (idx === -1) {
    return { errors: ['Mail not found.'] }
  }
  const others = store.messages.filter((_, entryIdx) => entryIdx !== idx)
  const { mail, errors } = normalizeMail(payload, others, { allowIdReuse: true })
  if (errors.length) {
    return { errors }
  }
  store.messages[idx] = mail
  const next = writeStore(store)
  return { mail: clone(mail), store: next }
}

function deleteMail(id) {
  const store = readStore()
  const idx = store.messages.findIndex(entry => entry.id === id)
  if (idx === -1) {
    return { errors: ['Mail not found.'] }
  }
  const [removed] = store.messages.splice(idx, 1)
  const next = writeStore(store)
  return { mail: clone(removed), store: next }
}

function validateMailStandalone(payload) {
  const store = readStore()
  const { mail, errors } = normalizeMail(payload, store.messages)
  return { mail, errors }
}

module.exports = {
  listMail,
  getMailById,
  createMail,
  updateMail,
  deleteMail,
  validateMailStandalone
}
