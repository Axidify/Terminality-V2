export type MailFolder = 'inbox' | 'news' | 'spam' | 'archive'
export type MailCategory = 'main' | 'side' | 'lore' | 'spam'

export interface MailMessageDefinition {
  id: string
  fromName: string
  fromAddress: string
  subject: string
  previewLine?: string
  body: string
  inUniverseDate: string
  folder: MailFolder
  emailCategory: MailCategory
  isUnreadByDefault?: boolean
  linkedQuestId?: string | null
  status?: 'draft' | 'published'
}

export interface SerializedMailState {
  deliveredIds?: string[]
  readIds?: string[]
  archivedIds?: string[]
  deletedIds?: string[]
}

export interface MailEngineState {
  deliveredIds: string[]
  readIds: string[]
  archivedIds: string[]
  deletedIds: string[]
}

export interface MailListEntry extends MailMessageDefinition {
  read: boolean
  archived: boolean
  deleted: boolean
}

export interface MailFilterOptions {
  unreadOnly?: boolean
  sender?: string
  search?: string
  includeArchived?: boolean
  includeDeleted?: boolean
  folder?: MailFolder
  category?: MailCategory
}

const MAIL_FOLDERS: MailFolder[] = ['inbox', 'news', 'spam', 'archive']
const MAIL_CATEGORIES: MailCategory[] = ['main', 'side', 'lore', 'spam']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const DEFAULT_MAIL_DEFINITIONS: MailMessageDefinition[] = [
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
    isUnreadByDefault: true,
    linkedQuestId: null
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
    isUnreadByDefault: true,
    linkedQuestId: null
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
    isUnreadByDefault: true,
    linkedQuestId: null
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
    isUnreadByDefault: true,
    linkedQuestId: null
  }
]

let mailDefinitions: MailMessageDefinition[] = []

const normalizeMailIds = (ids?: string[] | null, limit = 200): string[] => {
  if (!Array.isArray(ids) || !ids.length) return []
  const seen = new Set<string>()
  const normalized: string[] = []
  ids.forEach(id => {
    if (typeof id !== 'string') return
    const trimmed = id.trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    normalized.push(trimmed)
  })
  return limit > 0 ? normalized.slice(0, limit) : normalized
}

const normalizeMailIdInput = (value?: string | string[] | null): string[] => {
  if (!value) return []
  if (Array.isArray(value)) return normalizeMailIds(value)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? [trimmed] : []
  }
  return []
}

const fallbackPreview = (body: string): string => {
  const line = body.split(/\r?\n/).find(entry => entry.trim().length > 0)
  return line ? line.slice(0, 140) : body.slice(0, 140)
}

const asMailFolder = (value: string | undefined): MailFolder => (
  MAIL_FOLDERS.includes(value as MailFolder) ? value as MailFolder : 'inbox'
)

const asMailCategory = (value: string | undefined): MailCategory => (
  MAIL_CATEGORIES.includes(value as MailCategory) ? value as MailCategory : 'lore'
)

const normalizeMailDefinition = (input: MailMessageDefinition, seed = Date.now()) => {
  const id = input.id?.trim() || `mail_${seed}`
  const body = typeof input.body === 'string' ? input.body : ''
  return {
    id,
    fromName: input.fromName?.trim() || 'Unknown Sender',
    fromAddress: input.fromAddress?.trim() || 'noreply@atlasnet',
    subject: input.subject?.trim() || 'Untitled',
    previewLine: input.previewLine?.trim() || fallbackPreview(body),
    body,
    inUniverseDate: input.inUniverseDate?.trim() || new Date().toISOString().slice(0, 16).replace('T', ' '),
    folder: asMailFolder(input.folder),
    emailCategory: asMailCategory(input.emailCategory),
    isUnreadByDefault: input.isUnreadByDefault !== false,
    linkedQuestId: input.linkedQuestId ?? null,
    status: input.status || 'draft'
  }
}

const applyMailDefinitions = (definitions: MailMessageDefinition[]) => {
  const seen = new Set<string>()
  const normalized: MailMessageDefinition[] = []
  const stamp = Date.now()
  definitions.forEach((entry, idx) => {
    const mail = normalizeMailDefinition(entry, stamp + idx)
    if (seen.has(mail.id)) return
    seen.add(mail.id)
    normalized.push(mail)
  })
  mailDefinitions = normalized
}

export const setMailDefinitions = (definitions?: MailMessageDefinition[]): void => {
  if (!Array.isArray(definitions) || !definitions.length) {
    applyMailDefinitions(DEFAULT_MAIL_DEFINITIONS)
    return
  }
  applyMailDefinitions(definitions)
}

applyMailDefinitions(DEFAULT_MAIL_DEFINITIONS)

export const createMailEngineState = (): MailEngineState => ({
  deliveredIds: [],
  readIds: [],
  archivedIds: [],
  deletedIds: []
})

const filterByDelivered = (ids: string[], deliveredSet: Set<string>): string[] => ids.filter(id => deliveredSet.has(id))

export const hydrateMailState = (serialized?: SerializedMailState | null): MailEngineState => {
  if (!serialized) return createMailEngineState()
  const deliveredIds = normalizeMailIds(serialized.deliveredIds)
  const deliveredSet = new Set(deliveredIds)
  return {
    deliveredIds,
    readIds: filterByDelivered(normalizeMailIds(serialized.readIds), deliveredSet),
    archivedIds: filterByDelivered(normalizeMailIds(serialized.archivedIds), deliveredSet),
    deletedIds: filterByDelivered(normalizeMailIds(serialized.deletedIds), deliveredSet)
  }
}

export const serializeMailState = (state: MailEngineState): SerializedMailState => ({
  deliveredIds: [...state.deliveredIds],
  readIds: [...state.readIds],
  archivedIds: [...state.archivedIds],
  deletedIds: [...state.deletedIds]
})

const parseMailDate = (value: string): Date | null => {
  if (!value) return null
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

const clampMailDateLabel = (label: string): string => {
  if (label.length >= 12) return label.slice(0, 12)
  return label.padEnd(12, ' ')
}

export const formatMailDateLabel = (value: string): string => {
  const date = parseMailDate(value)
  if (!date) return clampMailDateLabel(value || 'Unknown')
  const month = MONTH_LABELS[date.getMonth()] || '???'
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${month} ${day} ${hours}:${minutes}`
}

export const formatMailTimestamp = (value: string): string => {
  const date = parseMailDate(value)
  if (!date) return value || 'Unknown date'
  const month = MONTH_LABELS[date.getMonth()] || '???'
  const day = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${month} ${day}, ${year} ${hours}:${minutes}`
}

const definitionsReady = () => mailDefinitions.length > 0

const toMailListEntry = (
  definition: MailMessageDefinition,
  readSet: Set<string>,
  archivedSet: Set<string>,
  deletedSet: Set<string>
): MailListEntry => ({
  ...definition,
  previewLine: definition.previewLine || fallbackPreview(definition.body),
  read: readSet.has(definition.id),
  archived: archivedSet.has(definition.id),
  deleted: deletedSet.has(definition.id)
})

export function ensureMailDelivered(state: MailEngineState, ids?: string | string[] | null): MailEngineState {
  const deliveredSet = new Set(state.deliveredIds)
  const readSet = new Set(state.readIds)
  const archivedSet = new Set(state.archivedIds)
  const deletedSet = new Set(state.deletedIds)

  const extraIds = normalizeMailIdInput(ids)
  const autoDeliverPublished = arguments.length < 2
  if (autoDeliverPublished && definitionsReady()) {
    mailDefinitions.forEach(def => {
      if (def.status === 'draft') return
      deliveredSet.add(def.id)
    })
  }
  extraIds.forEach(id => deliveredSet.add(id))

  const deliveredIds = Array.from(deliveredSet)
  const readIds = filterByDelivered([...readSet], deliveredSet)
  const archivedIds = filterByDelivered([...archivedSet], deliveredSet)
  const deletedIds = filterByDelivered([...deletedSet], deliveredSet)

  if (
    deliveredIds.length === state.deliveredIds.length &&
    readIds.length === state.readIds.length &&
    archivedIds.length === state.archivedIds.length &&
    deletedIds.length === state.deletedIds.length &&
    deliveredIds.every((id, idx) => id === state.deliveredIds[idx]) &&
    readIds.every((id, idx) => id === state.readIds[idx]) &&
    archivedIds.every((id, idx) => id === state.archivedIds[idx]) &&
    deletedIds.every((id, idx) => id === state.deletedIds[idx])
  ) {
    return state
  }

  return { deliveredIds, readIds, archivedIds, deletedIds }
}

export const markMailRead = (state: MailEngineState, id: string): MailEngineState => {
  if (!id) return state
  const deliveredSet = new Set(state.deliveredIds)
  deliveredSet.add(id)
  const readSet = new Set(state.readIds)
  if (readSet.has(id) && deliveredSet.size === state.deliveredIds.length) {
    return state
  }
  readSet.add(id)
  const deliveredIds = Array.from(deliveredSet)
  return {
    deliveredIds,
    readIds: Array.from(readSet),
    archivedIds: filterByDelivered(state.archivedIds, deliveredSet),
    deletedIds: filterByDelivered(state.deletedIds, deliveredSet)
  }
}

export const buildMailList = (state: MailEngineState, filters: MailFilterOptions = {}): MailListEntry[] => {
  if (!definitionsReady()) return []
  const deliveredSet = new Set(state.deliveredIds)
  if (!deliveredSet.size) return []
  const readSet = new Set(state.readIds)
  const archivedSet = new Set(state.archivedIds)
  const deletedSet = new Set(state.deletedIds)
  const includeArchived = Boolean(filters.includeArchived)
  const includeDeleted = Boolean(filters.includeDeleted)
  const senderTerm = filters.sender?.trim().toLowerCase()
  const searchTerm = filters.search?.trim().toLowerCase()

  const matchesSender = (entry: MailMessageDefinition) => {
    if (!senderTerm) return true
    return entry.fromName.toLowerCase().includes(senderTerm) || entry.fromAddress.toLowerCase().includes(senderTerm)
  }

  const matchesSearch = (entry: MailMessageDefinition) => {
    if (!searchTerm) return true
    const haystack = [entry.subject, entry.previewLine || '', entry.body, entry.fromName, entry.fromAddress]
    return haystack.some(value => value?.toLowerCase().includes(searchTerm))
  }

  const entries = mailDefinitions
    .filter(def => deliveredSet.has(def.id))
    .map(def => toMailListEntry(def, readSet, archivedSet, deletedSet))
    .filter(entry => includeDeleted || !entry.deleted)
    .filter(entry => includeArchived || !entry.archived)
    .filter(entry => (filters.folder ? entry.folder === filters.folder : true))
    .filter(entry => (filters.category ? entry.emailCategory === filters.category : true))
    .filter(entry => matchesSender(entry))
    .filter(entry => matchesSearch(entry))
    .filter(entry => (filters.unreadOnly ? !entry.read : true))
    .sort((a, b) => {
      const aDate = parseMailDate(a.inUniverseDate)?.getTime() ?? 0
      const bDate = parseMailDate(b.inUniverseDate)?.getTime() ?? 0
      return bDate - aDate
    })

  return entries
}

export const countUnreadMail = (state: MailEngineState): number => (
  buildMailList(state).filter(entry => !entry.read).length
)
