import request from 'supertest'
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { app } = require('../index')
const fs = require('fs')
const path = require('path')

async function loginAsAdmin() {
  const username = `sync-admin-${Date.now()}`
  const password = 'sync-pass'
  const createRes = await request(app).post('/api/admin/create').send({ username, password })
  expect(createRes.status).toBe(200)

  const res = await request(app).post('/api/auth/login').send({ username, password })
  expect(res.status).toBe(200)
  expect(res.body.access_token).toBeTruthy()
  return { token: res.body.access_token, username }
}

describe('Changelog sync to file', () => {
  const changelogPath = path.join(__dirname, '..', '..', 'CHANGELOG.md')
  it('admin POST writes entry to CHANGELOG.md and /api/changelog', async () => {
    const { token } = await loginAsAdmin()
    const version = `9.9.${Date.now()}`
    const entryPayload = {
      version,
      date: '2025-11-15',
      summary: 'Sync test summary',
      sections: { added: ['Sync added'], changed: [], fixed: [], breaking: [] },
      tags: [],
      links: []
    }

    const original = fs.readFileSync(changelogPath, 'utf8')
    const createRes = await request(app).post('/api/changelog').set('Authorization', `Bearer ${token}`).send({ entry: entryPayload })
    expect(createRes.status).toBe(200)
    expect(createRes.body.entry.version).toBe(version)

    // Check api/changelog contains new version
    const listRes = await request(app).get('/api/changelog')
    expect(listRes.status).toBe(200)
    expect(listRes.body.latest).toBeTruthy()
    expect(listRes.body.latest.version).toBe(version)

    // Check file contains version header
    const updated = fs.readFileSync(changelogPath, 'utf8')
    expect(updated.includes(`## [${version}] - 2025-11-15`)).toBeTruthy()

    // cleanup
    await request(app).delete(`/api/changelog/${version}`).set('Authorization', `Bearer ${token}`)
    fs.writeFileSync(changelogPath, original, 'utf8')
  })

  it('admin PUT updates existing entry in CHANGELOG.md', async () => {
    const { token } = await loginAsAdmin()
    const version = `9.9.${Date.now()}`
    const entryPayload = {
      version,
      date: '2025-11-15',
      summary: 'Initial summary',
      sections: { added: ['Initial line'], changed: [], fixed: [], breaking: [] },
      tags: [],
      links: []
    }

    const original = fs.readFileSync(changelogPath, 'utf8')
    const createRes = await request(app).post('/api/changelog').set('Authorization', `Bearer ${token}`).send({ entry: entryPayload })
    expect(createRes.status).toBe(200)

    // update
    const updatedPayload = { ...entryPayload, summary: 'Updated sync summary', sections: { added: ['Updated line'], changed: [], fixed: [], breaking: [] } }
    const putRes = await request(app).put(`/api/changelog/${version}`).set('Authorization', `Bearer ${token}`).send({ entry: updatedPayload })
    expect(putRes.status).toBe(200)

    const fileContent = fs.readFileSync(changelogPath, 'utf8')
    expect(fileContent.includes('Updated sync summary') || fileContent.includes('Updated line')).toBeTruthy()

    // cleanup
    await request(app).delete(`/api/changelog/${version}`).set('Authorization', `Bearer ${token}`)
    fs.writeFileSync(changelogPath, original, 'utf8')
  })
})
