import { randomBytes } from 'node:crypto'

const SAFE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

export function generateCertificateNumber(now: Date = new Date()): string {
  const year = now.getUTCFullYear()
  const bytes = randomBytes(8)
  let suffix = ''
  for (const b of bytes) suffix += SAFE_CHARS[b % SAFE_CHARS.length]
  return `SR-${year}-${suffix}`
}
