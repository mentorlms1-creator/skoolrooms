// =============================================================================
// lib/payment/mock.ts — Mock payment provider for development
// Always succeeds. Generates fake checkout URLs.
// Useful for local dev and screenshot-primary mode.
// =============================================================================

import { randomUUID } from 'crypto'
import type {
  PaymentProvider,
  WebhookEvent,
  GatewayTransaction,
} from '@/lib/payment/provider'

export class MockPaymentProvider implements PaymentProvider {
  /**
   * Creates a mock checkout session.
   * Returns a fake URL that points to the mock callback endpoint.
   * In development, visiting this URL triggers the webhook handler.
   */
  async createCheckout(params: {
    amountPkr: number
    description: string
    metadata: Record<string, string>
    idempotencyKey: string
    successUrl: string
    cancelUrl: string
  }): Promise<{ checkoutUrl: string; sessionId: string }> {
    const sessionId = randomUUID()

    // Build a fake checkout URL that includes metadata for the mock callback
    const checkoutUrl = `https://mock-gateway.local/checkout/${sessionId}?amount=${params.amountPkr}&return=${encodeURIComponent(params.successUrl)}`

    return { checkoutUrl, sessionId }
  }

  /**
   * Mock refund — always succeeds.
   */
  async refund(
    _transactionId: string,
    _amountPkr?: number,
  ): Promise<{ success: boolean; error?: string }> {
    return { success: true }
  }

  /**
   * Mock webhook verification — always returns valid with a parsed event.
   * In development, this allows testing webhook flows without real signatures.
   */
  async verifyWebhook(
    payload: string,
    _signature: string,
  ): Promise<{ valid: boolean; event?: WebhookEvent }> {
    try {
      const parsed = JSON.parse(payload) as {
        transactionId?: string
        amountPkr?: number
        metadata?: Record<string, string>
        type?: string
      }

      const event: WebhookEvent = {
        type: (parsed.type as WebhookEvent['type']) || 'payment_success',
        transactionId: parsed.transactionId || randomUUID(),
        amountPkr: parsed.amountPkr || 0,
        metadata: parsed.metadata || {},
      }

      return { valid: true, event }
    } catch {
      // If payload isn't valid JSON, still return valid with defaults
      return {
        valid: true,
        event: {
          type: 'payment_success',
          transactionId: randomUUID(),
          amountPkr: 0,
          metadata: {},
        },
      }
    }
  }

  /**
   * Mock transaction fetch — returns empty array.
   * Reconciliation cron will find no discrepancies in mock mode.
   */
  async fetchTransactions(
    _from: Date,
    _to: Date,
  ): Promise<GatewayTransaction[]> {
    return []
  }
}
