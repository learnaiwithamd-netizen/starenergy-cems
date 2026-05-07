import type { JSX } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

export function AuditNewPage(): JSX.Element {
  const [params] = useSearchParams()
  const storeNumber = params.get('storeNumber')

  return (
    <section aria-labelledby="audit-new-heading">
      <h1 id="audit-new-heading" className="text-2xl font-semibold">
        Start audit for store {storeNumber ?? '(missing)'}
      </h1>
      <p className="mt-2 text-sm text-muted">
        Audit creation arrives in Story 2.2 — store auto-fill + DRAFT creation.
      </p>
      <p className="mt-4">
        <Link to="/" className="underline">
          ← Back to store selector
        </Link>
      </p>
    </section>
  )
}
