/**
 * components/public/marketing/WhatsAppButton.tsx — Floating WhatsApp chat
 * launcher. Hidden until WHATSAPP_NUMBER is set in tokens.ts, so we never
 * ship a dead button.
 */

import { WHATSAPP_NUMBER } from './tokens'

export function WhatsAppButton() {
  if (!WHATSAPP_NUMBER) return null

  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      style={{
        position: 'fixed',
        bottom: 28,
        right: 28,
        width: 54,
        height: 54,
        borderRadius: '50%',
        background: '#25D366',
        fontSize: 24,
        boxShadow: '0 4px 20px rgba(37,211,102,0.45)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textDecoration: 'none',
      }}
    >
      💬
    </a>
  )
}
