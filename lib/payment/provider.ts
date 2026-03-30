// =============================================================================
// lib/payment/provider.ts — PaymentProvider interface + factory
// Defines the payment gateway abstraction and returns the active provider
// based on the PAYMENT_GATEWAY environment variable.
// =============================================================================

// -----------------------------------------------------------------------------
// Webhook event type — parsed gateway webhook payload
// -----------------------------------------------------------------------------
export type WebhookEvent = {
  type: 'payment_success' | 'payment_failed' | 'refund_success'
  transactionId: string
  amountPkr: number
  metadata: Record<string, string>
}

// -----------------------------------------------------------------------------
// Gateway transaction type — for reconciliation cron
// -----------------------------------------------------------------------------
export type GatewayTransaction = {
  transactionId: string
  amountPkr: number
  status: string
  createdAt: Date
  metadata: Record<string, string>
}

// -----------------------------------------------------------------------------
// PaymentProvider interface — all gateway adapters implement this
// -----------------------------------------------------------------------------
export interface PaymentProvider {
  /**
   * Creates a checkout session and returns the redirect URL.
   * The customer is redirected to checkoutUrl to complete payment.
   */
  createCheckout(params: {
    amountPkr: number
    description: string
    metadata: Record<string, string>
    idempotencyKey: string
    successUrl: string
    cancelUrl: string
  }): Promise<{ checkoutUrl: string; sessionId: string }>

  /**
   * Issues a refund for a completed transaction.
   * If amountPkr is omitted, full refund is issued.
   */
  refund(
    transactionId: string,
    amountPkr?: number,
  ): Promise<{ success: boolean; error?: string }>

  /**
   * Verifies a webhook payload signature and parses the event.
   * Returns { valid: false } if signature is invalid.
   */
  verifyWebhook(
    payload: string,
    signature: string,
  ): Promise<{ valid: boolean; event?: WebhookEvent }>

  /**
   * Fetches transactions from the gateway for a given date range.
   * Used by the daily reconciliation cron to detect discrepancies.
   */
  fetchTransactions(from: Date, to: Date): Promise<GatewayTransaction[]>
}

// -----------------------------------------------------------------------------
// Factory — returns the active payment provider based on env config
// -----------------------------------------------------------------------------

let cachedProvider: PaymentProvider | null = null

/**
 * Returns the active PaymentProvider instance.
 *
 * Determined by PAYMENT_GATEWAY env var:
 * - 'mock' (default) → MockPaymentProvider (dev + screenshot-primary mode)
 * - 'safepay' → SafepayProvider (Phase 2)
 * - 'payfast' → PayfastProvider (Phase 2)
 */
export function getPaymentProvider(): PaymentProvider {
  if (cachedProvider) return cachedProvider

  const gateway = process.env.PAYMENT_GATEWAY || 'mock'

  switch (gateway) {
    case 'mock': {
      // Dynamic import avoided — mock is always available
      const { MockPaymentProvider } = require('@/lib/payment/mock') as {
        MockPaymentProvider: new () => PaymentProvider
      }
      cachedProvider = new MockPaymentProvider()
      break
    }
    // Phase 2: uncomment when adapters are built
    // case 'safepay': {
    //   const { SafepayProvider } = require('@/lib/payment/safepay')
    //   cachedProvider = new SafepayProvider()
    //   break
    // }
    // case 'payfast': {
    //   const { PayfastProvider } = require('@/lib/payment/payfast')
    //   cachedProvider = new PayfastProvider()
    //   break
    // }
    default:
      throw new Error(`Unknown PAYMENT_GATEWAY: ${gateway}. Expected 'mock', 'safepay', or 'payfast'.`)
  }

  return cachedProvider
}
