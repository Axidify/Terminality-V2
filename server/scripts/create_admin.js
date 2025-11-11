const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
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

(async () => {
  const prisma = new PrismaClient()
  try {
    const { username = 'admin', password = 'admin', secret } = argv
    if (process.env.NODE_ENV === 'production' && process.env.DEV_ADMIN_SECRET !== secret) {
      console.error('Not allowed in production without DEV_ADMIN_SECRET')
      process.exit(1)
    }
  const user = await prisma.user.findUnique({ where: { username } })
    if (user) {
      console.log(`User ${username} already exists; promoting to admin`) 
      await prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } })
      console.log('Promoted')
    } else {
      const hashed = await bcrypt.hash(password, 10)
      await prisma.user.create({ data: { username, email: argv.email || `${username}@example.local`, password: hashed, role: 'admin' } })
      console.log('Admin created')
    }
  } catch (e) {
    console.error('Error creating admin', e)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
})()
