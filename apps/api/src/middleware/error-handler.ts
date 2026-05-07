import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import type { ProblemDetail } from '@cems/types'
import { ZodError } from 'zod'
import { CalcServiceError } from '../lib/calc-service-client.js'
import { InvalidCredentialsError, RoleNotPermittedError, TokenExpiredError } from '../lib/auth-errors.js'

const PROBLEM_BASE = 'https://cems.starenergy.ca/errors'

const STATUS_TO_SLUG: Record<number, string> = {
  400: 'bad-request',
  401: 'authentication-required',
  403: 'forbidden',
  404: 'not-found',
  409: 'conflict',
  413: 'payload-too-large',
  422: 'validation-error',
  500: 'internal-error',
  503: 'service-unavailable',
}

const STATUS_TO_TITLE: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  422: 'Validation Failed',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
}

function buildProblemDetail(
  status: number,
  detail: string,
  instance: string,
  errors?: Array<{ field: string; message: string }>,
  slugOverride?: string,
): ProblemDetail {
  const slug = slugOverride ?? STATUS_TO_SLUG[status] ?? 'internal-error'
  const title = STATUS_TO_TITLE[status] ?? 'Internal Server Error'
  return {
    type: `${PROBLEM_BASE}/${slug}`,
    title,
    status,
    detail,
    instance,
    ...(errors ? { errors } : {}),
  }
}

/**
 * Global Fastify error handler — every error response is RFC 7807-shaped JSON
 * with `Content-Type: application/problem+json`. Stack traces are NEVER returned
 * in the body; full error logs go to Pino keyed by `request.id` for correlation.
 */
export function buildErrorHandler() {
  return function errorHandler(
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply,
  ): void {
    const instance = request.url

    // Auth-flow expired-token → 401 with token-expired slug. Branch BEFORE
    // the generic 401 mapping so the SPA refresh flow can branch on
    // `problem.type`.
    if (error instanceof TokenExpiredError) {
      const problem = buildProblemDetail(
        401,
        error.message,
        instance,
        undefined,
        'token-expired',
      )
      request.log.warn({ err: error, request_id: request.id }, 'access token expired')
      reply.code(401).type('application/problem+json').send(problem)
      return
    }

    // Auth-flow credential mismatch → 401 with the standard
    // authentication-required slug + the EXACT same body the unknown-email
    // path produces (no enumeration). Caller-supplied detail is overridden
    // here to guarantee the no-leak invariant.
    if (error instanceof InvalidCredentialsError) {
      const problem = buildProblemDetail(401, 'Invalid email or password', instance)
      request.log.warn({ request_id: request.id }, 'login attempt rejected')
      reply.code(401).type('application/problem+json').send(problem)
      return
    }

    // Role-mismatch → 403 with the standard `forbidden` slug + a fixed
    // `Role not permitted` detail. Caller-supplied detail is overridden
    // here to keep the response uniform across all role-guarded routes.
    if (error instanceof RoleNotPermittedError) {
      const problem = buildProblemDetail(403, 'Role not permitted', instance)
      request.log.warn(
        {
          request_id: request.id,
          tenant_id: request.rlsContext?.tenantId ?? null,
          user_role: request.rlsContext?.role ?? null,
          route: request.routeOptions?.url ?? request.url,
        },
        'role guard rejected request',
      )
      reply.code(403).type('application/problem+json').send(problem)
      return
    }

    // Calc-service failures → 503 (timeout / breaker open / upstream error / bad response).
    if (error instanceof CalcServiceError) {
      const problem = buildProblemDetail(
        503,
        'Calculation service is unavailable',
        instance,
      )
      request.log.error(
        { err: error, code: error.code, upstreamStatus: error.upstreamStatus, request_id: request.id },
        'calc-service error',
      )
      reply.code(503).type('application/problem+json').send(problem)
      return
    }

    // Zod validation error → 422 with errors[]
    if (error instanceof ZodError) {
      const problem = buildProblemDetail(
        422,
        'Request payload failed schema validation',
        instance,
        error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      )
      request.log.warn({ err: error, problem }, 'validation error')
      reply.code(422).type('application/problem+json').send(problem)
      return
    }

    // Fastify validation (Ajv via JSON Schema)
    if ((error as FastifyError & { validation?: unknown }).validation) {
      const validation = (error as FastifyError & {
        validation: Array<{ instancePath: string; message?: string }>
      }).validation
      const problem = buildProblemDetail(
        422,
        error.message || 'Request payload failed schema validation',
        instance,
        validation.map((v) => ({ field: v.instancePath || '(root)', message: v.message ?? 'invalid' })),
      )
      request.log.warn({ err: error, problem }, 'validation error')
      reply.code(422).type('application/problem+json').send(problem)
      return
    }

    // @fastify/sensible httpErrors.* expose `statusCode` (401/403/404/409 etc.)
    const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500

    if (status >= 500) {
      request.log.error({ err: error, request_id: request.id }, 'unhandled error')
    } else {
      request.log.warn({ err: error, request_id: request.id }, 'request rejected')
    }

    const problem = buildProblemDetail(
      status,
      // For 5xx, never leak internal error messages to the client.
      status >= 500 ? 'Internal server error' : (error.message || STATUS_TO_TITLE[status] || 'Error'),
      instance,
    )

    reply.code(status).type('application/problem+json').send(problem)
  }
}
