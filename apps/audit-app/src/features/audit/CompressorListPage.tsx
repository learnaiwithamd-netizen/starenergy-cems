import type { JSX } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Skeleton, Badge, cn } from '@cems/ui'
import type { Compressor } from '@cems/types'
import { AuditBreadcrumb } from './AuditBreadcrumb'
import { useMachineRooms } from './machine-room-api'
import { useRack } from './rack-api'
import { useCompressors, useCreateCompressor, useDuplicateCompressor } from './compressor-api'

type CompressorStatus = 'Not Started' | 'In Progress' | 'Complete'

/** Derive a compressor's completion status from its saved data blob. */
function getCompressorStatus(compressor: Compressor): CompressorStatus {
  const general = compressor.data['general'] as { modelNumber?: string } | undefined
  if (general?.modelNumber) return 'Complete'
  if (Object.keys(compressor.data).length > 0) return 'In Progress'
  return 'Not Started'
}

/** Display label — its entered model number or a numeric fallback. */
function getCompressorLabel(compressor: Compressor): string {
  const general = compressor.data['general'] as { modelNumber?: string } | undefined
  if (general?.modelNumber) return general.modelNumber
  return `Compressor ${compressor.compressorNumber}`
}

const STATUS_VARIANT: Record<CompressorStatus, 'outline' | 'warning' | 'success'> = {
  'Not Started': 'outline',
  'In Progress': 'warning',
  Complete: 'success',
}

export function CompressorListPage(): JSX.Element {
  const { auditId, rackId } = useParams<{ auditId: string; rackId: string }>()
  const navigate = useNavigate()

  const machineRoomsQ = useMachineRooms(auditId ?? null)
  const roomId = machineRoomsQ.data?.machineRooms[0]?.id ?? null
  const rackQ = useRack(auditId ?? null, roomId, rackId ?? null)
  const compressorsQ = useCompressors(auditId ?? null, roomId, rackId ?? null)

  const createCompressor = useCreateCompressor()
  const duplicateCompressor = useDuplicateCompressor()

  const rackGeneralUrl = `/audit/${auditId}/section/refrigeration/rack/${rackId}/general`

  function entryUrl(compressorId: string): string {
    return `/audit/${auditId}/section/refrigeration/rack/${rackId}/compressor/${compressorId}`
  }

  function goToCompressor(compressorId: string): void {
    void navigate(entryUrl(compressorId))
  }

  function handleAdd(): void {
    if (!auditId || !roomId || !rackId) return
    createCompressor.mutate({ auditId, roomId, rackId }, { onSuccess: (c) => goToCompressor(c.id) })
  }

  function handleDuplicate(compressorId: string): void {
    if (!auditId || !roomId || !rackId) return
    duplicateCompressor.mutate({ auditId, roomId, rackId, compressorId }, { onSuccess: (c) => goToCompressor(c.id) })
  }

  function handleNext(): void {
    void navigate(`/audit/${auditId}/section/refrigeration/rack/${rackId}/condenser`)
  }

  if (machineRoomsQ.isLoading || ((rackQ.isLoading || compressorsQ.isLoading) && !!roomId)) {
    return (
      <div className="space-y-3 pb-24" aria-busy="true" aria-label="Loading compressors">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (machineRoomsQ.isError || rackQ.isError || compressorsQ.isError) {
    return (
      <p role="alert" className="text-sm text-danger mt-4">
        Could not load compressors. Please go back and try again.
      </p>
    )
  }

  // Redirect to General page if no machine room exists (e.g. direct URL navigation).
  if (machineRoomsQ.data?.machineRooms.length === 0) {
    return <Navigate to={`/audit/${auditId}/section/refrigeration`} replace />
  }

  const compressors = compressorsQ.data?.compressors ?? []
  const rackNumber = rackQ.data?.rackNumber
  const mutationPending = createCompressor.isPending || duplicateCompressor.isPending

  return (
    <div className="pb-24">
      <AuditBreadcrumb
        segments={[
          { label: 'Refrigeration', to: `/audit/${auditId}` },
          { label: rackNumber ? `Rack ${rackNumber}` : 'Rack …', to: rackGeneralUrl },
          { label: 'Compressors' },
        ]}
      />

      <h1 className="text-xl font-semibold mb-6">Compressors</h1>

      <ul data-testid="compressor-list" className="space-y-3">
        {compressors.length === 0 && (
          <li className="text-sm text-muted">No compressors yet — tap “Add Compressor” to start.</li>
        )}
        {compressors.map((compressor) => {
          const status = getCompressorStatus(compressor)
          return (
            <li
              key={compressor.id}
              data-testid={`compressor-card-${compressor.id}`}
              className="border border-border rounded-md p-3 flex items-center justify-between gap-3"
            >
              <button
                type="button"
                onClick={() => goToCompressor(compressor.id)}
                className="flex-1 text-left min-h-[48px] flex items-center gap-2"
              >
                <span className="font-medium">{getCompressorLabel(compressor)}</span>
                <Badge data-testid={`compressor-status-${compressor.id}`} variant={STATUS_VARIANT[status]}>
                  {status}
                </Badge>
              </button>
              <button
                type="button"
                data-testid={`duplicate-compressor-${compressor.id}`}
                onClick={() => handleDuplicate(compressor.id)}
                disabled={mutationPending}
                className="text-sm text-primary underline min-h-[48px] min-w-[48px] px-2 disabled:opacity-50"
              >
                Duplicate
              </button>
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        data-testid="add-compressor-btn"
        onClick={handleAdd}
        disabled={mutationPending}
        className="mt-4 w-full border border-primary text-primary rounded-md text-base font-semibold p-3 min-h-[48px] disabled:opacity-60"
      >
        + Add Compressor
      </button>

      <button
        type="button"
        data-testid="next-btn"
        onClick={handleNext}
        className={cn(
          'fixed bottom-0 left-0 right-0 bg-primary text-primary-foreground text-base font-semibold p-4',
          'pb-[env(safe-area-inset-bottom)] min-h-[64px] z-10',
        )}
      >
        Next
      </button>
    </div>
  )
}
