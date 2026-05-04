import { RuleTester } from 'eslint'
import rule from './no-tenant-raw-prisma.js'

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
})

tester.run('no-tenant-raw-prisma', rule, {
  valid: [
    {
      name: 'tx.$queryRaw inside withRlsTransaction is allowed',
      code: 'await req.withRls(async (tx) => tx.$queryRaw`SELECT 1`)',
    },
    {
      name: 'unrelated method on prisma is allowed',
      code: 'await prisma.audit.findMany()',
    },
    {
      name: 'db-health.ts file is allowlisted',
      filename: '/repo/apps/api/src/routes/db-health.ts',
      code: 'await prisma.$queryRaw`SELECT 1`',
    },
    {
      name: 'aliased prisma escapes the rule (documented limitation)',
      code: 'const p = prisma; await p.$queryRaw`SELECT 1`',
    },
    {
      name: 'unrelated identifier ending in prisma is not flagged',
      code: 'await someOtherClient.foo.bar()',
    },
  ],
  invalid: [
    {
      name: 'prisma.$queryRaw tagged template is flagged',
      code: 'await prisma.$queryRaw`SELECT 1`',
      errors: [{ messageId: 'forbidden', data: { method: '$queryRaw' } }],
    },
    {
      name: 'prisma.$queryRawUnsafe call is flagged',
      code: "await prisma.$queryRawUnsafe('SELECT 1')",
      errors: [{ messageId: 'forbidden', data: { method: '$queryRawUnsafe' } }],
    },
    {
      name: 'prisma.$executeRaw is flagged',
      code: 'await prisma.$executeRaw`UPDATE audits SET status = ${status} WHERE id = ${id}`',
      errors: [{ messageId: 'forbidden', data: { method: '$executeRaw' } }],
    },
    {
      name: 'bracket access still flagged',
      code: "await prisma['$queryRaw']`SELECT 1`",
      errors: [{ messageId: 'forbidden', data: { method: '$queryRaw' } }],
    },
    {
      name: 'globalThis.prisma access is flagged',
      code: 'await globalThis.prisma.$queryRaw`SELECT 1`',
      errors: [{ messageId: 'forbidden', data: { method: '$queryRaw' } }],
    },
    {
      name: 'this.prisma access is flagged',
      code: 'class Repo { read() { return this.prisma.$queryRawUnsafe("SELECT 1") } }',
      errors: [{ messageId: 'forbidden', data: { method: '$queryRawUnsafe' } }],
    },
    {
      name: 'nested member-expression ending in .prisma is flagged',
      code: 'await container.db.prisma.$executeRaw`UPDATE x SET y = 1`',
      errors: [{ messageId: 'forbidden', data: { method: '$executeRaw' } }],
    },
  ],
})

console.log('no-tenant-raw-prisma: all RuleTester cases passed')
