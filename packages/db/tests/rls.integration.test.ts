// rls.integration.test.ts — runs ONLY when RUN_INTEGRATION=1 is set.
// Requires a live SQL Server with migrations already applied (docker compose up -d sql).
// Seeds two tenants, asserts RLS filters cross-tenant reads.
//
// KNOWN LIMITATION: Prisma 7 + vitest — all Prisma client instantiation (including
// `new PrismaClient(...)`) is deferred into `beforeAll` because the describe body itself
// evaluates at collection time, even under `describe.skipIf(true)`. This keeps the file
// import-safe when RUN_INTEGRATION is unset.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaMssql } from '@prisma/adapter-mssql'
import { withRlsContext } from '../src/index.js'
import { UserRole } from '@cems/types'

const skipSuite = process.env['RUN_INTEGRATION'] !== '1'

describe.skipIf(skipSuite)('RLS cross-tenant filter', () => {
  const tenantA = 'tenant-a-integration-test'
  const tenantB = 'tenant-b-integration-test'
  const storeAId = 'store-a-integration'
  const storeBId = 'store-b-integration'

  let prisma: PrismaClient

  beforeAll(async () => {
    if (!process.env['DATABASE_URL']) {
      throw new Error('RUN_INTEGRATION=1 requires DATABASE_URL to be set')
    }
    // Prisma 7 requires a driverAdapter — the classic `datasources.db.url` option was removed.
    // @prisma/adapter-mssql accepts either a mssql config object or a connection string.
    const adapter = new PrismaMssql(process.env['DATABASE_URL']!)
    prisma = new PrismaClient({ adapter })

    const adminPrisma = withRlsContext(prisma, {
      tenantId: 'seed',
      userId: 'seed-user',
      role: UserRole.ADMIN,
    })

    // Clean slate (ADMIN can delete across tenants)
    await adminPrisma.audit.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } })
    await adminPrisma.storeRef.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } })

    await adminPrisma.storeRef.create({ data: { id: storeAId, tenantId: tenantA, storeNumber: '100' } })
    await adminPrisma.storeRef.create({ data: { id: storeBId, tenantId: tenantB, storeNumber: '200' } })
    for (let i = 0; i < 2; i++) {
      await adminPrisma.audit.create({
        data: {
          tenantId: tenantA,
          clientId: 'client-a',
          storeId: storeAId,
          formVersion: 'v1.0',
          compressorDbVersion: 'cdb-v1',
        },
      })
      await adminPrisma.audit.create({
        data: {
          tenantId: tenantB,
          clientId: 'client-b',
          storeId: storeBId,
          formVersion: 'v1.0',
          compressorDbVersion: 'cdb-v1',
        },
      })
    }
  }, 30_000)

  afterAll(async () => {
    if (!prisma) return
    const adminPrisma = withRlsContext(prisma, {
      tenantId: 'cleanup',
      userId: 'cleanup',
      role: UserRole.ADMIN,
    })
    await adminPrisma.audit.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } })
    await adminPrisma.storeRef.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } })
    await prisma.$disconnect()
  })

  it('tenant A auditor sees only tenant A audits', async () => {
    const ctx = withRlsContext(prisma, {
      tenantId: tenantA,
      userId: 'user-a',
      role: UserRole.AUDITOR,
    })
    const audits = await ctx.audit.findMany({ where: { tenantId: { in: [tenantA, tenantB] } } })
    expect(audits).toHaveLength(2)
    for (const a of audits) {
      expect(a.tenantId).toBe(tenantA)
    }
  })

  it('tenant B auditor sees only tenant B audits', async () => {
    const ctx = withRlsContext(prisma, {
      tenantId: tenantB,
      userId: 'user-b',
      role: UserRole.AUDITOR,
    })
    const audits = await ctx.audit.findMany({ where: { tenantId: { in: [tenantA, tenantB] } } })
    expect(audits).toHaveLength(2)
    for (const a of audits) {
      expect(a.tenantId).toBe(tenantB)
    }
  })

  it('CLIENT role with assigned_store_ids sees only own-store audits', async () => {
    const ctx = withRlsContext(prisma, {
      tenantId: tenantA,
      userId: 'client-user',
      role: UserRole.CLIENT,
      assignedStoreIds: [storeAId],
    })
    const audits = await ctx.audit.findMany({ where: { tenantId: { in: [tenantA, tenantB] } } })
    expect(audits.length).toBeGreaterThanOrEqual(1)
    for (const a of audits) {
      expect(a.storeId).toBe(storeAId)
    }
  })

  it('CLIENT role with empty assigned_store_ids sees zero audits', async () => {
    const ctx = withRlsContext(prisma, {
      tenantId: tenantA,
      userId: 'client-no-stores',
      role: UserRole.CLIENT,
      assignedStoreIds: [],
    })
    const audits = await ctx.audit.findMany({ where: { tenantId: { in: [tenantA, tenantB] } } })
    expect(audits).toHaveLength(0)
  })

  it('ADMIN role bypasses tenant filter (sees both tenants)', async () => {
    const ctx = withRlsContext(prisma, {
      tenantId: 'admin-context',
      userId: 'admin-user',
      role: UserRole.ADMIN,
    })
    const audits = await ctx.audit.findMany({ where: { tenantId: { in: [tenantA, tenantB] } } })
    expect(audits).toHaveLength(4)
  })
})
