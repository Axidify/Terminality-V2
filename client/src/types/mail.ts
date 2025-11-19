export type MailTag = 'quest' | 'lore' | 'system' | 'reward'

export type MailFolder = 'inbox' | 'archive' | 'sent'

export interface GameMail {
  id: string
  from: string
  to: string
  subject: string
  body: string
  receivedAt: string
  read: boolean
  archived: boolean
  tags?: MailTag[]
  questId?: string
  type?: 'intro' | 'completion' | 'generic'
  folder?: MailFolder
}

export interface MailService {
  listMail(folder: MailFolder): Promise<GameMail[]>
  getMail(id: string): Promise<GameMail | null>
  markRead(id: string, read: boolean): Promise<void>
  archiveMail(id: string): Promise<void>
  sendMail(mail: GameMail, folder?: MailFolder): Promise<void>
  deleteMail(id: string): Promise<void>
}
