const { PrismaClient } = require('@prisma/client')
;(async () => {
  const prisma = new PrismaClient()
  const u = await prisma.user.findUnique({ where: { username: 'admin' } })
  console.log(u)
  await prisma.$disconnect()
})()
