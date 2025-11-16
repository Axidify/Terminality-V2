const fs = require('fs')
const path = require('path')
const systemProfilesStore = require('./systemProfilesStore')

const QUEST_FILE = path.join(__dirname, 'data', 'terminal-quests.json')
const STEP_TYPES = new Set(['SCAN_HOST', 'CONNECT_HOST', 'DELETE_FILE', 'DISCONNECT_HOST'])
const PATH_DEPENDENT_TYPES = new Set(['DELETE_FILE'])
const SYSTEM_REQUIRED_TYPES = new Set(['SCAN_HOST', 'CONNECT_HOST', 'DELETE_FILE', 'DISCONNECT_HOST'])
const TRIGGER_TYPES = new Set(['ON_FIRST_TERMINAL_OPEN', 'ON_QUEST_COMPLETION', 'ON_FLAG_SET'])
const QUEST_STATUSES = new Set(['draft', 'published'])

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function ensureQuestFile() {
  if (fs.existsSync(QUEST_FILE)) return
  fs.mkdirSync(path.dirname(QUEST_FILE), { recursive: true })
  fs.writeFileSync(QUEST_FILE, JSON.stringify({ version: 1, quests: [], lastUpdated: new Date().toISOString() }, null, 2))
}

function readStore() {
  ensureQuestFile()
  try {
    const raw = fs.readFileSync(QUEST_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { version: 1, quests: [], lastUpdated: new Date().toISOString() }
    if (!Array.isArray(parsed.quests)) parsed.quests = []
    parsed.quests = parsed.quests.map((quest) => {
      const normalized = {
        ...quest,
        status: normalizeStatus(quest?.status)
      ,
        completion_flag: typeof quest?.completion_flag === 'string' ? quest.completion_flag.trim() : undefined
      }
      if (normalized?.rewards && Array.isArray(normalized.rewards.flags)) {
        normalized.rewards = {
          ...normalized.rewards,
          flags: normalizeRewardFlags(normalized.rewards.flags)
        }
      }
      return normalized
    })
    parsed.version = parsed.version || 1
    parsed.lastUpdated = parsed.lastUpdated || new Date().toISOString()
    return parsed
  } catch (err) {
    console.warn('[terminal-quests] Failed to read quest store, resetting file.', err)
    const fallback = { version: 1, quests: [], lastUpdated: new Date().toISOString() }
    fs.writeFileSync(QUEST_FILE, JSON.stringify(fallback, null, 2), 'utf8')
    return fallback
  }
}

function writeStore(store) {
  const quests = Array.isArray(store.quests)
    ? store.quests.map(q => ({ ...q, status: normalizeStatus(q.status) === 'published' ? 'published' : 'draft' }))
    : []
  const payload = {
    version: store.version || 1,
    quests,
    lastUpdated: new Date().toISOString()
  }
  fs.writeFileSync(QUEST_FILE, JSON.stringify(payload, null, 2), 'utf8')
  return payload
}

function normalizeId(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed
}

function normalizeText(value, { max = 1000, optional = false } = {}) {
  if (value == null) {
    return optional ? '' : null
  }
  const text = String(value).replace(/\s+/g, ' ').trim()
  if (!text) return optional ? '' : null
  return text.slice(0, max)
}

function normalizeArray(value) {
  if (!Array.isArray(value)) return []
  return value.filter((entry) => typeof entry === 'string' && entry.trim()).map(entry => entry.trim()).slice(0, 50)
}

function normalizeRewardFlagEntry(entry) {
  if (!entry) return null
  if (typeof entry === 'string') {
    const raw = entry.trim()
    if (!raw) return null
    const idx = raw.search(/[:=]/)
    if (idx > 0) {
      const key = raw.slice(0, idx).trim()
      const value = raw.slice(idx + 1).trim()
      if (!key) return null
      return value ? { key, value } : { key }
    }
    return { key: raw }
  }
  if (typeof entry === 'object') {
    const key = normalizeId(entry.key)
    if (!key) return null
    const rawValue = entry.value != null ? String(entry.value).trim() : ''
    return rawValue ? { key, value: rawValue } : { key }
  }
  return null
}

function normalizeRewardFlags(input) {
  if (!Array.isArray(input)) return []
  const seen = new Set()
  const flags = []
  input.forEach(entry => {
    const flag = normalizeRewardFlagEntry(entry)
    if (!flag) return
    const signature = flag.value ? `${flag.key}=${flag.value}` : flag.key
    if (seen.has(signature)) return
    seen.add(signature)
    flags.push(flag)
  })
  return flags.slice(0, 50)
}

function buildFlagTokenSet(flags) {
  if (!Array.isArray(flags)) return new Set()
  const tokens = normalizeRewardFlags(flags).flatMap(flag => (
    flag.value ? [flag.key, `${flag.key}=${flag.value}`] : [flag.key]
  ))
  return new Set(tokens)
}

function normalizeStatus(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return QUEST_STATUSES.has(raw) ? raw : 'draft'
}

function normalizePath(value) {
  if (!value) return '/'
  if (value === '/') return '/'
  return '/' + value.split('/').filter(Boolean).join('/')
}

function dirname(value) {
  if (!value || value === '/') return '/'
  const parts = value.split('/').filter(Boolean)
  parts.pop()
  return parts.length ? `/${parts.join('/')}` : '/'
}

function cloneFilesystem(fsMap) {
  return Object.entries(fsMap || {}).reduce((acc, [pathKey, node]) => {
    acc[pathKey] = { ...node, children: Array.isArray(node.children) ? [...node.children] : undefined }
    return acc
  }, {})
}

function normalizeEmbeddedFilesystems(input) {
  if (!input || typeof input !== 'object') return {}
  const normalized = {}
  Object.entries(input).forEach(([systemId, fsValue]) => {
    if (!systemId) return
    if (!fsValue || typeof fsValue !== 'object') return
    normalized[systemId] = cloneFilesystem(fsValue)
  })
  return normalized
}

function normalizeTrigger(input, errors) {
  const rawType = typeof input?.type === 'string' ? input.type.trim().toUpperCase() : ''
  if (!TRIGGER_TYPES.has(rawType)) {
    errors.push('trigger.type is required and must be a supported trigger.')
    return { type: 'ON_FIRST_TERMINAL_OPEN' }
  }
  if (rawType === 'ON_QUEST_COMPLETION') {
    const questIdsInput = Array.isArray(input?.quest_ids)
      ? input.quest_ids
      : (input?.quest_ids ? [input.quest_ids] : [])
    const candidates = [input?.quest_id, ...questIdsInput]
    const questIds = candidates
      .map(candidate => normalizeId(candidate))
      .filter((value, index, array) => value && array.indexOf(value) === index)
    if (!questIds.length) {
      errors.push('On Quest Completion trigger requires at least one quest id.')
    }
    return { type: rawType, quest_ids: questIds }
  }
  if (rawType === 'ON_FLAG_SET') {
    const flagKey = normalizeId(input?.flag_key)
    if (!flagKey) errors.push('On Flag Set trigger requires a flag key.')
    const rawValue = typeof input?.flag_value === 'string' ? input.flag_value.trim() : undefined
    const flagValue = rawValue ? rawValue.slice(0, 100) : undefined
    return { type: rawType, flag_key: flagKey || undefined, flag_value: flagValue }
  }
  return { type: rawType }
}

function getFilesystemForSystem(systemId, embedded, errors) {
  if (!systemId) {
    errors.push('System id is required for filesystem validation.')
    return null
  }
  if (embedded && embedded[systemId]) {
    return embedded[systemId]
  }
  const profile = systemProfilesStore.getProfileById(systemId)
  if (profile && profile.filesystem) {
    return profile.filesystem
  }
  errors.push(`Unknown system profile '${systemId}'.`)
  return null
}

function ensureDirExists(fsMap, pathValue, errors, context) {
  if (!pathValue) return
  const normalized = normalizePath(pathValue)
  const node = fsMap?.[normalized]
  if (!node || node.type !== 'dir') {
    errors.push(`${context}: directory "${normalized}" does not exist.`)
  }
}

function ensureFileExists(fsMap, pathValue, errors, context) {
  if (!pathValue) return
  const normalized = normalizePath(pathValue)
  const node = fsMap?.[normalized]
  if (!node || node.type !== 'file') {
    errors.push(`${context}: file "${normalized}" does not exist.`)
  }
}

function validateStep(step, index) {
  const errors = []
  const normalizedId = normalizeId(step?.id || `step_${index + 1}`)
  if (!normalizedId) errors.push(`Step ${index + 1} is missing an id.`)
  const type = typeof step?.type === 'string' ? step.type.trim().toUpperCase() : ''
  if (!type || !STEP_TYPES.has(type)) errors.push(`Step ${normalizedId || index + 1} has invalid type.`)
  const params = step?.params && typeof step.params === 'object' ? { ...step.params } : {}
  if (typeof params.file_path === 'string') {
    params.file_path = normalizePath(params.file_path)
  }
  if (typeof params.directory === 'string') {
    params.directory = normalizePath(params.directory)
  }
  if (type === 'SCAN_HOST' || type === 'CONNECT_HOST' || type === 'DISCONNECT_HOST') {
    if (!params.target_ip || typeof params.target_ip !== 'string') {
      errors.push(`Step ${normalizedId} requires params.target_ip.`)
    }
  }
  if (type === 'DELETE_FILE') {
    if (!params.target_ip || typeof params.target_ip !== 'string') {
      errors.push(`Step ${normalizedId} requires params.target_ip.`)
    }
    if (!params.file_path || typeof params.file_path !== 'string') {
      errors.push(`Step ${normalizedId} requires params.file_path.`)
    }
  }
  const hints = step?.hints && typeof step.hints === 'object'
    ? {
        prompt: typeof step.hints.prompt === 'string' ? step.hints.prompt.trim() : undefined,
        command_example: typeof step.hints.command_example === 'string' ? step.hints.command_example.trim() : undefined
      }
    : undefined
  const autoAdvance = step?.auto_advance === undefined ? true : Boolean(step.auto_advance)
  const targetSystemId = typeof step?.target_system_id === 'string' ? step.target_system_id.trim() : undefined
  return {
    step: {
      id: normalizedId || `step_${index + 1}`,
      type,
      target_system_id: targetSystemId,
      params,
      hints,
      auto_advance: autoAdvance
    },
    errors
  }
}

function buildQuestWarnings(quest, storeQuests) {
  const warnings = []
  const knownIds = new Set(storeQuests.map(q => q.id))
  const knownFlags = new Set()
  storeQuests.forEach(q => {
    const tokens = buildFlagTokenSet(q.rewards?.flags)
    tokens.forEach(token => knownFlags.add(token))
  })
  const requirements = quest.requirements || { required_quests: [], required_flags: [] }
  requirements.required_quests?.forEach(req => {
    if (req === quest.id) {
      warnings.push(`Quest cannot depend on itself (${req}).`)
      return
    }
    if (!knownIds.has(req)) {
      warnings.push(`Requirement references unknown quest id ${req}.`)
    }
  })
  const questFlagTokens = buildFlagTokenSet(quest.rewards?.flags)
  // Check completion flags across quests
  const completionFlag = normalizeId(quest.completion_flag)
  if (completionFlag) {
    storeQuests.forEach(q => {
      if (q.id !== quest.id && q.completion_flag && q.completion_flag.trim() === completionFlag) {
        warnings.push(`Completion flag '${completionFlag}' is also used by quest ${q.id}.`)
      }
    })
  }
  requirements.required_flags?.forEach(flag => {
    if (!knownFlags.has(flag) && !questFlagTokens.has(flag)) {
      warnings.push(`Requirement references flag '${flag}' that no quest emits yet.`)
    }
  })
  return warnings
}

function validateQuestPayload(input, storeQuests, { allowIdReuse = false } = {}) {
  const errors = []
  const existing = storeQuests || []
  const questId = normalizeId(input?.id)
  if (!questId) errors.push('id is required.')
  if (!allowIdReuse && questId && existing.some(q => q.id === questId)) {
    errors.push(`Quest id ${questId} already exists.`)
  }
  const title = normalizeText(input?.title, { max: 200 })
  if (!title) errors.push('title is required.')
  const description = normalizeText(input?.description, { max: 2000 })
  if (!description) errors.push('description is required.')
  const trigger = normalizeTrigger(input?.trigger, errors)
  const stepsInput = Array.isArray(input?.steps) ? input.steps : []
  if (!stepsInput.length) errors.push('At least one step is required.')
  const normalizedSteps = []
  const seenStepIds = new Set()
  stepsInput.forEach((step, idx) => {
    const { step: normalized, errors: stepErrors } = validateStep(step, idx)
    if (seenStepIds.has(normalized.id)) {
      stepErrors.push(`Duplicate step id '${normalized.id}'.`)
    }
    seenStepIds.add(normalized.id)
    if (stepErrors.length) {
      errors.push(...stepErrors)
      return
    }
    normalizedSteps.push(normalized)
  })

  const defaultSystemId = normalizeId(input?.default_system_id)
  const embeddedFilesystems = normalizeEmbeddedFilesystems(input?.embedded_filesystems)

  normalizedSteps.forEach((step) => {
    if (!SYSTEM_REQUIRED_TYPES.has(step.type)) return
    const declaredSystem = normalizeId(step.target_system_id)
    const systemId = declaredSystem || defaultSystemId
    if (!systemId) {
      errors.push(`Step ${step.id} requires a target system id.`)
      return
    }
    step.target_system_id = systemId
    const fsMap = getFilesystemForSystem(systemId, embeddedFilesystems, errors)
    if (!fsMap) return
    if (PATH_DEPENDENT_TYPES.has(step.type)) {
      ensureFileExists(fsMap, step.params?.file_path, errors, `Step ${step.id}`)
      if (step.params?.directory) {
        ensureDirExists(fsMap, step.params.directory, errors, `Step ${step.id}`)
      } else if (step.params?.file_path) {
        ensureDirExists(fsMap, dirname(step.params.file_path), errors, `Step ${step.id}`)
      }
    } else if (step.params?.directory) {
      ensureDirExists(fsMap, step.params.directory, errors, `Step ${step.id}`)
    }
  })

  const rewards = input?.rewards && typeof input.rewards === 'object'
    ? {
        xp: typeof input.rewards.xp === 'number' ? input.rewards.xp : undefined,
        flags: normalizeArray(input.rewards.flags),
        unlocks_commands: normalizeArray(input.rewards.unlocks_commands)
      }
    : { xp: undefined, flags: [], unlocks_commands: [] }

  const requirements = input?.requirements && typeof input.requirements === 'object'
    ? {
        required_flags: normalizeArray(input.requirements.required_flags),
        required_quests: normalizeArray(input.requirements.required_quests)
      }
    : { required_flags: [], required_quests: [] }

  const status = normalizeStatus(input?.status)

  if (errors.length) {
    return { errors }
  }

  const quest = {
    id: questId,
    title,
    description,
    trigger,
    steps: normalizedSteps,
    rewards,
    requirements,
    default_system_id: defaultSystemId || undefined,
    embedded_filesystems: Object.keys(embeddedFilesystems).length ? embeddedFilesystems : undefined,
    completion_flag: normalizeId(input?.completion_flag) || undefined,
    status
  }
  const warnings = buildQuestWarnings(quest, existing)
  return { quest, warnings }
}

function listQuests(options = {}) {
  const store = readStore()
  const includeDrafts = Boolean(options.includeDrafts)
  const quests = includeDrafts ? store.quests : store.quests.filter(q => q.status !== 'draft')
  return clone(quests)
}

function getQuestById(id, options = {}) {
  if (!id) return null
  const store = readStore()
  const includeDrafts = Boolean(options.includeDrafts)
  const quest = store.quests.find(q => q.id === id)
  if (!quest) return null
  if (!includeDrafts && quest.status === 'draft') return null
  return clone(quest)
}

function createQuest(payload) {
  const store = readStore()
  const { quest, errors, warnings } = validateQuestPayload(payload, store.quests)
  if (errors && errors.length) {
    return { errors }
  }
  store.quests.push(quest)
  const next = writeStore(store)
  return { quest: clone(quest), warnings, store: next }
}

function updateQuest(id, payload) {
  const store = readStore()
  const idx = store.quests.findIndex(q => q.id === id)
  if (idx === -1) {
    return { errors: ['Quest not found.'] }
  }
  const others = store.quests.filter(q => q.id !== id)
  const { quest, errors, warnings } = validateQuestPayload(payload, others, { allowIdReuse: true })
  if (errors && errors.length) {
    return { errors }
  }
  store.quests[idx] = quest
  const next = writeStore(store)
  return { quest: clone(quest), warnings, store: next }
}

function deleteQuest(id) {
  const store = readStore()
  const idx = store.quests.findIndex(q => q.id === id)
  if (idx === -1) {
    return { errors: ['Quest not found.'] }
  }
  const [removed] = store.quests.splice(idx, 1)
  const next = writeStore(store)
  return { quest: clone(removed), store: next }
}

function validateQuestStandalone(payload) {
  const store = readStore()
  return validateQuestPayload(payload, store.quests)
}

module.exports = {
  listQuests,
  getQuestById,
  createQuest,
  updateQuest,
  deleteQuest,
  validateQuestPayload,
  validateQuestStandalone
}
