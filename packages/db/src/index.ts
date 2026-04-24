import { PrismaClient } from '@prisma/client'

export type { RlsContext } from './middleware/rls.js'
export { RlsContextError, withRlsContext } from './middleware/rls.js'

declare global {
  // eslint-disable-next-line no-var
  var __cemsPrisma: PrismaClient | undefined
}

// Lazy singleton — only instantiated on first access so import side-effects don't crash
// when DATABASE_URL isn't set (unit tests, type-check, CI builds).
let _prisma: PrismaClient | undefined

function getPrisma(): PrismaClient {
  if (_prisma) return _prisma
  if (globalThis.__cemsPrisma) {
    _prisma = globalThis.__cemsPrisma
    return _prisma
  }
  _prisma = new PrismaClient()
  if (process.env['NODE_ENV'] !== 'production') {
    globalThis.__cemsPrisma = _prisma
  }
  return _prisma
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrisma(), prop, receiver)
  },
})

export { PrismaClient }
