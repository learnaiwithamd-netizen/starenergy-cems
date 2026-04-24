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

export function getPrismaClient(): PrismaClient {
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

// Proxy-wrapped singleton. `Reflect.get` is called WITHOUT the receiver argument so
// `this`-binding on PrismaClient methods resolves to the real client, not the Proxy.
// Methods that use `this` (e.g., $transaction, $connect, $on) are explicitly re-bound.
// Without this, the Proxy would receive `this` for internal `this.someField` accesses
// and recurse through `get` for every private field.
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
