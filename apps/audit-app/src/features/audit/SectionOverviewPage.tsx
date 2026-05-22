import type { JSX } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Progress, Skeleton } from '@cems/ui'
import { SECTION_IDS, type AuditSectionState, type SectionId } from '@cems/types'
import { useAuditDetail } from './audit-api'

const SECTION_LABELS: Record<SectionId, string> = {
  general: 'General',
  refrigeration: 'Refrigeration',
  hvac: 'HVAC',
  lighting: 'Lighting',
  'building-envelope': 'Building Envelope',
}

type SectionStatus = 'not-started' | 'in-progress' | 'complete'

function hasMeaningfulContent(data: unknown): boolean {
  if (data == null || typeof data !== 'object') return false
  return Object.values(data as Record<string, unknown>).some((v) => {
    if (v == null) return false
    if (typeof v === 'string') return v.trim().length > 0
    if (Array.isArray(v)) return v.length > 0
    if (typeof v === 'object') return Object.keys(v as object).length > 0
    return true
  })
}

function deriveStatus(section: AuditSectionState | undefined): SectionStatus {
  if (!section) return 'not-started'
  if (section.completedAt) return 'complete'
  // P5 — only count fields with NON-EMPTY values; a section row that was
  // touched then cleared (or only carries empty-string form defaults)
  // should return to "Not Started".
  if (hasMeaningfulContent(section.data)) return 'in-progress'
  return 'not-started'
}

const STATUS_LABEL: Record<SectionStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  complete: 'Complete',
}

export function SectionOverviewPage(): JSX.Element {
  const { auditId } = useParams<{ auditId: string }>()
  const auditQ = useAuditDetail(auditId ?? null)

  const sectionsByid = new Map<SectionId, AuditSectionState>()
  if (auditQ.data) {
    for (const s of auditQ.data.sections) sectionsByid.set(s.sectionId, s)
  }

  const completeCount = SECTION_IDS.filter(
    (id) => deriveStatus(sectionsByid.get(id)) === 'complete',
  ).length

  return (
    <section aria-labelledby="section-overview-heading">
      <nav aria-label="breadcrumb" className="mb-4 text-sm text-muted">
        <Link to="/" className="underline">
          ← Stores
        </Link>
      </nav>

      <h1 id="section-overview-heading" className="text-2xl font-semibold">
        Audit sections
      </h1>

      {auditQ.isLoading && (
        <div role="status" className="mt-6 space-y-3" aria-busy="true" aria-label="Loading audit">
          {SECTION_IDS.map((id) => (
            <Skeleton key={id} className="h-12 w-full" />
          ))}
        </div>
      )}

      {!auditId && (
        <p role="alert" className="mt-4 text-sm text-danger">
          Invalid audit link — please go back to Stores.
        </p>
      )}

      {auditQ.isError && (
        <p role="alert" className="mt-4 text-sm text-danger">
          Could not load audit. Please go back and try again.
        </p>
      )}

      {auditQ.data && (
        <>
          <p className="mt-1 text-sm text-muted">
            {completeCount} of {SECTION_IDS.length} sections complete
          </p>
          <Progress
            value={(completeCount / SECTION_IDS.length) * 100}
            aria-label="Audit completion"
            className="mt-2"
          />

          {auditQ.data.currentSectionId && (
            <div className="mt-4">
              <Link
                to={`/audit/${auditQ.data.id}/section/${auditQ.data.currentSectionId}`}
                data-testid="continue-cta"
                className="inline-flex min-h-[48px] items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Continue {SECTION_LABELS[auditQ.data.currentSectionId]}
              </Link>
            </div>
          )}

          <ul className="mt-6 space-y-3" aria-label="Audit sections">
            {SECTION_IDS.map((id) => {
              const status = deriveStatus(sectionsByid.get(id))
              const label = SECTION_LABELS[id]
              return (
                <li key={id}>
                  <SectionCard auditId={auditQ.data.id} sectionId={id} label={label} status={status} />
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

function SectionCard({
  auditId,
  sectionId,
  label,
  status,
}: {
  auditId: string
  sectionId: SectionId
  label: string
  status: SectionStatus
}): JSX.Element {
  const borderClass =
    status === 'complete'
      ? 'border-success'
      : status === 'in-progress'
        ? 'border-primary'
        : 'border-border'
  return (
    <Link
      to={`/audit/${auditId}/section/${sectionId}`}
      aria-label={`${label}: ${STATUS_LABEL[status]}`}
      className={`flex min-h-[48px] items-center justify-between rounded border transition-colors duration-200 ${borderClass} bg-surface px-4 py-3 hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
      data-testid={`section-card-${sectionId}`}
    >
      <span className="font-medium">{label}</span>
      {status === 'complete' ? (
        <span className="flex items-center gap-1 text-xs font-medium text-success">
          <span aria-hidden="true">✓</span>
          {STATUS_LABEL[status]}
        </span>
      ) : (
        <span className="text-xs text-muted">{STATUS_LABEL[status]}</span>
      )}
    </Link>
  )
}
