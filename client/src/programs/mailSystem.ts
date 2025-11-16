import type { QuestDefinition } from './terminalQuests/types'

export type EmailId = string
export type MailFolder = 'inbox' | 'spam' | 'news' | 'archive'
export type MailCategory = 'main' | 'side' | 'lore' | 'spam'

export interface GameEmail {
  id: EmailId
  fromName: string
  fromAddress: string
  subject: string
  previewLine?: string
  body: string
  inUniverseDate: string
  folder: MailFolder
  isUnreadByDefault: boolean
  linkedQuestId?: QuestDefinition['id'] | null
  emailCategory?: MailCategory
  status?: 'draft' | 'published'
}

export type MailMessageDefinition = GameEmail

export interface MailListEntry extends GameEmail {
  read: boolean
  archived: boolean
  deleted: boolean
}

export interface MailEngineState {
  deliveredIds: EmailId[]
  readIds: EmailId[]
  archivedIds: EmailId[]
  deletedIds: EmailId[]
}

export interface SerializedMailState {
  deliveredIds?: EmailId[]
  readIds?: EmailId[]
  archivedIds?: EmailId[]
  deletedIds?: EmailId[]
}

export interface MailFilterOptions {
  unreadOnly?: boolean
  sender?: string
  search?: string
  includeArchived?: boolean
  includeDeleted?: boolean
}

const DEFAULT_MAIL_MESSAGES: GameEmail[] = [
  {
    id: 'ops_wipe_evidence',
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
      '— Atlas Ops'
    ].join('\n'),
    inUniverseDate: '2089-06-01 14:22',
    folder: 'inbox',
    isUnreadByDefault: true,
    linkedQuestId: 'intro_001_wipe_evidence',
    status: 'published'
  },
  {
    id: 'sysadmin_maintenance',
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
      '— Atlas SysAdmin'
    ].join('\n'),
    inUniverseDate: '2089-06-01 03:45',
    folder: 'inbox',
    isUnreadByDefault: true,
    status: 'published'
  },
  {
    id: 'atlas_city_news',
    emailCategory: 'lore',
    fromName: 'Atlas City Newswire',
    fromAddress: 'bulletin@atlascity.news',
    subject: 'Weekly Incident Bulletin',
    previewLine: 'Downtown blackout traced to rogue maintenance drone.',
    body: [
      'Atlas City Newswire — Incident Highlights:',
      '',
      '* Power grid glitch downtown attributed to a rogue maintenance drone.',
      '* Two municipal nodes were found serving counterfeit firmware packages.',
      '* The riverfront AR kiosk now loops a recruitment ad for “Atlas Pioneer Society.”',
      '',
      'Full brief attached for those with clearance. Rumor says the Pioneer Society is not recruiting civilians.',
      '',
      '— Automated Dispatch'
    ].join('\n'),
    inUniverseDate: '2089-05-31 18:05',
    folder: 'news',
    isUnreadByDefault: true,
    status: 'published'
  },
  {
    id: 'spam_warranty',
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
      '— Totally Real Warranty Dept'
    ].join('\n'),
    inUniverseDate: '2089-05-30 09:12',
    folder: 'spam',
    isUnreadByDefault: true,
    status: 'published'
  },
  {
    id: 'atlas_hr_onboarding',
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
      '— Atlas HR'
    ].join('\n'),
    inUniverseDate: '2089-05-29 11:00',
    folder: 'inbox',
    isUnreadByDefault: true,
    status: 'published'
  }
]

let MAIL_DEFINITIONS: GameEmail[] = [...DEFAULT_MAIL_MESSAGES]
const MAIL_INDEX = new Map<EmailId, GameEmail>()

const dedupe = (list?: EmailId[]) => {
  if (!list?.length) return []
  const seen = new Set<EmailId>()
  const out: EmailId[] = []
  list.forEach(entry => {
    const token = entry?.trim()
    if (!token || seen.has(token)) return
    seen.add(token)
    out.push(token)
  })
  return out
}

const generateId = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `mail_${Math.random().toString(36).slice(2, 9)}`)

const normalizeEmail = (entry: Partial<GameEmail> & { sender?: { name?: string; email?: string } }): GameEmail => {
  const id = entry.id?.trim() || generateId()
  const subject = entry.subject?.trim() || 'Untitled'
  const fromName = entry.fromName?.trim() || entry.sender?.name?.trim() || 'Unknown Sender'
  const fromAddress = entry.fromAddress?.trim() || entry.sender?.email?.trim() || 'noreply@atlasnet'
  const body = entry.body || ''
  const previewLine = entry.previewLine ?? (entry as any).preview ?? body.slice(0, 120)
  const inUniverseDate = entry.inUniverseDate || (entry as any).receivedAt || new Date().toISOString()
  const folder: MailFolder = entry.folder || 'inbox'
  const isUnreadByDefault = entry.isUnreadByDefault ?? true
  const linkedQuestId = entry.linkedQuestId === undefined ? (entry as any).relatedQuest : entry.linkedQuestId
  const category = entry.emailCategory || (entry as any).category || 'lore'
  return {
    id,
    fromName,
    fromAddress,
    subject,
    previewLine,
    body,
    inUniverseDate,
    folder,
    isUnreadByDefault,
    linkedQuestId: linkedQuestId || null,
    emailCategory: category as MailCategory
  }
}

const hydrateDefinitions = (definitions: GameEmail[]) => {
  MAIL_INDEX.clear()
  MAIL_DEFINITIONS = (definitions?.length ? definitions : DEFAULT_MAIL_MESSAGES).map(normalizeEmail)
  MAIL_DEFINITIONS.forEach(def => MAIL_INDEX.set(def.id, def))
}

hydrateDefinitions(DEFAULT_MAIL_MESSAGES)

const defaultDeliveredIds = () => MAIL_DEFINITIONS.map(def => def.id)
const defaultReadIds = () => MAIL_DEFINITIONS.filter(def => !def.isUnreadByDefault).map(def => def.id)

export const setMailDefinitions = (definitions: GameEmail[]) => {
  hydrateDefinitions(Array.isArray(definitions) && definitions.length ? definitions : DEFAULT_MAIL_MESSAGES)
}

export const getMailDefinitions = () => MAIL_DEFINITIONS
export const getMailById = (id: EmailId) => MAIL_INDEX.get(id)

export const createMailEngineState = (): MailEngineState => ({
  deliveredIds: defaultDeliveredIds(),
  readIds: defaultReadIds(),
  archivedIds: [],
  deletedIds: []
})

export const hydrateMailState = (serialized?: SerializedMailState | null): MailEngineState => ({
  deliveredIds: serialized?.deliveredIds?.length ? dedupe(serialized.deliveredIds) : defaultDeliveredIds(),
  readIds: serialized?.readIds?.length ? dedupe(serialized.readIds) : defaultReadIds(),
  archivedIds: dedupe(serialized?.archivedIds),
  deletedIds: dedupe(serialized?.deletedIds)
})

export const serializeMailState = (state: MailEngineState): SerializedMailState => ({
  deliveredIds: [...state.deliveredIds],
  readIds: [...state.readIds],
  archivedIds: [...state.archivedIds],
  deletedIds: [...state.deletedIds]
})

export const ensureMailDelivered = (state: MailEngineState, ids?: EmailId[]): MailEngineState => {
  const targetIds = ids?.length ? ids : MAIL_DEFINITIONS.map(def => def.id)
  const delivered = new Set(state.deliveredIds)
  let changed = false
  targetIds.forEach(id => {
    if (delivered.has(id)) return
    delivered.add(id)
    changed = true
  })
  return changed ? { ...state, deliveredIds: Array.from(delivered) } : state
}

export const countUnreadMail = (state: MailEngineState, includeArchived = false): number => {
  if (!MAIL_DEFINITIONS.length) return 0
  const delivered = new Set(state.deliveredIds)
  const archived = includeArchived ? new Set<EmailId>() : new Set(state.archivedIds)
  const deleted = new Set(state.deletedIds)
  const read = new Set(state.readIds)
  return MAIL_DEFINITIONS.reduce((count, def) => {
    if (!delivered.has(def.id)) return count
    if (deleted.has(def.id)) return count
    if (!includeArchived && archived.has(def.id)) return count
    const isUnread = def.isUnreadByDefault && !read.has(def.id)
    return isUnread ? count + 1 : count
  }, 0)
}

const matchesSenderFilter = (entry: GameEmail, filter?: string): boolean => {
  if (!filter) return true
  const normalized = filter.trim().toLowerCase()
  if (!normalized) return true
  return entry.fromName.toLowerCase().includes(normalized) || entry.fromAddress.toLowerCase().includes(normalized)
}

const matchesSearch = (entry: GameEmail, term?: string): boolean => {
  if (!term) return true
  const normalized = term.trim().toLowerCase()
  if (!normalized) return true
  return (
    entry.subject.toLowerCase().includes(normalized) ||
    entry.body.toLowerCase().includes(normalized) ||
    (entry.previewLine || '').toLowerCase().includes(normalized)
  )
}

const parseDate = (value: string): number => {
  const dt = new Date(value)
  const ts = dt.getTime()
  if (Number.isNaN(ts)) return Number.MIN_SAFE_INTEGER
  return ts
}

export const buildMailList = (state: MailEngineState, filters?: MailFilterOptions): MailListEntry[] => {
  const deliveredSet = new Set(state.deliveredIds)
  const archivedSet = new Set(state.archivedIds)
  const deletedSet = new Set(state.deletedIds)
  const readSet = new Set(state.readIds)
  return MAIL_DEFINITIONS
    .filter(entry => deliveredSet.has(entry.id))
    .map<MailListEntry>(entry => ({
      ...entry,
      read: readSet.has(entry.id) || !entry.isUnreadByDefault,
      archived: archivedSet.has(entry.id),
      deleted: deletedSet.has(entry.id)
    }))
    .filter(entry => {
      if (!filters?.includeDeleted && entry.deleted) return false
      if (!filters?.includeArchived && entry.archived) return false
      if (filters?.unreadOnly && entry.read) return false
      if (!matchesSenderFilter(entry, filters?.sender)) return false
      if (!matchesSearch(entry, filters?.search)) return false
      return true
    })
    .sort((a, b) => parseDate(b.inUniverseDate) - parseDate(a.inUniverseDate))
}

export const markMailRead = (state: MailEngineState, id: EmailId): MailEngineState => {
  if (!id || state.readIds.includes(id)) return state
  return {
    ...state,
    readIds: [...state.readIds, id]
  }
}

export const formatMailDateLabel = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toISOString().slice(0, 10)
}

export const formatMailTimestamp = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 19)}`
}
