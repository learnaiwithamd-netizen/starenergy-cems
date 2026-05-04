/**
 * HTTP client for the Python calc-service.
 *
 * - 30s per-request timeout (architecture mandate; Story 0.4 § Calc Service)
 * - Circuit breaker via opossum: opens after 50% failure rate over 60s,
 *   half-opens 30s after open, closes on first half-open success.
 * - Validates every response against the Zod mirrors so a Pydantic↔Zod
 *   schema drift fails loudly via `BAD_RESPONSE` rather than silently
 *   feeding bad data downstream.
 *
 * Errors are thrown as `CalcServiceError`; the API global error handler
 * maps them to RFC 7807 503 responses (slug `service-unavailable`).
 */

import CircuitBreaker from 'opossum'
import type { ZodType } from 'zod'
import { logger } from './logger.js'
import {
  baselineRequestSchema,
  baselineResponseSchema,
  ecmRequestSchema,
  ecmResponseSchema,
  refrigerantRequestSchema,
  refrigerantResponseSchema,
  type BaselineRequest,
  type BaselineResponse,
  type EcmRequest,
  type EcmResponse,
  type RefrigerantRequest,
  type RefrigerantResponse,
} from './calc-service-schemas.js'

export type CalcServiceErrorCode =
  | 'TIMEOUT'
  | 'CIRCUIT_OPEN'
  | 'BAD_RESPONSE'
  | 'UPSTREAM_ERROR'
  | 'CONFIG_ERROR'

export class CalcServiceError extends Error {
  public readonly code: CalcServiceErrorCode
  public readonly upstreamStatus?: number
  public override readonly cause?: unknown

  constructor(
    code: CalcServiceErrorCode,
    message: string,
    options: { upstreamStatus?: number; cause?: unknown } = {},
  ) {
    super(message)
    this.name = 'CalcServiceError'
    this.code = code
    if (options.upstreamStatus !== undefined) {
      this.upstreamStatus = options.upstreamStatus
    }
    if (options.cause !== undefined) {
      this.cause = options.cause
    }
  }
}

const DEFAULT_TIMEOUT_MS = 30_000

// Opossum 8.x typings expect a function with at most one arg-shape; we
// pass a single `{ path, requestSchema, responseSchema, body }` object
// to keep the breaker generic across endpoints.
interface CallParams<Req, Res> {
  path: '/calculate/ecm' | '/calculate/baseline' | '/calculate/refrigerant'
  body: Req
  requestSchema: ZodType<Req>
  responseSchema: ZodType<Res>
}

let _baseUrl: string | undefined
let _breaker:
  | CircuitBreaker<[CallParams<unknown, unknown>], unknown>
  | undefined

function getBaseUrl(): string {
  if (_baseUrl) return _baseUrl
  const url = process.env['CALC_SERVICE_URL']
  if (!url || url.length === 0) {
    throw new CalcServiceError(
      'CONFIG_ERROR',
      'CALC_SERVICE_URL is not set',
    )
  }
  _baseUrl = url.replace(/\/$/, '')
  return _baseUrl
}

async function rawCall<Req, Res>(
  params: CallParams<Req, Res>,
): Promise<Res> {
  const validatedReq = params.requestSchema.parse(params.body)
  const url = `${getBaseUrl()}${params.path}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validatedReq),
      signal: controller.signal,
    })
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === 'AbortError' ||
        // Node's undici fetch nests the cause as DOMException.
        (err as { cause?: { name?: string } }).cause?.name === 'AbortError')
    ) {
      throw new CalcServiceError('TIMEOUT', `calc-service ${params.path} timed out after ${DEFAULT_TIMEOUT_MS}ms`, {
        cause: err,
      })
    }
    throw new CalcServiceError(
      'UPSTREAM_ERROR',
      `calc-service ${params.path} fetch failed`,
      { cause: err },
    )
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    throw new CalcServiceError(
      'UPSTREAM_ERROR',
      `calc-service ${params.path} returned ${response.status}`,
      { upstreamStatus: response.status },
    )
  }

  let parsed: unknown
  try {
    parsed = await response.json()
  } catch (err) {
    throw new CalcServiceError(
      'BAD_RESPONSE',
      `calc-service ${params.path} returned non-JSON body`,
      { cause: err },
    )
  }

  const result = params.responseSchema.safeParse(parsed)
  if (!result.success) {
    throw new CalcServiceError(
      'BAD_RESPONSE',
      `calc-service ${params.path} response failed schema validation`,
      { cause: result.error },
    )
  }
  return result.data
}

function getBreaker(): CircuitBreaker<[CallParams<unknown, unknown>], unknown> {
  if (_breaker) return _breaker
  _breaker = new CircuitBreaker(rawCall as (p: CallParams<unknown, unknown>) => Promise<unknown>, {
    // AbortController in rawCall is the only timeout — disable opossum's
    // own timer so timeout-classification is unambiguous (TIMEOUT, never
    // a stray opossum TimeoutError that falls through to UPSTREAM_ERROR).
    timeout: false,
    // Honor AC 5 spec: open after at least 5 calls with ≥50% errors.
    // volumeThreshold=5 enforces the "minimum 5 calls" semantics so the
    // breaker cannot open on a single early failure.
    volumeThreshold: 5,
    errorThresholdPercentage: 50,
    resetTimeout: 30_000,
    rollingCountTimeout: 60_000,
    rollingCountBuckets: 10,
    name: 'calc-service',
  })
  _breaker.on('open', () =>
    logger.warn({ event: 'calc-circuit:open', breaker: 'calc-service' }, 'calc-service breaker opened'),
  )
  _breaker.on('halfOpen', () =>
    logger.info({ event: 'calc-circuit:half-open', breaker: 'calc-service' }, 'calc-service breaker half-open'),
  )
  _breaker.on('close', () =>
    logger.info({ event: 'calc-circuit:closed', breaker: 'calc-service' }, 'calc-service breaker closed'),
  )
  return _breaker
}

async function callBreaker<Req, Res>(params: CallParams<Req, Res>): Promise<Res> {
  const breaker = getBreaker()
  try {
    return (await breaker.fire(params as CallParams<unknown, unknown>)) as Res
  } catch (err) {
    if (err instanceof CalcServiceError) throw err
    // Opossum tags its breaker-open rejection with code EOPENBREAKER.
    // String-matching err.message is brittle across versions; check the
    // breaker's own state as a fallback for older opossum builds.
    const errCode = (err as { code?: string }).code
    if (errCode === 'EOPENBREAKER' || breaker.opened) {
      throw new CalcServiceError(
        'CIRCUIT_OPEN',
        `calc-service circuit breaker is open`,
        { cause: err },
      )
    }
    throw new CalcServiceError(
      'UPSTREAM_ERROR',
      `calc-service unexpected error`,
      { cause: err },
    )
  }
}

export async function calculateEcm(req: EcmRequest): Promise<EcmResponse> {
  return callBreaker({
    path: '/calculate/ecm',
    body: req,
    requestSchema: ecmRequestSchema,
    responseSchema: ecmResponseSchema,
  })
}

export async function calculateBaseline(req: BaselineRequest): Promise<BaselineResponse> {
  return callBreaker({
    path: '/calculate/baseline',
    body: req,
    requestSchema: baselineRequestSchema,
    responseSchema: baselineResponseSchema,
  })
}

export async function calculateRefrigerant(
  req: RefrigerantRequest,
): Promise<RefrigerantResponse> {
  return callBreaker({
    path: '/calculate/refrigerant',
    body: req,
    requestSchema: refrigerantRequestSchema,
    responseSchema: refrigerantResponseSchema,
  })
}

// Test-only resets — keep export gated by NODE_ENV via convention.
export const __testing__ = {
  resetBaseUrl: () => {
    _baseUrl = undefined
  },
  resetBreaker: () => {
    _breaker = undefined
  },
}
