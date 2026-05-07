import type { FastifyInstance } from 'fastify'
import { UserRole } from '@cems/types'
import { requireRole } from '../middleware/role-guard.js'

/**
 * Test-only routes — wired ONLY when NODE_ENV !== 'production'. The caller
 * (apps/api/src/app.ts) gates the registration. These routes exist purely
 * to exercise infrastructure (e.g., the requireRole guard for AC5 of
 * Story 1.2) end-to-end without depending on real domain routes from
 * later stories.
 *
 * Story 1.3 introduces real ADMIN-only routes; at that point this file
 * should be deleted.
 */
export function registerTestRoutes(app: FastifyInstance): void {
  app.get(
    '/api/v1/_test/admin-only',
    {
      schema: { hide: true }, // do NOT appear in OpenAPI docs
      preHandler: requireRole([UserRole.ADMIN]),
    },
    async () => ({ status: 'ok' as const }),
  )
}
