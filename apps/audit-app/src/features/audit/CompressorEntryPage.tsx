import { useEffect, useRef, useState, type JSX } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useForm, Controller, type SubmitErrorHandler } from 'react-hook-form'
import { Skeleton, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Input, cn } from '@cems/ui'
import { RACK_REFRIGERANT_OPTIONS } from '@cems/types'
import { ApiError } from '../../lib/api-client'
import { AuditBreadcrumb } from './AuditBreadcrumb'
import { FieldHelpTooltip } from './FieldHelpTooltip'
import { AutoSaveIndicator } from './AutoSaveIndicator'
import { OfflineBanner } from './OfflineBanner'
import { useMachineRooms } from './machine-room-api'
import { useRack } from './rack-api'
import { useCompressor, useAutoSaveCompressor, useCompressorRefLookup, useReportUnknownModel } from './compressor-api'

interface CompressorFormValues {
  modelNumber: string
  make: string
  serialNumber: string
  capacity: string
  eer: string
  refrigerantType: string
  comment: string
}

const LOOKUP_DEBOUNCE_MS = 600

export function CompressorEntryPage(): JSX.Element {
  const { auditId, rackId, compressorId } = useParams<{ auditId: string; rackId: string; compressorId: string }>()
  const navigate = useNavigate()
  const [attempted, setAttempted] = useState(false)

  const machineRoomsQ = useMachineRooms(auditId ?? null)
  const roomId = machineRoomsQ.data?.machineRooms[0]?.id ?? null
  const rackQ = useRack(auditId ?? null, roomId, rackId ?? null)
  const compressorQ = useCompressor(auditId ?? null, roomId, rackId ?? null, compressorId ?? null)
  const autoSave = useAutoSaveCompressor(auditId ?? null, roomId, rackId ?? null, compressorId ?? null)
  const reportUnknownModel = useReportUnknownModel()

  const [compressorRefId, setCompressorRefId] = useState<string | null>(null)
  const [modelNotFound, setModelNotFound] = useState(false)
  const [debouncedModel, setDebouncedModel] = useState('')

  const compressorRefIdRef = useRef<string | null>(null)
  const hydratedRef = useRef(false)
  // Set true by hydration so the first lookup for the saved model does NOT
  // clobber the Auditor's previously-saved override values with DB values.
  const skipNextAutoFillRef = useRef(false)

  const applyRefId = (id: string | null): void => {
    compressorRefIdRef.current = id
    setCompressorRefId(id)
  }

  const {
    control,
    handleSubmit,
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<CompressorFormValues>({
    mode: 'onSubmit',
    defaultValues: {
      modelNumber: '',
      make: '',
      serialNumber: '',
      capacity: '',
      eer: '',
      refrigerantType: '',
      comment: '',
    },
  })

  const lookupQ = useCompressorRefLookup(debouncedModel || null)

  // Hydrate the form (once) from saved compressor data.
  useEffect(() => {
    if (hydratedRef.current) return
    const compressor = compressorQ.data
    if (!compressor) return
    hydratedRef.current = true
    applyRefId(compressor.compressorRefId)
    const general = compressor.data?.['general'] as Record<string, unknown> | undefined
    if (!general) return
    if (general['modelNumber']) {
      setValue('modelNumber', String(general['modelNumber']))
      // The upcoming lookup for the hydrated model must not overwrite saved values.
      skipNextAutoFillRef.current = true
      setDebouncedModel(String(general['modelNumber']))
    }
    if (general['make']) setValue('make', String(general['make']))
    if (general['serialNumber']) setValue('serialNumber', String(general['serialNumber']))
    if (general['capacity']) setValue('capacity', String(general['capacity']))
    if (general['eer']) setValue('eer', String(general['eer']))
    if (general['refrigerantType']) setValue('refrigerantType', String(general['refrigerantType']))
    if (general['comment']) setValue('comment', String(general['comment']))
  }, [compressorQ.data, setValue])

  // Debounce the model-number field into the lookup query.
  const modelNumber = watch('modelNumber')
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedModel(modelNumber.trim()), LOOKUP_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [modelNumber])

  // Auto-populate from a regression-DB match.
  useEffect(() => {
    const ref = lookupQ.data
    if (!ref) return
    setModelNotFound(false)
    if (skipNextAutoFillRef.current) {
      // This lookup corresponds to the hydrated model — link the ref but keep saved overrides.
      skipNextAutoFillRef.current = false
      applyRefId(ref.id)
      return
    }
    setValue('make', ref.manufacturer)
    setValue('refrigerantType', ref.refrigerantType)
    const coeff = ref.regressionCoefficients
    if (coeff['capacity'] != null) setValue('capacity', String(coeff['capacity']))
    if (coeff['eer'] != null) setValue('eer', String(coeff['eer']))
    applyRefId(ref.id)
  }, [lookupQ.data, setValue])

  // Model not found in the regression DB → amber alert + clear the ref link.
  useEffect(() => {
    if (lookupQ.isError && lookupQ.error instanceof ApiError && lookupQ.error.status === 404) {
      skipNextAutoFillRef.current = false
      setModelNotFound(true)
      applyRefId(null)
    }
  }, [lookupQ.isError, lookupQ.error])

  // Auto-save on any field change (reads the latest ref id from the ref).
  useEffect(() => {
    const subscription = watch(() => {
      autoSave.save({ data: { general: getValues() }, compressorRefId: compressorRefIdRef.current })
    })
    return () => subscription.unsubscribe()
  }, [watch, getValues, autoSave])

  // Persist link/unlink when the ref id changes outside the form (after hydration).
  useEffect(() => {
    if (!hydratedRef.current) return
    autoSave.save({ data: { general: getValues() }, compressorRefId })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compressorRefId])

  const onInvalid: SubmitErrorHandler<CompressorFormValues> = () => {
    setAttempted(true)
  }

  const onValid = async (): Promise<void> => {
    autoSave.flush()
    if (compressorRefId == null && getValues('modelNumber').trim().length > 0 && auditId && roomId && rackId && compressorId) {
      try {
        await reportUnknownModel.mutateAsync({ auditId, roomId, rackId, compressorId })
      } catch {
        // FR53 notification is best-effort — never block the Auditor's progression.
      }
    }
    void navigate(`/audit/${auditId}/section/refrigeration/rack/${rackId}/compressors`)
  }

  const modelNumberError = attempted && !!errors.modelNumber
  const errorCount = modelNumberError ? 1 : 0

  if (machineRoomsQ.isLoading || ((rackQ.isLoading || compressorQ.isLoading) && !!roomId)) {
    return (
      <div className="space-y-3 pb-24" aria-busy="true" aria-label="Loading compressor">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (machineRoomsQ.isError || rackQ.isError || compressorQ.isError) {
    return (
      <p role="alert" className="text-sm text-danger mt-4">
        Could not load compressor. Please go back and try again.
      </p>
    )
  }

  // Redirect to General page if no machine room exists (e.g. direct URL navigation).
  if (machineRoomsQ.data?.machineRooms.length === 0) {
    return <Navigate to={`/audit/${auditId}/section/refrigeration`} replace />
  }

  const rackNumber = rackQ.data?.rackNumber
  const compressorNumber = compressorQ.data?.compressorNumber

  return (
    <div className="pb-24">
      <OfflineBanner lastSavedAt={autoSave.lastSavedAt} />
      <AuditBreadcrumb
        segments={[
          { label: 'Refrigeration', to: `/audit/${auditId}` },
          { label: rackNumber ? `Rack ${rackNumber}` : 'Rack …', to: `/audit/${auditId}/section/refrigeration/rack/${rackId}/general` },
          { label: compressorNumber ? `Compressor ${compressorNumber}` : 'Compressor …' },
        ]}
      />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Compressor</h1>
        <AutoSaveIndicator state={autoSave.state} />
      </div>

      <form onSubmit={handleSubmit(onValid, onInvalid)} aria-label="Compressor" className="space-y-6">
        {/* Compressor Model Number (required) */}
        <div>
          <div className="flex items-center mb-1">
            <label className="text-sm font-medium" htmlFor="compressor-model">
              Compressor Model Number*
            </label>
            <FieldHelpTooltip
              content="The model number from the compressor nameplate. Known models auto-fill specs from the regression database."
              label="Model number help"
            />
          </div>
          <Controller
            control={control}
            name="modelNumber"
            rules={{ required: true }}
            render={({ field }) => (
              <Input
                id="compressor-model"
                data-testid="compressor-model"
                aria-required="true"
                aria-invalid={modelNumberError}
                className={cn('min-h-[48px]', modelNumberError && 'border-danger animate-shake')}
                {...field}
              />
            )}
          />
          {modelNotFound && (
            <p
              role="status"
              data-testid="model-not-found-alert"
              className="mt-2 rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              Model not found — enter specs manually. Admin will be notified.
            </p>
          )}
          {modelNumberError && (
            <p className="text-xs text-danger mt-1" role="alert">
              Compressor Model Number is required.
            </p>
          )}
        </div>

        {/* Make / Manufacturer */}
        <div>
          <div className="flex items-center mb-1">
            <label className="text-sm font-medium" htmlFor="compressor-make">
              Make / Manufacturer
            </label>
            <FieldHelpTooltip content="Compressor manufacturer (auto-filled for known models)" label="Make help" />
          </div>
          <Controller
            control={control}
            name="make"
            render={({ field }) => (
              <Input id="compressor-make" data-testid="compressor-make" className="min-h-[48px]" {...field} />
            )}
          />
        </div>

        {/* Serial Number */}
        <div>
          <div className="flex items-center mb-1">
            <label className="text-sm font-medium" htmlFor="compressor-serial">
              Serial Number
            </label>
            <FieldHelpTooltip content="Unique serial number of this physical compressor" label="Serial number help" />
          </div>
          <Controller
            control={control}
            name="serialNumber"
            render={({ field }) => (
              <Input id="compressor-serial" data-testid="compressor-serial" className="min-h-[48px]" {...field} />
            )}
          />
        </div>

        {/* Capacity (BTU/h) */}
        <div>
          <div className="flex items-center mb-1">
            <label className="text-sm font-medium" htmlFor="compressor-capacity">
              Capacity (BTU/h)
            </label>
            <FieldHelpTooltip content="Rated cooling capacity (auto-filled for known models)" label="Capacity help" />
          </div>
          <Controller
            control={control}
            name="capacity"
            render={({ field }) => (
              <Input
                id="compressor-capacity"
                data-testid="compressor-capacity"
                inputMode="numeric"
                className="min-h-[48px]"
                {...field}
              />
            )}
          />
        </div>

        {/* EER */}
        <div>
          <div className="flex items-center mb-1">
            <label className="text-sm font-medium" htmlFor="compressor-eer">
              EER
            </label>
            <FieldHelpTooltip content="Energy Efficiency Ratio (auto-filled for known models)" label="EER help" />
          </div>
          <Controller
            control={control}
            name="eer"
            render={({ field }) => (
              <Input
                id="compressor-eer"
                data-testid="compressor-eer"
                inputMode="decimal"
                className="min-h-[48px]"
                {...field}
              />
            )}
          />
        </div>

        {/* Refrigerant Type */}
        <div>
          <div className="flex items-center mb-1">
            <p className="text-sm font-medium" id="compressor-refrigerant-label">
              Refrigerant Type
            </p>
            <FieldHelpTooltip content="Refrigerant the compressor runs on (auto-filled for known models)" label="Refrigerant type help" />
          </div>
          <Controller
            control={control}
            name="refrigerantType"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger
                  data-testid="compressor-refrigerant"
                  aria-labelledby="compressor-refrigerant-label"
                  className="min-h-[48px]"
                >
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
            <FieldHelpTooltip content="Any additional notes about this compressor" label="Comment help" />
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
