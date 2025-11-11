import request from 'supertest'
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { app, prisma } = require('../index')

describe('Auth integration', () => {
  it('registers, logs in, returns me and allows logout', async () => {
    const username = `testuser-${Date.now()}`
    const password = 'hunter2'
    // register
    const reg = await request(app).post('/api/auth/register').send({ username, password })
    expect(reg.status).toBe(200)
  expect(reg.body.access_token).toBeDefined()
    // login
    const login = await request(app).post('/api/auth/login').send({ username, password })
    expect(login.status).toBe(200)
  const token = login.body.access_token
    expect(token).toBeDefined()
    // me
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)
    expect(me.status).toBe(200)
    expect(me.body.username).toBe(username)
    // logout
    const logout = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`)
    expect(logout.status).toBe(200)
    const me2 = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)
    expect(me2.status).toBe(401)
  })

  it('admin endpoint is restricted to admin role', async () => {
    // Create admin user (dev-only) so test is hermetic
  const adminUser = `admin-${Date.now()}`
  const adminPass = 'adminpass'
  await request(app).post('/api/admin/create').send({ username: adminUser, password: adminPass })
  const adminLogin = await request(app).post('/api/auth/login').send({ username: adminUser, password: adminPass })
    expect(adminLogin.status).toBe(200)
  const token = adminLogin.body.access_token
    expect(token).toBeDefined()
    const users = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`)
    expect(users.status).toBe(200)
    expect(Array.isArray(users.body)).toBe(true)
    // Non-admin cannot access
  const username = `testuser2-${Date.now()}`
  const password = 'hunter2'
    await request(app).post('/api/auth/register').send({ username, password })
    const login2 = await request(app).post('/api/auth/login').send({ username, password })
  const token2 = login2.body.access_token
    const bad = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token2}`)
    expect(bad.status).toBe(403)
  })

  it('allows user to update password via profile', async () => {
    const username = `profileuser-${Date.now()}`
    const password = 'oldpass'
    await request(app).post('/api/auth/register').send({ username, password })
    const login = await request(app).post('/api/auth/login').send({ username, password })
    expect(login.status).toBe(200)
    const token = login.body.access_token
    const res = await request(app).patch('/api/auth/me').set('Authorization', `Bearer ${token}`).send({ oldPassword: password, password: 'newpass' })
    expect(res.status).toBe(200)
    // login with new password
    const login2 = await request(app).post('/api/auth/login').send({ username, password: 'newpass' })
    expect(login2.status).toBe(200)
  })
})
