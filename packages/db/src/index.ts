import { PrismaClient } from '@prisma/client'
import { PrismaMssql } from '@prisma/adapter-mssql'

export type { RlsContext } from './middleware/rls.js'
export { RlsContextError, withRlsContext, withRlsTransaction } from './middleware/rls.js'
export type { Prisma } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var __cemsPrisma: PrismaClient | undefined
}

// Lazy singleton — only instantiated on first access so import side-effects don't crash
// when DATABASE_URL isn't set (unit tests, type-check, CI builds).
let _prisma: PrismaClient | undefined

export function getPrismaClient(): PrismaClient {
  if (_prisma) return _prisma
  if (globalThis.__cemsPrisma) {
    _prisma = globalThis.__cemsPrisma
    return _prisma
  }
  const url = process.env['DATABASE_URL']
  if (!url) {
    throw new Error('DATABASE_URL is not set. Configure it in .env or via deployment env vars.')
  }
  // Prisma 7 requires either a driver adapter or no options at all (the latter still
  // requires CLI-time URL discovery via prisma.config.ts, not runtime). The driver
  // adapter is the supported runtime path for Prisma 7 with SQL Server.
  const adapter = new PrismaMssql(url)
  _prisma = new PrismaClient({ adapter })
  if (process.env['NODE_ENV'] !== 'production') {
    globalThis.__cemsPrisma = _prisma
  }
  return _prisma
}

// Proxy-wrapped singleton. `Reflect.get` is called WITHOUT the receiver argument so
// `this`-binding on PrismaClient methods resolves to the real client, not the Proxy.
// Methods that use `this` (e.g., $transaction, $connect, $on) are explicitly re-bound.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient()
    const value = Reflect.get(client, prop)
    return typeof value === 'function' ? value.bind(client) : value
  },
  has(_target, prop) {
    return prop in getPrismaClient()
  },
})

export { PrismaClient }
