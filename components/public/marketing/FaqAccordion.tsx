'use client'

/**
 * components/public/marketing/FaqAccordion.tsx — Expand/collapse FAQ list
 * from the marketing design. Only piece of the teacher landing page that
 * needs client state.
 */

import { useState } from 'react'
import { C, FONT_BODY, FONT_HEAD } from './tokens'

export type FaqItem = { q: string; a: string }

export function FaqAccordion({ faqs }: { faqs: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {faqs.map((f, i) => (
        <div
          key={f.q}
          style={{
            borderRadius: 14,
            border: `2px solid ${open === i ? C.purple : '#eee'}`,
            overflow: 'hidden',
            transition: 'border-color 0.2s',
          }}
        >
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
            style={{
              width: '100%',
              padding: '18px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              background: C.white,
              border: 'none',
              cursor: 'pointer',
              fontFamily: FONT_HEAD,
              fontWeight: 700,
              fontSize: 14,
              color: C.black,
              textAlign: 'left',
            }}
          >
            {f.q}
            <span style={{ color: C.purple, fontSize: 22, fontWeight: 300, flexShrink: 0 }}>
              {open === i ? '−' : '+'}
            </span>
          </button>
          {open === i && (
            <div style={{ padding: '0 24px 18px', fontSize: 14, fontFamily: FONT_BODY, fontWeight: 300, color: '#666', lineHeight: 1.75 }}>
              {f.a}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
