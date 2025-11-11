const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const bcrypt = require('bcryptjs')

async function main() {
  // Ensure a default state row exists
  const existing = await prisma.state.findUnique({ where: { id: 1 } })
  if (!existing) {
    const defaultState = { version: 1, desktop: { icons: {}, isLocked: true, wallpaper: 'default' }, story: {} }
    await prisma.state.create({ data: { id: 1, data: JSON.stringify(defaultState) } })
  }
  // Add an admin user if none exists, or ensure the password is hashed
  let admin = await prisma.user.findUnique({ where: { username: 'admin' } })
  if (!admin) {
    const hashed = await bcrypt.hash('admin', 10)
    await prisma.user.create({ data: { username: 'admin', email: 'admin@example.local', password: hashed, role: 'admin' } })
  } else {
    // If an admin exists and the password is stored in plaintext, replace it with a hash
    const isHashed = typeof admin.password === 'string' && admin.password.startsWith('$2')
    if (!isHashed) {
    const hashed = await bcrypt.hash('admin', 10)
    await prisma.user.update({ where: { id: admin.id }, data: { password: hashed, email: admin.email || 'admin@example.local' } })
    }
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
