import { rules as cemsRules } from '@cems/config/eslint'

// Minimal flat config — Story 0.7 will land the full React + jsx-a11y rule set.
// Until then we wire just the TS parser so `pnpm lint` parses .ts/.tsx without
// erroring; rules are intentionally empty.
/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['dist/**', 'node_modules/**', '*.timestamp-*.mjs'],
  },
  {
    files: ['src/**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    languageOptions: cemsRules.tsParser.languageOptions,
    plugins: cemsRules.tsParser.plugins,
    rules: {},
  },
]
