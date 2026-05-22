import { useEffect, useState, type JSX } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useForm, Controller, type SubmitErrorHandler } from 'react-hook-form'
import { Skeleton, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Input, cn } from '@cems/ui'
import {
  RACK_DESIGNATION_OPTIONS,
  RACK_TYPE_OPTIONS,
  RACK_MAKE_OPTIONS,
  RACK_REFRIGERANT_OPTIONS,
  RACK_AGE_YEAR_OPTIONS,
  RACK_RETROFIT_YEAR_OPTIONS,
} from '@cems/types'
import { AuditBreadcrumb } from './AuditBreadcrumb'
import { FieldHelpTooltip } from './FieldHelpTooltip'
import { AutoSaveIndicator } from './AutoSaveIndicator'
import { OfflineBanner } from './OfflineBanner'
import { useMachineRooms } from './machine-room-api'
import { useRack, useAutoSaveRack } from './rack-api'
import { ApiError } from '../../lib/api-client'

const str = (v: unknown): string => (v == null ? '' : String(v))

interface RackGeneralFormValues {
  rackDesignation: string
  rackType: string
  rackMake: string
  rackModelSerial: string
  ageYear: string
  lastRetrofitYear: string
  refrigerant: string
  comment: string
}

export function RackGeneralPage(): JSX.Element {
  const { auditId, rackId } = useParams<{ auditId: string; rackId: string }>()
  const navigate = useNavigate()
  const [attempted, setAttempted] = useState(false)

  const machineRoomsQ = useMachineRooms(auditId ?? null)
  const roomId = machineRoomsQ.data?.machineRooms[0]?.id ?? null
  const rackQ = useRack(auditId ?? null, roomId, rackId ?? null)
  const autoSave = useAutoSaveRack(auditId ?? null, roomId, rackId ?? null)
  // `save` is a stable useCallback; destructuring lets the auto-save effect
  // depend on it directly without re-subscribing on every save-state change.
  const { save: saveRack } = autoSave

  const {
    control,
    handleSubmit,
    watch,
    getValues,
    reset,
    formState: { errors },
  } = useForm<RackGeneralFormValues>({
    mode: 'onSubmit',
    defaultValues: {
      rackDesignation: '',
      rackType: '',
      rackMake: '',
      rackModelSerial: '',
      ageYear: '',
      lastRetrofitYear: '',
      refrigerant: '',
      comment: '',
    },
  })

  // Hydrate the form from saved rack data. `reset` (vs per-field setValue) also
  // CLEARS stale fields, so navigating between racks — or to a freshly
  // duplicated rack whose `general` lacks some keys — never bleeds the previous
  // rack's values into the new one. Keyed on rackId + the loaded data.
  useEffect(() => {
    if (!rackQ.data) return
    const general = (rackQ.data.data?.['general'] ?? {}) as Record<string, unknown>
    reset({
      rackDesignation: str(general['rackDesignation']),
      rackType: str(general['rackType']),
      rackMake: str(general['rackMake']),
      rackModelSerial: str(general['rackModelSerial']),
      ageYear: str(general['ageYear']),
      lastRetrofitYear: str(general['lastRetrofitYear']),
      refrigerant: str(general['refrigerant']),
      comment: str(general['comment']),
    })
  }, [rackId, rackQ.data, reset])

  // Auto-save on any field change. Depend on the STABLE `saveRack` (a
  // useCallback) rather than the `autoSave` object, whose identity changes on
  // every save-state transition and would needlessly churn this subscription.
  useEffect(() => {
    const subscription = watch(() => {
      saveRack({ general: getValues() })
    })
    return () => subscription.unsubscribe()
  }, [watch, getValues, saveRack])

  const onInvalid: SubmitErrorHandler<RackGeneralFormValues> = () => {
    setAttempted(true)
  }

  const onValid = () => {
    autoSave.flush()
    void navigate(`/audit/${auditId}/section/refrigeration/rack/${rackId}/compressors`)
  }

  const designationError = attempted && !!errors.rackDesignation
  const errorCount = designationError ? 1 : 0

  if (machineRoomsQ.isLoading || (rackQ.isLoading && !!roomId)) {
    return (
      <div className="space-y-3 pb-24" aria-busy="true" aria-label="Loading rack">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  // A 404 means the rack doesn't exist (stale/foreign id, or deleted) — route
  // back to the rack list rather than dead-ending on an error alert.
  if (rackQ.isError && rackQ.error instanceof ApiError && rackQ.error.status === 404) {
    return <Navigate to={`/audit/${auditId}/section/refrigeration/racks`} replace />
  }

  if (machineRoomsQ.isError || rackQ.isError) {
    return (
      <p role="alert" className="text-sm text-danger mt-4">
        Could not load rack. Please go back and try again.
      </p>
    )
  }

  // Redirect to General page if no machine room exists (e.g. direct URL navigation).
  if (machineRoomsQ.data?.machineRooms.length === 0) {
    return <Navigate to={`/audit/${auditId}/section/refrigeration`} replace />
  }

  const rackNumber = rackQ.data?.rackNumber

  return (
    <div className="pb-24">
      <OfflineBanner lastSavedAt={autoSave.lastSavedAt} />
      <AuditBreadcrumb
        segments={[
          { label: 'Refrigeration', to: `/audit/${auditId}` },
          { label: 'Machine Room', to: `/audit/${auditId}/section/refrigeration` },
          { label: 'Racks', to: `/audit/${auditId}/section/refrigeration/racks` },
          { label: rackNumber ? `Rack ${rackNumber}` : 'Rack …' },
        ]}
      />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Rack — General</h1>
        <AutoSaveIndicator state={autoSave.state} />
      </div>

      <form
        onSubmit={handleSubmit(onValid, onInvalid)}
        aria-label="Rack General"
        className="space-y-6"
      >
        {/* Rack Name / Designation (required) */}
        <div>
          <div className="flex items-center mb-1">
            <p className="text-sm font-medium" id="rack-designation-label">
              Rack Name/Designation*
            </p>
            <FieldHelpTooltip
              content="A unique letter or number identifying this rack within the machine room"
              label="Rack designation help"
            />
          </div>
          <Controller
            control={control}
            name="rackDesignation"
            rules={{ required: true }}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger
                  data-testid="rack-designation"
                  aria-labelledby="rack-designation-label"
                  aria-required="true"
                  aria-invalid={designationError}
                  className={cn('min-h-[48px]', designationError && 'border-danger animate-shake')}
                >
                  <SelectValue placeholder="Select designation" />
                </SelectTrigger>
                <SelectContent>
                  {RACK_DESIGNATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {designationError && (
            <p className="text-xs text-danger mt-1" role="alert">
              Rack Name/Designation is required.
            </p>
          )}
        </div>

        {/* Rack Type */}
        <div>
          <div className="flex items-center mb-1">
            <p className="text-sm font-medium" id="rack-type-label">
              Rack Type
            </p>
            <FieldHelpTooltip content="Operating temperature class of the rack" label="Rack type help" />
          </div>
          <Controller
            control={control}
            name="rackType"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger data-testid="rack-type" aria-labelledby="rack-type-label" className="min-h-[48px]">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {RACK_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Rack Make */}
        <div>
          <div className="flex items-center mb-1">
            <p className="text-sm font-medium" id="rack-make-label">
              Rack Make
            </p>
            <FieldHelpTooltip content="Manufacturer of the refrigeration rack" label="Rack make help" />
          </div>
          <Controller
            control={control}
            name="rackMake"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger data-testid="rack-make" aria-labelledby="rack-make-label" className="min-h-[48px]">
                  <SelectValue placeholder="Select make" />
                </SelectTrigger>
                <SelectContent>
                  {RACK_MAKE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Rack Model / Serial Number */}
        <div>
          <div className="flex items-center mb-1">
            <label className="text-sm font-medium" htmlFor="rack-model-serial">
              Rack Model/Serial Number
            </label>
            <FieldHelpTooltip content="Model or serial number from the rack nameplate" label="Model/serial help" />
          </div>
          <Controller
            control={control}
            name="rackModelSerial"
            render={({ field }) => (
              <Input
                id="rack-model-serial"
                data-testid="rack-model-serial"
                className="min-h-[48px]"
                {...field}
              />
            )}
          />
        </div>

        {/* Age — Year of Manufacturing */}
        <div>
          <div className="flex items-center mb-1">
            <p className="text-sm font-medium" id="age-year-label">
              Age — Year of Manufacturing
            </p>
            <FieldHelpTooltip content="The year the rack was originally manufactured" label="Year of manufacturing help" />
          </div>
          <Controller
            control={control}
            name="ageYear"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger data-testid="age-year" aria-labelledby="age-year-label" className="min-h-[48px]">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {RACK_AGE_YEAR_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Year of Last Major Retrofit */}
        <div>
          <div className="flex items-center mb-1">
            <p className="text-sm font-medium" id="last-retrofit-year-label">
              Year of Last Major Retrofit
            </p>
            <FieldHelpTooltip content="The year of the most recent major retrofit, if any" label="Last retrofit help" />
          </div>
          <Controller
            control={control}
            name="lastRetrofitYear"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger
                  data-testid="last-retrofit-year"
                  aria-labelledby="last-retrofit-year-label"
                  className="min-h-[48px]"
                >
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {RACK_RETROFIT_YEAR_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Refrigerant */}
        <div>
          <div className="flex items-center mb-1">
            <p className="text-sm font-medium" id="refrigerant-label">
              Refrigerant
            </p>
            <FieldHelpTooltip content="Primary refrigerant charged in this rack" label="Refrigerant help" />
          </div>
          <Controller
            control={control}
            name="refrigerant"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger data-testid="refrigerant" aria-labelledby="refrigerant-label" className="min-h-[48px]">
                  <SelectValue placeholder="Select refrigerant" />
                </SelectTrigger>
                <SelectContent>
                  {RACK_REFRIGERANT_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Comment */}
        <div>
          <div className="flex items-center mb-1">
            <label className="text-sm font-medium" htmlFor="comment-field">
              Comment
            </label>
            <FieldHelpTooltip content="Any additional notes about this rack" label="Comment help" />
          </div>
          <Controller
            control={control}
            name="comment"
            render={({ field }) => (
              <Input id="comment-field" data-testid="comment-field" className="min-h-[48px]" {...field} />
            )}
          />
        </div>

        {/* Fixed Next button */}
        <button
          type="submit"
          data-testid="next-btn"
          className="fixed bottom-0 left-0 right-0 bg-primary text-primary-foreground text-base font-semibold p-4 pb-[env(safe-area-inset-bottom)] min-h-[64px] z-10"
        >
          {attempted && errorCount > 0
            ? `Next (${errorCount} required field${errorCount !== 1 ? 's' : ''} remaining)`
            : 'Next'}
        </button>
      </form>
    </div>
  )
}
