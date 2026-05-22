import type { JSX } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Skeleton } from '@cems/ui'
import { ApiError } from '../../lib/api-client'
import { useStoreDetail, useCreateAudit } from './audit-api'

interface DraftExistsProblem {
  type: string
  existingAuditId?: string
  existingStoreId?: string
}


export function AuditNewPage(): JSX.Element {
  const [params] = useSearchParams()
  const storeNumber = params.get('storeNumber') || null
  const navigate = useNavigate()

  const storeQ = useStoreDetail(storeNumber)
  const createAudit = useCreateAudit()

  function handleStartAudit() {
    if (!storeQ.data) return
    createAudit.mutate(
      { storeId: storeQ.data.id },
      {
        onSuccess: ({ auditId }) => {
          navigate(`/audit/${auditId}`)
        },
      },
    )
  }

  return (
    <section aria-labelledby="audit-new-heading">
      <nav aria-label="breadcrumb" className="mb-4 text-sm text-muted">
        <Link to="/" className="underline">
          ← Stores
        </Link>
      </nav>

      <h1 id="audit-new-heading" className="text-2xl font-semibold">
        {storeQ.isLoading
          ? 'Loading store…'
          : storeQ.data
            ? `Start audit — ${storeQ.data.storeNumber}`
            : `Start audit — ${storeNumber ?? '(missing)'}`}
      </h1>

      {!storeNumber && (
        <p role="alert" className="mt-4 text-sm text-danger">
          No store selected — please go back and choose a store.
        </p>
      )}

      {storeQ.isError && (
        <p role="alert" className="mt-4 text-sm text-danger">
          Could not load store details. Please go back and select the store again.
        </p>
      )}

      {storeQ.isLoading && (
        <div role="status" className="mt-6 space-y-3" aria-busy="true" aria-label="Loading store details">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-56" />
        </div>
      )}

      {storeQ.data && (
        <dl className="mt-6 space-y-2 text-sm" aria-label="Store details">
          <StoreField label="Store number" value={storeQ.data.storeNumber} />
          <StoreField label="Store name" value={storeQ.data.storeName} />
          <StoreField label="Banner" value={storeQ.data.banner} />
          <StoreField label="Region" value={storeQ.data.region} />
          <StoreField label="Address" value={storeQ.data.address} />
          <StoreField label="Postal code" value={storeQ.data.postalCode} />
          <StoreField label="Operating hours" value={storeQ.data.operatingHours} />
          <StoreField label="Store manager" value={storeQ.data.storeManager} />
          {storeQ.data.serviceProviders.length > 0 && (
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 font-medium text-muted">Service providers</dt>
              <dd>{storeQ.data.serviceProviders.join(', ')}</dd>
            </div>
          )}
        </dl>
      )}

      {createAudit.isError && (() => {
        const err = createAudit.error
        const problem =
          err instanceof ApiError ? (err.problem as DraftExistsProblem) : null
        const isDraftExists =
          problem?.type === 'https://cems.starenergy.ca/errors/draft-already-exists' &&
          problem.existingAuditId
        const isStoreNotAssigned =
          err instanceof ApiError &&
          err.status === 403 &&
          (err.problem as { type?: string }).type ===
            'https://cems.starenergy.ca/errors/store-not-assigned'

        if (isDraftExists) {
          return (
            <div
              role="alert"
              className="mt-4 rounded border border-warning bg-warning/10 p-3 text-sm"
              data-testid="draft-exists-alert"
            >
              <p className="font-medium text-warning">
                You already have an in-progress audit.
              </p>
              <p className="mt-1">
                Finish or contact your administrator to reassign it before starting a new one.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                onClick={() => navigate(`/audit/${problem.existingAuditId}`)}
              >
                Open existing draft
              </Button>
            </div>
          )
        }

        if (isStoreNotAssigned) {
          return (
            <p role="alert" className="mt-4 text-sm text-danger">
              This store is not assigned to you. Please go back and choose an assigned store.
            </p>
          )
        }

        return (
          <p role="alert" className="mt-4 text-sm text-danger">
            Failed to create audit — please try again.
          </p>
        )
      })()}

      <div className="mt-8 flex gap-3">
        <Button
          type="button"
          onClick={handleStartAudit}
          disabled={!storeQ.data || createAudit.isPending}
          aria-busy={createAudit.isPending}
        >
          {createAudit.isPending ? 'Creating…' : 'Start Audit'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => navigate('/')}>
          Cancel
        </Button>
      </div>
    </section>
  )
}

function StoreField({ label, value }: { label: string; value: string | null | undefined }): JSX.Element | null {
  if (!value) return null
  return (
    <div className="flex gap-2">
      <dt className="w-36 shrink-0 font-medium text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
