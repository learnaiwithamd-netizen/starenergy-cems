import { useEffect, useRef, useState, type JSX } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, useFieldArray, Controller, type SubmitErrorHandler } from 'react-hook-form'
import { Skeleton, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, cn } from '@cems/ui'
import {
  MR_ID_OPTIONS,
  MR_LOCATION_OPTIONS,
  RACK_NAME_OPTIONS,
  SUCTION_GROUP_NUMBER_OPTIONS,
  SUCTION_GROUP_TYPE_OPTIONS,
} from '@cems/types'
import { AuditBreadcrumb } from './AuditBreadcrumb'
import { FieldHelpTooltip } from './FieldHelpTooltip'
import { AutoSaveIndicator } from './AutoSaveIndicator'
import { OfflineBanner } from './OfflineBanner'
import { useGetOrCreateMachineRoom, useAutoSaveMachineRoom } from './machine-room-api'

interface RackRowFormValues {
  rackName: string
  suctionGroupNumber: string
  suctionGroupType: string
}

interface GeneralFormValues {
  machineRoomId: string
  location: string
  racks: RackRowFormValues[]
}

export function MachineRoomGeneralPage(): JSX.Element {
  const { auditId } = useParams<{ auditId: string }>()
  const navigate = useNavigate()
  const [roomId, setRoomId] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)

  const getOrCreate = useGetOrCreateMachineRoom()
  const autoSave = useAutoSaveMachineRoom(auditId ?? null, roomId)

  const {
    control,
    handleSubmit,
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<GeneralFormValues>({
    mode: 'onSubmit',
    defaultValues: {
      machineRoomId: '',
      location: '',
      racks: [{ rackName: '', suctionGroupNumber: '', suctionGroupType: '' }],
    },
  })

  const { fields, append } = useFieldArray({ control, name: 'racks' })
  const hydratedRef = useRef(false)

  // On mount: get-or-create machine room and hydrate form from saved data
  useEffect(() => {
    if (!auditId) return
    getOrCreate.mutate(
      { auditId },
      {
        onSuccess: (room) => {
          setRoomId(room.id)
          // Guard against re-hydration on mutation retry (P12 fix).
          if (hydratedRef.current) return
          hydratedRef.current = true
          const general = room.data?.['general'] as Partial<GeneralFormValues> | undefined
          if (!general) return
          if (general.machineRoomId) setValue('machineRoomId', general.machineRoomId)
          if (general.location) setValue('location', general.location)
          if (Array.isArray(general.racks) && general.racks.length > 0) {
            const savedRacks = general.racks as RackRowFormValues[]
            savedRacks.forEach((row, i) => {
              if (i === 0) {
                setValue('racks.0.rackName', row.rackName ?? '')
                setValue('racks.0.suctionGroupNumber', row.suctionGroupNumber ?? '')
                setValue('racks.0.suctionGroupType', row.suctionGroupType ?? '')
              } else {
                append({
                  rackName: row.rackName ?? '',
                  suctionGroupNumber: row.suctionGroupNumber ?? '',
                  suctionGroupType: row.suctionGroupType ?? '',
                })
              }
            })
          }
        },
      },
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditId])

  // Auto-save on any field change
  useEffect(() => {
    const subscription = watch(() => {
      autoSave.save({ general: getValues() })
    })
    return () => subscription.unsubscribe()
  }, [watch, getValues, autoSave])

  const onInvalid: SubmitErrorHandler<GeneralFormValues> = () => {
    setAttempted(true)
  }

  const onValid = () => {
    autoSave.flush()
    void navigate(`/audit/${auditId}/section/refrigeration/ventilation`)
  }

  const mrIdError = attempted && !!errors.machineRoomId
  const racksError = attempted && !!errors.racks
  const errorCount = (mrIdError ? 1 : 0) + (racksError ? 1 : 0)

  if (getOrCreate.isPending) {
    return (
      <div className="space-y-3 pb-24" aria-busy="true" aria-label="Loading machine room">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (getOrCreate.isError) {
    return (
      <p role="alert" className="text-sm text-danger mt-4">
        Could not load machine room. Please go back and try again.
      </p>
    )
  }

  return (
    <div className="pb-24">
      <OfflineBanner lastSavedAt={autoSave.lastSavedAt} />
      <AuditBreadcrumb
        segments={[
          { label: 'Refrigeration', to: `/audit/${auditId}` },
          { label: 'Machine Room' },
        ]}
      />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Machine Room — General</h1>
        <AutoSaveIndicator state={autoSave.state} />
      </div>

      <form
        onSubmit={handleSubmit(onValid, onInvalid)}
        aria-label="Machine Room General"
        className="space-y-6"
      >
        {/* Machine Room ID (required) */}
        <div>
          <div className="flex items-center mb-1">
            <p className="text-sm font-medium" id="mr-id-label">
              Machine Room ID*
            </p>
            <FieldHelpTooltip
              content="Select a unique identifier for this machine room (e.g. 1 for the primary room)"
              label="Machine Room ID help"
            />
          </div>
          <Controller
            control={control}
            name="machineRoomId"
            rules={{ required: true }}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger
                  data-testid="mr-id"
                  aria-labelledby="mr-id-label"
                  aria-required="true"
                  aria-invalid={mrIdError}
                  className={cn('min-h-[48px]', mrIdError && 'border-danger animate-shake')}
                >
                  <SelectValue placeholder="Select ID" />
                </SelectTrigger>
                <SelectContent>
                  {MR_ID_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {mrIdError && (
            <p className="text-xs text-danger mt-1" role="alert">
              Machine Room ID is required.
            </p>
          )}
        </div>

        {/* Location */}
        <div>
          <div className="flex items-center mb-1">
            <p className="text-sm font-medium" id="mr-location-label">
              Location
            </p>
            <FieldHelpTooltip
              content="Physical location of the machine room in the building"
              label="Location help"
            />
          </div>
          <Controller
            control={control}
            name="location"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger
                  data-testid="mr-location"
                  aria-labelledby="mr-location-label"
                  className="min-h-[48px]"
                >
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {MR_LOCATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Rack rows */}
        <div>
          <div className="flex items-center mb-2">
            <h2 className="text-sm font-medium">Rack Entries</h2>
            <FieldHelpTooltip
              content="Enter rack name, suction group number and type for each rack in this machine room"
              label="Rack entries help"
            />
          </div>
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="border border-border rounded-md p-3 space-y-3"
                data-testid={`rack-row-${index}`}
              >
                <p className="text-xs text-muted font-medium">Rack {index + 1}</p>

                <div>
                  <p className="text-xs mb-1" id={`rack-name-label-${index}`}>
                    Rack Name
                  </p>
                  <Controller
                    control={control}
                    name={`racks.${index}.rackName`}
                    rules={{ required: true }}
                    render={({ field: f }) => (
                      <Select onValueChange={f.onChange} value={f.value}>
                        <SelectTrigger
                          data-testid={`rack-name-${index}`}
                          aria-labelledby={`rack-name-label-${index}`}
                          className="min-h-[48px]"
                        >
                          <SelectValue placeholder="Select rack name" />
                        </SelectTrigger>
                        <SelectContent>
                          {RACK_NAME_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div>
                  <p className="text-xs mb-1" id={`suction-num-label-${index}`}>
                    Suction Group Number
                  </p>
                  <Controller
                    control={control}
                    name={`racks.${index}.suctionGroupNumber`}
                    render={({ field: f }) => (
                      <Select onValueChange={f.onChange} value={f.value}>
                        <SelectTrigger
                          data-testid={`suction-num-${index}`}
                          aria-labelledby={`suction-num-label-${index}`}
                          className="min-h-[48px]"
                        >
                          <SelectValue placeholder="Select number" />
                        </SelectTrigger>
                        <SelectContent>
                          {SUCTION_GROUP_NUMBER_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div>
                  <p className="text-xs mb-1" id={`suction-type-label-${index}`}>
                    Suction Group Type
                  </p>
                  <Controller
                    control={control}
                    name={`racks.${index}.suctionGroupType`}
                    render={({ field: f }) => (
                      <Select onValueChange={f.onChange} value={f.value}>
                        <SelectTrigger
                          data-testid={`suction-type-${index}`}
                          aria-labelledby={`suction-type-label-${index}`}
                          className="min-h-[48px]"
                        >
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {SUCTION_GROUP_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            data-testid="add-rack-btn"
            onClick={() => append({ rackName: '', suctionGroupNumber: '', suctionGroupType: '' })}
            className="mt-3 text-sm text-primary underline min-h-[48px] flex items-center gap-1"
          >
            + Add Another Rack
          </button>
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
