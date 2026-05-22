import { useEffect, useState, type JSX } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useForm, Controller, type SubmitErrorHandler } from 'react-hook-form'
import { Skeleton, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Input, cn } from '@cems/ui'
import { EXHAUST_TYPE_OPTIONS, EXHAUST_CONTROL_BY_OPTIONS, EXHAUST_QTY_OPTIONS } from '@cems/types'
import { AuditBreadcrumb } from './AuditBreadcrumb'
import { FieldHelpTooltip } from './FieldHelpTooltip'
import { AutoSaveIndicator } from './AutoSaveIndicator'
import { OfflineBanner } from './OfflineBanner'
import { useMachineRooms, useAutoSaveMachineRoom } from './machine-room-api'

interface ExhaustFormValues {
  exhaustType: string
  qtyOfFans: string
  hpOfMotor: string
  powerRatingW: string
  setPointOn: string
  setPointOff: string
  controlBy: string
  comment: string
}

/** Parse a numeric-input string, returning undefined for blank/non-finite input
 *  (an `<input type="number">` can hold intermediate junk like "5e" or "-"). */
function toNum(s: string): number | undefined {
  if (s.trim() === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

/** Build the `exhaust` sub-key payload — clears Forced-only fields on Natural. */
function buildExhaustPayload(v: ExhaustFormValues): Record<string, unknown> {
  const isForced = v.exhaustType === 'Forced'
  return {
    exhaustType: v.exhaustType || undefined,
    qtyOfFans: isForced ? v.qtyOfFans || undefined : undefined,
    hpOfMotor: isForced ? v.hpOfMotor || undefined : undefined,
    powerRatingW: isForced ? v.powerRatingW || undefined : undefined,
    setPointOn: isForced ? toNum(v.setPointOn) : undefined,
    setPointOff: isForced ? toNum(v.setPointOff) : undefined,
    controlBy: isForced ? v.controlBy || undefined : 'None',
    comment: v.comment || undefined,
  }
}

export function MachineRoomExhaustPage(): JSX.Element {
  const { auditId } = useParams<{ auditId: string }>()
  const navigate = useNavigate()
  const [attempted, setAttempted] = useState(false)

  const machineRoomsQ = useMachineRooms(auditId ?? null)
  const room = machineRoomsQ.data?.machineRooms[0]
  const roomId = room?.id ?? null
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
  } = useForm<ExhaustFormValues>({
    mode: 'onSubmit',
    defaultValues: {
      exhaustType: '',
      qtyOfFans: '',
      hpOfMotor: '',
      powerRatingW: '',
      setPointOn: '',
      setPointOff: '',
      controlBy: '',
      comment: '',
    },
  })

  const exhaustType = watch('exhaustType')
  const isForced = exhaustType === 'Forced'

  // Hydrate form from saved data once machine rooms load
  useEffect(() => {
    const loaded = machineRoomsQ.data?.machineRooms[0]
    if (!loaded) return
    const exhaust = loaded.data?.['exhaust'] as Record<string, unknown> | undefined
    if (!exhaust) return
    if (exhaust['exhaustType']) setValue('exhaustType', String(exhaust['exhaustType']))
    if (exhaust['qtyOfFans']) setValue('qtyOfFans', String(exhaust['qtyOfFans']))
    if (exhaust['hpOfMotor']) setValue('hpOfMotor', String(exhaust['hpOfMotor']))
    if (exhaust['powerRatingW']) setValue('powerRatingW', String(exhaust['powerRatingW']))
    if (exhaust['setPointOn'] != null) setValue('setPointOn', String(exhaust['setPointOn']))
    if (exhaust['setPointOff'] != null) setValue('setPointOff', String(exhaust['setPointOff']))
    if (exhaust['controlBy']) setValue('controlBy', String(exhaust['controlBy']))
    if (exhaust['comment']) setValue('comment', String(exhaust['comment']))
  }, [machineRoomsQ.data, setValue])

  // Reset hidden fields when exhaust type changes to Natural
  useEffect(() => {
    if (!isForced) {
      setValue('qtyOfFans', '', { shouldValidate: false })
      setValue('hpOfMotor', '', { shouldValidate: false })
      setValue('powerRatingW', '', { shouldValidate: false })
      setValue('setPointOn', '', { shouldValidate: false })
      setValue('setPointOff', '', { shouldValidate: false })
      setValue('controlBy', '', { shouldValidate: false })
    }
  }, [isForced, setValue])

  // Auto-save on any field change. We send only the `exhaust` sub-key — the
  // repo now top-level-merges it into the existing machine-room data, so
  // `general` / `ventilation` are preserved server-side (no stale-cache merge).
  // Depend on the stable `saveRoom`, not the churning `autoSave` object.
  useEffect(() => {
    const subscription = watch(() => {
      saveRoom({ exhaust: buildExhaustPayload(getValues()) })
    })
    return () => subscription.unsubscribe()
  }, [watch, getValues, saveRoom])

  const onInvalid: SubmitErrorHandler<ExhaustFormValues> = () => {
    setAttempted(true)
  }

  const onValid = () => {
    autoSave.flush()
    void navigate(`/audit/${auditId}/section/refrigeration/racks`)
  }

  const exhaustTypeError = attempted && !!errors.exhaustType
  const setPointOffError = attempted && !!errors.setPointOff
  const errorCount = (exhaustTypeError ? 1 : 0) + (setPointOffError ? 1 : 0)

  if (machineRoomsQ.isLoading) {
    return (
      <div className="space-y-3 pb-24" aria-busy="true" aria-label="Loading exhaust">
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
          { label: 'Exhaust' },
        ]}
      />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Machine Room — Exhaust</h1>
        <AutoSaveIndicator state={autoSave.state} />
      </div>

      <form
        onSubmit={handleSubmit(onValid, onInvalid)}
        aria-label="Machine Room Exhaust"
        className="space-y-6"
      >
        {/* Exhaust Type (required) */}
        <div>
          <div className="flex items-center mb-1">
            <p className="text-sm font-medium" id="exhaust-type-label">
              Exhaust Type*
            </p>
            <FieldHelpTooltip
              content="Forced = mechanical exhaust fan; Natural = passive vent/opening"
              label="Exhaust type help"
            />
          </div>
          <Controller
            control={control}
            name="exhaustType"
            rules={{ required: true }}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger
                  data-testid="exhaust-type"
                  aria-labelledby="exhaust-type-label"
                  aria-required="true"
                  aria-invalid={exhaustTypeError}
                  className={cn('min-h-[48px]', exhaustTypeError && 'border-danger animate-shake')}
                >
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {EXHAUST_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {exhaustTypeError && (
            <p className="text-xs text-danger mt-1" role="alert">
              Exhaust Type is required.
            </p>
          )}
        </div>

        {/* Conditional fields — only shown when Forced */}
        {isForced && (
          <>
            {/* Qty of Fans */}
            <div>
              <div className="flex items-center mb-1">
                <p className="text-sm font-medium" id="qty-fans-label">
                  Qty of Fans
                </p>
                <FieldHelpTooltip content="Number of exhaust fans in this machine room" label="Qty of fans help" />
              </div>
              <Controller
                control={control}
                name="qtyOfFans"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger
                      data-testid="qty-fans"
                      aria-labelledby="qty-fans-label"
                      className="min-h-[48px]"
                    >
                      <SelectValue placeholder="Select quantity" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXHAUST_QTY_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* HP of Motor */}
            <div>
              <div className="flex items-center mb-1">
                <label className="text-sm font-medium" htmlFor="hp-motor">
                  HP of Motor
                </label>
                <FieldHelpTooltip content="Horsepower rating of the exhaust fan motor" label="HP of motor help" />
              </div>
              <Controller
                control={control}
                name="hpOfMotor"
                render={({ field }) => (
                  <Input id="hp-motor" data-testid="hp-motor" type="number" className="min-h-[48px]" {...field} />
                )}
              />
            </div>

            {/* Power Rating (W) */}
            <div>
              <div className="flex items-center mb-1">
                <label className="text-sm font-medium" htmlFor="power-rating">
                  Power Rating (W)
                </label>
                <FieldHelpTooltip content="Electrical power rating of the exhaust fan in watts" label="Power rating help" />
              </div>
              <Controller
                control={control}
                name="powerRatingW"
                render={({ field }) => (
                  <Input
                    id="power-rating"
                    data-testid="power-rating"
                    type="number"
                    className="min-h-[48px]"
                    {...field}
                  />
                )}
              />
            </div>

            {/* Set point ON */}
            <div>
              <div className="flex items-center mb-1">
                <label className="text-sm font-medium" htmlFor="set-point-on">
                  Set point ON (°F)
                </label>
                <FieldHelpTooltip content="Temperature at which the exhaust activates" label="Set point ON help" />
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
                <FieldHelpTooltip content="Must be lower than ON set point" label="Set point OFF help" />
              </div>
              <Controller
                control={control}
                name="setPointOff"
                rules={{
                  validate: {
                    offLowerThanOn: (v, fv) => {
                      if (fv.exhaustType !== 'Forced') return true
                      if (!v || !fv.setPointOn) return true
                      return (
                        Number(v) < Number(fv.setPointOn) ||
                        'OFF set point must be lower than ON set point for cooling exhaust.'
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
                <FieldHelpTooltip content="What activates the exhaust fan" label="Control by help" />
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
                      {EXHAUST_CONTROL_BY_OPTIONS.map((opt) => (
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

        {/* Comment (always visible, optional) */}
        <div>
          <div className="flex items-center mb-1">
            <label className="text-sm font-medium" htmlFor="comment-field">
              Comment
            </label>
            <FieldHelpTooltip content="Any additional notes about the exhaust system" label="Comment help" />
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
