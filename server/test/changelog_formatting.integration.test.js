import request from 'supertest'
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { app } = require('../index')

async function loginAsAdmin() {
  const username = `format-admin-${Date.now()}`
  const password = 'format-pass'
  const createRes = await request(app).post('/api/admin/create').send({ username, password })
  expect(createRes.status).toBe(200)

  const res = await request(app).post('/api/auth/login').send({ username, password })
  expect(res.status).toBe(200)
  expect(res.body.access_token).toBeTruthy()
  return { token: res.body.access_token, username }
}

describe('Changelog formatting', () => {
  it('strips markdown syntax so stored text is always plain', async () => {
    const { token } = await loginAsAdmin()
    const version = `9.9.${Date.now()}`
    const entryPayload = {
      version,
      date: '2025-11-15',
      summary: 'Ships **bold** and _italic_ support with `code` blocks',
      highlight: 'See **Docs** at [terminality.dev](https://terminality.dev)',
      sections: {
        added: ['Added **bold** formatting'],
        changed: ['Changed _rendering_ path'],
        fixed: ['Fixed `dangerous` sanitization'],
        breaking: []
      },
      tags: ['formatting'],
      links: [{ label: 'Docs', url: 'https://terminality.dev/changelog' }]
    }

    const createRes = await request(app)
      .post('/api/changelog')
      .set('Authorization', `Bearer ${token}`)
      .send({ entry: entryPayload })

    expect(createRes.status).toBe(200)
    expect(createRes.body.entry.summary).toBe('Ships bold and italic support with code blocks')
    expect(createRes.body.entry.highlight).toBe('See Docs at terminality.dev (https://terminality.dev)')
    expect(createRes.body.entry.sections.added[0]).toBe('Added bold formatting')
    expect(createRes.body.entry.sections.changed[0]).toBe('Changed rendering path')
    expect(createRes.body.entry.sections.fixed[0]).toBe('Fixed dangerous sanitization')

    const getRes = await request(app).get(`/api/changelog/${version}`)
    expect(getRes.status).toBe(200)
    expect(getRes.body.entry.summary).toBe('Ships bold and italic support with code blocks')
    expect(getRes.body.entry.sections.added[0]).toBe('Added bold formatting')
    expect(getRes.body.entry.sections.changed[0]).toBe('Changed rendering path')
    expect(getRes.body.entry.sections.fixed[0]).toBe('Fixed dangerous sanitization')

    await request(app)
      .delete(`/api/changelog/${version}`)
      .set('Authorization', `Bearer ${token}`)
  })
})
