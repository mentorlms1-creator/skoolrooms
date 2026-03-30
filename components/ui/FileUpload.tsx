'use client'

/**
 * components/ui/FileUpload.tsx — Universal file upload component using R2 presigned URLs
 *
 * Flow:
 * 1. User selects file (click or drag-and-drop)
 * 2. Client validates file size against UPLOAD_LIMITS
 * 3. Calls server action to get presigned URL
 * 4. Uploads directly to R2 via PUT
 * 5. Calls onUploadComplete with the public URL
 */

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { UPLOAD_LIMITS, UPLOAD_LIMIT_LABELS, UPLOAD_ALLOWED_FORMATS, type UploadFileType } from '@/constants/plans'

type FileUploadProps = {
  fileType: UploadFileType
  entityId: string
  onUploadComplete: (url: string) => void
  accept?: string
  maxSizeMb?: number
  currentUrl?: string
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error'

export function FileUpload({
  fileType,
  entityId,
  onUploadComplete,
  accept,
  maxSizeMb,
  currentUrl,
}: FileUploadProps) {
  const [state, setState] = useState<UploadState>(currentUrl ? 'success' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState<number | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const maxBytes = maxSizeMb
    ? maxSizeMb * 1024 * 1024
    : UPLOAD_LIMITS[fileType]
  const maxLabel = maxSizeMb ? `${maxSizeMb}MB` : UPLOAD_LIMIT_LABELS[fileType]
  const allowedFormats = UPLOAD_ALLOWED_FORMATS[fileType]
  const acceptAttr = accept || allowedFormats.join(',')

  const isImage = useCallback((contentType: string) => {
    return contentType.startsWith('image/')
  }, [])

  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > maxBytes) {
        return `File is too large. Maximum size is ${maxLabel}.`
      }

      if (!allowedFormats.includes(file.type)) {
        return `File type not allowed. Accepted: ${allowedFormats
          .map((f) => f.split('/')[1]?.toUpperCase())
          .join(', ')}`
      }

      return null
    },
    [maxBytes, maxLabel, allowedFormats],
  )

  const uploadFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        setState('error')
        return
      }

      setError(null)
      setState('uploading')
      setFileName(file.name)
      setFileSize(file.size)

      // Generate image preview
      if (isImage(file.type)) {
        const reader = new FileReader()
        reader.onload = (e) => setPreview(e.target?.result as string)
        reader.readAsDataURL(file)
      } else {
        setPreview(null)
      }

      try {
        // Request presigned URL from server
        const presignResponse = await fetch('/api/r2/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileType,
            contentType: file.type,
            fileName: file.name,
            sizeBytes: file.size,
            entityId,
          }),
        })

        if (!presignResponse.ok) {
          const data = await presignResponse.json().catch(() => ({}))
          throw new Error(
            (data as { error?: string }).error || 'Failed to prepare upload. Please try again.',
          )
        }

        const { uploadUrl, publicUrl } = (await presignResponse.json()) as {
          uploadUrl: string
          publicUrl: string
        }

        // Upload directly to R2
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type,
            'Content-Length': String(file.size),
          },
          body: file,
        })

        if (!uploadResponse.ok) {
          throw new Error('Upload failed. Please try again.')
        }

        setState('success')
        setPreview(isImage(file.type) ? publicUrl : null)
        onUploadComplete(publicUrl)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
        setState('error')
      }
    },
    [fileType, entityId, onUploadComplete, validateFile, isImage],
  )

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    // Reset input so the same file can be re-selected
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          flex cursor-pointer flex-col items-center justify-center
          rounded-lg border-2 border-dashed p-6
          transition-colors duration-150
          ${isDragOver ? 'border-brand-500 bg-brand-50' : 'border-border hover:border-brand-500 hover:bg-paper'}
          ${state === 'error' ? 'border-danger' : ''}
        `}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        aria-label="Upload file"
      >
        {state === 'uploading' ? (
          <div className="flex flex-col items-center gap-2">
            <Spinner size="md" />
            <p className="text-sm text-muted">Uploading...</p>
          </div>
        ) : preview ? (
          <div className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Upload preview"
              className="h-24 w-24 rounded-md object-cover"
            />
            <p className="text-sm text-muted">Click or drag to replace</p>
          </div>
        ) : fileName ? (
          <div className="flex flex-col items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-8 w-8 text-muted"
              aria-hidden="true"
            >
              <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0117 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z" />
            </svg>
            <p className="text-sm font-medium text-ink">{fileName}</p>
            {fileSize && (
              <p className="text-xs text-muted">{formatFileSize(fileSize)}</p>
            )}
            <p className="text-sm text-muted">Click or drag to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-8 w-8 text-muted"
              aria-hidden="true"
            >
              <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
              <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
            </svg>
            <p className="text-sm font-medium text-ink">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-muted">
              Max {maxLabel}
            </p>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* Error message */}
      {error && (
        <p className="text-sm text-danger">{error}</p>
      )}
    </div>
  )
}
