/**
 * Tests for the calc-service HTTP client + circuit breaker.
 *
 * Mocks `globalThis.fetch` so no real calc-service is required. Resets the
 * lazy breaker singleton between tests via the `__testing__` hook so each
 * test starts from a closed breaker.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __testing__,
  CalcServiceError,
  calculateRefrigerant,
} from './calc-service-client.js'

const VALID_REFRIGERANT_REQ = {
  refrigerant_type: 'R-404A' as const,
  temperature_f: 40,
}

const VALID_REFRIGERANT_RES = {
  refrigerant_type: 'R-404A',
  temperature_f: 40,
  pressure_psig: 0,
  service_version: '0.0.1',
  calculated_at: '2026-04-28T12:00:00Z',
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('calc-service-client', () => {
  beforeEach(() => {
    process.env['CALC_SERVICE_URL'] = 'http://test-calc:8000'
    __testing__.resetBaseUrl()
    __testing__.resetBreaker()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the parsed body on a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, VALID_REFRIGERANT_RES)),
    )

    const result = await calculateRefrigerant(VALID_REFRIGERANT_REQ)
    expect(result.refrigerant_type).toBe('R-404A')
    expect(result.pressure_psig).toBe(0)
  })

  it('throws CalcServiceError(TIMEOUT) when fetch is aborted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        // Simulate a fetch that observes abort: wait for the signal, then throw an AbortError.
        return new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('aborted')
            err.name = 'AbortError'
            reject(err)
          })
        })
      }),
    )

    await expect(calculateRefrigerant(VALID_REFRIGERANT_REQ)).rejects.toMatchObject({
      name: 'CalcServiceError',
      code: 'TIMEOUT',
    })
  }, 35_000)

  it('opens the circuit breaker after the configured 5-call volume threshold is exceeded', async () => {
    let callCount = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        callCount += 1
        return jsonResponse(500, { detail: 'broke' })
      }),
    )

    // Opossum config: volumeThreshold=5, errorThresholdPercentage=50.
    // The breaker requires AT LEAST 5 calls in the rolling window before
    // it can open — so the first 4 failures must all reach upstream.
    for (let i = 0; i < 4; i += 1) {
      await expect(calculateRefrigerant(VALID_REFRIGERANT_REQ)).rejects.toMatchObject({
        name: 'CalcServiceError',
        code: 'UPSTREAM_ERROR',
      })
    }
    expect(callCount).toBe(4)

    // The 5th call is what crosses the threshold; it still hits upstream
    // (the breaker decides AFTER the call) but a follow-up should short-circuit.
    await expect(calculateRefrigerant(VALID_REFRIGERANT_REQ)).rejects.toBeInstanceOf(
      CalcServiceError,
    )
    const callsBeforeOpen = callCount

    // Subsequent calls must short-circuit with CIRCUIT_OPEN — no new fetch.
    await expect(calculateRefrigerant(VALID_REFRIGERANT_REQ)).rejects.toMatchObject({
      name: 'CalcServiceError',
      code: 'CIRCUIT_OPEN',
    })
    expect(callCount).toBe(callsBeforeOpen)
  })

  it('throws CalcServiceError(BAD_RESPONSE) when the response fails Zod validation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(200, { ...VALID_REFRIGERANT_RES, pressure_psig: 'not-a-number' }),
      ),
    )

    await expect(calculateRefrigerant(VALID_REFRIGERANT_REQ)).rejects.toMatchObject({
      name: 'CalcServiceError',
      code: 'BAD_RESPONSE',
    })
  })

  it('throws CalcServiceError(CONFIG_ERROR) when CALC_SERVICE_URL is missing', async () => {
    delete process.env['CALC_SERVICE_URL']
    __testing__.resetBaseUrl()

    await expect(calculateRefrigerant(VALID_REFRIGERANT_REQ)).rejects.toMatchObject({
      name: 'CalcServiceError',
      code: 'CONFIG_ERROR',
    })
  })
})
