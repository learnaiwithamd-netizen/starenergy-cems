import tseslint from 'typescript-eslint'
import noTenantRawPrisma from './rules/no-tenant-raw-prisma.js'

/**
 * `cems` ESLint plugin — exposes project-specific rules.
 *
 * Use via flat config:
 *   import { plugin as cemsPlugin, rules as cemsRules } from '@cems/config/eslint'
 *   export default [cemsRules.recommended]
 */
export const plugin = {
  meta: { name: '@cems/config/eslint', version: '0.0.1' },
  rules: {
    'no-tenant-raw-prisma': noTenantRawPrisma,
  },
}

/**
 * Pre-baked flat-config blocks ready for `eslint.config.{js,mjs}` consumers.
 *
 * `recommendedTs` is a small array (TS parser block + the cems rule block)
 * that consumers spread into their own flat config along with their `files:`
 * patterns. Splitting it lets us reuse the parser block for `.ts` files
 * while keeping the rule block parser-agnostic.
 */
export const rules = {
  // Spread INTO a `files: [...]` block; provides TS parser + the
  // typescript-eslint plugin so consumers' inline disable comments
  // (e.g. `@typescript-eslint/no-explicit-any`) resolve cleanly.
  tsParser: {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
  },
  recommended: {
    plugins: { cems: plugin },
    rules: {
      'cems/no-tenant-raw-prisma': 'error',
      'no-console': 'error',
      'no-debugger': 'error',
      'no-unused-vars': 'off',
    },
  },
}

/** Default export keeps backwards compatibility for any consumer that
 *  imported the module as a flat-config array directly. */
export default [rules.recommended]
