import React from 'react'

import { QuestDesignerApp } from '../programs/QuestDesignerApp'
import { QuestIcon } from '../os/components/Icons'
import { useUser } from '../os/UserContext'

import './QuestDesignerPage.css'

const navigateToDesktop = () => { window.location.href = '/app' }
const navigateHome = () => { window.location.href = '/' }
const openDocs = () => { window.open('https://github.com/Axidify/Terminality-V2/blob/main/docs/TerminalQuestDesigner.md', '_blank', 'noopener,noreferrer') }

export const QuestDesignerPage: React.FC = () => {
  const { loading, isAdmin } = useUser()

  if (loading) {
    return (
      <div className="quest-designer-page">
        <div className="quest-designer-page__card">
          <span className="quest-designer-page__card-pill">Security Check</span>
          <div className="quest-designer-page__card-icon pulse" aria-hidden="true">
            <QuestIcon size={32} />
          </div>
          <h1>Verifying Clearance</h1>
          <p className="quest-designer-page__card-body">We are authenticating your author permissions and restoring draft data.</p>
          <div className="quest-designer-page__card-meta">
            <span>Session lock enforced</span>
            <span>Local drafts protected</span>
          </div>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="quest-designer-page">
        <div className="quest-designer-page__card">
          <span className="quest-designer-page__card-pill warning">Atlas Development Tools</span>
          <div className="quest-designer-page__card-icon" aria-hidden="true">
            <QuestIcon size={32} />
          </div>
          <h1>Access Restricted</h1>
          <p className="quest-designer-page__card-body">
            Administrator privileges are required to author, publish, or sync quests. Please return to the desktop or request elevated access.
          </p>
          <div className="quest-designer-page__card-meta">
            <span>Role: Investigator</span>
            <span>Status: Read-only</span>
          </div>
          <div className="quest-designer-page__actions">
            <button type="button" onClick={navigateHome}>Return Home</button>
            <button type="button" onClick={navigateToDesktop}>Back to Desktop</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="quest-designer-page">
      <div className="quest-designer-page__grid" aria-hidden="true" />
      <header className="quest-designer-page__header">
        <div className="quest-designer-page__header-left">
          <span className="quest-designer-page__icon"><QuestIcon size={28} /></span>
          <div>
            <p className="quest-designer-page__eyebrow">Atlas Development Tools</p>
            <h1>Quest Designer</h1>
            <p className="quest-designer-page__subtitle">Build, iterate, and validate multi-step operations with a focused authoring workspace.</p>
          </div>
        </div>
        <div className="quest-designer-page__header-actions">
          <button type="button" className="ghost" onClick={openDocs}>Docs</button>
          <button type="button" onClick={navigateToDesktop}>Return to Desktop</button>
        </div>
      </header>
      <section className="quest-designer-page__status">
        <article className="status-card">
          <span className="status-label">Draft Mode</span>
          <strong>Local-first</strong>
          <p>Autosaves to your browser storage before publishing.</p>
        </article>
        <article className="status-card">
          <span className="status-label">Workflow</span>
          <strong>Wizard & Power Views</strong>
          <p>Swap between guided and advanced panels without leaving the page.</p>
        </article>
        <article className="status-card">
          <span className="status-label">Release</span>
          <strong>Mail Sync Ready</strong>
          <p>Quest mail previews stay in sync with the in-game inbox.</p>
        </article>
      </section>
      <div className="quest-designer-page__content">
        <div className="quest-designer-page__app-shell">
          {/* Embed the guided wizard directly into the page by default */}
          <QuestDesignerApp initialWizardOpen wizardMode="inline" />
        </div>
      </div>
    </div>
  )
}
