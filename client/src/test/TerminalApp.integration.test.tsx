import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TerminalApp } from '../programs/TerminalApp'
import { snapshotTerminalSessionState, startQuestSession } from '../programs/terminalRuntime'
import type { QuestDefinition, QuestSystemDefinition } from '../types/quest'

const questSystem: QuestSystemDefinition = {
  id: 'relay-alpha',
  label: 'Atlas Relay Alpha',
  ip: '10.23.4.8',
  difficulty: 'tutorial',
  filesystemRoot: {
    id: 'root',
    name: '/',
    type: 'folder',
    children: [
      {
        id: 'evidence-log',
        name: 'evidence.log',
        type: 'file',
        content: 'Flagged by audit daemon.'
      }
    ]
  },
  doors: [
    {
      id: 'front-gate',
      name: 'front',
      port: 22,
      status: 'guarded'
    }
  ],
  securityRules: {
    maxTrace: 100,
    nervousThreshold: 60,
    panicThreshold: 95,
    nervousEffect: 'log_only',
    panicEffect: 'kick_user',
    actionTraceCosts: {}
  }
}

const sampleQuest: QuestDefinition = {
  id: 'quest_wipe_evidence',
  title: 'Wipe the Evidence',
  shortDescription: 'Clean the relay logs.',
  difficulty: 'tutorial',
  riskProfile: {
    maxRecommendedTrace: 20,
    failAboveTrace: 90
  },
  system: questSystem,
  steps: [
    { id: 'scan', type: 'SCAN_HOST', params: { target_ip: questSystem.ip } },
    { id: 'connect', type: 'CONNECT_HOST', params: { target_ip: questSystem.ip } },
    { id: 'read', type: 'READ_FILE', params: { path: '/evidence.log' } },
    { id: 'delete', type: 'DELETE_FILE', params: { path: '/evidence.log' } },
    { id: 'disconnect', type: 'DISCONNECT_HOST', params: { target_ip: questSystem.ip } }
  ]
}

const buildQuestVariant = (overrides: Partial<QuestDefinition>): QuestDefinition => ({
  ...sampleQuest,
  ...overrides,
  system: overrides.system ?? questSystem,
  riskProfile: overrides.riskProfile ?? sampleQuest.riskProfile
})

const loudQuest = buildQuestVariant({
  id: 'quest_loud_run',
  title: 'Drive It Loud',
  riskProfile: {
    maxRecommendedTrace: 5,
    failAboveTrace: 85
  }
})

const failureQuest = buildQuestVariant({
  id: 'quest_fail_run',
  title: 'Crash And Burn',
  riskProfile: {
    maxRecommendedTrace: 5,
    failAboveTrace: 25
  }
})

const renderTerminal = (overrides: Partial<React.ComponentProps<typeof TerminalApp>> = {}) => (
  render(<TerminalApp quest={sampleQuest} {...overrides} />)
)

const submitCommand = async (input: HTMLInputElement, command: string, expectation: RegExp) => {
  fireEvent.change(input, { target: { value: command } })
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
  await screen.findByText(expectation)
}

describe('TerminalApp runtime integration', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    cleanup()
  })

  it('boots with quest context and renders intro lines', async () => {
    renderTerminal()
    expect(await screen.findByText(/Quest accepted: Wipe the Evidence/)).toBeTruthy()
    expect(screen.getByText(/Target system Atlas Relay Alpha/)).toBeTruthy()
  })

  it('executes commands and emits quest completion callbacks', async () => {
    const onQuestCompleted = vi.fn()
    renderTerminal({ onQuestCompleted })
    const input = screen.getByLabelText<HTMLInputElement>('Terminal command input')
    await submitCommand(input, `scan ${questSystem.ip}`, /Scan complete/i)
    await submitCommand(input, `connect ${questSystem.ip}`, /Connected to/i)
    await submitCommand(input, 'cat /evidence.log', /Flagged by audit daemon/i)
    await submitCommand(input, 'rm /evidence.log', /Deleted \/evidence\.log/i)
    await submitCommand(input, 'disconnect', /Disconnected from/i)

    expect(await screen.findByText(/Quest complete: Wipe the Evidence/)).toBeTruthy()
    expect(await screen.findByText(/Outcome: Ghost Run/)).toBeTruthy()
    expect(onQuestCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ id: sampleQuest.id }),
      expect.objectContaining({ questProgress: expect.objectContaining({ status: 'completed' }) }),
      expect.objectContaining({ outcome: 'stealth' })
    )
  })

  it('debounces snapshot persistence callbacks', async () => {
    vi.useFakeTimers()
    const onSnapshotChange = vi.fn()
    renderTerminal({ onSnapshotChange })
    const input = screen.getByLabelText<HTMLInputElement>('Terminal command input')
    fireEvent.change(input, { target: { value: 'help' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await act(async () => { await vi.advanceTimersByTimeAsync(450) })
    expect(onSnapshotChange).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('supports advanced commands like deep_scan and clean_logs', async () => {
    renderTerminal()
    const input = screen.getByLabelText<HTMLInputElement>('Terminal command input')
    await submitCommand(input, `deep_scan ${questSystem.ip}`, /Deep scan of/)
    await submitCommand(input, `connect ${questSystem.ip}`, /Connected to/i)
    await submitCommand(input, 'clean_logs /evidence.log', /Sanitized logs at/i)
  })

  it('classifies loud runs as success when trace exceeds the stealth window', async () => {
    const onQuestCompleted = vi.fn()
    renderTerminal({ quest: loudQuest, onQuestCompleted })
    const input = screen.getByLabelText<HTMLInputElement>('Terminal command input')
    await submitCommand(input, `scan ${questSystem.ip}`, /Scan complete/i)
    await submitCommand(input, `connect ${questSystem.ip}`, /Connected to/i)
    await submitCommand(input, 'bruteforce front', /Backdoor planted/i)
    await submitCommand(input, 'bruteforce front', /Door already compromised/i)
    await submitCommand(input, 'cat /evidence.log', /Flagged by audit daemon/i)
    await submitCommand(input, 'rm /evidence.log', /Deleted \/evidence\.log/i)
    await submitCommand(input, 'disconnect', /Disconnected from/i)

    expect(await screen.findByText(/Outcome: Success/)).toBeTruthy()
    expect(onQuestCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ id: loudQuest.id }),
      expect.anything(),
      expect.objectContaining({ outcome: 'success' })
    )
  })

  it('marks quests as failures when the trace crosses the panic threshold', async () => {
    const onQuestCompleted = vi.fn()
    renderTerminal({ quest: failureQuest, onQuestCompleted })
    const input = screen.getByLabelText<HTMLInputElement>('Terminal command input')
    await submitCommand(input, `scan ${questSystem.ip}`, /Scan complete/i)
    await submitCommand(input, `connect ${questSystem.ip}`, /Connected to/i)
    await submitCommand(input, 'bruteforce front', /Backdoor planted/i)
    await submitCommand(input, 'bruteforce front', /Door already compromised/i)
    await submitCommand(input, 'bruteforce front', /Door already compromised/i)
    await submitCommand(input, 'cat /evidence.log', /Flagged by audit daemon/i)
    await submitCommand(input, 'rm /evidence.log', /Deleted \/evidence\.log/i)
    await submitCommand(input, 'disconnect', /Disconnected from/i)

    expect(await screen.findByText(/Outcome: Compromised/)).toBeTruthy()
    expect(onQuestCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ id: failureQuest.id }),
      expect.anything(),
      expect.objectContaining({ outcome: 'failure' })
    )
  })

  it('hydrates from a snapshot when provided', async () => {
    const snapshot = snapshotTerminalSessionState(startQuestSession(sampleQuest))
    renderTerminal({ snapshot })
    expect(await screen.findByText(/Quest accepted/)).toBeTruthy()
  })
})
