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

// =============================================================================
// Monthly billing helpers
// payment_month is stored in DB as 'YYYY-MM-01' (date type, first of month).
// All helpers below produce / consume that exact format so it lines up with
// the fee-reminders cron's `eq('payment_month', billingMonth)` check.
// =============================================================================

/**
 * Returns the first-of-month date string ('YYYY-MM-01') for a given Date.
 * Computed in PKT to avoid UTC midnight rolling back into the previous month
 * for evening-PKT requests.
 */
export function firstOfMonthPKT(date: Date): string {
  // toLocaleString in PKT gives us "M/D/YYYY, H:MM:SS AM/PM"
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PKT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date) // 'YYYY-MM-DD'
  return `${parts.slice(0, 7)}-01`
}

/**
 * Computes the FIRST billing month for a fresh enrollment.
 * For mid-cycle enrollments: don't back-bill — first payment covers the
 * current month forward. For pre-start-date enrollments: first payment
 * covers the cohort's start month.
 *
 * @param cohortStartDate - ISO date string (e.g. '2026-03-15')
 * @param billingDay - Cohort's billing_day (1-28). Currently unused in the
 *   computation (we always tag the first month, not the first billing date)
 *   but kept in the signature for future extension.
 * @returns 'YYYY-MM-01' string
 */
export function firstBillingMonth(
  cohortStartDate: string,
  _billingDay: number,
): string {
  // Slice the date string directly — no Date round-trip needed for the start month
  const startMonth = `${cohortStartDate.slice(0, 7)}-01`
  const todayMonth = firstOfMonthPKT(new Date())
  return startMonth > todayMonth ? startMonth : todayMonth
}

/**
 * Returns every billing month (first-of-month strings) covered by the
 * cohort's date range, inclusive on both ends. One entry per calendar month.
 *
 * @param cohortStartDate - ISO date string
 * @param cohortEndDate - ISO date string
 * @returns Array of 'YYYY-MM-01' strings, oldest first
 */
export function monthlyBillingSchedule(
  cohortStartDate: string,
  cohortEndDate: string,
): string[] {
  const start = firstOfMonthPKT(new Date(`${cohortStartDate}T00:00:00Z`))
  const end = firstOfMonthPKT(new Date(`${cohortEndDate}T00:00:00Z`))

  const result: string[] = []
  let cursor = start
  while (cursor <= end) {
    result.push(cursor)
    // Advance one month — parse, +1 month, re-format
    const [y, m] = cursor.split('-').map(Number)
    const next = new Date(Date.UTC(y, m, 1)) // m is 1-indexed; +0 days = same day next month? no: m here goes from 1..12 to 2..13 (becomes Jan next year)
    // Date.UTC normalises the month overflow correctly
    cursor = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`
  }
  return result
}

/**
 * Returns the billing due-date string ('YYYY-MM-DD') for a given payment_month
 * and the cohort's billing_day.
 *
 * @param paymentMonth - 'YYYY-MM-01' string
 * @param billingDay - 1-28
 */
export function dueDateForMonth(paymentMonth: string, billingDay: number): string {
  const yyyymm = paymentMonth.slice(0, 7) // 'YYYY-MM'
  return `${yyyymm}-${String(billingDay).padStart(2, '0')}`
}
