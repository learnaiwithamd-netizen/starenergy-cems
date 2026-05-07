/**
 * Local-dev only — seeds three test users (Admin, Auditor, Client) into
 * the `tenant-dev` tenant so a developer can call POST /api/v1/auth/login
 * against a freshly migrated DB.
 *
 * Hard-fails in production. Idempotent via prisma.user.upsert.
 *
 * Run via:    pnpm --filter @cems/db db:seed:test-users
 */

import argon2 from 'argon2'
import { PrismaClient } from '@prisma/client'
import { PrismaMssql } from '@prisma/adapter-mssql'

if (process.env['NODE_ENV'] === 'production') {
  // eslint-disable-next-line no-console
  console.error('refusing to seed test users in NODE_ENV=production')
  process.exit(1)
}

const DEFAULT_PASSWORD = 'password123!'

const TENANT = 'tenant-dev'
const SEED_USERS = [
  {
    email: 'admin@cems.local',
    name: 'Dev Admin',
    role: 'ADMIN',
    assignedStoreIds: [],
  },
  {
    email: 'auditor@cems.local',
    name: 'Dev Auditor',
    role: 'AUDITOR',
    assignedStoreIds: [],
  },
  {
    email: 'client@cems.local',
    name: 'Dev Client',
    role: 'CLIENT',
    assignedStoreIds: ['store-001'],
  },
] as const

async function main() {
  const url = process.env['DATABASE_URL']
  if (!url) {
    throw new Error('DATABASE_URL is not set — copy .env.example to .env')
  }
  const adapter = new PrismaMssql(url)
  const prisma = new PrismaClient({ adapter })

  const passwordHash = await argon2.hash(DEFAULT_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  })

  for (const u of SEED_USERS) {
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: TENANT, email: u.email } },
      update: { name: u.name, role: u.role, passwordHash, assignedStoreIds: JSON.stringify(u.assignedStoreIds) },
      create: {
        tenantId: TENANT,
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
        assignedStoreIds: JSON.stringify(u.assignedStoreIds),
      },
    })
    // eslint-disable-next-line no-console
    console.log(`✓ ${u.role.padEnd(7)} ${u.email}`)
  }

  // eslint-disable-next-line no-console
  console.log(`\nDefault password for all seeded users: ${DEFAULT_PASSWORD}`)
  // eslint-disable-next-line no-console
  console.log(`Tenant: ${TENANT}`)

  await prisma.$disconnect()
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
