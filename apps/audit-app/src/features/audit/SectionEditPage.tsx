import { useEffect, type JSX } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Button, Input, Skeleton } from '@cems/ui'
import {
  SECTION_IDS,
  type AuditSectionState,
  type SectionId,
} from '@cems/types'
import { useAuditDetail } from './audit-api'
import { useAutoSaveSection } from './useAutoSaveSection'
import { AutoSaveIndicator } from './AutoSaveIndicator'
import { OfflineBanner } from './OfflineBanner'

const SECTION_LABELS: Record<SectionId, string> = {
  general: 'General',
  refrigeration: 'Refrigeration',
  hvac: 'HVAC',
  lighting: 'Lighting',
  'building-envelope': 'Building Envelope',
}

const COMING_SOON_BY_SECTION: Partial<Record<SectionId, string>> = {
  refrigeration: 'Refrigeration data collection arrives in Story 3.x.',
  hvac: 'HVAC section forms arrive in Story 5.2.',
  lighting: 'Lighting section forms arrive in Story 5.3.',
  'building-envelope': 'Building Envelope section forms arrive in Story 5.3.',
}

function isValidSection(id: string | undefined): id is SectionId {
  return typeof id === 'string' && (SECTION_IDS as readonly string[]).includes(id)
}

export function SectionEditPage(): JSX.Element {
  const { auditId, sectionId } = useParams<{ auditId: string; sectionId: string }>()

  if (!isValidSection(sectionId)) {
    return <Navigate to={auditId ? `/audit/${auditId}` : '/'} replace />
  }

  return <SectionEditView auditId={auditId ?? ''} sectionId={sectionId} />
}

function SectionEditView({
  auditId,
  sectionId,
}: {
  auditId: string
  sectionId: SectionId
}): JSX.Element {
  const auditQ = useAuditDetail(auditId || null)
  const autoSave = useAutoSaveSection(auditId || null, sectionId)

  const initial =
    auditQ.data?.sections.find((s) => s.sectionId === sectionId)?.data ?? {}

  return (
    <>
      <OfflineBanner lastSavedAt={autoSave.lastSavedAt} />
      <section aria-labelledby="section-edit-heading">
        <nav aria-label="breadcrumb" className="mb-4 text-sm text-muted">
          <Link to={`/audit/${auditId}`} className="underline">
            ← Audit overview
          </Link>
        </nav>

        <div className="flex items-center justify-between">
          <h1 id="section-edit-heading" className="text-2xl font-semibold">
            {SECTION_LABELS[sectionId]}
          </h1>
          <AutoSaveIndicator state={autoSave.state} />
        </div>

        {auditQ.isLoading && (
          <div className="mt-6 space-y-3" aria-busy="true" aria-label="Loading section">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {auditQ.isError && (
          <p role="alert" className="mt-4 text-sm text-danger">
            Could not load audit. Please go back and try again.
          </p>
        )}

        {auditQ.data && (
          <div className="mt-6">
            {sectionId === 'general' ? (
              <GeneralSectionForm
                initial={initial}
                section={auditQ.data.sections.find((s) => s.sectionId === 'general')}
                onChange={autoSave.save}
              />
            ) : (
              <ComingSoonSection sectionId={sectionId} onSaveTest={autoSave.save} />
            )}
          </div>
        )}
      </section>
    </>
  )
}

interface GeneralFormShape {
  auditDate: string
  weatherConditions: string
  onSiteContact: string
  generalNotes: string
}

function GeneralSectionForm({
  initial,
  section: _section,
  onChange,
}: {
  initial: Record<string, unknown>
  section: AuditSectionState | undefined
  onChange: (data: Record<string, unknown>) => void
}): JSX.Element {
  const { register, watch, getValues } = useForm<GeneralFormShape>({
    defaultValues: {
      auditDate: typeof initial['auditDate'] === 'string' ? (initial['auditDate'] as string) : '',
      weatherConditions:
        typeof initial['weatherConditions'] === 'string' ? (initial['weatherConditions'] as string) : '',
      onSiteContact:
        typeof initial['onSiteContact'] === 'string' ? (initial['onSiteContact'] as string) : '',
      generalNotes:
        typeof initial['generalNotes'] === 'string' ? (initial['generalNotes'] as string) : '',
    },
  })

  useEffect(() => {
    const subscription = watch(() => {
      onChange({ ...getValues() })
    })
    return () => subscription.unsubscribe()
  }, [watch, getValues, onChange])

  return (
    <form className="space-y-4" aria-label="General section">
      <div className="block text-sm">
        <label htmlFor="general-audit-date" className="mb-1 block font-medium">
          Audit date
        </label>
        <Input
          id="general-audit-date"
          type="date"
          {...register('auditDate')}
          data-testid="general-audit-date"
        />
      </div>
      <div className="block text-sm">
        <label htmlFor="general-weather" className="mb-1 block font-medium">
          Weather conditions
        </label>
        <Input
          id="general-weather"
          type="text"
          placeholder="e.g. Sunny, 18°C"
          {...register('weatherConditions')}
          data-testid="general-weather"
        />
      </div>
      <div className="block text-sm">
        <label htmlFor="general-contact" className="mb-1 block font-medium">
          On-site contact
        </label>
        <Input
          id="general-contact"
          type="text"
          placeholder="Name + role"
          {...register('onSiteContact')}
          data-testid="general-contact"
        />
      </div>
      <div className="block text-sm">
        <label htmlFor="general-notes" className="mb-1 block font-medium">
          General notes
        </label>
        <textarea
          id="general-notes"
          {...register('generalNotes')}
          data-testid="general-notes"
          className="min-h-[96px] w-full rounded border border-border bg-surface px-3 py-2"
        />
      </div>
    </form>
  )
}

function ComingSoonSection({
  sectionId,
  onSaveTest,
}: {
  sectionId: SectionId
  onSaveTest: (data: Record<string, unknown>) => void
}): JSX.Element {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{COMING_SOON_BY_SECTION[sectionId] ?? 'Coming soon.'}</p>
      <Button
        type="button"
        variant="ghost"
        onClick={() => onSaveTest({ touched: true, at: new Date().toISOString() })}
        data-testid="stub-save"
      >
        Save test value (auto-save proof)
      </Button>
    </div>
  )
}
