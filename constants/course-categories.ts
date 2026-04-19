/**
 * Course categories — fixed enum (stored as text in courses.category).
 *
 * Stored as text so we can append new categories without a migration.
 * Validation lives here in TypeScript; the DB column is `text NULL`.
 */

export const COURSE_CATEGORIES = [
  { value: 'mathematics', label: 'Mathematics' },
  { value: 'science', label: 'Science' },
  { value: 'physics', label: 'Physics' },
  { value: 'chemistry', label: 'Chemistry' },
  { value: 'biology', label: 'Biology' },
  { value: 'english', label: 'English' },
  { value: 'urdu', label: 'Urdu' },
  { value: 'computer_science', label: 'Computer Science' },
  { value: 'business_studies', label: 'Business Studies' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'economics', label: 'Economics' },
  { value: 'islamic_studies', label: 'Islamic Studies' },
  { value: 'general_knowledge', label: 'General Knowledge' },
  { value: 'test_prep', label: 'Test Prep' },
  { value: 'languages', label: 'Languages' },
  { value: 'art_music', label: 'Art & Music' },
  { value: 'other', label: 'Other' },
] as const

export type CourseCategory = (typeof COURSE_CATEGORIES)[number]['value']

const VALID_CATEGORY_SET: ReadonlySet<string> = new Set(
  COURSE_CATEGORIES.map((c) => c.value),
)

export function isValidCourseCategory(v: string): v is CourseCategory {
  return VALID_CATEGORY_SET.has(v)
}

export function categoryLabel(value: string | null | undefined): string | null {
  if (!value) return null
  const found = COURSE_CATEGORIES.find((c) => c.value === value)
  return found ? found.label : value
}

const MAX_TAGS = 5
const MAX_TAG_LENGTH = 24

/**
 * Normalize an array of free-form tags: lowercase, trim, dedupe, drop empties,
 * cap to MAX_TAG_LENGTH characters and MAX_TAGS entries.
 */
export function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input) {
    if (typeof raw !== 'string') continue
    const t = raw.trim().toLowerCase().slice(0, MAX_TAG_LENGTH)
    if (!t) continue
    if (seen.has(t)) continue
    seen.add(t)
    out.push(t)
    if (out.length >= MAX_TAGS) break
  }
  return out
}

export const TAG_LIMITS = { max: MAX_TAGS, maxLength: MAX_TAG_LENGTH } as const
