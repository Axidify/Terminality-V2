// Selects Prisma schema based on env vars.
// Precedence:
// 1) DB_PROVIDER=postgres|postgresql => Postgres
// 2) NODE_ENV=production => Postgres
// 3) default => SQLite (dev)
const fs = require('fs')
const path = require('path')

const root = __dirname
const prismaDir = path.join(root, '..', 'prisma')
const target = path.join(prismaDir, 'schema.prisma')
const provider = String(process.env.DB_PROVIDER || '').toLowerCase()
const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production'

const usePostgres = provider === 'postgres' || provider === 'postgresql' || isProd
const src = usePostgres
  ? path.join(prismaDir, 'schema.postgres.prisma')
  : path.join(prismaDir, 'schema.sqlite.prisma')

try {
  const content = fs.readFileSync(src, 'utf8')
  fs.writeFileSync(target, content, 'utf8')
  console.log(`[prisma] Selected schema: ${path.basename(src)} -> schema.prisma`)
} catch (e) {
  console.error('[prisma] Failed to select schema', e)
  process.exit(0) // do not fail install; prisma commands may still handle defaults
}
