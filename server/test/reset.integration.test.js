import request from 'supertest'
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { app, prisma } = require('../index')

describe('Password reset flow', () => {
  it('requests a reset token and confirms reset', async () => {
    const username = `resetuser-${Date.now()}`
    const password = 'initial'
    // register
    const reg = await request(app).post('/api/auth/register').send({ username, password })
    expect(reg.status).toBe(200)
    // request reset
    const reqRes = await request(app).post('/api/auth/reset/request').send({ username })
    expect(reqRes.status).toBe(200)
    const resetToken = reqRes.body.reset_token
    expect(resetToken).toBeDefined()
    // confirm
    const newPass = 'newpass'
    const conf = await request(app).post('/api/auth/reset/confirm').send({ token: resetToken, password: newPass })
    expect(conf.status).toBe(200)
    // login with new password
    const login = await request(app).post('/api/auth/login').send({ username, password: newPass })
    expect(login.status).toBe(200)
  })

  it('requests reset via email and confirms reset', async () => {
    const username = `resetuser2-${Date.now()}`
    const password = 'initial'
    const email = `${username}@example.local`
    // register with email
    const reg = await request(app).post('/api/auth/register').send({ username, password, email })
    expect(reg.status).toBe(200)
    // request reset via email
    const reqRes = await request(app).post('/api/auth/reset/request').send({ email })
    expect(reqRes.status).toBe(200)
    const resetToken = reqRes.body.reset_token
    expect(resetToken).toBeDefined()
    // confirm
    const newPass = 'newpass2'
    const conf = await request(app).post('/api/auth/reset/confirm').send({ token: resetToken, password: newPass })
    expect(conf.status).toBe(200)
    // login with new password
    const login = await request(app).post('/api/auth/login').send({ username, password: newPass })
    expect(login.status).toBe(200)
  })
})
