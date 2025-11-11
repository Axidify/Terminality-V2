import request from 'supertest'
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { app, prisma } = require('../index')

describe('State integration tests', () => {
  it('GET /api/state requires auth', async () => {
    const res = await request(app).get('/api/state')
    expect(res.status).toBe(401)
  })

  it('GET /api/state returns state with auth', async () => {
    // register and login to obtain token
    const username = `stateuser-${Date.now()}`
    const password = 'hunter2'
    await request(app).post('/api/auth/register').send({ username, password })
    const login = await request(app).post('/api/auth/login').send({ username, password })
    const token = login.body.access_token
    const res = await request(app).get('/api/state').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.state).toBeDefined()
  })

  it('PUT /api/state should update state with auth', async () => {
    const username = `stateuser2-${Date.now()}`
    const password = 'hunter2'
    await request(app).post('/api/auth/register').send({ username, password })
    const login = await request(app).post('/api/auth/login').send({ username, password })
    const token = login.body.access_token
    const newState = { version: 999, desktop: { isLocked: false } }
    const res = await request(app).put('/api/state').set('Authorization', `Bearer ${token}`).send({ state: newState })
    expect(res.status).toBe(200)
    expect(res.body.state.version).toBe(999)
    const res2 = await request(app).get('/api/state').set('Authorization', `Bearer ${token}`)
    expect(res2.body.state.version).toBe(999)
  })
})
