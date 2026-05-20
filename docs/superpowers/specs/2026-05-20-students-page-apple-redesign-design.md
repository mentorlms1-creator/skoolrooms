# Students Page — Apple-Designed-By-Apple Redesign

**Date:** 2026-05-20
**Status:** Design — pending implementation
**Scope:** `/dashboard/students` page redesign + student avatar feature

---

## 1. Overview

Redesign the teacher's `/dashboard/students` page in the visual language of Apple's iCloud Web (Mail / Music / Contacts era). Calm, generous, content-first. Most of the page is layout and visual hierarchy work, but one piece — student profile avatars — adds new database, upload, and display infrastructure across two pages.

**Voice anchor:** iCloud Web. Calm whitespace, big numbers up top, soft cards beneath, hairline separators, restrained use of color, system typography. Not Finder (too dense), not iWork (too editorial), not iOS Settings (too list-y).

**Why this matters:** the teacher dashboard is where Pakistani tutors will spend the most time. The current students page is functional but generic. Apple-grade polish on this page sets a credibility bar for the rest of the app and gives us a pattern to roll out elsewhere if the bet pays off.

## 2. Design decisions (locked)

| Decision | Choice | Why |
|----------|--------|-----|
| Voice | iCloud Web | Calm, professional, content-first |
| List rendering | Music-style table → cards on mobile | Scannable at 200 rows; adapts cleanly to phones |
| Page top | KPI hero card with stats, filters below | Most "dashboard-y" — celebratory numbers |
| Stats deltas | Keep all three (`+N this month`, `N% of total`, `Oldest N days`) | Gives the numbers context, not just decoration |
| Avatars | Photo if uploaded, colored initials otherwise | Identity + visual variety; future-proof |
| Scope | This page only; touch shared primitives only if architecturally required | Avoid scope creep; preserve `components/ui` discipline |

## 3. Visual & layout spec

### 3.1 Typography

| Element | Size (desktop / mobile) | Weight | Tracking |
|---------|-------------------------|--------|----------|
| Page title | 28px / 22px | 700 | `-0.025em` |
| Page subtitle | 13px / 12px | 400 (muted) | normal |
| KPI number | 34px / 22px | 600 | `-0.03em` |
| KPI label | 11px | 500 (muted, uppercase) | `0.06em` |
| KPI delta | 11px | 400 (muted) | normal |
| Table column header | 11px | 600 (muted, uppercase) | `0.06em` |
| Row name | 13px | 600 | `-0.005em` |
| Row meta (email/phone) | 11px | 400 (muted) | normal |

Fonts: system stack (`-apple-system, "SF Pro Text", system-ui, sans-serif`) — no custom font load. Renders as SF on Apple devices, Segoe UI on Windows, Roboto on Android.

### 3.2 Color tokens (all from `globals.css`)

- Surfaces: `bg-card` (white in light, near-black in dark)
- Page background: `bg-background`
- Hairlines / borders: `border-border/40` (subtle separator) or `border-border` (default)
- Text: `text-foreground`, `text-muted-foreground`
- Semantic accents: `text-success` (Active KPI), `text-warning` (Pending KPI), `text-foreground` (Total KPI)
- Hover tint: `bg-muted/40`
- **Zero raw hex anywhere.** Every color comes from `globals.css` OKLCH vars.

### 3.3 Page structure, top to bottom

```
PageHeader (title + subtitle)        [existing component, unchanged]
KPI hero card                         [new — composed inline in page.tsx]
  ├ Total          ──┐
  ├ Active            │ divided by vertical hairlines
  └ Pending        ──┘
Toolbar                               [existing — minor polish only]
  ├ Spotlight search input
  └ Segmented status control
Student list                          [restructured in StudentTable.tsx]
  desktop: Music-style table          (4 cols: Student / Course•Cohort / Enrolled / Status)
  mobile:  stacked cards
Pagination                            [restyled — same Newer/Older cursor pattern]
```

### 3.4 KPI hero card

Single `bg-card` panel, `rounded-2xl`, padding `p-6` desktop / `p-4` mobile. Three stats in a CSS grid (`grid-cols-3`), separated by `border-l border-border/40` (omitted on first). Each stat shows:

```
{number}
{LABEL}
{delta line}
```

Delta copy:
- **Total**: `+N this month` (count of enrollments created since start of current PKT month)
- **Active**: `N% of total` (active / total, rounded to nearest integer, never shown if total = 0)
- **Pending**: `Oldest N days` (days the longest-pending enrollment has been waiting; omitted if no pending)

If a delta is unavailable or zero in a way that's awkward (e.g., 0 students at all), the line collapses to empty. Don't show `+0 this month` or `0% of total`.

## 4. Avatar system

The only piece that crosses page boundaries and modifies the database.

### 4.1 Schema migration

**File:** `supabase/migrations/032_students_profile_photo.sql`

```sql
-- Add optional profile photo URL to students.
-- Stored as R2 object URL (same pattern as teachers.profile_photo_url).
ALTER TABLE students ADD COLUMN profile_photo_url text;
```

One column, nullable. **No new RLS policy needed:**
- Student self-update: existing `students_update_own_row` policy already covers updates to any column on the student's own row, including this new one.
- Teacher read access: teachers don't read `students` rows through RLS — `getStudentsByTeacherPage()` in `lib/db/enrollments.ts` uses `createAdminClient()` (service role, bypasses RLS) and joins `students!inner(...)`. The new column will be selected the same way. The teacher's right to see the data is enforced upstream by `requireTeacher()` + the `teacher_id` filter on cohorts; RLS is not the gate.

After applying: `npx supabase gen types typescript` to regenerate `types/database.ts`.

### 4.2 Avatar palette (OKLCH)

**File:** `app/globals.css` — additions under `@theme`:

```css
--avatar-1: oklch(0.62 0.18 25);   /* red */
--avatar-2: oklch(0.65 0.16 50);   /* orange */
--avatar-3: oklch(0.70 0.14 90);   /* yellow */
--avatar-4: oklch(0.62 0.17 145);  /* green */
--avatar-5: oklch(0.62 0.14 195);  /* teal */
--avatar-6: oklch(0.58 0.17 250);  /* blue */
--avatar-7: oklch(0.55 0.20 285);  /* purple */
--avatar-8: oklch(0.62 0.16 340);  /* pink */
--avatar-foreground: oklch(1 0 0); /* white text on colored circles, both themes */
```

OKLCH lightness sits in a band that's legible on both `bg-card` (white) and the dark-mode `bg-card` (near-black). No per-mode override needed.

### 4.3 Helpers

**File:** `lib/utils/avatar.ts` (new, ~20 lines)

```ts
export function avatarColorVar(studentId: string): string {
  let h = 0
  for (let i = 0; i < studentId.length; i++) h = (h * 31 + studentId.charCodeAt(i)) | 0
  return `var(--avatar-${(Math.abs(h) % 8) + 1})`
}

export function avatarInitials(name: string): string {
  return name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?'
}
```

Deterministic — same student always gets the same color across the app. Stable identity.

### 4.4 Shared component

**File:** `components/ui/StudentAvatar.tsx` (new)

```ts
type Props = {
  id: string
  name: string
  photoUrl?: string | null
  size?: 'sm' | 'md' | 'lg'   // 24 / 32 / 56 px
  className?: string
}
```

If `photoUrl` is non-null, renders a Next.js `<Image>` at the requested size, `rounded-full`, `object-cover`. Otherwise renders a `<div>` with `background: avatarColorVar(id)`, white initials styled as `text-[var(--avatar-foreground)] font-semibold` — the semantic token defined in `@theme` (CLAUDE.md rule 14: no Tailwind defaults like `text-white`).

**Sizing in this redesign:** desktop table rows and mobile cards both use `size="md"` (32px). The student-settings preview uses `size="lg"` (56px). `size="sm"` (24px) is reserved for future denser contexts (e.g., compact attendance grids).

Lives in `components/ui/` because students appear on multiple pages (table, detail, payments, attendance) — one component, one source (per CLAUDE.md rule 13).

### 4.5 Upload UI

**Files:** `app/(student)/student/settings/page.tsx` + `app/(student)/student/settings/form.tsx`

Mirrors the existing pattern from `app/(teacher)/onboarding/step-3/form.tsx`:

- `<FileUpload>` component (already exists at `components/ui/FileUpload.tsx`) handles R2 presigned upload via `lib/r2/`
- Component shows a live `<StudentAvatar size="lg">` preview alongside the upload button
- **Server action: extend the existing `updateStudentProfileAction`** in `lib/actions/student-settings.ts` (which today handles name + phone) to also accept a `profile_photo_url` FormData field. Single action persists all three fields on form submit — no separate avatar action.
- **Replace flow**: action reads the existing `profile_photo_url` from the row before updating; if it was non-null and differs from the new value, the old R2 object is deleted (via existing `lib/r2/` delete helper) before persisting the new URL.
- **Clear flow**: empty string in the FormData field = clear photo. Old R2 object deleted on save.

### 4.6 Display flow on the teacher's table

For each row, `<StudentAvatar id={student.id} name={student.name} photoUrl={student.profile_photo_url} size="md" />`. Photo if present, colored initials otherwise. Zero conditional logic in the page — the component handles it.

## 5. Mobile, motion, and states

### 5.1 Mobile breakpoint

Single breakpoint at `sm` (640px).

- **≥640px**: 4-column table
- **<640px**: stacked cards. Each card = avatar (left) + body (right). Body has two lines: top = name + email; bottom (meta line) = course • status pill. **Enrolled date is omitted on mobile** to keep cards calm; teachers can tap into the student detail for the date.
- KPI hero stays 3-column on mobile, compressed: numbers 22px, delta lines drop, hairline separators stay.
- Toolbar collapses to vertical: search full-width, segmented control horizontal-scrolls (scrollbar hidden via inline utilities).

### 5.2 Motion

All transitions 120–200ms, ease.

- Row hover: 120ms background tint to `bg-muted/40`
- Filter segment switch: existing 150ms `transition-all` on the active background
- Filter/search/pagination updates: existing `isPending` opacity dim (0.5, 200ms) on the table region only. KPI hero does **not** dim (counts come from a separate cheap query, doesn't refetch on filter changes)
- Row click → student detail: `next-view-transitions` Link (already in use). iOS-like push transition.

**No skeletons. No spinners. No mount animations on the KPI numbers** (would compete with the page-transition fade).

### 5.3 States

| State | Treatment |
|-------|-----------|
| Empty — new user (no students yet) | Existing `<EmptyState>` component, copy unchanged |
| Empty — filter returns 0 rows | New empty state, calmer copy: `"No students match this filter."` + `"Clear filters"` link that strips `?q=...&status=...` |
| Loading (filter/pagination) | Table region opacity 0.5 for 200ms |
| Error (server action failure) | Existing toast system (`useToast`) |
| RLS denial / not authenticated | Caught by `requireTeacher()` at page level, redirects to login |

### 5.4 Row click target

The entire row (desktop) or card (mobile) is wrapped in a `<Link>` with `block` styling. Hover/active tint covers the whole row, not just the name. This is a deliberate upgrade over today's behavior (only the name link was clickable).

## 6. File map

### New (3)
- `supabase/migrations/032_students_profile_photo.sql`
- `lib/utils/avatar.ts`
- `components/ui/StudentAvatar.tsx`

### Modified — core redesign (3)
- `app/(teacher)/dashboard/students/page.tsx` — replace flat stats row with KPI hero card
- `app/(teacher)/dashboard/students/StudentTable.tsx` — bespoke Music-style table + mobile cards + `<StudentAvatar>` + full-row click + restyled pagination
- `app/globals.css` — add 9 avatar OKLCH vars under `@theme` (8 hues + `--avatar-foreground`)

### Modified — data layer (1)
- `lib/db/enrollments.ts`:
  - `getStudentsByTeacherPage()` selects `students.profile_photo_url`, exposes on returned row type
  - `getStudentStatsByTeacher()` returns extra fields: `newThisMonth: number`, `activePct: number`, `oldestPendingDays: number | null`

### Modified — avatar feature on student portal (3)
- `app/(student)/student/settings/page.tsx` — pass `profilePhotoUrl` to form
- `app/(student)/student/settings/form.tsx` — add `<FileUpload>` + `<StudentAvatar size="lg">` preview section
- `lib/actions/student-settings.ts` — extend existing `updateStudentProfileAction` to also persist `profile_photo_url` and delete the old R2 object on replace/clear

### Regenerated (1)
- `types/database.ts` — auto-generated by `npx supabase gen types typescript`

### NOT touched (explicit)
- `components/ui/StatusBadge.tsx` — current dot + sizing holds up
- `components/ui/DataTable.tsx` — the redesigned table is bespoke; DataTable stays untouched and continues serving every other table in the app
- `components/ui/PageHeader.tsx` — unchanged
- All ~30 other consumers of `StatusBadge` — unaffected
- Auth, RLS, payment flows — unaffected

**Total blast radius:** 11 files touched (3 new + 7 modified + 1 type regen), 1 migration.

## 7. Out of scope

Things the user might expect but are explicitly NOT in this redesign:
- Per-teacher avatar overrides (every teacher sees the same student's avatar)
- Avatar editing for teachers viewing their students (only the student themselves can change their photo)
- Bulk operations on students (multi-select, bulk-message, bulk-status-change)
- Sorting beyond the default `created_at DESC`
- Column customization (showing/hiding columns)
- Export / CSV download
- Search within email and phone (current behavior already covers name+email)
- Re-rolling the StatusBadge or any other shared primitive
- Pattern-rolling to other dashboard pages (deferred to follow-up if this lands well)

## 8. Risks and edge cases

| Risk | Mitigation |
|------|------------|
| Long names truncate ugly in the cell | `truncate` + `min-w-0` on the name column; email line truncates too |
| Student uploads a 10MB photo | `FileUpload` already enforces content-length limits server-side (per `lib/r2/` plumbing); add explicit `max-size: 2MB` for avatars |
| Student replaces avatar repeatedly → R2 orphans | Server action deletes old R2 object before persisting new URL |
| Teacher hot-reloads while student is uploading | Server state is the source of truth; teacher's next page load picks up new URL |
| Teacher's read of `students.profile_photo_url` | Not gated by RLS — `getStudentsByTeacherPage()` uses `createAdminClient()` (service role) and authorizes upstream via `requireTeacher()` + cohort `teacher_id` filter. New column inherits the same path; no policy change needed |
| Stats delta queries slow the page | Each delta is a single cheap `COUNT()` or `MAX()` with existing indexes (`created_at`, `status`); ran in parallel with main query via `Promise.all` |
| Dark mode contrast on colored avatars | OKLCH lightness band 0.55–0.70 stays legible on both `bg-card` modes; no per-mode override needed |
| Pakistani slow connections + new R2 images | `<Image>` with default lazy loading; 30×30 thumbnails are ~3–5KB |
| Student has no name (shouldn't happen — `name NOT NULL`) | `avatarInitials()` returns `?` as fallback |

## 9. Acceptance criteria

The redesign is done when:

1. `/dashboard/students` renders the new layout on both desktop and mobile without horizontal scroll
2. Both light and dark modes look polished — no contrast issues, no raw hex anywhere
3. KPI hero shows correct counts AND correct deltas; deltas collapse gracefully on edge cases (no students, no pending, etc.)
4. Filter and search continue to work, URL params preserved, segmented control reflects current state
5. Each student row shows their photo if uploaded, otherwise a deterministic colored-initial avatar
6. The same student gets the same avatar color across the app (table + future detail page)
7. Student can upload, replace, and clear their profile photo from `/student/settings` — old R2 objects are deleted on replace/clear
8. The whole row (desktop) / card (mobile) is clickable to the student detail page
9. `isPending` opacity dim works on filter / search / pagination
10. Empty-state copy differs between "no students yet" and "filter returns 0"
11. `npm run build` succeeds; `npx tsc --noEmit` is clean
12. Every other page in the app (admin, billing, public join, etc.) renders unchanged — no shared-primitive regressions
