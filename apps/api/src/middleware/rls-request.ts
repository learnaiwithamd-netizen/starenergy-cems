import type { FastifyInstance, FastifyRequest } from 'fastify'
import { type Prisma, prisma, withRlsTransaction } from '@cems/db'

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Run a unit of tenant-scoped work inside an RLS-pinned transaction.
     * The callback receives a `Prisma.TransactionClient` — every model and raw
     * query inside `fn` runs on the same connection with SESSION_CONTEXT set
     * from `request.rlsContext`.
     *
     * Throws if the route is public (no rlsContext) — auth middleware should
     * have populated rlsContext before this runs on any non-public route.
     */
    withRls: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>
  }
}

export function registerRlsRequestHook(app: FastifyInstance): void {
  app.decorateRequest('withRls', null as unknown as FastifyRequest['withRls'])

  app.addHook('preHandler', async (request) => {
    request.withRls = (fn) => {
      if (!request.rlsContext) {
        throw new Error(
          'request.withRls invoked on a request without rlsContext. ' +
            'Either the route is public (and should not access tenant data) or auth middleware did not run.',
        )
      }
      return withRlsTransaction(prisma, request.rlsContext, fn)
    }
  })
}
