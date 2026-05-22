import { describe, it, expect, vi } from 'vitest'
import { findCompressorRefByModel } from './compressor-ref.repo.js'

type AnyArg = Record<string, unknown>

const now = new Date('2026-05-22T10:00:00Z')

function makeRow(overrides: Partial<AnyArg> = {}) {
  return {
    id: 'ref-1',
    compressorDbVersion: '1.0',
    modelNumber: 'ZB45KCE-TFD',
    manufacturer: 'Copeland',
    refrigerantType: 'R-404A',
    regressionCoefficients: JSON.stringify({ capacity: '45000', eer: '11.2' }),
    createdAt: now,
    ...overrides,
  }
}

describe('compressor-ref.repo', () => {
  describe('findCompressorRefByModel', () => {
    it('returns null when no model matches', async () => {
      const findFirst = vi.fn(async () => null)
      const db = { compressorRef: { findFirst } }
      const result = await findCompressorRefByModel(db, { modelNumber: 'NOPE' })
      expect(result).toBeNull()
    })

    it('queries by modelNumber only (latest version) when version omitted', async () => {
      const findFirst = vi.fn<(arg: AnyArg) => Promise<unknown>>(async () => makeRow())
      const db = { compressorRef: { findFirst } }

      const result = await findCompressorRefByModel(db, { modelNumber: 'ZB45KCE-TFD' })

      expect(findFirst.mock.calls[0]![0]).toEqual({
        where: { modelNumber: 'ZB45KCE-TFD' },
        orderBy: { compressorDbVersion: 'desc' },
      })
      expect(result!.manufacturer).toBe('Copeland')
      expect(result!.regressionCoefficients).toEqual({ capacity: '45000', eer: '11.2' })
      expect(result!.createdAt).toBe(now.toISOString())
    })

    it('pins the lookup to a specific version when provided', async () => {
      const findFirst = vi.fn<(arg: AnyArg) => Promise<unknown>>(async () => makeRow({ compressorDbVersion: '2.0' }))
      const db = { compressorRef: { findFirst } }

      await findCompressorRefByModel(db, { modelNumber: 'ZB45KCE-TFD', version: '2.0' })

      expect((findFirst.mock.calls[0]![0] as AnyArg)['where']).toEqual({
        modelNumber: 'ZB45KCE-TFD',
        compressorDbVersion: '2.0',
      })
    })

    it('falls back to {} for malformed regression_coefficients JSON', async () => {
      const findFirst = vi.fn(async () => makeRow({ regressionCoefficients: 'not-json' }))
      const db = { compressorRef: { findFirst } }
      const result = await findCompressorRefByModel(db, { modelNumber: 'ZB45KCE-TFD' })
      expect(result!.regressionCoefficients).toEqual({})
    })
  })
})
