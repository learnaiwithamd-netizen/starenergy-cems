import tseslint from 'typescript-eslint'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
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
        ecmaFeatures: { jsx: true },
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
  // React + jsx-a11y flat-config block for SPAs. Consumers spread this into
  // their flat config — covers all .tsx/.jsx files. Combined with the
  // --max-warnings=0 flag in package.json's lint script, any jsx-a11y issue
  // fails CI.
  reactA11y: {
    files: ['**/*.{tsx,jsx}'],
    plugins: {
      'jsx-a11y': jsxA11y,
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: {
        // Browser globals so React components don't trigger no-undef on
        // window / document / etc.
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      // JSX in React 17+ transform — no need to import React in scope.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
}

/** Default export keeps backwards compatibility for any consumer that
 *  imported the module as a flat-config array directly. */
export default [rules.recommended]
