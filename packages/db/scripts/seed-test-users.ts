/**
 * Local-dev only — seeds:
 *   1. Five sample StoreRef rows (Story 2.1)
 *   2. Three test users (Admin, Auditor, Client) into the `tenant-dev` tenant
 *   3. The seeded Auditor's assignedStoreIds = first 2 store IDs
 *      The seeded Client's  assignedStoreIds = first 2 store IDs
 *   4. Sample compressor_refs (Story 3.3) — GLOBAL regression-DB rows so the
 *      compressor model-lookup auto-populate path is exercisable locally.
 *
 * Hard-fails in production. Idempotent via prisma.user.upsert + storeRef.upsert
 * + compressorRef.upsert.
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

const SEED_STORES = [
  { storeNumber: 'STORE-001', storeName: 'Sobeys Brampton 1042', banner: 'Sobeys', region: 'ON', address: '1042 Steeles Ave W, Brampton, ON', postalCode: 'L6T 4S5' },
  { storeNumber: 'STORE-002', storeName: 'Sobeys Mississauga 87',  banner: 'Sobeys', region: 'ON', address: '87 Burnhamthorpe Rd, Mississauga, ON', postalCode: 'L5B 3C2' },
  { storeNumber: 'STORE-003', storeName: 'Metro Montréal 220',     banner: 'Metro',  region: 'QC', address: '220 Rue Sainte-Catherine, Montréal, QC', postalCode: 'H2X 1Z3' },
  { storeNumber: 'STORE-004', storeName: 'Metro Laval 56',         banner: 'Metro',  region: 'QC', address: '56 Boulevard Le Corbusier, Laval, QC',     postalCode: 'H7N 4Y8' },
  { storeNumber: 'STORE-005', storeName: 'IGA Halifax 12',         banner: 'IGA',    region: 'NS', address: '12 Spring Garden Rd, Halifax, NS',         postalCode: 'B3J 3R9' },
] as const

const SEED_USERS = [
  { email: 'admin@cems.local',   name: 'Dev Admin',   role: 'ADMIN',   storeAssignmentCount: 0 },
  { email: 'auditor@cems.local', name: 'Dev Auditor', role: 'AUDITOR', storeAssignmentCount: 2 },
  { email: 'client@cems.local',  name: 'Dev Client',  role: 'CLIENT',  storeAssignmentCount: 2 },
] as const

const COMPRESSOR_DB_VERSION = '1.0'

// GLOBAL reference data (no tenant). regression_coefficients carries nominal
// capacity (BTU/h) + EER for the SPA auto-populate path; the `coefficients`
// array is a placeholder — the real regression math lands in Epic 8.
const SEED_COMPRESSOR_REFS = [
  { modelNumber: 'ZB45KCE-TFD', manufacturer: 'Copeland', refrigerantType: 'R-404A', regressionCoefficients: { capacity: '45000', eer: '11.2', coefficients: [0.92, -0.013, 0.0007] } },
  { modelNumber: 'ZF18K4E-TFD', manufacturer: 'Copeland', refrigerantType: 'R-448A', regressionCoefficients: { capacity: '18000', eer: '9.8', coefficients: [0.88, -0.011, 0.0006] } },
  { modelNumber: '4DES-7Y',     manufacturer: 'Bitzer',   refrigerantType: 'R-448A', regressionCoefficients: { capacity: '62000', eer: '12.1', coefficients: [0.95, -0.014, 0.0008] } },
  { modelNumber: 'D4DA3-1000',  manufacturer: 'Carlyle',  refrigerantType: 'R-22',   regressionCoefficients: { capacity: '100000', eer: '10.4', coefficients: [0.9, -0.012, 0.0007] } },
] as const

async function main() {
  const url = process.env['DATABASE_URL']
  if (!url) {
    throw new Error('DATABASE_URL is not set — copy .env.example to .env')
  }
  const adapter = new PrismaMssql(url)
  const prisma = new PrismaClient({ adapter })

  // 1. Upsert StoreRefs first — capture their IDs so user.assignedStoreIds
  //    can reference them.
  const storeIds: string[] = []
  for (const s of SEED_STORES) {
    const row = await prisma.storeRef.upsert({
      where: { tenantId_storeNumber: { tenantId: TENANT, storeNumber: s.storeNumber } },
      update: {
        storeName: s.storeName,
        banner: s.banner,
        region: s.region,
        address: s.address,
        postalCode: s.postalCode,
      },
      create: {
        tenantId: TENANT,
        storeNumber: s.storeNumber,
        storeName: s.storeName,
        banner: s.banner,
        region: s.region,
        address: s.address,
        postalCode: s.postalCode,
      },
      select: { id: true },
    })
    storeIds.push(row.id)
    // eslint-disable-next-line no-console
    console.log(`✓ STORE   ${s.storeNumber}`)
  }

  // 2. Upsert users with first-N store IDs (per role) as their assignedStoreIds.
  const passwordHash = await argon2.hash(DEFAULT_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  })

  for (const u of SEED_USERS) {
    const assignedStoreIds = storeIds.slice(0, u.storeAssignmentCount)
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: TENANT, email: u.email } },
      update: {
        name: u.name,
        role: u.role,
        status: 'ACTIVE',
        passwordHash,
        assignedStoreIds: JSON.stringify(assignedStoreIds),
      },
      create: {
        tenantId: TENANT,
        email: u.email,
        name: u.name,
        role: u.role,
        status: 'ACTIVE',
        passwordHash,
        assignedStoreIds: JSON.stringify(assignedStoreIds),
      },
    })
    // eslint-disable-next-line no-console
    console.log(
      `✓ ${u.role.padEnd(7)} ${u.email.padEnd(24)} (${assignedStoreIds.length} stores)`,
    )
  }

  // 3. Upsert sample compressor_refs (GLOBAL — no tenant; Story 3.3).
  for (const c of SEED_COMPRESSOR_REFS) {
    await prisma.compressorRef.upsert({
      where: {
        compressorDbVersion_modelNumber: {
          compressorDbVersion: COMPRESSOR_DB_VERSION,
          modelNumber: c.modelNumber,
        },
      },
      update: {
        manufacturer: c.manufacturer,
        refrigerantType: c.refrigerantType,
        regressionCoefficients: JSON.stringify(c.regressionCoefficients),
      },
      create: {
        compressorDbVersion: COMPRESSOR_DB_VERSION,
        modelNumber: c.modelNumber,
        manufacturer: c.manufacturer,
        refrigerantType: c.refrigerantType,
        regressionCoefficients: JSON.stringify(c.regressionCoefficients),
      },
    })
    // eslint-disable-next-line no-console
    console.log(`✓ COMPRESSOR ${c.modelNumber.padEnd(14)} (${c.manufacturer})`)
  }

  // eslint-disable-next-line no-console
  console.log(`\nDefault password for all seeded users: ${DEFAULT_PASSWORD}`)
  // eslint-disable-next-line no-console
  console.log(`Tenant: ${TENANT}`)
  // eslint-disable-next-line no-console
  console.log(`Sample stores: ${SEED_STORES.length} (Auditor + Client assigned to first 2)`)
  // eslint-disable-next-line no-console
  console.log(`Sample compressor_refs: ${SEED_COMPRESSOR_REFS.length} (db version ${COMPRESSOR_DB_VERSION})`)

  await prisma.$disconnect()
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
