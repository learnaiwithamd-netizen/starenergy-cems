import { useEffect, useMemo, useState, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Skeleton } from '@cems/ui'
import type { AuditListItem, StoreSummary } from '@cems/types'
import { useAssignedStores } from './stores-api'
import { useInProgressDraft } from '../audit/audit-api'
import { useAuthStore } from '../auth/auth-store'
import { useLogout } from '../auth/useLogout'

const SEARCH_DEBOUNCE_MS = 150

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export function StoreSelectorPage(): JSX.Element {
  const storesQ = useAssignedStores()
  const draftQ = useInProgressDraft()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()

  const filtered = useMemo(() => {
    if (!storesQ.data) return []
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return storesQ.data.stores
    return storesQ.data.stores.filter((s) => {
      const num = s.storeNumber.toLowerCase()
      const name = (s.storeName ?? '').toLowerCase()
      return num.includes(q) || name.includes(q)
    })
  }, [storesQ.data, debouncedSearch])

  return (
    <section aria-labelledby="store-selector-heading">
      <header className="flex items-center justify-between gap-3">
        <h1 id="store-selector-heading" className="text-2xl font-semibold">
          Select a store
        </h1>
        <div className="flex items-center gap-2">
          {user && (
            <span className="text-sm text-muted">
              {user.name}
            </span>
          )}
          <Button variant="ghost" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </header>

      {draftQ.data && (
        <ResumeAuditCallout
          audit={draftQ.data}
          stores={storesQ.data?.stores ?? []}
          onResume={() => navigate(`/audit/${draftQ.data!.id}`)}
        />
      )}

      <div className="mt-4">
        <label htmlFor="store-search" className="sr-only">
          Search stores by number or name
        </label>
        <Input
          id="store-search"
          type="search"
          autoComplete="off"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by store number or name"
          className="w-full"
        />
      </div>

      <div className="mt-4">
        {storesQ.isLoading && <SkeletonList />}

        {storesQ.isError && (
          <p role="alert" className="text-sm text-danger">
            Failed to load stores — try refreshing.
          </p>
        )}

        {storesQ.data && storesQ.data.stores.length === 0 && (
          <p
            role="status"
            aria-live="polite"
            className="mt-8 text-center text-sm text-muted"
          >
            No stores assigned — contact your administrator
          </p>
        )}

        {storesQ.data && storesQ.data.stores.length > 0 && filtered.length === 0 && (
          <p role="status" aria-live="polite" className="mt-4 text-sm text-muted">
            No stores match &ldquo;{debouncedSearch}&rdquo;
          </p>
        )}

        {filtered.length > 0 && (
          <ul className="mt-4 space-y-2" aria-label="Assigned stores">
            {filtered.map((store) => (
              <li key={store.id}>
                <StoreRow
                  store={store}
                  onSelect={() =>
                    navigate(`/audit/new?storeNumber=${encodeURIComponent(store.storeNumber)}`)
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function ResumeAuditCallout({
  audit,
  stores,
  onResume,
}: {
  audit: AuditListItem
  stores: readonly StoreSummary[]
  onResume: () => void
}): JSX.Element {
  // P13 — prefer the storeNumber the server attached to the audit row
  // (always present); fall back to the assigned-stores cache; never show
  // the bare-id or a vague placeholder if it can be avoided.
  const matchingStore = stores.find((s) => s.id === audit.storeId)
  const storeLabel =
    audit.storeNumber ?? matchingStore?.storeNumber ?? '(your last store)'
  return (
    <div
      role="region"
      aria-label="Resume in-progress audit"
      className="mt-4 rounded border border-primary bg-primary/5 px-4 py-3"
      data-testid="resume-audit-callout"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">Resume audit at {storeLabel}</p>
          <p className="text-xs text-muted">
            Last saved {formatRelative(audit.updatedAt)}
          </p>
        </div>
        <Button onClick={onResume} data-testid="resume-audit-button">
          Resume
        </Button>
      </div>
    </div>
  )
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const diffMs = Math.max(0, Date.now() - then)
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

function StoreRow({
  store,
  onSelect,
}: {
  store: StoreSummary
  onSelect: () => void
}): JSX.Element {
  const subtitle = [store.banner, store.region].filter(Boolean).join(' · ')
  const accessibleName = `Select store ${store.storeNumber}: ${store.storeName ?? '(unnamed)'}`
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={accessibleName}
      className="min-h-[48px] w-full rounded border border-border bg-surface px-4 py-3 text-left hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
    >
      <div className="font-medium">
        {store.storeNumber}
        {store.storeName ? ` · ${store.storeName}` : ''}
      </div>
      {subtitle && <div className="text-xs text-muted">{subtitle}</div>}
    </button>
  )
}

function SkeletonList(): JSX.Element {
  return (
    <ul className="space-y-2" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i}>
          <Skeleton className="h-[64px] w-full rounded" />
        </li>
      ))}
    </ul>
  )
}
