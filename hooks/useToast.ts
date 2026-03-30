/**
 * hooks/useToast.ts — Toast notification hook
 * Convenience wrapper around UIProvider context.
 * Must be used within a UIProvider.
 */

import { useUIContext } from '@/providers/UIProvider'

export function useToast() {
  const { addToast, removeToast, toasts } = useUIContext()
  return { addToast, removeToast, toasts }
}
