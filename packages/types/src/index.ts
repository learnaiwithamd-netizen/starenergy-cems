export * from './audit.js'
export * from './user.js'
export * from './calculation.js'
export * from './api.js'
export * from './forms/general.schema.js'
export * from './forms/refrigeration.schema.js'
export * from './forms/hvac.schema.js'
export * from './forms/lighting.schema.js'
export * from './forms/building-envelope.schema.js'

export const SECTION_LOCK_TTL_MS = 90_000
export const SECTION_LOCK_HEARTBEAT_MS = 30_000
export const SECTION_LOCK_POLL_MS = 15_000
export const PHOTO_MAX_SIZE_BYTES = 10 * 1024 * 1024
export const PHOTO_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/heic'] as const
