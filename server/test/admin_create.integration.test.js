import request from 'supertest'
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { app, prisma } = require('../index')

describe('Admin create endpoint', () => {
  it('can create and promote admin in dev', async () => {
    // Run the create endpoint without secret in test mode
    const username = `dev-admin-${Date.now()}`
    const res = await request(app).post('/api/admin/create').send({ username, password: 'p' })
    expect(res.status).toBe(200)
    expect(res.body.username).toBe(username)
    expect(res.body.role).toBe('admin')
    // ensure the user is now in the users list with role admin
    const adminLogin = await request(app).post('/api/auth/login').send({ username, password: 'p' })
    expect(adminLogin.status).toBe(200)
  const token = adminLogin.body.access_token
    const adminUsers = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`)
    expect(adminUsers.status).toBe(200)
  })
})
