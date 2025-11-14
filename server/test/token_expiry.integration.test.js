import request from 'supertest'
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { app, prisma } = require('../index')

describe('Token expiry behavior', () => {
  it('rejects expired tokens', async () => {
  // Create a dev admin user and login (hermetic)
  const adminUser = `admin-${Date.now()}`
  const adminPass = 'adminpass'
  await request(app).post('/api/admin/create').send({ username: adminUser, password: adminPass, secret: process.env.DEV_ADMIN_SECRET || undefined })
  const adminLogin = await request(app).post('/api/auth/login').send({ username: adminUser, password: adminPass })
    expect(adminLogin.status).toBe(200)
    const token = adminLogin.body.access_token
    expect(token).toBeDefined()
    // Resolve the real admin user id to avoid assuming it's 1
    const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)
    expect(meRes.status).toBe(200)
    const adminId = meRes.body.id
    // Create an expired token record for the admin; sign a new JWT but set expiresAt in the past in DB
    const payload = { userId: adminId, username: 'admin', role: 'admin' }
    // Generate a token with long expiry; we'll insert it with expired date in DB to simulate expiry
    const jwt = require('jsonwebtoken')
    const localJwt = jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' })
    const past = new Date(Date.now() - 1000 * 60 * 60)
    try {
      await prisma.token.create({ data: { token: localJwt, userId: adminId, expiresAt: past, type: 'session' } })
    } catch (e) {
      if (e && e.code === 'P2002') {
        await prisma.token.update({ where: { token: localJwt }, data: { expiresAt: past } })
      } else throw e
    }
    // try to use it
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${localJwt}`)
    expect(res.status).toBe(401)
  })
})
