/**
 * Audit-flow error types (Story 2.3).
 *
 * Both errors map to RFC 7807 404. We deliberately do NOT distinguish
 * "not found in tenant" vs "owned by another auditor" vs "audit no
 * longer in DRAFT" — leaking which check failed lets a malicious
 * caller infer existence. The route handler returns the same `404
 * audit-not-editable` for every editability failure; pure read paths
 * use `audit-not-found`.
 */

export class AuditNotEditableError extends Error {
  readonly statusCode = 404
  constructor(message = 'Audit not found or not editable') {
    super(message)
    this.name = 'AuditNotEditableError'
  }
}

export class AuditNotFoundError extends Error {
  readonly statusCode = 404
  constructor(message = 'Audit not found') {
    super(message)
    this.name = 'AuditNotFoundError'
  }
}

export class StoreNotFoundError extends Error {
  readonly statusCode = 422
  constructor(message = 'Store not found or not accessible in this tenant') {
    super(message)
    this.name = 'StoreNotFoundError'
  }
}

/**
 * AUDITOR tried to start an audit on a store not in their `assignedStoreIds`.
 * Maps to 403; product semantic: AUDITORs can only audit assigned sites.
 */
export class StoreNotAssignedError extends Error {
  readonly statusCode = 403
  constructor(message = 'Store is not assigned to this auditor') {
    super(message)
    this.name = 'StoreNotAssignedError'
  }
}

/**
 * AUDITOR tried to start a new DRAFT while one is already in flight.
 * Product semantic: one auditor → one DRAFT at a time; admin reassignment
 * is the resolution path for site-switch mid-draft. Maps to 409; the
 * route handler attaches the existing draft's id + storeId to the body.
 */
export class DraftAlreadyExistsError extends Error {
  readonly statusCode = 409
  constructor(
    public readonly existingAuditId: string,
    public readonly existingStoreId: string,
    message = 'Auditor already has an in-progress audit',
  ) {
    super(message)
    this.name = 'DraftAlreadyExistsError'
  }
}

export class MachineRoomNotFoundError extends Error {
  readonly statusCode = 404
  constructor(message = 'Machine room not found') {
    super(message)
    this.name = 'MachineRoomNotFoundError'
  }
}

export class RackNotFoundError extends Error {
  readonly statusCode = 404
  constructor(message = 'Rack not found or not accessible') {
    super(message)
    this.name = 'RackNotFoundError'
  }
}

export class CompressorNotFoundError extends Error {
  readonly statusCode = 404
  constructor(message = 'Compressor not found or not accessible') {
    super(message)
    this.name = 'CompressorNotFoundError'
  }
}

export class CompressorModelNotFoundError extends Error {
  readonly statusCode = 404
  constructor(message = 'Compressor model not found in the regression database') {
    super(message)
    this.name = 'CompressorModelNotFoundError'
  }
}
