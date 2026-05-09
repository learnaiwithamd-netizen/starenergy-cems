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
