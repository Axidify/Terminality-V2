import request from 'supertest'
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { app } = require('../index')

function buildQuestPayload(slug) {
  return {
    slug,
    codename: 'OPERATION UNIT TEST',
    tagline: 'Exercise the quest creation pipeline.',
    summary: 'Integration test quest used to verify the quest admin API.',
    difficulty: 'story',
    status: 'published',
    stageOrder: ['briefing', 'investigation', 'infiltration', 'decryption', 'complete'],
    objectives: [
      { id: 'brief', text: 'Read the briefing.', stage: 'briefing' },
      { id: 'hack', text: 'Hack the only relay.', stage: 'infiltration' }
    ],
    nodes: [
      {
        id: 'relay-alpha',
        label: 'Relay Alpha',
        description: 'Simple relay used for tests.',
        exposures: ['Test exposure'],
        requiredTool: 'unit-scan',
        puzzleId: 'test-cipher'
      }
    ],
    puzzles: [
      {
        id: 'test-cipher',
        type: 'cipher',
        prompt: 'Decode TEST by shifting back one letter.',
        solution: 'SDSR',
        hints: ['Shift backwards by one character.'],
        reward: 'Intel: SHIFT-1'
      }
    ],
    finaleCipher: {
      id: 'finale',
      type: 'logic',
      prompt: 'Combine intel to answer YES.',
      solution: 'YES',
      hints: ['Answer YES.'],
      reward: 'Extraction confirmed.'
    }
  }
}

describe('Quest admin API', () => {
  it('allows admins to create quests that become publicly readable once published', async () => {
    const username = `quest-admin-${Date.now()}`
    await request(app).post('/api/admin/create').send({ username, password: 'pass1234' })
    const login = await request(app).post('/api/auth/login').send({ username, password: 'pass1234' })
    expect(login.status).toBe(200)
    const token = login.body.access_token
    expect(token).toBeTruthy()

    const slug = `unit-quest-${Date.now()}`
    const questPayload = buildQuestPayload(slug)
    const createRes = await request(app)
      .post('/api/admin/quests')
      .set('Authorization', `Bearer ${token}`)
      .send(questPayload)
    expect(createRes.status).toBe(201)
    expect(createRes.body.quest.slug).toBe(slug)
    expect(createRes.body.quest.objectives).toHaveLength(2)

    const publicRes = await request(app).get(`/api/quests/${slug}`)
    expect(publicRes.status).toBe(200)
    expect(publicRes.body.quest.codename).toBe('OPERATION UNIT TEST')
    expect(publicRes.body.quest.finaleCipher.id).toBe('finale')
  })
})
