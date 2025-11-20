import { describe, expect, it, vi } from 'vitest'

import {
  createTerminalSessionState,
  handleTerminalCommand,
  type TerminalCommandContext,
  type TerminalSessionState
} from '../programs/terminalRuntime'
import type { GameMail, MailService } from '../types/mail'
import type { QuestDefinition } from '../types/quest'
import type { QuestStorageService } from '../programs/quest-designer/storage'

const baseMail: GameMail = {
  id: 'mail_alpha',
  from: 'atlas@ops',
  to: 'you@atlas.ops',
  subject: 'Briefing',
  body: 'Take the contract.',
  receivedAt: '2025-11-19T00:00:00.000Z',
  read: false,
  archived: false,
  folder: 'inbox'
}

const createMockMailService = (mailOverride?: GameMail) => {
  const mailRecord = mailOverride ?? baseMail
  const service: MailService = {
    listMail: vi.fn(async () => [mailRecord]),
    getMail: vi.fn(async () => mailRecord),
    markRead: vi.fn(async () => {}),
    archiveMail: vi.fn(async () => {}),
    sendMail: vi.fn(async () => {}),
    deleteMail: vi.fn(async () => {})
  }
  return service
}

const createMockQuestStorage = (quests: QuestDefinition[]): QuestStorageService => ({
  listQuests: vi.fn(async () => quests),
  getQuest: vi.fn(async (id: string) => quests.find(quest => quest.id === id) ?? null),
  saveQuest: vi.fn(async () => {}),
  deleteQuest: vi.fn(async () => {})
})

const demoQuest: QuestDefinition = {
  id: 'quest_alpha',
  title: 'Alpha Breach',
  shortDescription: 'Test quest for CLI commands.',
  objectiveShort: 'Complete the CLI test flow.',
  difficulty: 'tutorial',
  system: {
    id: 'sys_alpha',
    label: 'Atlas Relay Alpha',
    ip: '10.0.0.7',
    difficulty: 'tutorial',
    doors: [],
    filesystemRoot: {
      id: 'root',
      name: '/',
      type: 'folder',
      children: []
    }
  },
  steps: []
}

describe('terminalRuntime CLI commands', () => {
  const createSession = (overrides?: Partial<TerminalSessionState>) => (
    createTerminalSessionState(overrides)
  )

  it('guides players when scanning without an active contract', async () => {
    const result = await handleTerminalCommand('scan 10.0.0.5', createSession())

    expect(result.newLines[0].text).toContain('No active contract')
    expect(result.newLines.some(line => line.text.includes('quest list'))).toBe(true)
  })

  it('guides players when connecting without an active contract', async () => {
    const result = await handleTerminalCommand('connect 10.0.0.5', createSession())

    expect(result.newLines[0].text).toContain('No active contract')
    expect(result.newLines.some(line => line.text.includes('quest start'))).toBe(true)
  })

  it('lists mail in a folder and caches entries', async () => {
    const mailService = createMockMailService()
    const context: TerminalCommandContext = { mailService }
    const result = await handleTerminalCommand('mail inbox', createSession(), context)

    expect(mailService.listMail).toHaveBeenCalledWith('inbox')
    expect(result.nextState.mailListing?.entries).toHaveLength(1)
    expect(result.newLines.some(line => line.text.includes('Inbox'))).toBe(true)
    expect(result.newLines.some(line => line.text.includes(baseMail.subject))).toBe(true)
  })

  it('opens a mail using cached listing and marks it read', async () => {
    const mailService = createMockMailService()
    const listingSession = createSession({
      mailListing: {
        folder: 'inbox',
        entries: [
          {
            id: baseMail.id,
            subject: baseMail.subject,
            from: baseMail.from,
            receivedAt: baseMail.receivedAt,
            read: false
          }
        ]
      }
    })
    const context: TerminalCommandContext = { mailService }

    const result = await handleTerminalCommand('mail open 1', listingSession, context)

    expect(mailService.getMail).toHaveBeenCalledWith(baseMail.id)
    expect(mailService.markRead).toHaveBeenCalledWith(baseMail.id, true)
    expect(result.nextState.mailListing?.entries[0].read).toBe(true)
    expect(result.newLines.some(line => line.text.includes('Mail 1'))).toBe(true)
    expect(result.newLines.some(line => line.text.includes('----- end message -----'))).toBe(true)
  })

  it('prints contract hint when opening mail linked to a quest', async () => {
    const questMail: GameMail = {
      ...baseMail,
      linkedQuestId: 'quest_alpha',
      subject: 'Operation: Alpha Breach'
    }
    const mailService = createMockMailService(questMail)
    const listingSession = createSession({
      mailListing: {
        folder: 'inbox',
        entries: [
          {
            id: questMail.id,
            subject: questMail.subject,
            from: questMail.from,
            receivedAt: questMail.receivedAt,
            read: false
          }
        ]
      }
    })
    const result = await handleTerminalCommand('mail open 1', listingSession, { mailService })

    expect(result.newLines.some(line => /Contract: quest_alpha/i.test(line.text))).toBe(true)
    expect(result.newLines.some(line => /quest start quest_alpha/i.test(line.text))).toBe(true)
  })

  it('archives a mail and removes it from cached listing', async () => {
    const mailService = createMockMailService()
    const listingSession = createSession({
      mailListing: {
        folder: 'inbox',
        entries: [
          {
            id: baseMail.id,
            subject: baseMail.subject,
            from: baseMail.from,
            receivedAt: baseMail.receivedAt,
            read: false
          }
        ]
      }
    })
    const context: TerminalCommandContext = { mailService }

    const result = await handleTerminalCommand('mail archive 1', listingSession, context)

    expect(mailService.archiveMail).toHaveBeenCalledWith(baseMail.id)
    expect(result.nextState.mailListing?.entries).toHaveLength(0)
    expect(result.newLines.some(line => line.text.includes('Archived message 1'))).toBe(true)
  })

  it('falls back to immersive error when mail service is offline', async () => {
    const result = await handleTerminalCommand('mail inbox', createSession())

    expect(result.newLines.some(line => line.text.includes('Atlas mail system is offline'))).toBe(true)
  })

  it('lists quests and caches summaries', async () => {
    const questStorage = createMockQuestStorage([demoQuest])
    const context: TerminalCommandContext = { questStorage }

    const result = await handleTerminalCommand('quest list', createSession(), context)

    expect(questStorage.listQuests).toHaveBeenCalled()
    expect(result.nextState.questDirectory?.quests).toHaveLength(1)
    expect(result.newLines.some(line => line.text.includes('Available quests: 1'))).toBe(true)
  })

  it('starts a quest and primes the session state', async () => {
    const questStorage = createMockQuestStorage([demoQuest])
    const context: TerminalCommandContext = { questStorage }

    const result = await handleTerminalCommand('quest start quest_alpha', createSession(), context)

    expect(questStorage.getQuest).toHaveBeenCalledWith('quest_alpha')
    expect(result.nextState.quest?.id).toBe('quest_alpha')
    expect(result.newLines.some(line => line.text.includes('Quest accepted: Alpha Breach'))).toBe(true)
    expect(result.newLines.some(line => line.text.includes('Objective: Complete the CLI test flow.'))).toBe(true)
    expect(result.newLines.some(line => line.text.includes('Hint:'))).toBe(true)
    expect(result.newLines.some(line => line.text.includes('scan 10.0.0.7'))).toBe(true)
    expect(result.newLines.some(line => line.text.includes('connect 10.0.0.7'))).toBe(true)
    expect(result.nextState.questObjectiveText).toBe('Complete the CLI test flow.')
  })

  it('falls back to immersive error when quest storage is offline', async () => {
    const result = await handleTerminalCommand('quest list', createSession())

    expect(result.newLines.some(line => line.text.includes('Contract directory is offline'))).toBe(true)
  })

  it('runs scan without args to discover the assigned host', async () => {
    const baseSession = createSession({ quest: demoQuest, system: demoQuest.system ?? undefined })
    const result = await handleTerminalCommand('scan', baseSession)

    expect(result.newLines.some(line => line.text.includes('Scanning'))).toBe(true)
    expect(result.newLines.some(line => line.text.includes('Found 1 host'))).toBe(true)
    expect(result.nextState.scanDiscovery.knownHosts[demoQuest.system!.ip]).toBeDefined()
  })

  it('requires recon tier 2 before allowing --deep scans', async () => {
    const baseSession = createSession({ quest: demoQuest, system: demoQuest.system ?? undefined })
    const result = await handleTerminalCommand('scan --deep', baseSession)

    expect(result.newLines.some(line => /requires recon tier 2/i.test(line.text))).toBe(true)
  })

  it('performs a deep scan when the tier is unlocked', async () => {
    const baseSession = createSession({
      quest: demoQuest,
      system: demoQuest.system ?? undefined,
      toolTiers: { scan: 2 }
    })
    const result = await handleTerminalCommand('scan --deep', baseSession)

    expect(result.newLines.some(line => line.text.includes('Deep scanning'))).toBe(true)
    expect(result.newLines.some(line => line.text.trim().startsWith('security:'))).toBe(true)
    expect(result.nextState.scanDiscovery.knownHosts[demoQuest.system!.ip]?.infoLevel).toBe('deep')
  })

  it('completes scan steps even when target ip is not explicitly set', async () => {
    const questWithScanStep: QuestDefinition = {
      ...demoQuest,
      steps: [{ id: 'scan_step', type: 'SCAN_HOST', description: 'Ping the host' }]
    }
    const session = createSession({ quest: questWithScanStep, system: questWithScanStep.system ?? undefined })
    const result = await handleTerminalCommand('scan', session)

    expect(result.nextState.questProgress?.completedStepIds).toContain('scan_step')
  })

  it('prevents connecting before completing required recon scan', async () => {
    const reconQuest: QuestDefinition = {
      ...demoQuest,
      reconRequirements: {
        enabled: true,
        mustUseScan: true,
        discoveryTargets: [{ hostId: demoQuest.system!.id }]
      }
    }
    const session = createSession({ quest: reconQuest, system: reconQuest.system ?? undefined })
    const result = await handleTerminalCommand(`connect ${reconQuest.system!.ip}`, session)

    expect(result.newLines.some(line => /requires scanning/i.test(line.text))).toBe(true)
    expect(result.nextState.connectedIp).toBeNull()
  })

  it('warns when recon trace cap is exceeded during scan', async () => {
    const reconQuest: QuestDefinition = {
      ...demoQuest,
      reconRequirements: {
        enabled: true,
        mustUseScan: true,
        maxReconTracePercent: 1,
        discoveryTargets: [{ hostId: demoQuest.system!.id }]
      }
    }
    const session = createSession({ quest: reconQuest, system: reconQuest.system ?? undefined })
    const result = await handleTerminalCommand('scan', session)

    expect(result.newLines.some(line => /Recon trace cap/i.test(line.text))).toBe(true)
  })

  it('tracks recon telemetry metrics during scan attempts', async () => {
    const reconQuest: QuestDefinition = {
      ...demoQuest,
      reconRequirements: {
        enabled: true,
        mustUseScan: true,
        maxReconTracePercent: 1,
        allowedRanges: ['10.0.0.7/32'],
        forbiddenRanges: ['192.168.99.0/24'],
        discoveryTargets: [{ hostId: demoQuest.system!.id }]
      }
    }
    const session = createSession({ quest: reconQuest, system: reconQuest.system ?? undefined })
    const firstScan = await handleTerminalCommand('scan', session)
    const telemetryAfterFirst = firstScan.nextState.reconTelemetry

    expect(telemetryAfterFirst?.assignedRangeScanCount).toBe(1)
    expect(telemetryAfterFirst?.offRangeScanCount).toBe(0)
    expect(telemetryAfterFirst?.hostDiscovered).toBe(true)
    expect(telemetryAfterFirst?.maxTracePercentObserved).toBeGreaterThan(0)
    expect(telemetryAfterFirst?.constraint.stayedUnderTraceCap).toBe(false)

    const secondScan = await handleTerminalCommand('scan 192.168.99.0/24', firstScan.nextState)
    const telemetryAfterSecond = secondScan.nextState.reconTelemetry

    expect(telemetryAfterSecond?.offRangeScanCount).toBe(1)
    expect(telemetryAfterSecond?.constraint.avoidedForbiddenRanges).toBe(false)
    expect(telemetryAfterSecond?.constraint.respectedAllowedRanges).toBe(false)
  })

  it('notes must-scan violations in recon telemetry when players try to connect early', async () => {
    const reconQuest: QuestDefinition = {
      ...demoQuest,
      reconRequirements: {
        enabled: true,
        mustUseScan: true,
        discoveryTargets: [{ hostId: demoQuest.system!.id }]
      }
    }
    const session = createSession({ quest: reconQuest, system: reconQuest.system ?? undefined })
    const result = await handleTerminalCommand(`connect ${reconQuest.system!.ip}`, session)

    expect(result.nextState.reconTelemetry?.constraint.honoredMustUseScan).toBe(false)
  })
})
