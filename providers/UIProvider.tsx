'use client'

/**
 * providers/UIProvider.tsx — Client-side UI state manager
 * Manages confirm modal state.
 * Renders ConfirmModal (AlertDialog) at provider level.
 *
 * Toast notifications are handled by Sonner (import { toast } from 'sonner').
 */

import { createContext, useCallback, useContext, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

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
  const [confirmState, setConfirmState] = useState<ConfirmState>(INITIAL_CONFIRM_STATE)

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
      value={{ confirm, confirmState }}
    >
      {children}

      {/* Confirm dialog — single instance reused */}
      <AlertDialog open={confirmState.isOpen} onOpenChange={(open) => { if (!open) handleConfirmClose() }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmState.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmState.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmState.loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              variant={confirmState.confirmVariant === 'danger' ? 'danger' : 'primary'}
              disabled={confirmState.loading}
            >
              {confirmState.confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UIContext.Provider>
  )
}
