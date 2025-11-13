import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client')
const { resetAdminPassword } = require('../scripts/reset_admin_password')
const bcrypt = require('bcryptjs')
const request = require('supertest')
const { app } = require('../index')

describe('admin reset script', () => {
  it('creates user if missing and resets password', async () => {
    const prisma = new PrismaClient()
    const username = `testadmin-${Date.now()}`
    const password = 'initialpass'
    const newpass = 'newpass1'

    // Ensure user does not exist
    await prisma.user.deleteMany({ where: { username } }).catch(() => {})

    // Create via resetAdminPassword (should create)
    const createRes = await resetAdminPassword({ username, password })
    expect(createRes.created || createRes.updated).toBeTruthy()

    // Login via api
    const loginResp = await request(app).post('/api/auth/login').send({ username, password })
    expect(loginResp.status).toBe(200)

    // Reset password
    const resetResp = await resetAdminPassword({ username, password: newpass })
    expect(resetResp.updated).toBeTruthy()

    // Login with new password
    const loginNew = await request(app).post('/api/auth/login').send({ username, password: newpass })
    expect(loginNew.status).toBe(200)

    // Cleanup
    await prisma.user.deleteMany({ where: { username } })
    await prisma.$disconnect()
  })
})
