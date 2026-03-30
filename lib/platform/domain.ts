// =============================================================================
// lib/platform/domain.ts — Platform URL builders
// All platform URLs derive from NEXT_PUBLIC_PLATFORM_DOMAIN env var.
// Never hardcode 'lumscribe.com' anywhere — always use these functions.
// =============================================================================

/**
 * Returns the platform domain from environment.
 * Example: 'lumscribe.com'
 */
export const platformDomain = () => process.env.NEXT_PUBLIC_PLATFORM_DOMAIN!

/**
 * Returns the full URL for a teacher's subdomain.
 * Example: teacherSubdomainUrl('ahmed') → 'https://ahmed.lumscribe.com'
 * Example: teacherSubdomainUrl('ahmed', '/courses') → 'https://ahmed.lumscribe.com/courses'
 */
export const teacherSubdomainUrl = (sub: string, path = '') =>
  `https://${sub}.${platformDomain()}${path}`

/**
 * Returns the student portal URL.
 * Example: studentPortalUrl() → 'https://students.lumscribe.com'
 * Example: studentPortalUrl('/courses') → 'https://students.lumscribe.com/courses'
 */
export const studentPortalUrl = (path = '') =>
  `https://students.${platformDomain()}${path}`

/**
 * Returns the main platform URL with optional path.
 * Example: platformUrl() → 'https://lumscribe.com'
 * Example: platformUrl('/pricing') → 'https://lumscribe.com/pricing'
 */
export const platformUrl = (path = '') =>
  `https://${platformDomain()}${path}`
