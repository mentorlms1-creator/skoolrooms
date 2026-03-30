// =============================================================================
// app/api/r2/presign/route.ts — R2 presigned upload URL generation
// Authenticated endpoint: generates a presigned PUT URL for direct browser→R2 upload.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { getPresignedUploadUrl } from '@/lib/r2/upload'
import { UPLOAD_ALLOWED_FORMATS, UPLOAD_LIMITS, UPLOAD_LIMIT_LABELS } from '@/constants/plans'
import { rateLimit } from '@/lib/rate-limit'
import type { FileType } from '@/types/domain'
import type { ApiResponse, PresignOutput } from '@/types/api'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** All valid FileType values for input validation */
const VALID_FILE_TYPES = new Set<string>([
  'thumbnail', 'profile', 'assignment', 'announcement',
  'submission', 'screenshot', 'qrcode',
])

/**
 * Extracts file extension from a MIME type.
 * Falls back to 'bin' for unknown types.
 */
function extensionFromMime(contentType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'video/mp4': 'mp4',
  }
  return map[contentType] ?? 'bin'
}

/**
 * Builds the R2 object key based on fileType and entityId.
 * Key structure follows ARCHITECTURE.md conventions.
 */
function buildR2Key(fileType: FileType, entityId: string, ext: string): string {
  const timestamp = Date.now()

  switch (fileType) {
    case 'profile':
      return `profiles/${entityId}.${ext}`
    case 'thumbnail':
      return `thumbnails/${entityId}/${timestamp}.${ext}`
    case 'qrcode':
      return `qrcodes/${entityId}.${ext}`
    case 'assignment':
      return `assignments/${entityId}/${timestamp}.${ext}`
    case 'announcement':
      return `announcements/${entityId}/${timestamp}.${ext}`
    case 'submission':
      return `submissions/${entityId}/${timestamp}.${ext}`
    case 'screenshot':
      return `screenshots/${entityId}/${timestamp}.${ext}`
  }
}

// -----------------------------------------------------------------------------
// POST /api/r2/presign
// -----------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<PresignOutput>>> {
  // 1. Auth check
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  // 1b. Rate limit: 20 presign requests per user per minute
  const { allowed } = rateLimit(`presign:${user.id}`, 20, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many upload requests. Please wait a moment.' },
      { status: 429 },
    )
  }

  // 2. Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const { fileType, contentType, fileName, entityId } = body as {
    fileType?: string
    contentType?: string
    fileName?: string
    entityId?: string
  }

  if (!fileType || !contentType || !fileName || !entityId) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: fileType, contentType, fileName, entityId' },
      { status: 400 },
    )
  }

  // 3. Validate fileType
  if (!VALID_FILE_TYPES.has(fileType)) {
    return NextResponse.json(
      { success: false, error: `Invalid fileType "${fileType}". Must be one of: ${[...VALID_FILE_TYPES].join(', ')}` },
      { status: 400 },
    )
  }

  const validatedFileType = fileType as FileType

  // 4. Validate contentType against allowed formats for this fileType
  const allowedFormats = UPLOAD_ALLOWED_FORMATS[validatedFileType]
  if (!allowedFormats.includes(contentType)) {
    return NextResponse.json(
      {
        success: false,
        error: `Content type "${contentType}" is not allowed for ${validatedFileType}. Allowed: ${allowedFormats.join(', ')}`,
      },
      { status: 400 },
    )
  }

  // 5. Build R2 key and determine max size
  const ext = extensionFromMime(contentType)
  const key = buildR2Key(validatedFileType, entityId, ext)
  const maxSizeBytes = UPLOAD_LIMITS[validatedFileType]

  // 6. Generate presigned URL
  try {
    const { uploadUrl, publicUrl } = await getPresignedUploadUrl({
      key,
      contentType,
      maxSizeBytes,
    })

    return NextResponse.json({
      success: true,
      data: { uploadUrl, publicUrl, key },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate upload URL'
    console.error('[presign] Error:', message)

    // Check if it's a file-size validation error (user-facing)
    if (message.includes('File too large')) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large. Maximum size for ${validatedFileType} is ${UPLOAD_LIMIT_LABELS[validatedFileType]}.`,
        },
        { status: 400 },
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to generate upload URL' },
      { status: 500 },
    )
  }
}
