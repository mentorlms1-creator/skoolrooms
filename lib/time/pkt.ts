// =============================================================================
// lib/time/pkt.ts — Pakistan Standard Time (PKT) utilities
// All timestamps stored UTC in database. All display in PKT (UTC+5).
// Always use these functions — never use toLocaleString() or raw UTC display.
// =============================================================================

const PKT_TIMEZONE = 'Asia/Karachi'

/**
 * Returns the current time as a Date object representing PKT (UTC+5).
 * Note: JavaScript Date objects are always UTC internally.
 * This function returns a Date whose UTC value is shifted to represent PKT.
 */
export function currentPKT(): Date {
  const now = new Date()
  // Get UTC time string formatted for PKT timezone
  const pktString = now.toLocaleString('en-US', { timeZone: PKT_TIMEZONE })
  return new Date(pktString)
}

/**
 * Formats a UTC timestamp for display in PKT (UTC+5).
 *
 * @param utc - A UTC date string (ISO 8601) or Date object
 * @param format - Display format:
 *   - 'date'     → "15 Jan 2025"
 *   - 'time'     → "2:30 PM"
 *   - 'datetime' → "15 Jan 2025, 2:30 PM"
 *   - 'relative' → "2 hours ago", "in 3 days", etc.
 */
export function formatPKT(
  utc: string | Date,
  format: 'date' | 'time' | 'datetime' | 'relative',
): string {
  const date = typeof utc === 'string' ? new Date(utc) : utc

  if (format === 'relative') {
    return formatRelative(date)
  }

  const formatOptions: Record<string, Intl.DateTimeFormatOptions> = {
    date: {
      timeZone: PKT_TIMEZONE,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
    time: {
      timeZone: PKT_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    },
    datetime: {
      timeZone: PKT_TIMEZONE,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    },
  }

  return new Intl.DateTimeFormat('en-PK', formatOptions[format]).format(date)
}

/**
 * Returns a relative time string ("2 hours ago", "in 3 days", etc.)
 */
function formatRelative(date: Date): string {
  const now = Date.now()
  const diffMs = date.getTime() - now
  const absDiffMs = Math.abs(diffMs)

  const seconds = Math.floor(absDiffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  let value: number
  let unit: Intl.RelativeTimeFormatUnit

  if (seconds < 60) {
    value = seconds
    unit = 'second'
  } else if (minutes < 60) {
    value = minutes
    unit = 'minute'
  } else if (hours < 24) {
    value = hours
    unit = 'hour'
  } else {
    value = days
    unit = 'day'
  }

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  return rtf.format(diffMs < 0 ? -value : value, unit)
}

/**
 * Returns a Date representing the billing date for a specific month and year.
 * Billing day is always 1-28 (UI and API both block 29/30/31).
 *
 * @param billingDay - Day of month (1-28)
 * @param year - Full year (e.g. 2025)
 * @param month - Month (1-12, NOT 0-indexed)
 * @returns UTC Date at midnight for the billing date
 */
export function getBillingDateForMonth(
  billingDay: number,
  year: number,
  month: number,
): Date {
  if (billingDay < 1 || billingDay > 28) {
    throw new Error(`billing_day must be 1-28, got ${billingDay}`)
  }
  if (month < 1 || month > 12) {
    throw new Error(`month must be 1-12, got ${month}`)
  }

  // Month is 1-indexed for the caller, but Date uses 0-indexed months
  return new Date(Date.UTC(year, month - 1, billingDay))
}
