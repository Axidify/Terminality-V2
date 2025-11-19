import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import './EmailApp.css'
import type { GameMail, MailFolder, MailService, MailTag } from '../types/mail'
import type { QuestDefinition } from '../types/quest'
import { createMailService } from '../services/mailService'
import { createQuestStorageService } from './quest-designer/storage'
import { syncQuestMailPreviews } from '../services/questMailSync'
import { QUEST_MAIL_SYNC_EVENT } from '../constants/mail'

type MailQuickFilter = 'unread' | 'quest' | 'lore'

const FOLDERS: Array<{ id: MailFolder; label: string; helper: string }> = [
  { id: 'inbox', label: 'Inbox', helper: 'Briefings, alerts, directives.' },
  { id: 'archive', label: 'Archive', helper: 'Filed but searchable.' },
  { id: 'sent', label: 'Sent', helper: 'Outbound correspondence.' }
]

const FILTERS: Array<{ id: MailQuickFilter; label: string; helper: string }> = [
  { id: 'unread', label: 'Unread', helper: 'Only show fresh intel.' },
  { id: 'quest', label: 'Quest', helper: 'Mission-critical mail.' },
  { id: 'lore', label: 'Lore', helper: 'World-building chatter.' }
]

const TAG_LABELS: Record<MailTag, string> = {
  quest: 'Quest',
  lore: 'Lore',
  system: 'System',
  reward: 'Reward'
}

const formatTimestamp = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const senderDisplayName = (value: string) => {
  const match = value.match(/^(.*)<([^>]+)>$/)
  if (match) return match[1].trim() || match[2].trim()
  return value
}

const bodySnippet = (body: string, limit = 96) => {
  const compact = body.replace(/\s+/g, ' ').trim()
  if (compact.length <= limit) return compact
  return `${compact.slice(0, limit - 1)}…`
}

const mailMatchesFilters = (mail: GameMail, filters: Set<MailQuickFilter>) => {
  if (filters.has('unread') && mail.read) return false
  if (filters.has('quest') && !mail.tags?.includes('quest')) return false
  if (filters.has('lore') && !mail.tags?.includes('lore')) return false
  return true
}

type EmailAppProps = {
  onStartQuest?: (questId: string) => Promise<void> | void
  mailService?: MailService
}

export const EmailApp: React.FC<EmailAppProps> = ({ onStartQuest, mailService }) => {
  const service = useMemo(() => mailService ?? createMailService(), [mailService])
  const questStorage = useMemo(() => createQuestStorageService(), [])
  const mountedRef = useRef(true)
  const [folder, setFolder] = useState<MailFolder>('inbox')
  const folderRef = useRef<MailFolder>('inbox')
  const [filters, setFilters] = useState<Set<MailQuickFilter>>(new Set())
  const [mailByFolder, setMailByFolder] = useState<Record<MailFolder, GameMail[]>>({ inbox: [], archive: [], sent: [] })
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [linkedQuest, setLinkedQuest] = useState<QuestDefinition | null>(null)
  const [questLoading, setQuestLoading] = useState(false)
  const [startingQuest, setStartingQuest] = useState(false)
  const mail = mailByFolder[folder] || []

  useEffect(() => () => { mountedRef.current = false }, [])

  const refreshFolder = useCallback(async (target: MailFolder, busy = false) => {
    if (busy) setLoading(true)
    try {
      const list = await service.listMail(target)
      if (!mountedRef.current) return
      setMailByFolder(prev => ({ ...prev, [target]: list }))
    } finally {
      if (busy && mountedRef.current) setLoading(false)
    }
  }, [service])

  useEffect(() => {
    folderRef.current = folder
  }, [folder])

  useEffect(() => {
    refreshFolder(folder, true).catch(() => {})
    setSelectedId(null)
  }, [folder, refreshFolder])

  useEffect(() => {
    let cancelled = false
    const seedQuestMail = async () => {
      try {
        const quests = await questStorage.listQuests()
        if (cancelled || quests.length === 0) return
        await syncQuestMailPreviews({ quests, mailService: service })
        if (!cancelled) {
          await refreshFolder(folderRef.current)
        }
      } catch {
        // ignore seed errors
      }
    }
    seedQuestMail()
    return () => {
      cancelled = true
    }
  }, [questStorage, service, refreshFolder])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler: EventListener = () => {
      refreshFolder(folderRef.current).catch(() => {})
    }
    window.addEventListener(QUEST_MAIL_SYNC_EVENT, handler)
    return () => window.removeEventListener(QUEST_MAIL_SYNC_EVENT, handler)
  }, [refreshFolder])

  const filteredMail = useMemo(() => mail.filter(entry => mailMatchesFilters(entry, filters)), [mail, filters])
  const selectedMail = useMemo(() => mail.find(entry => entry.id === selectedId) || null, [mail, selectedId])
  const selectedFilteredOut = Boolean(selectedMail && !filteredMail.some(entry => entry.id === selectedMail.id))

  useEffect(() => {
    let cancelled = false
    if (!selectedMail?.questId) {
      setLinkedQuest(null)
      setQuestLoading(false)
      return () => { cancelled = true }
    }
    setQuestLoading(true)
    questStorage.getQuest(selectedMail.questId).then(result => {
      if (cancelled || !mountedRef.current) return
      setLinkedQuest(result ?? null)
    }).finally(() => {
      if (!cancelled && mountedRef.current) setQuestLoading(false)
    })
    return () => { cancelled = true }
  }, [questStorage, selectedMail])

  const toggleFilter = (id: MailQuickFilter) => {
    setFilters(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectMail = async (entry: GameMail) => {
    setSelectedId(entry.id)
    if (!entry.read) {
      await service.markRead(entry.id, true)
      refreshFolder(folder).catch(() => {})
    }
  }

  const handleToggleRead = async (entry: GameMail) => {
    await service.markRead(entry.id, !entry.read)
    refreshFolder(folder).catch(() => {})
  }

  const handleArchive = async (entry: GameMail) => {
    await service.archiveMail(entry.id)
    setSelectedId(null)
    refreshFolder(folder).catch(() => {})
    if (folder !== 'archive') refreshFolder('archive').catch(() => {})
  }

  const handleOpenQuest = (entry?: GameMail | null) => {
    const target = entry ?? selectedMail
    if (!target?.questId) return
    window.location.href = '/designer'
  }

  const handleStartQuest = async (entry?: GameMail | null) => {
    if (!onStartQuest) return
    const target = entry ?? selectedMail
    if (!target?.questId) return
    setStartingQuest(true)
    try {
      await onStartQuest(target.questId)
    } catch {
      // swallow quest start errors for now
    } finally {
      setStartingQuest(false)
    }
  }

  const folderStats = useMemo(() => {
    const stats: Record<MailFolder, { total: number; unread: number }> = {
      inbox: { total: mailByFolder.inbox?.length || 0, unread: mailByFolder.inbox?.filter(m => !m.read).length || 0 },
      archive: { total: mailByFolder.archive?.length || 0, unread: mailByFolder.archive?.filter(m => !m.read).length || 0 },
      sent: { total: mailByFolder.sent?.length || 0, unread: mailByFolder.sent?.filter(m => !m.read).length || 0 }
    }
    return stats
  }, [mailByFolder])

  const filterCounts = useMemo(() => ({
    unread: mail.filter(m => !m.read).length,
    quest: mail.filter(m => m.tags?.includes('quest')).length,
    lore: mail.filter(m => m.tags?.includes('lore')).length
  }), [mail])

  return (
    <div className="email-app">
      <header className="email-app__header">
        <div>
          <p className="email-app__eyebrow">Atlas Secure Courier</p>
          <h1 className="email-app__title">Mission Inbox</h1>
        </div>
        <div className="email-app__status">
          <span>{folderStats.inbox.unread} unread</span>
          <span className="dot" />
          <span>{folderStats.inbox.total} total</span>
        </div>
      </header>

      <div className="email-app__layout">
        <aside className="email-sidebar">
          <h2>Folders</h2>
          <ul>
            {FOLDERS.map(entry => (
              <li key={entry.id}>
                <button
                  type="button"
                  className={entry.id === folder ? 'active' : ''}
                  onClick={() => setFolder(entry.id)}
                >
                  <div>
                    <strong>{entry.label}</strong>
                    <small>{entry.helper}</small>
                  </div>
                  <span className="count">{folderStats[entry.id].unread}/{folderStats[entry.id].total}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="email-filters">
            <h3>Filters</h3>
            {FILTERS.map(filter => (
              <button
                key={filter.id}
                type="button"
                className={filters.has(filter.id) ? 'filter active' : 'filter'}
                onClick={() => toggleFilter(filter.id)}
              >
                <div>
                  <span>{filter.label}</span>
                  <small>{filter.helper}</small>
                </div>
                <span className="count">{filterCounts[filter.id]}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="email-list-panel">
          <div className="email-list-panel__header">
            <div>
              <h2>{folder === 'inbox' ? 'Inbox' : folder === 'archive' ? 'Archive' : 'Sent'}</h2>
              <p>{filteredMail.length} message{filteredMail.length === 1 ? '' : 's'}</p>
            </div>
            {loading && <span className="email-badge">Syncing…</span>}
          </div>
          <div className="email-list" role="list">
            {filteredMail.length === 0 && (
              <div className="email-empty">No mail matches the current filters.</div>
            )}
            {filteredMail.map(entry => (
              <article
                key={entry.id}
                role="listitem"
                className={`email-row ${selectedId === entry.id ? 'selected' : ''} ${entry.read ? 'read' : 'unread'}`}
                onClick={() => handleSelectMail(entry)}
                onDoubleClick={() => handleOpenQuest(entry)}
              >
                <div className="email-row__meta">
                  <span className="email-row__sender">{senderDisplayName(entry.from)}</span>
                  <time>{formatTimestamp(entry.receivedAt)}</time>
                </div>
                <div className="email-row__subject">
                  <span>{entry.subject}</span>
                  <div className="email-row__tags">
                    {entry.tags?.map(tag => (
                      <span key={tag} className={`tag tag-${tag}`}>{TAG_LABELS[tag]}</span>
                    ))}
                  </div>
                </div>
                <p className="email-row__snippet">{bodySnippet(entry.body)}</p>
                <div className="email-row__actions">
                  <button type="button" onClick={evt => { evt.stopPropagation(); handleToggleRead(entry) }}>
                    {entry.read ? 'Mark unread' : 'Mark read'}
                  </button>
                  <button type="button" onClick={evt => { evt.stopPropagation(); handleArchive(entry) }}>
                    Archive
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="email-viewer" aria-live="polite">
          {!selectedMail && (
            <div className="email-viewer__empty">
              <p>Select a message to read its details.</p>
            </div>
          )}
          {selectedMail && (
            <div className="email-viewer__content">
              {selectedFilteredOut && <div className="email-alert">Message hidden in list by current filters.</div>}
              <header>
                <div>
                  <p className="eyebrow">{senderDisplayName(selectedMail.from)}</p>
                  <h2>{selectedMail.subject}</h2>
                </div>
                <div className="viewer-actions">
                  <button type="button" onClick={() => handleToggleRead(selectedMail)}>
                    {selectedMail.read ? 'Mark unread' : 'Mark read'}
                  </button>
                  <button type="button" onClick={() => handleArchive(selectedMail)}>Archive</button>
                </div>
              </header>
              <dl className="email-viewer__meta">
                <div>
                  <dt>From</dt>
                  <dd>{selectedMail.from}</dd>
                </div>
                <div>
                  <dt>To</dt>
                  <dd>{selectedMail.to}</dd>
                </div>
                <div>
                  <dt>Received</dt>
                  <dd>{formatTimestamp(selectedMail.receivedAt)}</dd>
                </div>
              </dl>
              <article className="email-viewer__body">
                {selectedMail.body.split(/\n{2,}/).map((block, index) => (
                  <p key={`${selectedMail.id}-block-${index}`}>{block}</p>
                ))}
              </article>
              {selectedMail.tags && selectedMail.tags.length > 0 && (
                <div className="email-viewer__tags">
                  {selectedMail.tags.map(tag => <span key={tag} className={`tag tag-${tag}`}>{TAG_LABELS[tag]}</span>)}
                </div>
              )}
              {selectedMail.questId && (
                <div className="quest-callout">
                  <header>
                    <p className="eyebrow">Linked quest</p>
                    {questLoading && <span className="email-badge">Loading quest…</span>}
                  </header>
                  <h3>{linkedQuest?.title || 'Unknown quest'}</h3>
                  <p className="quest-status">Status: Not started (dev placeholder)</p>
                  <div className="quest-actions">
                    <button type="button" onClick={() => handleOpenQuest(selectedMail)}>Open quest details</button>
                    <button
                      type="button"
                      className="ghost"
                      disabled={!onStartQuest || questLoading || startingQuest}
                      onClick={() => handleStartQuest(selectedMail)}
                    >
                      {startingQuest ? 'Starting…' : 'Start quest'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
