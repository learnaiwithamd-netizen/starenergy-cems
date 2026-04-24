import { describe, expect, it } from 'vitest'
import * as auditLogRepo from './audit-log.repo.js'

describe('audit-log.repo', () => {
  it('exports exactly one function: appendLog (append-only mandate)', () => {
    const exports = Object.keys(auditLogRepo).filter((k) => typeof (auditLogRepo as Record<string, unknown>)[k] === 'function')
    expect(exports).toEqual(['appendLog'])
  })

  it('does NOT export update/delete/upsert/createMany', () => {
    const forbidden = ['update', 'delete', 'upsert', 'createMany', 'deleteMany', 'updateMany']
    for (const name of forbidden) {
      expect(auditLogRepo).not.toHaveProperty(name)
    }
  })

  it('exports the AppendLogInput and AppendLogResult types (smoke)', () => {
    // Types are erased at runtime — this test exists to document the contract.
    // If they're removed, the repo.ts import breaks (compile-time check).
    expect(typeof auditLogRepo.appendLog).toBe('function')
  })
})
