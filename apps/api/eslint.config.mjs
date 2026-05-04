import { rules as cemsRules } from '@cems/config/eslint'

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['dist/**', 'node_modules/**', '*.timestamp-*.mjs', '**/*.d.ts'],
  },
  {
    files: ['src/**/*.{ts,tsx,mts,cts,js,mjs,cjs}'],
    languageOptions: cemsRules.tsParser.languageOptions,
    plugins: {
      ...cemsRules.tsParser.plugins,
      ...cemsRules.recommended.plugins,
    },
    rules: cemsRules.recommended.rules,
  },
]
