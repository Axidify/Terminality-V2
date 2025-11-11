const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Ensure a default state row exists
  const existing = await prisma.state.findUnique({ where: { id: 1 } })
  if (!existing) {
    const defaultState = { version: 1, desktop: { icons: {}, isLocked: true, wallpaper: 'default' }, story: {} }
    await prisma.state.create({ data: { id: 1, data: JSON.stringify(defaultState) } })
  }
  // Add an admin user if none exists
  const admin = await prisma.user.findUnique({ where: { username: 'admin' } })
  if (!admin) {
    await prisma.user.create({ data: { username: 'admin', password: 'admin', role: 'admin' } })
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
