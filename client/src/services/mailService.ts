import { generateId } from '../programs/quest-designer/id'
import type { GameMail, MailFolder, MailService } from '../types/mail'

interface StoredMail extends GameMail {
  folder: MailFolder
}

const STORAGE_KEY = 'terminality:v2:mail'

const seedMail = (): StoredMail[] => [
  {
    id: generateId('mail'),
    from: 'mission@atlas.ops',
    to: 'you@atlas.ops',
    subject: 'Welcome to Terminality Ops',
    body: `Operator,

Welcome aboard. This inbox mirrors the chatter you will receive from Atlas handlers and field contacts.

Stay sharp.
`,
    receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    read: false,
    archived: false,
    tags: ['system'],
    folder: 'inbox'
  },
  {
    id: generateId('mail'),
    from: 'lore@atlas.ops',
    to: 'you@atlas.ops',
    subject: 'Lore Drop » Relay Outpost',
    body: 'Telemetry shows the Relay Outpost is bleeding packets into the void. Might be worth a look.',
    receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    read: true,
    archived: false,
    tags: ['lore'],
    folder: 'inbox'
  }
]

const readStore = (): StoredMail[] => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return seedMail()
  }
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return seedMail()
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return seedMail()
    return parsed
  } catch {
    return seedMail()
  }
}

const writeStore = (records: StoredMail[]) => {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // ignore quota errors for now
  }
}

class LocalMailService implements MailService {
  private cache: StoredMail[]

  constructor() {
    this.cache = readStore()
  }

  private persist(next: StoredMail[]) {
    this.cache = next
    writeStore(this.cache)
  }

  async listMail(folder: MailFolder): Promise<GameMail[]> {
    return this.cache
      .filter(mail => mail.folder === folder)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
      .map(mail => ({ ...mail }))
  }

  async getMail(id: string): Promise<GameMail | null> {
    const found = this.cache.find(mail => mail.id === id)
    return found ? { ...found } : null
  }

  async markRead(id: string, read: boolean): Promise<void> {
    this.persist(
      this.cache.map(mail =>
        mail.id === id
          ? {
            ...mail,
            read
          }
          : mail
      )
    )
  }

  async archiveMail(id: string): Promise<void> {
    this.persist(
      this.cache.map(mail =>
        mail.id === id
          ? {
            ...mail,
            archived: true,
            folder: 'archive'
          }
          : mail
      )
    )
  }

  async sendMail(mail: GameMail, folder?: MailFolder): Promise<void> {
    const targetFolder: MailFolder = folder ?? mail.folder ?? 'inbox'
    const record: StoredMail = {
      ...mail,
      id: mail.id || generateId('mail'),
      receivedAt: mail.receivedAt || new Date().toISOString(),
      read: mail.read ?? false,
      archived: targetFolder === 'archive' ? true : mail.archived ?? false,
      folder: targetFolder
    }
    const next = this.cache.filter(existing => existing.id !== record.id)
    this.persist([...next, record])
  }

  async deleteMail(id: string): Promise<void> {
    const next = this.cache.filter(mail => mail.id !== id)
    if (next.length === this.cache.length) return
    this.persist(next)
  }
}

export const createMailService = (): MailService => new LocalMailService()