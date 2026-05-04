/**
 * `no-tenant-raw-prisma` — flags direct uses of Prisma's raw-query escape
 * hatches (`$queryRaw`, `$queryRawUnsafe`, `$executeRaw`, `$executeRawUnsafe`)
 * on the unwrapped `prisma` client. Raw queries on the bare client bypass
 * the Story 0.4 `withRlsTransaction` discipline and skip the per-request
 * SESSION_CONTEXT, which means RLS predicates evaluate against an empty
 * tenant id — i.e. all rows are visible.
 *
 * Allowed:
 *   - The same calls on a transaction client (`tx.$queryRaw(...)`) inside
 *     `req.withRls(...)` or `withRlsTransaction(...)` — RLS is set on
 *     that pinned connection.
 *   - The diagnostic `db-health` route (path matches `**\/db-health.*`).
 *   - An explicit reviewer-acknowledged opt-out via the standard
 *     ESLint disable directive (in the api flat-config the rule id is
 *     `cems/no-tenant-raw-prisma`):
 *       // eslint-disable-next-line cems/no-tenant-raw-prisma -- AUDIT-REVIEWED: <reason>
 *
 * The rule is intentionally narrow (matches identifier `prisma` as the
 * call receiver). Aliasing escapes the rule; that's the architectural
 * trade-off — the goal is to catch the *common* mistake during code
 * review, not to substitute for the RLS architecture itself.
 */

const FORBIDDEN_METHODS = new Set([
  '$queryRaw',
  '$queryRawUnsafe',
  '$executeRaw',
  '$executeRawUnsafe',
])

// Allowlist by path — anchored to `apps/api/src/routes/db-health.{ts,js,...}`
// so a future `apps/api/src/foo/db-health.ts` does NOT slip past the check.
// Use forward slashes here; ESLint normalises Windows paths before matching.
const ALLOWLIST_PATHS = [/apps\/api\/src\/routes\/db-health\.(t|j)sx?$/]

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid prisma.$queryRaw / $executeRaw on the unwrapped client; require withRlsTransaction for tenant-scoped data access.',
      recommended: true,
    },
    schema: [],
    messages: {
      forbidden:
        'Direct prisma.{{method}} bypasses RLS. Use req.withRls(async (tx) => tx.{{method}}(...)) instead. See apps/api/README.md.',
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename()
    if (ALLOWLIST_PATHS.some((re) => re.test(filename))) {
      return {}
    }

    const checkCalleeNode = (calleeNode, reportNode) => {
      if (!calleeNode) return
      let methodName
      if (calleeNode.type === 'MemberExpression' && !calleeNode.computed && calleeNode.property?.type === 'Identifier') {
        methodName = calleeNode.property.name
      } else if (
        calleeNode.type === 'MemberExpression' &&
        calleeNode.computed &&
        calleeNode.property?.type === 'Literal' &&
        typeof calleeNode.property.value === 'string'
      ) {
        methodName = calleeNode.property.value
      } else {
        return
      }
      if (!FORBIDDEN_METHODS.has(methodName)) return
      const obj = calleeNode.object
      if (!obj) return
      // Direct identifier — `prisma.$queryRaw`...`
      if (obj.type === 'Identifier' && obj.name === 'prisma') {
        context.report({ node: reportNode, messageId: 'forbidden', data: { method: methodName } })
        return
      }
      // Member expression chain that ends in `.prisma` — catches the common
      // patterns: `globalThis.prisma.$queryRaw`, `this.prisma.$queryRaw`,
      // `module.prisma.$queryRaw`, `db.prisma.$queryRaw`, etc.
      const last =
        obj.type === 'MemberExpression' &&
        ((!obj.computed && obj.property?.type === 'Identifier' && obj.property.name) ||
          (obj.computed && obj.property?.type === 'Literal' && obj.property.value))
      if (last === 'prisma') {
        context.report({ node: reportNode, messageId: 'forbidden', data: { method: methodName } })
      }
    }

    return {
      // Tagged template form: prisma.$queryRaw`SELECT 1`
      TaggedTemplateExpression(node) {
        checkCalleeNode(node.tag, node)
      },
      // Function-call form: prisma.$queryRawUnsafe('SELECT 1')
      CallExpression(node) {
        checkCalleeNode(node.callee, node)
      },
    }
  },
}

export default rule
