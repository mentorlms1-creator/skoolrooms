'use client'

/**
 * providers/UIProvider.tsx — Client-side UI state manager
 * Manages toasts and confirm modal state.
 * Renders Toast components and ConfirmModal at provider level.
 */

import { createContext, useCallback, useContext, useState } from 'react'
import { Toast } from '@/components/ui/Toast'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type ToastType = 'success' | 'error' | 'warning' | 'info'

type ToastItem = {
  id: string
  type: ToastType
  message: string
}

type AddToastInput = {
  type: ToastType
  message: string
}

type ConfirmOptions = {
  title: string
  message: string
  confirmText?: string
  confirmVariant?: 'primary' | 'danger'
  onConfirm: () => void | Promise<void>
}

type ConfirmState = {
  isOpen: boolean
  title: string
  message: string
  confirmText: string
  confirmVariant: 'primary' | 'danger'
  onConfirm: () => void | Promise<void>
  loading: boolean
}

type UIContextType = {
  addToast: (toast: AddToastInput) => void
  removeToast: (id: string) => void
  toasts: ReadonlyArray<ToastItem>
  confirm: (options: ConfirmOptions) => void
  confirmState: ConfirmState
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const UIContext = createContext<UIContextType | null>(null)

export function useUIContext() {
  const ctx = useContext(UIContext)
  if (!ctx) {
    throw new Error('useUIContext must be used within UIProvider')
  }
  return ctx
}

// -----------------------------------------------------------------------------
// ID generation
// -----------------------------------------------------------------------------

let toastCounter = 0

function generateToastId(): string {
  toastCounter += 1
  return `toast-${Date.now()}-${toastCounter}`
}

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

const INITIAL_CONFIRM_STATE: ConfirmState = {
  isOpen: false,
  title: '',
  message: '',
  confirmText: 'Confirm',
  confirmVariant: 'primary',
  onConfirm: () => {},
  loading: false,
}

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState>(INITIAL_CONFIRM_STATE)

  const addToast = useCallback((input: AddToastInput) => {
    const newToast: ToastItem = {
      id: generateToastId(),
      type: input.type,
      message: input.message,
    }
    setToasts((prev) => [...prev, newToast])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const confirm = useCallback((options: ConfirmOptions) => {
    setConfirmState({
      isOpen: true,
      title: options.title,
      message: options.message,
      confirmText: options.confirmText ?? 'Confirm',
      confirmVariant: options.confirmVariant ?? 'primary',
      onConfirm: options.onConfirm,
      loading: false,
    })
  }, [])

  const handleConfirmClose = useCallback(() => {
    setConfirmState(INITIAL_CONFIRM_STATE)
  }, [])

  const handleConfirmAction = useCallback(async () => {
    setConfirmState((prev) => ({ ...prev, loading: true }))
    try {
      await confirmState.onConfirm()
    } finally {
      setConfirmState(INITIAL_CONFIRM_STATE)
    }
  }, [confirmState.onConfirm])

  return (
    <UIContext.Provider
      value={{ addToast, removeToast, toasts, confirm, confirmState }}
    >
      {children}

      {/* Toast container — stacks toasts top-right */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-[calc(100vw-2rem)]">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            type={toast.type}
            message={toast.message}
            onDismiss={() => removeToast(toast.id)}
          />
        ))}
      </div>

      {/* Confirm modal — single instance reused */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={handleConfirmClose}
        onConfirm={handleConfirmAction}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        confirmVariant={confirmState.confirmVariant}
        loading={confirmState.loading}
      />
    </UIContext.Provider>
  )
}
