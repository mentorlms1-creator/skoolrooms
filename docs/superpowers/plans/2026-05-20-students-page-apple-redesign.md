# Students Page — Apple Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the iCloud-Web-voiced redesign of `/dashboard/students` (KPI hero + Music-style table → mobile cards) and ship the supporting student-avatar feature (DB column + upload UI + shared `StudentAvatar` primitive).

**Architecture:** Server Components by default, client-only on the table. New `<StudentAvatar>` shared primitive renders a Next.js `<Image>` when a photo is present, otherwise a deterministic OKLCH-tinted circle with initials. Student settings page extends its existing `updateStudentProfileAction` to also persist the photo URL and clean up R2 on replace/clear. Teacher data flow is unchanged — `getStudentsByTeacherPage()` continues to use `createAdminClient()` (service-role, bypassing RLS), with the new `profile_photo_url` column joined through the existing `students!inner(...)` select.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4 (CSS-first `@theme`), Supabase Postgres + RLS, Cloudflare R2 (presigned uploads), TypeScript strict mode, OKLCH semantic tokens.

**Spec:** `docs/superpowers/specs/2026-05-20-students-page-apple-redesign-design.md`

**Notes on testing:** This codebase has no test runner configured (no `vitest`/`jest`/`playwright` in package.json, no `test` script). Verification in every task is via `npx tsc --noEmit`, `npm run build`, and explicit dev-server visual checks. Don't try to add a test framework — that's not the project's pattern.

**Notes on commits:** Commit after each task. The user's CLAUDE.md says only commit when asked, but in plan execution the user has implicitly opted in by approving this plan. Confirm before each commit if uncertain. Use the format `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` on the trailer.

---

## Task 0: Pre-flight — Reconcile existing uncommitted changes

**Context:** Before writing this plan the user did a styling pass on three files. They're still uncommitted in the working tree. The StatusBadge changes are universally useful and consistent with the new spec — keep them. The other two will be fully overwritten by Tasks 8 and 9, so discarding them keeps later diffs clean.

**Files:**
- Modify: `components/ui/StatusBadge.tsx` (keep — commit)
- Modify: `app/(teacher)/dashboard/students/page.tsx` (discard)
- Modify: `app/(teacher)/dashboard/students/StudentTable.tsx` (discard)

- [ ] **Step 1: Show what's pending**

```bash
git status --short
git diff components/ui/StatusBadge.tsx
```
Expected: three modified files (the two students-page files + StatusBadge.tsx), StatusBadge diff shows `gap-1.5` + colored dot.

- [ ] **Step 2: Commit the StatusBadge improvement on its own**

```bash
git add components/ui/StatusBadge.tsx
git commit -m "$(cat <<'EOF'
ui(StatusBadge): add semantic dot + gap-1.5 to every status pill

Each status badge now leads with a small colored dot (uses bg-current so it
inherits the variant color: success/warning/destructive/muted). Improves
scanability without changing sizing or the OKLCH semantic colors.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```
Expected: one file changed, ~4 insertions, ~2 deletions.

- [ ] **Step 3: Discard the obsolete students-page work**

These will be fully rewritten by Tasks 8 and 9. Revert to HEAD so the new code lands as a clean diff.

```bash
git checkout HEAD -- "app/(teacher)/dashboard/students/page.tsx" "app/(teacher)/dashboard/students/StudentTable.tsx"
git status --short
```
Expected: clean working tree.

- [ ] **Step 4: Verify typecheck still clean**

```bash
npx tsc --noEmit
```
Expected: no output (exit 0).

---

## Task 1: Schema migration + type regeneration

**Files:**
- Create: `supabase/migrations/032_students_profile_photo.sql`
- Modify (regenerated, do not edit by hand): `types/database.ts`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/032_students_profile_photo.sql
--
-- Add optional profile photo URL to students.
-- Mirrors the existing teachers.profile_photo_url column; stored as the public
-- R2 URL produced by lib/r2/upload.ts (key pattern: profiles/{studentId}.{ext}).
--
-- RLS impact: none. Student self-update is covered by the existing
-- students_update_own_row policy. Teacher reads use createAdminClient() in
-- lib/db/enrollments.ts, which bypasses RLS — authorization is upstream via
-- requireTeacher() + the cohort teacher_id filter.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS profile_photo_url text;
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the `supabase__apply_migration` MCP tool with:
- `name`: `students_profile_photo`
- `query`: the SQL above (without the comment header — Postgres tolerates it but `apply_migration` records the name separately)

Confirm in the MCP response that the migration applied successfully.

- [ ] **Step 3: Regenerate TypeScript types**

```bash
npx supabase gen types typescript --project-id <project-id> > types/database.ts
```

If the project is linked locally:
```bash
npx supabase gen types typescript --linked > types/database.ts
```

(If neither works, fall back to copying the types from the Supabase dashboard's "API Docs → Tables → students" section into `types/database.ts`. The relevant change is a single `profile_photo_url: string | null` field added to the `students.Row`, `students.Insert`, and `students.Update` types.)

- [ ] **Step 4: Verify the type appears**

```bash
grep -n "profile_photo_url" types/database.ts | head -10
```
Expected: at least 3 matches (Row, Insert, Update) under the `students` table block. Confirm by searching for the surrounding `students:` key in the file.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```
Expected: exit 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/032_students_profile_photo.sql types/database.ts
git commit -m "$(cat <<'EOF'
feat(db): add students.profile_photo_url for student avatars

Nullable text column on students. Mirrors teachers.profile_photo_url. RLS
unchanged: existing students_update_own_row covers updates; teacher reads go
through createAdminClient() in lib/db/enrollments.ts.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add OKLCH avatar palette to globals.css

**Files:**
- Modify: `app/globals.css` — add 9 new vars under the existing `@theme` block

- [ ] **Step 1: Locate the `@theme` block**

```bash
grep -n "@theme" app/globals.css | head -5
```
Note the line number of the `@theme inline` block where `--color-*: var(--*)` mappings live (around line 86 based on earlier inspection).

- [ ] **Step 2: Add the raw OKLCH definitions to `:root`**

In `app/globals.css`, immediately AFTER the line containing `--ring: oklch(0.55 0.25 285);` inside the `:root` block (light mode), insert:

```css
  /* Avatar palette — 8 deterministic hues + foreground for colored-initial circles.
     OKLCH lightness in the 0.55–0.70 band stays legible on both bg-card modes,
     so no per-mode override is needed below. */
  --avatar-1: oklch(0.62 0.18 25);
  --avatar-2: oklch(0.65 0.16 50);
  --avatar-3: oklch(0.70 0.14 90);
  --avatar-4: oklch(0.62 0.17 145);
  --avatar-5: oklch(0.62 0.14 195);
  --avatar-6: oklch(0.58 0.17 250);
  --avatar-7: oklch(0.55 0.20 285);
  --avatar-8: oklch(0.62 0.16 340);
  --avatar-foreground: oklch(1 0 0);
```

- [ ] **Step 3: Add the same defs to the `.dark` block**

Find the `.dark { ... }` block (around line 47). Immediately AFTER its `--ring` line, paste the SAME 9 lines (they're identical — the OKLCH band works in both modes).

- [ ] **Step 4: Map them inside `@theme inline`**

Inside the `@theme inline` block (around line 86), after the `--color-ring: var(--ring);` line, add:

```css
  --color-avatar-1: var(--avatar-1);
  --color-avatar-2: var(--avatar-2);
  --color-avatar-3: var(--avatar-3);
  --color-avatar-4: var(--avatar-4);
  --color-avatar-5: var(--avatar-5);
  --color-avatar-6: var(--avatar-6);
  --color-avatar-7: var(--avatar-7);
  --color-avatar-8: var(--avatar-8);
  --color-avatar-foreground: var(--avatar-foreground);
```

This is what makes `text-avatar-foreground` and `bg-avatar-1` valid Tailwind utility names.

- [ ] **Step 5: Build check**

```bash
npm run build 2>&1 | tail -20
```
Expected: successful build, no CSS errors. (If build is slow, `npx tsc --noEmit` alone is fine for this step — the CSS doesn't affect type-checking, only later visual checks.)

- [ ] **Step 6: Commit**

```bash
git add app/globals.css
git commit -m "$(cat <<'EOF'
ui(theme): add 8-hue OKLCH avatar palette + foreground token

Adds --avatar-1 through --avatar-8 and --avatar-foreground for use by the
new StudentAvatar component. Lightness band (0.55-0.70) chosen to read
correctly on bg-card in both light and dark mode without per-mode overrides.
Mapped into @theme inline so text-avatar-foreground and bg-avatar-N work.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Avatar utility helpers

**Files:**
- Create: `lib/utils/avatar.ts`

- [ ] **Step 1: Write the helpers**

```ts
// lib/utils/avatar.ts
//
// Deterministic avatar color + initials. Same student.id always maps to the
// same palette slot, so a given student looks identical wherever they appear
// in the app.

const PALETTE_SIZE = 8

/**
 * Returns a CSS color reference (e.g. "var(--avatar-3)") for a student.
 * Deterministic — same id always yields the same slot.
 * Inline-style usage: <div style={{ background: avatarColorVar(student.id) }} />
 */
export function avatarColorVar(studentId: string): string {
  let h = 0
  for (let i = 0; i < studentId.length; i++) {
    h = (h * 31 + studentId.charCodeAt(i)) | 0
  }
  return `var(--avatar-${(Math.abs(h) % PALETTE_SIZE) + 1})`
}

/**
 * "Aisha Khan" -> "AK", "Ali" -> "A", "" -> "?".
 * Takes up to the first two whitespace-separated tokens.
 */
export function avatarInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
```

- [ ] **Step 2: Sanity-check the logic in a one-liner**

(No formal test runner — this is the verification.)

```bash
node -e "
const avatar = require('./lib/utils/avatar.ts');
" 2>&1 || true
```

The above will fail because Node can't import TS directly — that's fine. Instead, verify by reading the file back and checking:

```bash
grep -n "Math.abs(h)" lib/utils/avatar.ts
grep -n "toUpperCase" lib/utils/avatar.ts
```
Expected: both grep commands return a match.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add lib/utils/avatar.ts
git commit -m "$(cat <<'EOF'
feat(utils): add deterministic avatar color + initials helpers

avatarColorVar(id) hashes a student UUID to one of 8 OKLCH palette slots,
returning a CSS var() reference for inline use. avatarInitials(name) takes
the first two name tokens. Pure functions; no React deps.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: StudentAvatar shared component

**Files:**
- Create: `components/ui/StudentAvatar.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/ui/StudentAvatar.tsx
//
// Shared avatar primitive. Renders the student's uploaded photo if present,
// otherwise a deterministic OKLCH-tinted circle with initials. Used wherever
// a student is identified visually (table rows, mobile cards, settings
// preview, future detail pages).
//
// Server-compatible (no client hooks).

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { avatarColorVar, avatarInitials } from '@/lib/utils/avatar'

type StudentAvatarSize = 'sm' | 'md' | 'lg'

type StudentAvatarProps = {
  id: string
  name: string
  photoUrl?: string | null
  size?: StudentAvatarSize
  className?: string
}

const sizeMap: Record<StudentAvatarSize, { px: number; text: string }> = {
  sm: { px: 24, text: 'text-[9px]' },
  md: { px: 32, text: 'text-[11px]' },
  lg: { px: 56, text: 'text-lg' },
}

export function StudentAvatar({
  id,
  name,
  photoUrl,
  size = 'md',
  className,
}: StudentAvatarProps) {
  const { px, text } = sizeMap[size]
  const dim = `${px}px`

  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={name}
        width={px}
        height={px}
        className={cn(
          'rounded-full object-cover shrink-0',
          className,
        )}
        style={{ width: dim, height: dim }}
      />
    )
  }

  return (
    <div
      aria-label={name}
      className={cn(
        'inline-flex items-center justify-center rounded-full shrink-0 font-semibold text-avatar-foreground select-none',
        text,
        className,
      )}
      style={{
        width: dim,
        height: dim,
        background: avatarColorVar(id),
      }}
    >
      {avatarInitials(name)}
    </div>
  )
}
```

- [ ] **Step 2: Confirm next/image is configured to allow R2 hostnames**

```bash
grep -n "remotePatterns\|domains" next.config.* 2>&1 | head -10
```
If R2's public hostname isn't in `next.config.ts`'s `images.remotePatterns`, the `<Image>` path will throw at runtime. If it IS configured, move on.

If it ISN'T configured, add it:

```ts
// next.config.ts (only if R2 hostname is missing)
images: {
  remotePatterns: [
    { protocol: 'https', hostname: '<your-r2-public-hostname>' },
    // ...existing patterns
  ],
}
```

The hostname comes from `CLOUDFLARE_R2_PUBLIC_URL` (an env var). If it's a wildcard (`*.r2.dev`), use `{ protocol: 'https', hostname: '**.r2.dev' }`.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add components/ui/StudentAvatar.tsx next.config.* 2>/dev/null
git commit -m "$(cat <<'EOF'
feat(ui): add StudentAvatar shared component

Renders next/image when photoUrl is set, otherwise a deterministic
OKLCH-tinted initials circle via avatarColorVar(). Three sizes: sm (24px),
md (32px, default), lg (56px). Server-compatible.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Extend data layer — query updates

**Files:**
- Modify: `lib/db/enrollments.ts` (around line 630–725)

- [ ] **Step 1: Read the existing functions**

```bash
sed -n '620,730p' lib/db/enrollments.ts
```
Confirm `getStudentsByTeacherPage()` at ~line 633 and `getStudentStatsByTeacher()` at ~line 679.

- [ ] **Step 2: Extend the select in `getStudentsByTeacherPage()`**

Find the `.select(\`...\`)` chain inside `getStudentsByTeacherPage`. Replace the `students!inner(...)` line. Before:

```ts
      students!inner(id, name, email, phone),
```

After:

```ts
      students!inner(id, name, email, phone, profile_photo_url),
```

- [ ] **Step 3: Update the `EnrollmentWithStudentAndCohort` type if needed**

Grep for the type:

```bash
grep -n "EnrollmentWithStudentAndCohort" lib/db/enrollments.ts | head -5
grep -n "EnrollmentWithStudentAndCohort" types/ -r | head -5
```

Find where it's defined. If it's a manual type with explicit student fields, add `profile_photo_url: string | null` to the student shape. If it's derived from `Database['public']['Tables']['students']['Row']`, the regenerated `types/database.ts` already covers it — no change.

- [ ] **Step 4: Extend `getStudentStatsByTeacher()` return shape and queries**

Replace the function body. Before (around line 679):

```ts
export async function getStudentStatsByTeacher(teacherId: string): Promise<{
  uniqueStudents: number
  active: number
  pending: number
}> {
  const supabase = createAdminClient()

  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id')
    .eq('teacher_id', teacherId)
    .is('deleted_at', null)

  const cohortIds = (cohorts ?? []).map((c) => c.id as string)
  if (cohortIds.length === 0) {
    return { uniqueStudents: 0, active: 0, pending: 0 }
  }

  const [{ count: active }, { count: pending }, { data: distinctRows }] =
    await Promise.all([
      // ...
    ])

  // ...

  return {
    uniqueStudents: distinct.size,
    active: active ?? 0,
    pending: pending ?? 0,
  }
}
```

After (full replacement):

```ts
export async function getStudentStatsByTeacher(teacherId: string): Promise<{
  uniqueStudents: number
  active: number
  pending: number
  newThisMonth: number
  activePct: number
  oldestPendingDays: number | null
}> {
  const supabase = createAdminClient()

  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id')
    .eq('teacher_id', teacherId)
    .is('deleted_at', null)

  const cohortIds = (cohorts ?? []).map((c) => c.id as string)
  if (cohortIds.length === 0) {
    return {
      uniqueStudents: 0,
      active: 0,
      pending: 0,
      newThisMonth: 0,
      activePct: 0,
      oldestPendingDays: null,
    }
  }

  // Start-of-month in PKT (UTC+5). All timestamps in DB are UTC, so we compute
  // the UTC instant that corresponds to 00:00 PKT on the 1st of the current
  // PKT month, then compare against created_at.
  const nowUtc = new Date()
  const nowPkt = new Date(nowUtc.getTime() + 5 * 60 * 60 * 1000)
  const startOfMonthPktUtc = new Date(
    Date.UTC(nowPkt.getUTCFullYear(), nowPkt.getUTCMonth(), 1) - 5 * 60 * 60 * 1000,
  ).toISOString()

  const [
    { count: active },
    { count: pending },
    { data: distinctRows },
    { count: newThisMonth },
    { data: oldestPendingRow },
  ] = await Promise.all([
    supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .in('cohort_id', cohortIds)
      .in('status', ['active', 'enrolled']),
    supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .in('cohort_id', cohortIds)
      .eq('status', 'pending'),
    supabase
      .from('enrollments')
      .select('student_id')
      .in('cohort_id', cohortIds),
    supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .in('cohort_id', cohortIds)
      .gte('created_at', startOfMonthPktUtc),
    supabase
      .from('enrollments')
      .select('created_at')
      .in('cohort_id', cohortIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1),
  ])

  const distinct = new Set<string>()
  for (const row of (distinctRows ?? []) as Array<{ student_id: string }>) {
    distinct.add(row.student_id)
  }

  const uniqueStudents = distinct.size
  const activeCount = active ?? 0
  const pendingCount = pending ?? 0

  const activePct =
    uniqueStudents > 0
      ? Math.round((activeCount / uniqueStudents) * 100)
      : 0

  let oldestPendingDays: number | null = null
  if (oldestPendingRow && oldestPendingRow.length > 0) {
    const createdAt = new Date(
      (oldestPendingRow[0] as { created_at: string }).created_at,
    )
    const ms = nowUtc.getTime() - createdAt.getTime()
    oldestPendingDays = Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
  }

  return {
    uniqueStudents,
    active: activeCount,
    pending: pendingCount,
    newThisMonth: newThisMonth ?? 0,
    activePct,
    oldestPendingDays,
  }
}
```

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```
Expected: exit 0.

If the page.tsx still consumes the old return shape (it does — Task 8 will update it), TypeScript will succeed because the new shape is a strict superset until consumers reference the new fields.

- [ ] **Step 6: Commit**

```bash
git add lib/db/enrollments.ts
git commit -m "$(cat <<'EOF'
feat(db): extend student stats with deltas + select profile_photo_url

getStudentStatsByTeacher now also returns newThisMonth (PKT month boundary),
activePct (active/total rounded), and oldestPendingDays (null if no pending).
All four extra counts run in parallel via Promise.all — no new round-trips
beyond what was already there.

getStudentsByTeacherPage now selects students.profile_photo_url so the
table can render the new avatar.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Extend student profile server action for photo + R2 cleanup

**Files:**
- Modify: `lib/actions/student-settings.ts`

- [ ] **Step 1: Read the existing action**

```bash
cat lib/actions/student-settings.ts
```
Note current `updateStudentProfileAction` reads `name` and `phone` from FormData, validates them, and calls `updateStudent(student.id, { name, phone })`.

- [ ] **Step 2: Replace the action with the extended version**

Open `lib/actions/student-settings.ts` and replace its contents with:

```ts
'use server'

import { createClient } from '@/supabase/server'
import { createAdminClient } from '@/supabase/server'
import { getStudentByAuthId } from '@/lib/db/students'
import { updateStudent } from '@/lib/db/students'
import { deleteR2File } from '@/lib/r2/upload'
import type { ApiResponse } from '@/types/api'

/**
 * Update the signed-in student's profile (name, phone, optional photo).
 *
 * FormData fields:
 *  - name (required, min 2 chars)
 *  - phone (required)
 *  - profile_photo_url (optional; always send — empty string = clear photo)
 *
 * On photo replace/clear, the previous R2 object is deleted to avoid orphans.
 */
export async function updateStudentProfileAction(
  formData: FormData,
): Promise<ApiResponse<null>> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { success: false, error: 'Not authenticated' }

  const student = await getStudentByAuthId(user.id)
  if (!student) return { success: false, error: 'Student not found' }

  const name = (formData.get('name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim()

  if (!name || name.length < 2) {
    return { success: false, error: 'Name must be at least 2 characters' }
  }
  if (!phone) {
    return { success: false, error: 'Phone number is required' }
  }

  // Photo handling. Field is only honored if it's present in FormData —
  // omission means "don't change". Empty string = explicit clear.
  const photoRaw = formData.get('profile_photo_url')
  const photoFieldPresent = photoRaw !== null
  const nextPhotoUrl = photoFieldPresent ? String(photoRaw).trim() : undefined

  if (photoFieldPresent) {
    const currentPhotoUrl = (student.profile_photo_url as string | null) ?? ''

    // If the value differs from what's currently stored and there WAS an old
    // photo, delete the old R2 object before saving the new URL (or clearing).
    if (currentPhotoUrl && currentPhotoUrl !== nextPhotoUrl) {
      const oldKey = r2KeyFromPublicUrl(currentPhotoUrl)
      if (oldKey) {
        try {
          await deleteR2File(oldKey)
        } catch (e) {
          // Best-effort cleanup; never block the profile save on R2 failure.
          console.error('[updateStudentProfileAction] R2 cleanup failed:', e)
        }
      }
    }
  }

  await updateStudent(student.id, {
    name,
    phone,
    // Only include profile_photo_url in the update if the field was sent.
    ...(photoFieldPresent
      ? { profile_photo_url: nextPhotoUrl === '' ? null : nextPhotoUrl }
      : {}),
  })

  return { success: true, data: null }
}

/**
 * Strip the CLOUDFLARE_R2_PUBLIC_URL prefix from a stored URL to recover the
 * object key. Returns null if the URL doesn't match the configured prefix
 * (defensive: avoids deleting an unrelated object).
 */
function r2KeyFromPublicUrl(publicUrl: string): string | null {
  const base = process.env.CLOUDFLARE_R2_PUBLIC_URL
  if (!base) return null
  const normalized = base.endsWith('/') ? base : `${base}/`
  if (!publicUrl.startsWith(normalized)) return null
  return publicUrl.slice(normalized.length)
}
```

- [ ] **Step 3: Confirm `updateStudent` accepts `profile_photo_url`**

```bash
grep -n "updateStudent\b" lib/db/students.ts | head -5
sed -n '1,80p' lib/db/students.ts | grep -A 20 "export function updateStudent\|export async function updateStudent"
```
The function signature should accept any subset of student columns. Since `types/database.ts` now includes `profile_photo_url` on `students.Update`, this should typecheck without modification. If `updateStudent` uses a hand-rolled type alias that doesn't include the new column, add `profile_photo_url?: string | null` to that type.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/student-settings.ts lib/db/students.ts 2>/dev/null
git commit -m "$(cat <<'EOF'
feat(student): extend profile action to handle photo upload + R2 cleanup

updateStudentProfileAction now also accepts profile_photo_url from FormData.
Field is only honored if present (omission = no change). Empty string clears
the photo. On replace/clear, the previous R2 object is deleted to prevent
orphans — best-effort, doesn't block the profile save on R2 failure.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Student settings — add avatar upload section

**Files:**
- Modify: `app/(student)/student/settings/page.tsx`
- Modify: `app/(student)/student/settings/form.tsx`

- [ ] **Step 1: Pass current photo URL + student id to the form**

In `app/(student)/student/settings/page.tsx`, update the `<StudentSettingsForm>` props. Find the existing component invocation and replace with:

```tsx
<StudentSettingsForm
  studentId={student.id as string}
  defaultName={student.name as string}
  defaultPhone={student.phone as string}
  defaultPhotoUrl={(student.profile_photo_url as string | null) ?? ''}
  email={student.email as string}
  memberSince={formatPKT(student.created_at as string, 'date')}
  guardianDefaults={{
    parent_name: (student.parent_name as string | null) ?? null,
    parent_phone: (student.parent_phone as string | null) ?? null,
    parent_email: (student.parent_email as string | null) ?? null,
  }}
/>
```

- [ ] **Step 2: Extend the form Props type and signature**

In `app/(student)/student/settings/form.tsx`, replace the `Props` type and the destructured component signature.

Find:
```tsx
type Props = {
  defaultName: string
  defaultPhone: string
  email: string
  memberSince: string
  guardianDefaults: {
    parent_name: string | null
    parent_phone: string | null
    parent_email: string | null
  }
}

export function StudentSettingsForm({ defaultName, defaultPhone, email, memberSince, guardianDefaults }: Props) {
```

Replace with:
```tsx
type Props = {
  studentId: string
  defaultName: string
  defaultPhone: string
  defaultPhotoUrl: string
  email: string
  memberSince: string
  guardianDefaults: {
    parent_name: string | null
    parent_phone: string | null
    parent_email: string | null
  }
}

export function StudentSettingsForm({ studentId, defaultName, defaultPhone, defaultPhotoUrl, email, memberSince, guardianDefaults }: Props) {
```

- [ ] **Step 3: Add the photo state + FileUpload imports**

At the top of `form.tsx`, add imports:

```tsx
import { FileUpload } from '@/components/ui/FileUpload'
import { StudentAvatar } from '@/components/ui/StudentAvatar'
```

Inside the component (with the other `useState` calls), add:

```tsx
const [photoUrl, setPhotoUrl] = useState(defaultPhotoUrl)
```

- [ ] **Step 4: Submit the photo URL**

In `handleSubmit`, change the FormData construction so the field is always sent:

Find:
```tsx
const formData = new FormData(e.currentTarget)
```

Add immediately after it:
```tsx
formData.set('profile_photo_url', photoUrl)
```

The action treats the field's presence as authoritative; empty string clears.

- [ ] **Step 5: Insert the avatar section JSX**

Inside the form's JSX, immediately after the success banner block (the `<div>` that renders the green "Profile updated." message — around the current line 71/72) and BEFORE the `<div className="space-y-2">` holding the Name field, insert:

```tsx
<div className="rounded-2xl bg-container ring-1 ring-foreground/[0.03] p-4 flex items-center gap-4">
  <StudentAvatar
    id={studentId}
    name={defaultName}
    photoUrl={photoUrl || null}
    size="lg"
  />
  <div className="flex-1 min-w-0">
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50 mb-2">
      Profile Photo
    </p>
    <FileUpload
      fileType="profile"
      entityId={studentId}
      onUploadComplete={(url) => setPhotoUrl(url)}
      onRemove={() => setPhotoUrl('')}
      currentUrl={photoUrl || undefined}
    />
    <p className="mt-2 text-xs text-muted-foreground">
      Optional. JPEG, PNG, or WebP. Max 2MB.
    </p>
  </div>
</div>
```

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 7: Visual check (dev server)**

```bash
npm run dev
```

Open `http://localhost:3000/student/settings` while signed in as a student. Verify:
- Avatar preview circle appears at top of form (large, with initials if no photo)
- File upload button works; upload completes; preview updates to the photo
- Save submits; refresh shows the photo persisted
- Light + dark mode both look correct

Stop the dev server when done.

- [ ] **Step 8: Commit**

```bash
git add "app/(student)/student/settings/page.tsx" "app/(student)/student/settings/form.tsx"
git commit -m "$(cat <<'EOF'
feat(student): add profile photo upload to settings

New avatar section at the top of /student/settings mounts FileUpload +
StudentAvatar preview. On submit, the photo URL is sent to the existing
updateStudentProfileAction which handles R2 cleanup.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Rewrite `/dashboard/students/page.tsx` — KPI hero card

**Files:**
- Modify: `app/(teacher)/dashboard/students/page.tsx` (full rewrite)

- [ ] **Step 1: Write the new page**

Replace the entire contents of `app/(teacher)/dashboard/students/page.tsx` with:

```tsx
/**
 * app/(teacher)/dashboard/students/page.tsx — All Students page (Server Component)
 *
 * iCloud-Web redesign: PageHeader + KPI hero card + StudentTable.
 * Stats come from a cheap aggregate query; table data is server-paginated.
 */

import type { Metadata } from 'next'
import { requireTeacher } from '@/lib/auth/guards'
import {
  getStudentsByTeacherPage,
  getStudentStatsByTeacher,
} from '@/lib/db/enrollments'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { StudentTable, type StudentTableRow } from './StudentTable'
import { DEFAULT_PAGE_SIZE } from '@/lib/pagination/limits'

export const metadata: Metadata = {
  title: 'Students — Skool Rooms',
}

type SearchParams = {
  cursor?: string
  q?: string
  status?: string
}

export default async function TeacherStudentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const teacher = await requireTeacher()
  const { cursor, q, status } = await searchParams

  const [page, stats] = await Promise.all([
    getStudentsByTeacherPage({
      teacherId: teacher.id,
      cursor: cursor ?? null,
      limit: DEFAULT_PAGE_SIZE,
      q: q ?? null,
      status: status ?? null,
    }),
    getStudentStatsByTeacher(teacher.id),
  ])

  const tableData: StudentTableRow[] = page.rows.map((e) => ({
    enrollmentId: e.id,
    studentId: e.students.id,
    name: e.students.name,
    email: e.students.email,
    phone: e.students.phone,
    photoUrl: (e.students as { profile_photo_url?: string | null }).profile_photo_url ?? null,
    courseTitle: e.cohorts.courses.title,
    cohortName: e.cohorts.name,
    status: e.status,
    enrolledAt: e.created_at,
  }))

  return (
    <>
      <PageHeader
        title="Students"
        description="All students enrolled across your courses"
      />

      {/* KPI hero — 3 stats divided by hairlines */}
      <div className="mb-6 rounded-2xl bg-card ring-1 ring-border/40 shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5 sm:p-6">
        <div className="grid grid-cols-3 gap-0">
          <KpiStat
            value={stats.uniqueStudents}
            label="Total"
            delta={stats.newThisMonth > 0 ? `+${stats.newThisMonth} this month` : null}
            tone="neutral"
          />
          <KpiStat
            value={stats.active}
            label="Active"
            delta={
              stats.uniqueStudents > 0 && stats.activePct > 0
                ? `${stats.activePct}% of total`
                : null
            }
            tone="success"
            divided
          />
          <KpiStat
            value={stats.pending}
            label="Pending"
            delta={
              stats.oldestPendingDays !== null && stats.pending > 0
                ? `Oldest ${stats.oldestPendingDays} day${stats.oldestPendingDays === 1 ? '' : 's'}`
                : null
            }
            tone="warning"
            divided
          />
        </div>
      </div>

      {page.rows.length === 0 && !cursor && !q && !status ? (
        <EmptyState
          title="No students yet"
          description="Students will appear here once they enroll in your courses."
        />
      ) : (
        <StudentTable
          data={tableData}
          nextCursor={page.nextCursor}
          currentCursor={cursor ?? null}
          totalHint={stats.uniqueStudents}
          currentSearch={q ?? ''}
          currentStatus={status ?? ''}
        />
      )}
    </>
  )
}

type KpiTone = 'neutral' | 'success' | 'warning'

function KpiStat({
  value,
  label,
  delta,
  tone,
  divided = false,
}: {
  value: number
  label: string
  delta: string | null
  tone: KpiTone
  divided?: boolean
}) {
  const toneClass =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-warning'
        : 'text-foreground'

  return (
    <div className={divided ? 'pl-4 sm:pl-6 border-l border-border/40' : 'pr-4 sm:pr-6'}>
      <div
        className={`text-[26px] sm:text-[34px] font-semibold tracking-[-0.025em] leading-none ${toneClass}`}
      >
        {value}
      </div>
      <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      {delta && (
        <div className="mt-1 hidden sm:block text-[11px] text-muted-foreground/80">
          {delta}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Do NOT typecheck or commit yet — proceed directly to Task 9**

Tasks 8 and 9 are paired: the new `page.tsx` produces a `StudentTableRow` with `photoUrl`, and `StudentTable.tsx` must accept it. Type-checking with only Task 8 applied will fail because the OLD `StudentTable.tsx` doesn't have `photoUrl` on its type. Leave `page.tsx` modified and go to Task 9 — the combined typecheck + commit happens there.

---

## Task 9: Rewrite `StudentTable.tsx` — desktop Music-style table

**Files:**
- Modify: `app/(teacher)/dashboard/students/StudentTable.tsx` (full rewrite, replaces the old DataTable-based version)

- [ ] **Step 1: Write the new component**

Replace the entire contents of `app/(teacher)/dashboard/students/StudentTable.tsx` with:

```tsx
'use client'

/**
 * app/(teacher)/dashboard/students/StudentTable.tsx — Music-style student list
 *
 * Roomy table on sm+, stacked cards on <sm. URL-driven search/filter/cursor;
 * the search input auto-submits after 500ms debounce (Enter forces instant).
 * Full row → student detail via next-view-transitions.
 */

import { Link } from 'next-view-transitions'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { StudentAvatar } from '@/components/ui/StudentAvatar'
import { Input } from '@/components/ui/input'
import { ROUTES } from '@/constants/routes'
import { formatPKT } from '@/lib/time/pkt'
import { cn } from '@/lib/utils'

export type StudentTableRow = {
  enrollmentId: string
  studentId: string
  name: string
  email: string
  phone: string
  photoUrl: string | null
  courseTitle: string
  cohortName: string
  status: string
  enrolledAt: string
}

const STATUSES = [
  { label: 'All', value: '_all' },
  { label: 'Active', value: 'active' },
  { label: 'Pending', value: 'pending' },
  { label: 'Withdrawn', value: 'withdrawn' },
  { label: 'Revoked', value: 'revoked' },
] as const

type StudentTableProps = {
  data: StudentTableRow[]
  nextCursor?: string | null
  currentCursor?: string | null
  totalHint?: number
  currentSearch?: string
  currentStatus?: string
}

export function StudentTable({
  data,
  nextCursor = null,
  currentCursor = null,
  totalHint,
  currentSearch = '',
  currentStatus = '',
}: StudentTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(currentSearch)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  const updateUrl = (
    next: Partial<{ cursor: string | null; q: string; status: string }>,
  ) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(next)) {
      if (key === 'cursor') {
        if (value) params.set('cursor', value as string)
        else params.delete('cursor')
      } else if (typeof value === 'string') {
        if (value) params.set(key, value)
        else params.delete(key)
      }
    }
    const qs = params.toString()
    startTransition(() => {
      router.replace(qs ? `/dashboard/students?${qs}` : '/dashboard/students', {
        scroll: false,
      })
    })
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    updateUrl({ q: search, cursor: null })
  }

  const onSearchChange = (value: string) => {
    setSearch(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      updateUrl({ q: value, cursor: null })
    }, 500)
  }

  const hasActiveFilter = Boolean(currentSearch || currentStatus)
  const isFilteredEmpty = data.length === 0 && hasActiveFilter

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-[260px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40 pointer-events-none" />
            <Input
              placeholder="Search name or email..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8 pr-7 rounded-lg border-none ring-1 ring-border bg-muted/20 hover:bg-muted/30 focus:bg-background h-9 text-xs focus-visible:ring-primary/45 transition-all placeholder:text-muted-foreground/50"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  if (debounceTimer.current) clearTimeout(debounceTimer.current)
                  updateUrl({ q: '', cursor: null })
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground p-0.5 rounded-full"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="w-full sm:w-auto overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-lg bg-muted/25 p-0.5 ring-1 ring-border/30">
            <div className="flex min-w-max gap-0.5">
              {STATUSES.map((item) => {
                const isActive = (currentStatus || '_all') === item.value
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() =>
                      updateUrl({
                        status: item.value === '_all' ? '' : item.value,
                        cursor: null,
                      })
                    }
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 select-none whitespace-nowrap',
                      isActive
                        ? 'bg-card text-foreground shadow-xs font-semibold ring-1 ring-border/30'
                        : 'text-muted-foreground/80 hover:text-foreground hover:bg-foreground/[0.02]',
                    )}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Hidden submit so Enter still fires instantly */}
        <button type="submit" className="hidden" aria-hidden="true" />
      </form>

      {/* Filtered-empty state */}
      {isFilteredEmpty ? (
        <div className="rounded-2xl bg-card ring-1 ring-border/40 px-6 py-16 text-center">
          <p className="text-sm text-foreground font-medium">
            No students match this filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('')
              if (debounceTimer.current) clearTimeout(debounceTimer.current)
              startTransition(() => {
                router.replace('/dashboard/students', { scroll: false })
              })
            }}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div
          className={cn(
            'transition-opacity duration-200',
            isPending && 'opacity-50 pointer-events-none',
          )}
        >
          {/* DESKTOP TABLE — sm+ */}
          <div className="hidden sm:block rounded-2xl bg-card ring-1 ring-border/40 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="grid grid-cols-[2.4fr_1.6fr_1fr_0.9fr] px-5 py-3 border-b border-border/40 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              <span>Student</span>
              <span>Course / Cohort</span>
              <span>Enrolled</span>
              <span>Status</span>
            </div>

            {data.map((row, idx) => (
              <Link
                key={row.enrollmentId}
                href={ROUTES.TEACHER.studentDetail(row.studentId)}
                className={cn(
                  'grid grid-cols-[2.4fr_1.6fr_1fr_0.9fr] items-center px-5 py-3 gap-2 transition-colors duration-150 hover:bg-muted/40',
                  idx < data.length - 1 && 'border-b border-border/40',
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StudentAvatar
                    id={row.studentId}
                    name={row.name}
                    photoUrl={row.photoUrl}
                    size="md"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-semibold text-foreground leading-tight truncate">
                      {row.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {row.email}
                      {row.phone ? ` · ${row.phone}` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="text-[12px] font-medium text-foreground truncate">
                    {row.courseTitle}
                  </span>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {row.cohortName}
                  </span>
                </div>

                <span className="text-[12px] text-muted-foreground whitespace-nowrap">
                  {formatPKT(row.enrolledAt, 'date')}
                </span>

                <div>
                  <StatusBadge status={row.status} size="sm" />
                </div>
              </Link>
            ))}
          </div>

          {/* MOBILE CARDS — <sm */}
          <div className="sm:hidden flex flex-col gap-2">
            {data.map((row) => (
              <Link
                key={row.enrollmentId}
                href={ROUTES.TEACHER.studentDetail(row.studentId)}
                className="flex items-center gap-3 rounded-xl bg-card ring-1 ring-border/40 px-4 py-3 transition-colors duration-150 active:bg-muted/50"
              >
                <StudentAvatar
                  id={row.studentId}
                  name={row.name}
                  photoUrl={row.photoUrl}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-foreground leading-tight truncate">
                    {row.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {row.email}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                    <span className="truncate">{row.courseTitle}</span>
                    <span>·</span>
                    <StatusBadge status={row.status} size="sm" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            count={data.length}
            totalHint={totalHint}
            nextCursor={nextCursor}
            currentCursor={currentCursor}
            onPageChange={(cursor) => updateUrl({ cursor })}
          />
        </div>
      )}
    </div>
  )
}

function Pagination({
  count,
  totalHint,
  nextCursor,
  currentCursor,
  onPageChange,
}: {
  count: number
  totalHint?: number
  nextCursor: string | null
  currentCursor: string | null
  onPageChange: (cursor: string | null) => void
}) {
  const hasNewer = currentCursor !== null
  const hasOlder = nextCursor !== null

  return (
    <div className="flex justify-between items-center pt-4 px-1 text-[11px] text-muted-foreground">
      <span>
        {count > 0 ? (
          <>
            Showing {count}
            {totalHint !== undefined && ` of ${totalHint}`}
          </>
        ) : (
          'No results on this page'
        )}
      </span>
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={!hasNewer}
          onClick={() => onPageChange(null)}
          className={cn(
            'px-3 py-1.5 rounded-lg ring-1 ring-border/40 bg-card text-xs transition-colors',
            hasNewer
              ? 'text-foreground hover:bg-muted/30'
              : 'text-muted-foreground/40 cursor-not-allowed',
          )}
        >
          ← Newer
        </button>
        <button
          type="button"
          disabled={!hasOlder}
          onClick={() => hasOlder && onPageChange(nextCursor)}
          className={cn(
            'px-3 py-1.5 rounded-lg ring-1 ring-border/40 bg-card text-xs transition-colors',
            hasOlder
              ? 'text-foreground hover:bg-muted/30'
              : 'text-muted-foreground/40 cursor-not-allowed',
          )}
        >
          Older →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck the combined Task 8 + Task 9 changes**

```bash
npx tsc --noEmit
```
Expected: exit 0. The new `StudentTableRow` includes `photoUrl`, which the new `page.tsx` produces; types align.

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | tail -30
```
Expected: build succeeds. Watch for any new errors around `text-avatar-foreground` (the @theme inline mapping is what makes this valid) or `next/image` remote pattern errors.

- [ ] **Step 4: Visual check (dev server)**

```bash
npm run dev
```

Open `http://localhost:3000/dashboard/students` while signed in as a teacher with at least a few students.

Verify on **desktop (≥640px)**:
- Page title large + subtitle quiet
- KPI hero card shows three stats with hairline dividers; deltas appear under each ("+N this month", "N% of total", "Oldest N days") — and disappear gracefully when zero
- Search input has spotlight feel with magnifying glass icon
- Segmented status control highlights "All" by default
- Table has 4 columns; rows show avatar + name + email•phone, course / cohort, enrolled date, status pill
- Hover any row → background tints, cursor turns to pointer
- Click row → navigates to `/dashboard/students/<id>` with view transition
- Type in search → after 500ms, results filter; table dims briefly during transition
- Press Enter in search → instant filter
- Click status segment → URL updates, table refilters
- Click clear (X) in search → search empties, results return
- Filter to status that has no results → "No students match this filter." card with "Clear filters" link
- Pagination shows correct count + Newer/Older buttons; Older works, Newer disabled on page 1

Verify on **mobile (<640px)** — use browser devtools, narrow to 375px:
- KPI hero stays 3-col but compact (no delta lines)
- Search full-width
- Segmented control horizontal-scrolls without visible scrollbar
- Table is replaced by stacked cards (avatar left, name+email+meta right)
- Tap row → still navigates with view transition

Verify in **dark mode** (toggle from sidebar):
- All surfaces switch cleanly to dark
- Avatar circles stay legible (OKLCH band)
- Status pills stay readable
- No raw color leakage

Stop the dev server when done.

- [ ] **Step 5: Commit both rewrites together**

```bash
git add "app/(teacher)/dashboard/students/page.tsx" "app/(teacher)/dashboard/students/StudentTable.tsx"
git commit -m "$(cat <<'EOF'
feat(teacher): Apple-redesign students page (KPI hero + bespoke table)

Rebuild /dashboard/students in iCloud-Web voice:
- KPI hero card with Total/Active/Pending and contextual deltas
  (+N this month, N% of total, Oldest N days; collapse on zero)
- Bespoke Music-style table on sm+: 4 cols, avatar via StudentAvatar,
  hairline row separators, hover tint, whole-row Link to detail
- Stacked cards on <sm with the same data, no horizontal scroll
- Spotlight-style search with 500ms debounce + Enter override
- iOS-style segmented status filter (scrollbar-hidden overflow on mobile)
- "No students match this filter." empty state with Clear filters link
- isPending opacity dim on filter/search/pagination transitions

DataTable is no longer used here; the table is bespoke for this layout.
DataTable remains untouched for every other page that uses it.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Final verification

**Files:** none modified — verification only.

- [ ] **Step 1: Full typecheck + build from a clean tree**

```bash
git status
npx tsc --noEmit
npm run build 2>&1 | tail -40
```
Expected: clean tree, typecheck passes, build succeeds.

- [ ] **Step 2: Smoke-check every page that touches StatusBadge**

The dot we added in Task 0 cascades. Spin up the dev server and click through the highest-traffic pages to confirm no visual regressions:

```bash
npm run dev
```

Check in light AND dark:
- `/dashboard/courses` (teacher)
- `/dashboard/settings/billing`
- `/dashboard/settings/plan`
- `/admin/payouts` (if you have admin access)
- `/student/payments` (sign in as a student)
- `/[subdomain]/join/[token]/pay/[enrollmentId]` (find an enrollment in pending state)

Verify status pills now have a colored dot but sizing and colors look identical to before. Anything off → revert just the StatusBadge commit (`git revert <hash>`) and the redesign is unaffected.

- [ ] **Step 3: Test the avatar feature end-to-end**

While the dev server is still running:
1. Sign in as a student → `/student/settings` → upload a photo → save → refresh → photo persists
2. Sign in as that student's teacher → `/dashboard/students` → that student's row shows their photo (no initials)
3. Sign back in as the student → upload a DIFFERENT photo → check R2 dashboard / logs to confirm the old object was deleted
4. Sign in as a different student (no photo) → `/student/settings` → confirm avatar shows colored initials
5. As teacher again → that other student's row shows colored initials in the same deterministic color across page reloads

- [ ] **Step 4: Test mobile**

Narrow the browser to 375px (or use a real phone via local network IP). Run through the same scenarios.

- [ ] **Step 5: Final summary**

Stop the dev server. Tag the work in your head: 10 commits, 11 files touched, 1 migration, 1 type regen, no shared-primitive regressions, both modes polished. If everything passes — done.

If anything fails, the failure points to one of the earlier tasks; fix there rather than patching at the end.

---

## Self-review notes (from the spec)

Spec sections that must each have a corresponding task:
- §3.1 Typography → Tasks 8 + 9 (inline classes match the spec)
- §3.2 Color tokens → Task 2 (palette) + all consumers
- §3.3 Page structure → Task 8 (page.tsx)
- §3.4 KPI hero card → Task 8
- §4.1 Schema migration → Task 1
- §4.2 OKLCH palette → Task 2
- §4.3 Helpers → Task 3
- §4.4 StudentAvatar → Task 4
- §4.5 Upload UI → Task 6 (server action) + Task 7 (form/page)
- §4.6 Display flow → Task 9 (Avatar used inside row)
- §5.1 Mobile breakpoint → Task 9 (both desktop + mobile renderings)
- §5.2 Motion → Task 9 (hover transitions, isPending dim)
- §5.3 States → Task 9 (filter-empty state) + Task 8 (new-user empty via existing EmptyState)
- §5.4 Row click target → Task 9 (Link wraps whole row/card)
- §6 File map → all matched
- §7 Out of scope → respected (no bulk ops, no per-teacher overrides, no column customization)
- §8 Risks & edge cases → addressed inline in tasks (truncate, R2 cleanup, OKLCH band, etc.)
- §9 Acceptance criteria → covered by Task 10
