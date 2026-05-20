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

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent, type MouseEvent } from 'react'
import { Upload, FileText, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { UPLOAD_LIMITS, UPLOAD_LIMIT_LABELS, UPLOAD_ALLOWED_FORMATS, type UploadFileType } from '@/constants/plans'

type FileUploadProps = {
  fileType: UploadFileType
  entityId: string
  onUploadComplete: (url: string) => void
  /**
   * When provided, a remove button appears once a file is uploaded/loaded.
   * The parent is responsible for clearing whatever it tracks (URL in state,
   * form field, etc.); this component just resets its own preview state.
   */
  onRemove?: () => void
  accept?: string
  maxSizeMb?: number
  currentUrl?: string
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error'

export function FileUpload({
  fileType,
  entityId,
  onUploadComplete,
  onRemove,
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
        // Step 1: Request presigned URL from our server
        let presignResponse: Response
        try {
          presignResponse = await fetch('/api/r2/presign', {
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
        } catch (networkErr) {
          // fetch() only throws for network-layer failures (offline, DNS, etc.)
          console.error('[FileUpload] Presign request failed at network layer:', networkErr)
          throw new Error("Couldn't reach the server. Check your internet connection and try again.")
        }

        const presignBody = (await presignResponse.json().catch(() => ({}))) as {
          success?: boolean
          error?: string
          data?: { uploadUrl?: string; publicUrl?: string }
        }

        if (!presignResponse.ok || !presignBody.success) {
          throw new Error(
            presignBody.error || 'Failed to prepare upload. Please try again.',
          )
        }

        const uploadUrl = presignBody.data?.uploadUrl
        const publicUrl = presignBody.data?.publicUrl
        if (!uploadUrl || !publicUrl) {
          throw new Error('Failed to prepare upload. Please try again.')
        }

        // Step 2: Upload directly to R2. fetch() throwing here almost always
        // means the R2 bucket's CORS doesn't allow this origin — browsers
        // report that as "Failed to fetch", which is useless to the user.
        let uploadResponse: Response
        try {
          uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': file.type,
              'Content-Length': String(file.size),
            },
            body: file,
          })
        } catch (networkErr) {
          console.error(
            '[FileUpload] Upload to R2 failed at network layer (likely CORS).',
            { uploadUrl, origin: window.location.origin, error: networkErr },
          )
          throw new Error("Upload couldn't reach storage. This usually means the storage bucket isn't accepting uploads from this site — please contact support.")
        }

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed (HTTP ${uploadResponse.status}). Please try again.`)
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

  function handleRemove(e: MouseEvent<HTMLButtonElement>) {
    // Stop the drop-zone's onClick from firing and opening the file picker.
    e.stopPropagation()
    setState('idle')
    setPreview(null)
    setFileName(null)
    setFileSize(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
    onRemove?.()
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const canRemove = onRemove && (preview !== null || fileName !== null) && state !== 'uploading'

  return (
    <div className="flex flex-col gap-2">
      {/* Drop zone (positioned relative so the remove button can absolutely overlay it) */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center',
          'rounded-lg border-2 border-dashed p-6',
          'transition-colors duration-150',
          isDragOver
            ? 'border-primary bg-primary/10'
            : 'border-border hover:border-primary hover:bg-accent/50',
          state === 'error' && 'border-destructive',
        )}
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
        {canRemove && (
          <button
            type="button"
            onClick={handleRemove}
            className={cn(
              'absolute right-2 top-2 z-10',
              'flex h-7 w-7 items-center justify-center rounded-full',
              'bg-background/80 text-muted-foreground backdrop-blur-sm',
              'border border-border shadow-sm',
              'hover:bg-destructive hover:text-destructive-foreground hover:border-destructive',
              'focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2 focus:ring-offset-background',
              'transition-colors',
            )}
            aria-label="Remove file"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {state === 'uploading' ? (
          <div className="flex flex-col items-center gap-2">
            <Spinner size="md" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </div>
        ) : preview ? (
          <div className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Upload preview"
              className="max-h-64 w-full rounded-md object-contain"
            />
            <p className="text-sm text-muted-foreground">Click or drag to replace</p>
          </div>
        ) : fileName ? (
          <div className="flex flex-col items-center gap-1">
            <FileText className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">{fileName}</p>
            {fileSize && (
              <p className="text-xs text-muted-foreground">{formatFileSize(fileSize)}</p>
            )}
            <p className="text-sm text-muted-foreground">Click or drag to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Upload className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">
              Click to upload or drag and drop
            </p>
            <p className="text-sm text-muted-foreground">
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
        {...(acceptAttr.includes('image') ? { capture: 'environment' } : {})}
      />

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
