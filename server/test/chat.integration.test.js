import request from 'supertest'
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { app, prisma } = require('../index')

describe('Chat integration', () => {
  it('allows authenticated user to post and fetch messages', async () => {
    const username = `chatuser-${Date.now()}`
    const password = 'hunter2'
    // register & login
    const reg = await request(app).post('/api/auth/register').send({ username, password })
    expect(reg.status).toBe(200)
    const login = await request(app).post('/api/auth/login').send({ username, password })
    expect(login.status).toBe(200)
    const token = login.body.access_token
    expect(token).toBeDefined()
    // post message
    const content = 'hello from test'
    const post = await request(app).post('/api/chat').set('Authorization', `Bearer ${token}`).send({ content })
    expect(post.status).toBe(200)
    expect(post.body.content).toBe(content)
    // fetch messages
    const get = await request(app).get('/api/chat').set('Authorization', `Bearer ${token}`)
    expect(get.status).toBe(200)
    expect(Array.isArray(get.body)).toBe(true)
    const found = get.body.find(m => m.content === content)
    expect(found).toBeDefined()
  })
})
