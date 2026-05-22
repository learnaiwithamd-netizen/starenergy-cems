import { useEffect, useState, type JSX } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useForm, Controller, type SubmitErrorHandler } from 'react-hook-form'
import { Skeleton, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Input, cn } from '@cems/ui'
import {
  VENTILATION_TYPE_OPTIONS,
  CONNECTED_TO_EXHAUST_OPTIONS,
  VENTILATION_CONTROL_BY_OPTIONS,
} from '@cems/types'
import { AuditBreadcrumb } from './AuditBreadcrumb'
import { FieldHelpTooltip } from './FieldHelpTooltip'
import { AutoSaveIndicator } from './AutoSaveIndicator'
import { OfflineBanner } from './OfflineBanner'
import { useMachineRooms, useAutoSaveMachineRoom } from './machine-room-api'

interface VentilationFormValues {
  ventilationType: string
  connectedToExhaust: string
  setPointOn: string
  setPointOff: string
  controlBy: string
}

/** Parse a numeric-input string, returning undefined for blank/non-finite input
 *  (an `<input type="number">` can hold intermediate junk like "5e" or "-"). */
function toNum(s: string): number | undefined {
  if (s.trim() === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

export function MachineRoomVentilationPage(): JSX.Element {
  const { auditId } = useParams<{ auditId: string }>()
  const navigate = useNavigate()
  const [attempted, setAttempted] = useState(false)

  const machineRoomsQ = useMachineRooms(auditId ?? null)
  const roomId = machineRoomsQ.data?.machineRooms[0]?.id ?? null
  const autoSave = useAutoSaveMachineRoom(auditId ?? null, roomId)
  // `save` is a stable useCallback; destructure so the auto-save effect can
  // depend on it without re-subscribing on every save-state transition.
  const { save: saveRoom } = autoSave

  const {
    control,
    handleSubmit,
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<VentilationFormValues>({
    mode: 'onSubmit',
    defaultValues: {
      ventilationType: '',
      connectedToExhaust: 'No',
      setPointOn: '',
      setPointOff: '',
      controlBy: '',
    },
  })

  const ventilationType = watch('ventilationType')
  const isForced = ventilationType === 'Forced'

  // Hydrate form from saved data once machine rooms load
  useEffect(() => {
    const room = machineRoomsQ.data?.machineRooms[0]
    if (!room) return
    const ventilation = room.data?.['ventilation'] as Partial<VentilationFormValues> | undefined
    if (!ventilation) return
    if (ventilation.ventilationType) setValue('ventilationType', ventilation.ventilationType)
    if (ventilation.connectedToExhaust) setValue('connectedToExhaust', ventilation.connectedToExhaust)
    if (ventilation.setPointOn != null) setValue('setPointOn', String(ventilation.setPointOn))
    if (ventilation.setPointOff != null) setValue('setPointOff', String(ventilation.setPointOff))
    if (ventilation.controlBy) setValue('controlBy', ventilation.controlBy)
  }, [machineRoomsQ.data, setValue])

  // Reset hidden fields when ventilation type changes to Natural
  useEffect(() => {
    if (!isForced) {
      setValue('setPointOn', '', { shouldValidate: false })
      setValue('setPointOff', '', { shouldValidate: false })
      setValue('controlBy', '', { shouldValidate: false })
      setValue('connectedToExhaust', 'No', { shouldValidate: false })
    }
  }, [isForced, setValue])

  // Auto-save on any field change. Sends only the `ventilation` sub-key — the
  // repo top-level-merges it, preserving `general` / `exhaust` server-side.
  // Depend on the stable `autoSave.save`, not the churning `autoSave` object.
  useEffect(() => {
    const subscription = watch(() => {
      const values = getValues()
      const ventilation = {
        ventilationType: values.ventilationType || undefined,
        connectedToExhaust: values.connectedToExhaust || undefined,
        setPointOn: toNum(values.setPointOn),
        setPointOff: toNum(values.setPointOff),
        controlBy: values.controlBy || undefined,
      }
      saveRoom({ ventilation })
    })
    return () => subscription.unsubscribe()
  }, [watch, getValues, saveRoom])

  const onInvalid: SubmitErrorHandler<VentilationFormValues> = () => {
    setAttempted(true)
  }

  const onValid = () => {
    autoSave.flush()
    void navigate(`/audit/${auditId}/section/refrigeration/exhaust`)
  }

  const ventTypeError = attempted && !!errors.ventilationType
  const setPointOffError = attempted && !!errors.setPointOff
  const errorCount = (ventTypeError ? 1 : 0) + (setPointOffError ? 1 : 0)

  if (machineRoomsQ.isLoading) {
    return (
      <div className="space-y-3 pb-24" aria-busy="true" aria-label="Loading ventilation">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (machineRoomsQ.isError) {
    return (
      <p role="alert" className="text-sm text-danger mt-4">
        Could not load machine room. Please go back and try again.
      </p>
    )
  }

  // Redirect to General page if no machine room exists (e.g. direct URL navigation).
  if (machineRoomsQ.data?.machineRooms.length === 0) {
    return <Navigate to={`/audit/${auditId}/section/refrigeration`} replace />
  }

  return (
    <div className="pb-24">
      <OfflineBanner lastSavedAt={autoSave.lastSavedAt} />
      <AuditBreadcrumb
        segments={[
          { label: 'Refrigeration', to: `/audit/${auditId}` },
          { label: 'Machine Room', to: `/audit/${auditId}/section/refrigeration` },
          { label: 'Ventilation' },
        ]}
      />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Machine Room — Ventilation</h1>
        <AutoSaveIndicator state={autoSave.state} />
      </div>

      <form
        onSubmit={handleSubmit(onValid, onInvalid)}
        aria-label="Machine Room Ventilation"
        className="space-y-6"
      >
        {/* Ventilation Type (required) */}
        <div>
          <div className="flex items-center mb-1">
            <p className="text-sm font-medium" id="vent-type-label">
              Ventilation Type*
            </p>
            <FieldHelpTooltip
              content="Forced = mechanical fan; Natural = louvers/opening in wall"
              label="Ventilation type help"
            />
          </div>
          <Controller
            control={control}
            name="ventilationType"
            rules={{ required: true }}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger
                  data-testid="vent-type"
                  aria-labelledby="vent-type-label"
                  aria-required="true"
                  aria-invalid={ventTypeError}
                  className={cn('min-h-[48px]', ventTypeError && 'border-danger animate-shake')}
                >
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {VENTILATION_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {ventTypeError && (
            <p className="text-xs text-danger mt-1" role="alert">
              Ventilation Type is required.
            </p>
          )}
        </div>

        {/* Connected to Exhaust (always visible) */}
        <div>
          <div className="flex items-center mb-1">
            <p className="text-sm font-medium" id="exhaust-label">
              Connected to Exhaust
            </p>
            <FieldHelpTooltip
              content="Whether the ventilation is connected to the exhaust system"
              label="Connected to exhaust help"
            />
          </div>
          <Controller
            control={control}
            name="connectedToExhaust"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger
                  data-testid="connected-exhaust"
                  aria-labelledby="exhaust-label"
                  className="min-h-[48px]"
                >
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {CONNECTED_TO_EXHAUST_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Conditional fields — only shown when Forced */}
        {isForced && (
          <>
            {/* Set point ON */}
            <div>
              <div className="flex items-center mb-1">
                <label className="text-sm font-medium" htmlFor="set-point-on">
                  Set point ON (°F)
                </label>
                <FieldHelpTooltip
                  content="Temperature at which ventilation activates"
                  label="Set point ON help"
                />
              </div>
              <Controller
                control={control}
                name="setPointOn"
                render={({ field }) => (
                  <Input
                    id="set-point-on"
                    data-testid="set-point-on"
                    type="number"
                    className="min-h-[48px]"
                    {...field}
                  />
                )}
              />
            </div>

            {/* Set point OFF — cross-field validation */}
            <div>
              <div className="flex items-center mb-1">
                <label className="text-sm font-medium" htmlFor="set-point-off">
                  Set point OFF (°F)
                </label>
                <FieldHelpTooltip
                  content="Must be lower than ON set point"
                  label="Set point OFF help"
                />
              </div>
              <Controller
                control={control}
                name="setPointOff"
                rules={{
                  validate: {
                    offLowerThanOn: (v, fv) => {
                      if (fv.ventilationType !== 'Forced') return true
                      if (!v || !fv.setPointOn) return true
                      return (
                        Number(v) < Number(fv.setPointOn) ||
                        'OFF set point must be lower than ON set point for cooling ventilation.'
                      )
                    },
                  },
                }}
                render={({ field }) => (
                  <Input
                    id="set-point-off"
                    data-testid="set-point-off"
                    type="number"
                    aria-invalid={setPointOffError}
                    className={cn('min-h-[48px]', setPointOffError && 'border-danger animate-shake')}
                    {...field}
                  />
                )}
              />
              {setPointOffError && errors.setPointOff?.message && (
                <p className="text-xs text-danger mt-1" role="alert" data-testid="setpoint-off-error">
                  {errors.setPointOff.message}
                </p>
              )}
            </div>

            {/* Control by */}
            <div>
              <div className="flex items-center mb-1">
                <p className="text-sm font-medium" id="control-by-label">
                  Control by
                </p>
                <FieldHelpTooltip
                  content="What activates the fan"
                  label="Control by help"
                />
              </div>
              <Controller
                control={control}
                name="controlBy"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger
                      data-testid="control-by"
                      aria-labelledby="control-by-label"
                      className="min-h-[48px]"
                    >
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {VENTILATION_CONTROL_BY_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </>
        )}

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
