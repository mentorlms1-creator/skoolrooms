// =============================================================================
// types/api.ts — API request/response types
// =============================================================================

import type { FileType } from './domain'

// -----------------------------------------------------------------------------
// ApiResponse — Discriminated union for all API responses
// -----------------------------------------------------------------------------
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string }

// -----------------------------------------------------------------------------
// Enrollment API
// -----------------------------------------------------------------------------
export type EnrollInput = {
  cohortId: string
  studentId: string
  discountCode?: string
  idempotencyKey: string
}

export type EnrollOutput = {
  checkoutUrl?: string
  enrollmentId: string
  referenceCode?: string
  status: 'active' | 'pending_verification' | 'waitlisted'
}

// -----------------------------------------------------------------------------
// Subscription API
// -----------------------------------------------------------------------------
export type SubscribeInput = {
  planSlug: string
  idempotencyKey: string
}

export type SubscribeOutput = {
  checkoutUrl?: string
  subscriptionId: string
}

// -----------------------------------------------------------------------------
// Presigned Upload API
// -----------------------------------------------------------------------------
export type PresignInput = {
  fileType: FileType
  contentType: string
  fileName: string
  sizeBytes: number
}

export type PresignOutput = {
  uploadUrl: string
  publicUrl: string
  key: string
}
