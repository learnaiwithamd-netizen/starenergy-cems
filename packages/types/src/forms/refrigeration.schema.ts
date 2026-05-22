import { z } from 'zod'

// ─── Machine Room dropdown option constants (from Ref_MR.csv spec) ────────────

export const MR_ID_OPTIONS = ['1', '2', '3', '4', 'A', 'B', 'C', 'D'] as const
export type MrId = (typeof MR_ID_OPTIONS)[number]

export const MR_LOCATION_OPTIONS = ['Mezzanine', 'Penthouse', 'Main floor', 'Other'] as const
export type MrLocation = (typeof MR_LOCATION_OPTIONS)[number]

export const RACK_NAME_OPTIONS = ['1', '2', '3', '4', '5', '6', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const
export type RackName = (typeof RACK_NAME_OPTIONS)[number]

export const SUCTION_GROUP_NUMBER_OPTIONS = ['1', '2', '3', '4', '5'] as const
export type SuctionGroupNumber = (typeof SUCTION_GROUP_NUMBER_OPTIONS)[number]

export const SUCTION_GROUP_TYPE_OPTIONS = ['Low Temp.', 'Medium Temp.', 'Dual Temp.'] as const
export type SuctionGroupType = (typeof SUCTION_GROUP_TYPE_OPTIONS)[number]

export const VENTILATION_TYPE_OPTIONS = ['Forced', 'Natural'] as const
export type VentilationType = (typeof VENTILATION_TYPE_OPTIONS)[number]

export const CONNECTED_TO_EXHAUST_OPTIONS = ['Yes', 'No'] as const
export type ConnectedToExhaust = (typeof CONNECTED_TO_EXHAUST_OPTIONS)[number]

export const VENTILATION_CONTROL_BY_OPTIONS = ['Thermostat', 'None'] as const
export type VentilationControlBy = (typeof VENTILATION_CONTROL_BY_OPTIONS)[number]

// Set-point ranges (°F) for ventilation screens
export const VENTILATION_SETPOINT_MIN = 32
export const VENTILATION_SETPOINT_MAX = 120

// ─── Refrigeration section schema (flat JSON summary on audit_sections) ───────

export const refrigerationSectionSchema = z.object({
  machineRoomCount: z.number().int().nonnegative().optional(),
})

export type RefrigerationSectionData = z.infer<typeof refrigerationSectionSchema>

// ─── Story 3.2 — Machine Room Exhaust + Rack General sub-schemas ──────────────

export const mrExhaustDataSchema = z.object({
  exhaustType: z.enum(['Forced', 'Natural']),
  qtyOfFans: z.string().optional(),
  hpOfMotor: z.string().optional(),
  powerRatingW: z.string().optional(),
  setPointOn: z.number().optional(),
  setPointOff: z.number().optional(),
  controlBy: z.enum(['Thermostat', 'Timer', 'VFD', 'Leak Detector', 'None']).optional(),
  comment: z.string().optional(),
})
export type MrExhaustData = z.infer<typeof mrExhaustDataSchema>

export const rackGeneralDataSchema = z.object({
  rackDesignation: z.string().min(1),
  rackType: z.enum(['Medium Temperature', 'Low Temperature', 'Dual Temperature']).optional(),
  rackMake: z.string().optional(),
  rackModelSerial: z.string().optional(),
  ageYear: z.string().optional(),
  lastRetrofitYear: z.string().optional(),
  refrigerant: z.string().optional(),
  comment: z.string().optional(),
})
export type RackGeneralData = z.infer<typeof rackGeneralDataSchema>

// ─── Story 3.3 — Compressor data sub-schema ───────────────────────────────────
// Only modelNumber is required; capacity/eer/refrigerantType auto-populate from
// the regression DB when the model is known, but stay editable + optional so an
// unknown-model compressor (FR45 manual-entry fallback) can still be saved.
export const compressorDataSchema = z.object({
  modelNumber: z.string().min(1),
  make: z.string().optional(),
  serialNumber: z.string().optional(),
  capacity: z.string().optional(),
  eer: z.string().optional(),
  refrigerantType: z.string().optional(),
  comment: z.string().optional(),
})
export type CompressorData = z.infer<typeof compressorDataSchema>

// ─── Story 3.2 — Exhaust + Rack dropdown option constants ─────────────────────

export const EXHAUST_TYPE_OPTIONS = ['Forced', 'Natural'] as const
export const EXHAUST_CONTROL_BY_OPTIONS = ['Thermostat', 'Timer', 'VFD', 'Leak Detector', 'None'] as const
export const EXHAUST_QTY_OPTIONS = ['1', '2', '3', '4', '5', '6'] as const
export const RACK_DESIGNATION_OPTIONS = ['A', 'B', 'C', 'D', '1', '2', '3', '4'] as const
export const RACK_TYPE_OPTIONS = ['Medium Temperature', 'Low Temperature', 'Dual Temperature'] as const
export const RACK_MAKE_OPTIONS = ['Hussmann', 'Tyler', 'Hill Phoenix', 'Kysor Warren', 'Bohn', 'Carrier', 'Heatcraft', 'Other'] as const
export const RACK_REFRIGERANT_OPTIONS = ['R-22', 'R-404A', 'R-407A', 'R-407C', 'R-410A', 'R-448A', 'R-449A', 'R-452A', 'R-454C', 'R-717 (Ammonia)', 'Other'] as const
// Year range helpers (string arrays for dropdowns)
export const RACK_AGE_YEAR_OPTIONS: string[] = Array.from({ length: 37 }, (_, i) => String(1990 + i))
export const RACK_RETROFIT_YEAR_OPTIONS: string[] = Array.from({ length: 38 }, (_, i) => String(1990 + i))
