import { rules as cemsRules } from '@cems/config/eslint'

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['dist/**', 'node_modules/**', '*.timestamp-*.mjs'],
  },
  {
    files: ['src/**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    ...cemsRules.tsParser,
    ...cemsRules.recommended,
  },
  {
    ...cemsRules.reactA11y,
    files: ['src/**/*.{tsx,jsx}'],
  },
]
