import { rules as cemsRules } from '@cems/config/eslint'

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: ['src/**/*.{ts,tsx,mts,cts,js,jsx}'],
    languageOptions: cemsRules.tsParser.languageOptions,
    plugins: cemsRules.tsParser.plugins,
    rules: {},
  },
]
