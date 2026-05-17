import type { JSX } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Skeleton, Badge, cn } from '@cems/ui'
import type { Rack } from '@cems/types'
import { AuditBreadcrumb } from './AuditBreadcrumb'
import { useMachineRooms } from './machine-room-api'
import { useRacks, useCreateRack, useDuplicateRack } from './rack-api'

type RackStatus = 'Not Started' | 'In Progress' | 'Complete'

/** Derive a rack's completion status from its saved data blob. */
function getRackStatus(rack: Rack): RackStatus {
  const general = rack.data['general'] as { rackDesignation?: string } | undefined
  if (general?.rackDesignation) return 'Complete'
  if (Object.keys(rack.data).length > 0) return 'In Progress'
  return 'Not Started'
}

/** Display label for a rack — its chosen designation or a numeric fallback. */
function getRackLabel(rack: Rack): string {
  const general = rack.data['general'] as { rackDesignation?: string } | undefined
  if (general?.rackDesignation) return `Rack ${general.rackDesignation}`
  return `Rack ${rack.rackNumber}`
}

const STATUS_VARIANT: Record<RackStatus, 'outline' | 'warning' | 'success'> = {
  'Not Started': 'outline',
  'In Progress': 'warning',
  Complete: 'success',
}

export function RackListPage(): JSX.Element {
  const { auditId } = useParams<{ auditId: string }>()
  const navigate = useNavigate()

  const machineRoomsQ = useMachineRooms(auditId ?? null)
  const roomId = machineRoomsQ.data?.machineRooms[0]?.id ?? null
  const racksQ = useRacks(auditId ?? null, roomId)

  const createRack = useCreateRack()
  const duplicateRack = useDuplicateRack()

  const generalUrl = `/audit/${auditId}/section/refrigeration`

  function goToRack(rackId: string): void {
    void navigate(`${generalUrl}/rack/${rackId}/general`)
  }

  function handleAdd(): void {
    if (!auditId || !roomId) return
    createRack.mutate({ auditId, roomId }, { onSuccess: (rack) => goToRack(rack.id) })
  }

  function handleDuplicate(rackId: string): void {
    if (!auditId || !roomId) return
    duplicateRack.mutate({ auditId, roomId, rackId }, { onSuccess: (rack) => goToRack(rack.id) })
  }

  if (machineRoomsQ.isLoading || (racksQ.isLoading && !!roomId)) {
    return (
      <div className="space-y-3 pb-24" aria-busy="true" aria-label="Loading racks">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (machineRoomsQ.isError || racksQ.isError) {
    return (
      <p role="alert" className="text-sm text-danger mt-4">
        Could not load racks. Please go back and try again.
      </p>
    )
  }

  // Redirect to General page if no machine room exists (e.g. direct URL navigation).
  if (machineRoomsQ.data?.machineRooms.length === 0) {
    return <Navigate to={generalUrl} replace />
  }

  const racks = racksQ.data?.racks ?? []
  const mutationPending = createRack.isPending || duplicateRack.isPending

  return (
    <div className="pb-24">
      <AuditBreadcrumb
        segments={[
          { label: 'Refrigeration', to: `/audit/${auditId}` },
          { label: 'Machine Room', to: generalUrl },
          { label: 'Racks' },
        ]}
      />

      <h1 className="text-xl font-semibold mb-6">Refrigeration Racks</h1>

      <ul data-testid="rack-list" className="space-y-3">
        {racks.length === 0 && (
          <li className="text-sm text-muted">No racks yet — tap “Add Rack” to start.</li>
        )}
        {racks.map((rack) => {
          const status = getRackStatus(rack)
          return (
            <li
              key={rack.id}
              data-testid={`rack-card-${rack.id}`}
              className="border border-border rounded-md p-3 flex items-center justify-between gap-3"
            >
              <button
                type="button"
                onClick={() => goToRack(rack.id)}
                className="flex-1 text-left min-h-[48px] flex items-center gap-2"
              >
                <span className="font-medium">{getRackLabel(rack)}</span>
                <Badge data-testid={`rack-status-${rack.id}`} variant={STATUS_VARIANT[status]}>
                  {status}
                </Badge>
              </button>
              <button
                type="button"
                data-testid={`duplicate-rack-${rack.id}`}
                onClick={() => handleDuplicate(rack.id)}
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
        data-testid="add-rack-btn"
        onClick={handleAdd}
        disabled={mutationPending}
        className={cn(
          'fixed bottom-0 left-0 right-0 bg-primary text-primary-foreground text-base font-semibold p-4',
          'pb-[env(safe-area-inset-bottom)] min-h-[64px] z-10 disabled:opacity-60',
        )}
      >
        + Add Rack
      </button>
    </div>
  )
}
