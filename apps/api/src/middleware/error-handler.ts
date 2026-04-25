import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import type { ProblemDetail } from '@cems/types'
import { ZodError } from 'zod'

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
): ProblemDetail {
  const slug = STATUS_TO_SLUG[status] ?? 'internal-error'
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
