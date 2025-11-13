const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

// Minimal arg parsing like create_admin.js
const argv = {}
const raw = process.argv.slice(2)
for (let i = 0; i < raw.length; i++) {
  if (raw[i].startsWith('--')) {
    const key = raw[i].slice(2)
    const value = raw[i+1] && !raw[i+1].startsWith('--') ? raw[i+1] : true
    argv[key] = value
    if (value !== true) i++
  }
}

async function resetAdminPassword({ username = 'admin', password, secret, revokeTokens = false }) {
  const prisma = new PrismaClient()
  try {
    if (!username) throw new Error('username required')
    if (!password) throw new Error('password required')

    if (process.env.NODE_ENV === 'production' && process.env.DEV_ADMIN_SECRET !== secret) {
      throw new Error('Not allowed in production without DEV_ADMIN_SECRET')
    }

    // Find user by username
    const user = await prisma.user.findUnique({ where: { username } })
    if (!user) {
      // Create user as admin if not exists
      const hashed = await bcrypt.hash(password, 10)
      const row = await prisma.user.create({ data: { username, password: hashed, email: argv.email || `${username}@example.local`, role: 'admin' } })
      return { created: true, id: row.id }
    }

    // Update password
    const hashed = await bcrypt.hash(password, 10)
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } })

    // Optionally revoke tokens for the user
    let revoked = 0
    if (revokeTokens) {
      const res = await prisma.token.updateMany({ where: { userId: user.id }, data: { revoked: true } })
      revoked = res.count || 0
    }

    return { updated: true, id: user.id, revoked }
  } catch (e) {
    throw e
  } finally {
    try { await prisma.$disconnect() } catch (ignore) {}
  }
}

if (require.main === module) {
  ;(async () => {
    try {
      const { username = 'admin', password, secret } = argv
      const revokeTokens = argv['revoke-tokens'] === true || argv['revoke-tokens'] === 'true'
      const res = await resetAdminPassword({ username, password, secret, revokeTokens })
      if (res.created) {
        console.log(`Admin user '${username}' created with id ${res.id}`)
      } else if (res.updated) {
        console.log(`Password updated for ${username} (id ${res.id}). Revoked tokens: ${res.revoked}`)
      } else {
        console.log('No-op')
      }
      process.exit(0)
    } catch (err) {
      console.error('Error in reset_admin_password:', err.message || err)
      process.exit(1)
    }
  })()
}

module.exports = { resetAdminPassword }
