// Prisma client is exported here after `pnpm db:generate` runs (Story 0.3).
// For Story 0.1 scaffold, we expose types and context shape only.
// Story 0.3 will replace this with a real PrismaClient singleton + RLS middleware.

export type { RlsContext } from './middleware/rls.js'
export { applyRlsMiddleware } from './middleware/rls.js'

export interface DatabaseConfig {
  url: string
  poolSize?: number
}
