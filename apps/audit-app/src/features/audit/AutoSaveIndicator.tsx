import type { JSX } from 'react'
import type { AutoSaveState } from './useAutoSaveSection'

interface AutoSaveIndicatorProps {
  state: AutoSaveState
}

/**
 * Inline auto-save status. The container is `aria-live="polite"` so screen
 * readers announce save success without interrupting. `idle` and `saving`
 * render an empty span (auto-save is silent per AC1; the ✓ Saved badge
 * only appears AFTER the save completes).
 */
export function AutoSaveIndicator({ state }: AutoSaveIndicatorProps): JSX.Element {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="text-sm" data-testid="auto-save-indicator">
      {state === 'saved' && <span className="text-success">✓ Saved</span>}
      {state === 'error' && <span className="text-warning">Save failed — retrying</span>}
    </div>
  )
}
