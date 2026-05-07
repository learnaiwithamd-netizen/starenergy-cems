/**
 * Local-only axe gate sanity fixture.
 *
 * Skipped in CI/regular runs. To verify the axe gate catches a real
 * violation, change `describe.skip` to `describe.only` and run
 * `pnpm --filter audit-app test`. axe-core should report a descriptive
 * `button-name` violation (icon-only button with no accessible name).
 *
 * Always revert to `describe.skip` before committing.
 */
import { render } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { describe, it, expect } from 'vitest'

function IconOnlyButtonWithoutAriaLabel() {
  return (
    <main>
      <button type="button">
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <svg width="24" height="24" aria-hidden="true" />
      </button>
    </main>
  )
}

describe.skip('axe gate sanity — icon-only button violation', () => {
  it('fails with a descriptive button-name violation', async () => {
    const { container } = render(<IconOnlyButtonWithoutAriaLabel />)
    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(results).toHaveNoViolations()
  })
})
