// =============================================================================
// lib/r2/upload.ts — Cloudflare R2 presigned upload URLs
// Flow: client requests presigned URL → uploads directly to R2 → sends publicUrl back
// All file size limits enforced server-side before generating the URL.
// =============================================================================

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { FileType } from '@/types/domain'
import { getUploadLimitMb } from '@/lib/platform/settings'

// -----------------------------------------------------------------------------
// R2 S3-compatible client (lazy singleton)
// -----------------------------------------------------------------------------

let s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (s3Client) return s3Client

  s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY!,
    },
  })

  return s3Client
}

// -----------------------------------------------------------------------------
// Presigned upload URL
// -----------------------------------------------------------------------------

/**
 * Generates a presigned PUT URL for direct browser-to-R2 upload.
 *
 * @param params.key - The R2 object key (e.g. 'thumbnails/{teacherId}/{courseId}.jpg')
 * @param params.contentType - MIME type (e.g. 'image/jpeg')
 * @param params.maxSizeBytes - Maximum file size in bytes. Validated against
 *   platform_settings upload limits before generating the URL.
 *
 * @returns uploadUrl (presigned PUT URL) + publicUrl (public access URL)
 *
 * R2 key structure:
 *   thumbnails/{teacherId}/{courseId}.{ext}
 *   assignments/{cohortId}/{assignmentId}.{ext}
 *   announcements/{cohortId}/{announcementId}.{ext}
 *   submissions/{assignmentId}/{studentId}.{ext}
 *   screenshots/{type}/{entityId}/{timestamp}.jpg
 *   profiles/{teacherId}.{ext}
 *   qrcodes/{teacherId}.{ext}
 */
export async function getPresignedUploadUrl(params: {
  key: string
  contentType: string
  maxSizeBytes: number
}): Promise<{ uploadUrl: string; publicUrl: string }> {
  const { key, contentType, maxSizeBytes } = params
  const bucket = process.env.CLOUDFLARE_R2_BUCKET!
  const publicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL!

  // Validate file size against platform limit for this file type
  const fileType = extractFileType(key)
  if (fileType) {
    const limitMb = await getUploadLimitMb(fileType)
    const limitBytes = limitMb * 1024 * 1024

    if (maxSizeBytes > limitBytes) {
      throw new Error(
        `File too large. Maximum size for ${fileType} is ${limitMb}MB.`,
      )
    }
  }

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: maxSizeBytes,
  })

  const uploadUrl = await getSignedUrl(getS3Client(), command, {
    expiresIn: 3600, // 1 hour
  })

  const publicUrl = `${publicBaseUrl}/${key}`

  return { uploadUrl, publicUrl }
}

// -----------------------------------------------------------------------------
// Delete R2 file
// -----------------------------------------------------------------------------

/**
 * Deletes a file from R2 by its key.
 * Used for cleanup when uploads are replaced or content is deleted.
 */
export async function deleteR2File(key: string): Promise<void> {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET!

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  await getS3Client().send(command)
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Extracts the FileType from an R2 key based on its prefix.
 * Returns null if the prefix doesn't match a known file type.
 */
function extractFileType(key: string): FileType | null {
  const prefixMap: Record<string, FileType> = {
    'thumbnails/': 'thumbnail',
    'profiles/': 'profile',
    'qrcodes/': 'qrcode',
    'assignments/': 'assignment',
    'announcements/': 'announcement',
    'submissions/': 'submission',
    'screenshots/': 'screenshot',
  }

  for (const [prefix, type] of Object.entries(prefixMap)) {
    if (key.startsWith(prefix)) return type
  }

  return null
}
