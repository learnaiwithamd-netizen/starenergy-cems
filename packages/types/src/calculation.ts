export interface CalcResult {
  id: string
  auditId: string
  runAt: string
  inputSnapshot: Record<string, unknown>
  ecmSavingsKwh: number | null
  ecmSavingsDollars: number | null
  baselineKwh: number | null
  cddRegression: number | null
  hddRegression: number | null
  status: 'PENDING' | 'COMPLETE' | 'FAILED'
}

export interface LlmFlag {
  id: string
  calcResultId: string
  field: string
  flagReason: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  overrideId: string | null
}

export interface OverrideRecord {
  id: string
  flagId: string
  adminUserId: string
  justification: string
  overriddenAt: string
}
