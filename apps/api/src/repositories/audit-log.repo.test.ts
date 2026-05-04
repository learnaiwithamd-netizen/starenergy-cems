import { describe, expect, it, vi } from 'vitest'
import * as auditLogRepo from './audit-log.repo.js'
import { UserRole } from '@cems/types'

describe('audit-log.repo', () => {
  describe('public API shape', () => {
    it('exports only appendLog + appendLogFromRequest (append-only mandate)', () => {
      const exports = Object.keys(auditLogRepo)
        .filter((k) => typeof (auditLogRepo as Record<string, unknown>)[k] === 'function')
        .sort()
      expect(exports).toEqual(['appendLog', 'appendLogFromRequest'])
    })

    it('does NOT export update/delete/upsert/createMany (append-only mandate)', () => {
      const forbidden = ['update', 'delete', 'upsert', 'createMany', 'deleteMany', 'updateMany']
      for (const name of forbidden) {
        expect(auditLogRepo).not.toHaveProperty(name)
      }
    })
  })

  describe('appendLog behaviour', () => {
    it('calls db.auditLog.create with the input fields + null fallbacks for optional values', async () => {
      type CreateCall = { data: Record<string, unknown>; select: Record<string, boolean> }
      const createSpy = vi.fn<(arg: CreateCall) => Promise<{ id: string; occurredAt: Date }>>(
        async () => ({ id: 'log-1', occurredAt: new Date('2026-04-25T00:00:00Z') }),
      )
      const fakeDb = { auditLog: { create: createSpy } }

      const result = await auditLogRepo.appendLog(fakeDb, {
        tenantId: 'tenant-a',
        eventType: 'AUDIT_APPROVED',
        payload: { approvedBy: 'admin-1' },
      })

      expect(createSpy).toHaveBeenCalledOnce()
      const callArg = createSpy.mock.calls[0]![0]
      expect(callArg.data).toEqual({
        tenantId: 'tenant-a',
        auditId: null,
        eventType: 'AUDIT_APPROVED',
        payload: JSON.stringify({ approvedBy: 'admin-1' }),
        actorUserId: null,
        actorRole: null,
      })
      expect(callArg.select).toEqual({ id: true, occurredAt: true })
      expect(result).toEqual({ id: 'log-1', occurredAt: new Date('2026-04-25T00:00:00Z') })
    })

    it('passes through actorUserId + actorRole when provided', async () => {
      type CreateCall = { data: Record<string, unknown>; select: Record<string, boolean> }
      const createSpy = vi.fn<(arg: CreateCall) => Promise<{ id: string; occurredAt: Date }>>(
        async () => ({ id: 'log-2', occurredAt: new Date() }),
      )
      const fakeDb = { auditLog: { create: createSpy } }

      await auditLogRepo.appendLog(fakeDb, {
        tenantId: 'tenant-a',
        auditId: 'audit-42',
        eventType: 'STATE_TRANSITION',
        payload: { from: 'DRAFT', to: 'SUBMITTED' },
        actorUserId: 'user-99',
        actorRole: UserRole.AUDITOR,
      })

      const callArg = createSpy.mock.calls[0]![0]
      expect(callArg.data.auditId).toBe('audit-42')
      expect(callArg.data.actorUserId).toBe('user-99')
      expect(callArg.data.actorRole).toBe(UserRole.AUDITOR)
    })
  })

  describe('appendLogFromRequest', () => {
    it('throws when request.rlsContext is null', async () => {
      const fakeReq = {
        rlsContext: null,
        withRls: vi.fn(),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(auditLogRepo.appendLogFromRequest(fakeReq as any, {
        eventType: 'TEST',
        payload: {},
      })).rejects.toThrow(/rlsContext/)
    })

    it('runs appendLog inside req.withRls with tenant+actor pulled from rlsContext', async () => {
      type CreateCall = { data: Record<string, unknown>; select: Record<string, boolean> }
      const createSpy = vi.fn<(arg: CreateCall) => Promise<{ id: string; occurredAt: Date }>>(
        async () => ({ id: 'log-3', occurredAt: new Date() }),
      )
      const fakeTx = { auditLog: { create: createSpy } }
      const withRlsSpy = vi.fn(async (fn: (tx: typeof fakeTx) => Promise<unknown>) => fn(fakeTx))

      const fakeReq = {
        rlsContext: {
          tenantId: 'tenant-from-ctx',
          userId: 'user-from-ctx',
          role: UserRole.ADMIN,
          assignedStoreIds: [],
        },
        withRls: withRlsSpy,
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await auditLogRepo.appendLogFromRequest(fakeReq as any, {
        eventType: 'AUDIT_PUBLISHED',
        payload: { auditId: 'a-1' },
        auditId: 'a-1',
      })

      expect(withRlsSpy).toHaveBeenCalledOnce()
      const callArg = createSpy.mock.calls[0]![0]
      expect(callArg.data).toEqual({
        tenantId: 'tenant-from-ctx',
        auditId: 'a-1',
        eventType: 'AUDIT_PUBLISHED',
        payload: JSON.stringify({ auditId: 'a-1' }),
        actorUserId: 'user-from-ctx',
        actorRole: UserRole.ADMIN,
      })
    })
  })
})
