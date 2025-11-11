const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

async function main() {
  const prisma = new PrismaClient()
  try {
    const users = await prisma.user.findMany()
    for (const user of users) {
      if (!user.password || typeof user.password !== 'string') continue
      // bcrypt hashes start with $2a$, $2b$, $2y$ etc.
      if (!user.password.startsWith('$2')) {
        console.log(`Hashing password for user ${user.username}`)
        const hashed = await bcrypt.hash(user.password, 10)
        await prisma.user.update({ where: { id: user.id }, data: { password: hashed } })
      }
    }
    console.log('Migration complete')
  } catch (e) {
    console.error('Migration error', e)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
