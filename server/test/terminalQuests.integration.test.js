import request from 'supertest'
import { describe, it, expect, beforeEach } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { app, prisma } = require('../index')

function makePayload(id = `tq_${Date.now()}`) {
  return {
    id,
    title: `Test quest ${id}`,
    description: 'Integration test quest',
    trigger: { type: 'ON_FIRST_TERMINAL_OPEN' },
    steps: [
      { id: 's1', type: 'SCAN_HOST', params: { target_ip: '10.23.4.8' } }
    ],
    rewards: { flags: [{ key: 'reward_flag' }] },
    default_system_id: 'atlas_relay',
    status: 'published'
  }
}

describe('Terminal quests admin', () => {
  // Each test will create its own admin and login to avoid shared state

  it('persists completion_flag when provided', async () => {
    const username = `admin-${Date.now()}`
    await request(app).post('/api/admin/create').send({ username, password: 'pw' })
    const login = await request(app).post('/api/auth/login').send({ username, password: 'pw' })
    expect(login.status).toBe(200)
    const token = login.body.access_token
    expect(token).toBeTruthy()

    const payload = makePayload('quest_flag_test1')
    payload.completion_flag = 'unit_completed_1'

    const res = await request(app).post('/api/terminal-quests').set('Authorization', `Bearer ${token}`).send({ quest: payload })
    expect(res.status).toBe(201)
    expect(res.body.quest.completion_flag).toBe('unit_completed_1')
  })

  it('emits warning when another quest uses the same completion_flag', async () => {
    const username = `admin-${Date.now()}`
    await request(app).post('/api/admin/create').send({ username, password: 'pw' })
    const login = await request(app).post('/api/auth/login').send({ username, password: 'pw' })
    expect(login.status).toBe(200)
    const token = login.body.access_token

    const payloadA = makePayload('quest_flag_test_a')
    payloadA.completion_flag = 'shared_flag'
    const resA = await request(app).post('/api/terminal-quests').set('Authorization', `Bearer ${token}`).send({ quest: payloadA })
    expect(resA.status).toBe(201)

    const payloadB = makePayload('quest_flag_test_b')
    payloadB.completion_flag = 'shared_flag'
    const resB = await request(app).post('/api/terminal-quests').set('Authorization', `Bearer ${token}`).send({ quest: payloadB })
    expect(resB.status).toBe(201)
    expect(Array.isArray(resB.body.warnings)).toBeTruthy()
    expect(resB.body.warnings.some(w => w.includes('Completion flag'))).toBeTruthy()
  })
})
