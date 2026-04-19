# Lane J — Certificate of Completion Plan

Phase 3 feature: when a student finishes a cohort, the platform issues a Skool Rooms-branded PDF certificate. Reuses Lane H's `@react-pdf/renderer` install + the `app/api/teacher/progress-report/[enrollmentId]/route.ts` pattern.

---

## Current state (audit)

### Enrollment lifecycle
- `enrollments.status` is `text NOT NULL DEFAULT 'pending'` (`001_initial_schema.sql:175`). **No CHECK constraint** — application-level enum only.
- `types/domain.ts:148` enum: `EnrollmentStatus = { PENDING, ACTIVE, REJECTED, WITHDRAWN, REVOKED }`. **No `'completed'` value exists today** — must be added.
- `archiveCohortAction` (`lib/actions/cohorts.ts:482-535`) archives a cohort and:
  - Sets cohort `status='archived'`
  - Bulk-rejects enrollments with `status='pending'`
  - Expires waitlist entries
  - **Does NOT touch enrollments with `status='active'`** — they stay active forever after archive.
- Therefore there is no existing trigger that promotes active → completed; we add this transition explicitly.

### React-PDF infrastructure (Lane H — already shipped)
- `@react-pdf/renderer` is in `package.json` (Lane H install).
- Reference render route: `app/api/teacher/progress-report/[enrollmentId]/route.ts:1-206` — pattern: cookie-auth via `createClient()` + `getTeacherByAuthId`, switch to `createAdminClient()` for the data fetches, build typed React element via `createElement(...)`, call `renderToBuffer`, return `NextResponse` with `Content-Type: application/pdf` + `Content-Disposition`.
- Reference document component: `components/teacher/ProgressReportDocument.tsx:1-143` — `Document` + `Page` (size="A4"), `StyleSheet.create()`, fonts `Helvetica` / `Helvetica-Bold` (built-in, no font registration).
- Filename sanitisation pattern: `name.replace(/[^a-zA-Z0-9]/g, '-')`.

### Teachers table — signature column
- `teachers` table (`001_initial_schema.sql:61-88`) has `profile_photo_url text` but **no `signature_image_url` column**. v1 will not include teacher signature; we render a printed teacher name with a stylised script-font wordmark instead. (See Non-goals.)

### Student dashboard surface
- `app/(student)/student/page.tsx` already imports `getArchivedEnrollmentsWithoutFeedback` (Lane C feedback prompt pattern) — proves the dashboard is the right place to surface a "new certificate" CTA. We will add `getCompletedEnrollmentsWithCertificate(studentId)` in `lib/db/enrollments.ts` and render a similar dismissible/inline card.

### Teacher cohort students surface
- `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/students/StudentRowActions.tsx` already wires per-row actions (revoke, refund, view payments, progress dialog, progress-report PDF download). Per-student "Issue / Revoke certificate" buttons slot in here.
- Bulk action area on the students page does not exist yet (revoke/refund are per-row only). A new "Issue certificates" bulk-action button will be added at the page header.

### EmailType
- `EmailType` enum (`types/domain.ts:8-80`) — no `'certificate_issued'` entry. We add one.

### Migration numbering
- Last migration: `015_student_last_login.sql`. Lane J owns **`016_certificates.sql`**.

---

## Gaps vs Phase 3 brief

| Gap | Status |
|-----|--------|
| `enrollments.status='completed'` value + transition action | Missing (enum + action) |
| `certificates` table + RLS + indexes | Missing — created in 016 |
| EnrollmentStatus enum entry `COMPLETED='completed'` | Missing |
| `lib/db/certificates.ts` query layer | Missing |
| `lib/actions/certificates.ts` (issue, revoke, bulk-issue) | Missing |
| `lib/actions/enrollment-management.ts` add `markCompleteAction` | Missing |
| `GET /api/student/certificate/[enrollmentId]` PDF route | Missing |
| `components/teacher/CertificateDocument.tsx` PDF component (landscape) | Missing |
| Teacher UI: per-row issue/revoke + bulk-issue button | Missing |
| Student UI: download button on enrollment row + dashboard CTA | Missing |
| `EmailType.CERTIFICATE_ISSUED` + email template | Missing |
| Public verification route `/verify/[certificateNumber]` | Out of scope v1 (deferred) |

---

## Migration 016 — `supabase/migrations/016_certificates.sql`

```sql
-- ============================================================================
-- 016_certificates.sql — Certificate of completion (Phase 3 Lane J)
--
-- Adds:
--   - certificates table (issuance audit + future verification anchor)
--   - 'completed' enrollment status documented (no CHECK constraint exists,
--     so no DB change needed — application enforces the enum)
-- ============================================================================

CREATE TABLE IF NOT EXISTS certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id),
  certificate_number text NOT NULL,             -- canonical public ID, e.g. SR-2026-AB12CD34
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by_teacher_id uuid REFERENCES teachers(id),  -- nullable: teacher row may be deleted later
  revoked_at timestamptz,                       -- null = valid; non-null = revoked
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One active certificate per enrollment. We allow multiple historical rows only
-- if a revoked certificate is re-issued, but for v1 we restrict to ONE row per
-- enrollment via UNIQUE — re-issuance is "clear revoked_at", not "insert new".
CREATE UNIQUE INDEX idx_certificates_enrollment_id
  ON certificates(enrollment_id);

-- Certificate number must be globally unique (used in verification URL later)
CREATE UNIQUE INDEX idx_certificates_certificate_number
  ON certificates(certificate_number);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- Teacher reads + manages certificates for their own cohorts' enrollments
CREATE POLICY "teachers_manage_own_cohort_certificates"
  ON certificates FOR ALL
  USING (
    enrollment_id IN (
      SELECT e.id FROM enrollments e
      JOIN cohorts c ON c.id = e.cohort_id
      WHERE c.teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid())
    )
  );

-- Student reads own certificates (download path)
CREATE POLICY "students_read_own_certificates"
  ON certificates FOR SELECT
  USING (
    enrollment_id IN (
      SELECT e.id FROM enrollments e
      WHERE e.student_id = (SELECT id FROM students WHERE supabase_auth_id = auth.uid())
    )
  );

-- Note: INSERT / UPDATE / DELETE always go through Server Actions using
-- supabaseAdmin (service role bypass). Student/teacher policies above are
-- read-paths only; server-side writes don't depend on them.
```

**Design notes:**
- **No DB-level CHECK on `enrollments.status`.** The current schema uses raw `text` (verified `001_initial_schema.sql:175`). Adding `'completed'` is purely an application enum change — no migration touches that column. We document the new status in the migration header for future archaeology.
- **`certificate_number` format:** `SR-YYYY-XXXXXXXX` where `YYYY` is the year of issuance (PKT) and `XXXXXXXX` is 8 chars from a safe alphanumeric set (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ` — no 0/O/1/I/L). Generated in the action layer via `crypto.randomBytes` + base32-style mapping. UNIQUE INDEX collision → retry up to 5 times.
- **`issued_by_teacher_id` is nullable** so that teacher-row deletion (rare; admin operation) does not orphan / void certificates. The cert remains valid; the issuer is just unknown.
- **One row per enrollment** simplifies the model. Revoke = `UPDATE revoked_at = now()`; re-issue = `UPDATE revoked_at = null, revoke_reason = null, issued_at = now()`. We do not keep an audit history of revoke/re-issue cycles in v1 (deferred — `notifications_log` would capture the email events).

---

## Implementation plan (ordered steps)

### Step 1: EnrollmentStatus enum + transition

**Files touched:**
- `types/domain.ts` (anchor-specific Edit at the `EnrollmentStatus` const, add `COMPLETED: 'completed'`).
- `lib/actions/enrollment-management.ts` — add `markCompleteAction`.

#### 1a — Add enum value
```ts
export const EnrollmentStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',   // NEW
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
  REVOKED: 'revoked',
} as const
```

Use anchor-specific Edit (match the full const block) so this does not clobber any other lane's edit.

#### 1b — `markCompleteAction(enrollmentId)`

Server Action in `lib/actions/enrollment-management.ts`:
1. `getAuthenticatedTeacher()` — return error if null.
2. `checkPlanLock(teacher)` — return error if locked.
3. Fetch enrollment + cohort. Ownership check: cohort.teacher_id === teacher.id.
4. Guard: enrollment.status MUST be `'active'` (cannot complete pending/revoked/withdrawn).
5. (Soft) recommend cohort be archived first, but do **not** require it — a teacher may want to mark students complete progressively in long-running cohorts. Instead, surface a UX hint in the UI.
6. Update `enrollments` SET `status='completed'`, `updated_at=now()`.
7. Return `{ success: true, data: null }`. Do NOT auto-issue the certificate here — issuance is a separate explicit action (see decision below).

**Why split mark-complete from issue-certificate:** the brief lists three issuance options. We pick **manual teacher issuance** as the default (see decision rationale in Step 4). Mark-complete is a precondition; issuance is the act. Keeping them separate also lets a teacher re-grade a student (mark them complete) without forcing immediate certificate generation, and lets bulk-issue work over a list of already-completed enrollments.

---

### Step 2: Certificates db layer — `lib/db/certificates.ts`

**Files to CREATE:** `lib/db/certificates.ts`.

Functions:
- `getCertificateByEnrollmentId(enrollmentId): Promise<CertificateRow | null>` — used by both the student download route (auth: student owns enrollment) and teacher UI to show issued state.
- `getCertificateByNumber(certificateNumber): Promise<CertificateRow | null>` — used by future public verification route. Build now, no caller in v1.
- `createCertificate(input: { enrollmentId, certificateNumber, issuedByTeacherId }): Promise<CertificateRow>` — INSERT. UNIQUE collisions on `certificate_number` bubble to caller.
- `updateCertificateRevoked(id, revokeReason | null, revokedAt: Date | null): Promise<CertificateRow | null>` — used for both revoke (`revokedAt = now()`) and re-issue (`revokedAt = null`).
- `getCertificatesByEnrollmentIds(enrollmentIds: string[]): Promise<Map<string, CertificateRow>>` — bulk lookup for the cohort students page (avoid N+1).

All functions use `createAdminClient()` (write paths) or the SSR client (read paths called from a Server Component where RLS already filters). Pattern matches `lib/db/feedback.ts` and `lib/db/discount-codes.ts`.

**Type:** add `CertificateRow` to `types/database.ts` after running `npx supabase gen types typescript` post-migration. Until then, hand-write a minimal interface in `lib/db/certificates.ts`:
```ts
export interface CertificateRow {
  id: string
  enrollment_id: string
  certificate_number: string
  issued_at: string
  issued_by_teacher_id: string | null
  revoked_at: string | null
  revoke_reason: string | null
  created_at: string
}
```

---

### Step 3: Certificate-number generator

**Helper:** `lib/certificates/generateNumber.ts` (new tiny utility module — or inline in `lib/actions/certificates.ts` if preferred; lean toward a separate file because it's pure + testable).

```ts
const SAFE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'  // 32 chars, no 0/O/1/I/L

export function generateCertificateNumber(now: Date = new Date()): string {
  const year = now.getUTCFullYear()  // YYYY in UTC; certs are global, year is just a prefix
  const bytes = crypto.randomBytes(8)
  let suffix = ''
  for (const b of bytes) suffix += SAFE_CHARS[b % SAFE_CHARS.length]
  return `SR-${year}-${suffix}`
}
```

`crypto` is Node `node:crypto` — server only. With 32^8 ≈ 1.1 trillion suffixes per year, collision probability is vanishingly small; we still retry up to 5x in the action layer on UNIQUE constraint violation.

---

### Step 4: Server Actions — `lib/actions/certificates.ts`

**Files to CREATE:** `lib/actions/certificates.ts`.

#### Issuance trigger — DECISION

The brief offers three options:
1. Auto on `enrollment.status → 'completed'`.
2. Manual teacher issue (teacher clicks "Issue certificate").
3. Student self-download (any student with `enrollment.status='completed'`).

**Recommendation: option 2 — manual teacher issuance.** Reasoning:
- **Quality control.** Teachers should consciously decide a student earned the certificate. Auto-issue ties cert quality to whether the teacher remembered to mark someone "complete" rather than to teacher judgement.
- **Reversibility.** A teacher who issues incorrectly can revoke. Auto-issue + revoke creates a worse audit trail than "never issued" because the student already got the email + downloaded the PDF.
- **Bulk path covers laziness.** Teachers who don't care about per-student review can use bulk-issue from the cohort students page (Step 7) — a single click that issues for all `status='completed'` enrollments lacking a cert. So manual is not friction for the indifferent, but is preserved for the careful.
- **Student self-serve once issued.** After a cert exists, the student downloads on their own from the enrollment detail page (Step 6); the teacher does not gate downloads.

Option 3 (student self-download without teacher action) is the worst: it lets every "completed" enrollment auto-mint certs, which collapses the cert's signal value. Option 1 is acceptable but loses the bulk-issue distinction; we keep it as a future toggle (`teachers.auto_issue_certificates bool`) — out of scope v1.

#### Actions

```ts
issueCertificateAction(enrollmentId: string): Promise<ApiResponse<{ certificateId: string; certificateNumber: string }>>
```
1. `getAuthenticatedTeacher()`; ownership check on enrollment.cohort.teacher_id.
2. `checkPlanLock(teacher)`.
3. Guard: enrollment.status === `'completed'`. If `'active'`, return `{ success: false, error: 'Mark the student complete first.', code: 'NOT_COMPLETED' }`.
4. Check existing cert via `getCertificateByEnrollmentId`. If exists and **not revoked** → return `{ success: false, error: 'Certificate already issued.', code: 'ALREADY_ISSUED' }`. If exists and **revoked** → call `updateCertificateRevoked(cert.id, null, null)` and update `issued_at = now()`, then proceed to email/return.
5. If no cert: generate number with retry-on-UNIQUE (up to 5 attempts). Call `createCertificate(...)` with `issuedByTeacherId = teacher.id`.
6. Send `certificate_issued` email to student via `sendEmail()` (Step 9).
7. Return `{ certificateId, certificateNumber }`.

```ts
revokeCertificateAction(certificateId: string, reason: string): Promise<ApiResponse<null>>
```
1. Auth + ownership (cert → enrollment → cohort.teacher_id).
2. Guard: cert is currently not revoked.
3. `updateCertificateRevoked(id, reason, now())`.
4. **No email** on revoke (could be embarrassing for the student to receive a "your cert was revoked" notice; if a teacher needs that, it's a manual conversation). Document in an inline code comment on the action.
5. Return success.

```ts
bulkIssueCertificatesAction(cohortId: string): Promise<ApiResponse<{ issued: number; skipped: number; failed: number }>>
```
1. Auth + ownership on cohort.
2. Fetch all enrollments in cohort with `status='completed'` (use a new `getCompletedEnrollmentsByCohort` helper in `lib/db/enrollments.ts`).
3. Bulk lookup existing certs via `getCertificatesByEnrollmentIds`.
4. For each completed enrollment without an active cert:
   - Generate number, INSERT, send email.
   - On exception (UNIQUE retry exhausted, RLS error), `failed++` and continue.
5. Return counts. Show a toast like "Issued 12, skipped 3 (already had cert), 0 failed."

**Why no `markAndIssueAction` combo:** the UI shows two distinct buttons; combining them hides intent. Two clicks for the careful teacher; bulk button for the others.

---

### Step 5: PDF route — `GET /api/student/certificate/[enrollmentId]`

**Files to CREATE:** `app/api/student/certificate/[enrollmentId]/route.ts`.

**Auth model:** dual-mode — student OR owning teacher may download.
- `createClient()` (SSR) → `auth.getUser()`.
- Try `getStudentByAuthId(user.id)`; if found and student owns the enrollment → allow.
- Else try `getTeacherByAuthId(user.id)`; if found and teacher owns the enrollment's cohort → allow.
- Else 401/403.

This dual mode lets the teacher preview a certificate from the cohort students page without needing a separate teacher-only route. Mirrors the progress-report route's pattern but extended.

**Steps:**
1. Resolve auth (above).
2. Fetch enrollment + cohort + course + student via `createAdminClient()` join (same shape as progress-report route lines 36-67).
3. Fetch teacher row via `getTeacherById(cohort.teacher_id)` for the teacher name on the cert.
4. Fetch certificate via `getCertificateByEnrollmentId`. **404 if not found** (we never generate-on-the-fly; cert must exist as a DB row first — this is what makes (b) the persistence model and not (a)).
5. **403 if `revoked_at` is non-null.** Return JSON `{ error: 'Certificate has been revoked.' }`.
6. Build PDF element via `createElement(CertificateDocument, props)`; `renderToBuffer`.
7. Return `NextResponse(buffer, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="..."' } })`. Use `inline` (not `attachment`) so browsers preview before save — same UX as the progress report.

**Filename:** `certificate-${safeStudentName}-${safeCohortName}.pdf`.

**Cache headers:** `Cache-Control: private, max-age=300` (5 min) — certificate content is stable but we still want to pick up a re-issue (revoked → re-issued) within minutes. Do NOT cache publicly.

---

### Step 6: PDF component — `components/teacher/CertificateDocument.tsx`

(Lives in `components/teacher/` to mirror `ProgressReportDocument.tsx` location convention — both are server-rendered PDF components, neither is teacher-specific in a UI sense, but we keep the folder consistent.)

**Layout: A4 landscape.**

```tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 60, fontFamily: 'Helvetica', backgroundColor: '#fefefe' },
  // Decorative outer border
  outerBorder: { position: 'absolute', top: 30, left: 30, right: 30, bottom: 30,
                 borderWidth: 2, borderColor: '#1a1a1a' },
  innerBorder: { position: 'absolute', top: 38, left: 38, right: 38, bottom: 38,
                 borderWidth: 1, borderColor: '#888' },
  // Brand
  brand: { textAlign: 'center', marginTop: 20, marginBottom: 12 },
  platformName: { fontSize: 14, fontFamily: 'Helvetica-Bold', letterSpacing: 4 },
  // Title
  certTitle: { textAlign: 'center', fontSize: 36, fontFamily: 'Helvetica-Bold',
               marginTop: 16, marginBottom: 4 },
  certSubtitle: { textAlign: 'center', fontSize: 12, color: '#555',
                  letterSpacing: 2, marginBottom: 36 },
  // Body
  awardedTo: { textAlign: 'center', fontSize: 11, color: '#555', marginBottom: 8 },
  studentName: { textAlign: 'center', fontSize: 32, fontFamily: 'Helvetica-Bold',
                 marginBottom: 28, borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
                 paddingBottom: 12 },
  bodyLine: { textAlign: 'center', fontSize: 12, color: '#333',
              lineHeight: 1.6, marginBottom: 4 },
  courseTitle: { fontFamily: 'Helvetica-Bold' },
  // Footer
  footerRow: { flexDirection: 'row', marginTop: 40, paddingHorizontal: 40,
               justifyContent: 'space-between' },
  footerCol: { flex: 1, alignItems: 'center' },
  footerLabel: { fontSize: 9, color: '#666', marginTop: 4, letterSpacing: 1 },
  footerValue: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  certNumber: { position: 'absolute', bottom: 50, right: 60, fontSize: 8, color: '#888' },
})
```

**Content order (top → bottom):**
1. Decorative borders (outer + inner).
2. Brand: `SKOOL ROOMS` (letter-spaced bold caps).
3. Title: `CERTIFICATE OF COMPLETION`.
4. Subtitle: `THIS IS TO CERTIFY THAT`.
5. Student name (large, underlined).
6. Body lines:
   - `has successfully completed the course`
   - `**{courseTitle}**` (bold)
   - `as part of the cohort "{cohortName}"`
   - `held from {startDatePKT} to {endDatePKT}`
7. Footer row, two columns:
   - Left: `{teacherName}` over label `TEACHER`.
   - Right: `{issuedDatePKT}` over label `ISSUED ON`.
8. Certificate number bottom-right corner: `{certificateNumber}`.

**Props interface:**
```ts
type Props = {
  studentName: string
  cohortName: string
  courseName: string
  teacherName: string
  startDate: string       // already formatted PKT
  endDate: string         // already formatted PKT
  issuedDate: string      // already formatted PKT
  certificateNumber: string
}
```

**Page setup:** `<Page size="A4" orientation="landscape" style={styles.page}>` — `orientation="landscape"` is a `@react-pdf/renderer` standard prop on `Page`.

**Fonts:** built-in `Helvetica` / `Helvetica-Bold`. **No external font registration in v1** — bundling Inter via `Font.register({ family: 'Inter', src: ... })` adds binary deps and font-file management; defer until brand polish phase. The non-goals confirm: "font embedding (Inter or fallback)" is explicitly noted; we choose fallback.

**No teacher signature image v1.** `teachers.signature_image_url` does not exist; printing the teacher name in bold under a `TEACHER` label is sufficient. Phase 4 can add an optional signature column + render an image above the name with no layout change.

---

### Step 7: Teacher UI

#### 7a — Per-row actions in `StudentRowActions.tsx`

**File touched:** `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/students/StudentRowActions.tsx`.

For each enrollment, add new menu items (use existing dropdown pattern):
- **`Mark complete`** — visible only if `enrollment.status === 'active'`. Calls `markCompleteAction(enrollmentId)`. Toast on success.
- **`Issue certificate`** — visible if `enrollment.status === 'completed'` AND no active cert. Calls `issueCertificateAction(enrollmentId)`. Toast with `certificateNumber`.
- **`Download certificate`** — visible if active cert exists. Opens `/api/student/certificate/${enrollmentId}` in new tab (anchor with `target="_blank"`).
- **`Revoke certificate`** — visible if active cert exists. Opens an inline confirm dialog asking for `reason` (textarea, optional). Calls `revokeCertificateAction(certificateId, reason)`.

To know cert state per row, the page-level fetch (Step 7b) builds `Map<enrollmentId, CertificateRow>` and passes it to each `<StudentRowActions>` as a new prop `certificate?: CertificateRow | null`.

#### 7b — Page-level fetch + bulk button

**File touched:** `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/students/page.tsx`.

After fetching enrollments:
```ts
const enrollmentIds = enrollments.map((e) => e.id)
const certByEnrollment = await getCertificatesByEnrollmentIds(enrollmentIds)
```
Pass `certByEnrollment.get(e.id) ?? null` to each row.

In the page header (next to the existing bulk actions area, if any — otherwise as a new toolbar row), add:
- **`Issue certificates`** button (Lucide `Award` icon). Disabled if no enrollments have `status='completed'` and no cert. Wraps `bulkIssueCertificatesAction(cohortId)` in a confirm dialog ("Issue certificates for N completed students?"). On submit, show progress toast then result toast.
- Adjacent badge: "X completed / Y issued" so teacher can see at a glance.

#### 7c — Cohort detail header CTA

**File touched:** `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/page.tsx`.

When `cohort.status === 'archived'` AND any enrollments are still `status='active'`, show a soft banner: "You have N active students in this archived cohort. Mark them complete to issue certificates." Links to the students page. Pure UX nudge — no enforcement.

#### 7d — Bulk-mark-complete (optional, recommended)

To pair with bulk-issue, add a `bulkMarkCompleteAction(cohortId)` that flips all `status='active'` enrollments in a cohort to `'completed'`. Useful when the teacher archives a cohort and wants every active student promoted in one click. Surface as a second button in the cohort header banner from 7c: "Mark all active students complete".

Guard against accidental click with a confirm dialog ("This will mark N students as completed. They will then be eligible for certificates."). Idempotent.

---

### Step 8: Student UI

#### 8a — Enrollment detail row — download button

**File touched:** `app/(student)/student/payments/page.tsx` (the existing student enrollment detail surface — confirmed by audit).

For each enrollment row where `enrollment.status === 'completed'` AND a cert exists, render a `Download certificate` button (Lucide `Award` + `Download` icon). Plain anchor `<a href="/api/student/certificate/${enrollmentId}" target="_blank">` — no JS state needed; the GET route handles auth and serves the inline PDF.

If `status='completed'` but no cert exists yet, render muted text "Certificate not yet issued by your teacher." (no button). This sets expectation without confusion.

To know cert state, extend the existing student enrollment fetch (`getEnrollmentsByStudentWithTeacher` or sibling) with `getCertificatesByEnrollmentIds`, mirroring the teacher pattern.

#### 8b — Dashboard CTA card

**File touched:** `app/(student)/student/page.tsx`.

Add a new tile/card: "New certificate available" if the student has any enrollment with `status='completed'` AND an active cert AND the student has not opened the cert PDF yet (no easy "opened" tracking — simplest: show the card for any cert issued in the last 30 days, dismissible via cookie `dismissed_cert_${certId}` like the feedback prompt pattern).

New helper: `getRecentlyIssuedCertificates(studentId, sinceDays = 30)` in `lib/db/certificates.ts` joining `certificates` ⨝ `enrollments` filtered to this student.

Card content: "Your certificate for **{cohortName}** is ready." — primary button "Download" → `/api/student/certificate/${enrollmentId}`. Secondary: "Dismiss" (sets cookie).

---

### Step 9: Email — `certificate_issued`

**Files touched:**
- `types/domain.ts` (anchor-specific Edit at the `EmailType` const) — add:
  ```ts
  CERTIFICATE_ISSUED: 'certificate_issued',
  ```
- `lib/email/sender.ts` — add a new `case 'certificate_issued':` branch.

**Template:**
- Subject: `Your certificate for {cohortName} is ready`
- Body (text + HTML):
  - "Hi {studentName}, your teacher {teacherName} has issued your certificate of completion for **{courseName}** ({cohortName})."
  - Big button: `Download certificate` → links to `students.skoolrooms.com/student/payments` (the enrollment list — student logs in, finds the row, clicks Download). Do NOT link directly to `/api/student/certificate/...` — that requires an active session and a cold link from email won't work without a redirect-to-login wrapper. Wrap the deep link in a redirect helper if you want one-click; v1 keeps it simple by sending users to their dashboard.
- Footer: certificate number for reference.

Data shape: `{ studentName, teacherName, courseName, cohortName, certificateNumber }`. No platform-cut math; this is a pure notification.

Do NOT email on revoke (rationale in Step 4).

---

### Step 10: Routes constant

**File touched:** `constants/routes.ts`.

Add:
```ts
ROUTES.STUDENT.certificateDownload = (enrollmentId) =>
  `/api/student/certificate/${enrollmentId}`
```
Use this in components instead of hand-built strings.

---

## Edge cases

| Edge case | Behavior |
|-----------|----------|
| Enrollment revoked AFTER cert issued | Auto-revoke the cert. `revokeEnrollmentAction` (already in `lib/actions/enrollment-management.ts`) gets a small additive edit: after the status update, look up cert and call internal helper to set `revoked_at = now()`, `revoke_reason = 'Enrollment revoked'`. Do not delete the cert row (preserves audit). |
| Student withdraws AFTER cert issued | Same as revoked — auto-revoke cert. |
| Teacher deleted (admin operation) | Cert row keeps `issued_by_teacher_id` as the orphan FK (or `NULL` if deletion cascades — currently teachers have no `ON DELETE`-cascading children for this column; the FK is `REFERENCES teachers(id)` with no clause, so the delete would fail. Recommend declaring `ON DELETE SET NULL` in 016 — already in the migration above). Cert remains valid; teacher name on the PDF would be missing. **Mitigation:** at PDF render time, fall back to `cohort.teacher.name` if available, else "Skool Rooms" as the issuer. |
| Cohort archived without completing students | No certs issued. Active students stay `'active'` until teacher acts. No silent issuance. |
| Cohort archived AND students completed AND certs issued, then cohort is restored (not supported) | Out of scope — archived cohorts are permanently read-only per CLAUDE.md rule 21. Skip. |
| Re-issue after revoke | `issueCertificateAction` detects revoked cert and clears `revoked_at`, updates `issued_at = now()`. Same `certificate_number` is preserved (intentional — verification URL stays stable). |
| Bulk-issue called twice quickly | Idempotent: second call skips already-issued enrollments. Toast: "Issued 0, skipped N." |
| Student tries to download before issuance | 404 from the GET route. Student UI hides the button entirely; the 404 is the defence-in-depth. |
| Wrong student tries to download | 403 from the dual-auth check. RLS additionally blocks the SELECT. |
| `certificate_number` collision (1 in 1.1T) | Retry up to 5 times. Beyond 5, return `{ success: false, error: 'Could not generate certificate number, please retry.' }` and log the surprise to console. |
| Teacher on Free plan tries to issue | `checkPlanLock` blocks. Free plan keeps the feature; only locked accounts (e.g., suspended, payment overdue past grace) cannot issue. **Plan-tier gating decision:** certificate issuance is NOT gated to a paid plan in v1 — every plan can issue. (If product later wants this gated, add a `FeatureKey.CERTIFICATES` and a `canUseFeature` check at the top of both issue actions. Out of scope v1.) |
| Enrollment `status='completed'` set, then teacher reverts to `'active'` (not in current actions) | Not exposed; if an admin manually does it, an existing cert remains valid. No automatic action. |

---

## Non-goals (explicitly deferred)

- **Public verification route `/verify/[certificateNumber]`** — schema supports it (UNIQUE cert number), but no UI. Defer to Phase 4. When built, it's a Server Component reading `getCertificateByNumber` and rendering "Valid / Revoked" with cohort + student name (no email). Anonymous access; no RLS issue because this would use service role.
- **QR code on the PDF** — pairs with the verification route; defer together.
- **LinkedIn share button / share-image generator** — defer.
- **Custom per-teacher branding (logo/colors)** — global Skool Rooms branding only in v1.
- **Teacher signature image** — no DB column today; defer.
- **Auto-issue on `status → completed` transition** — keep manual; revisit if teacher feedback shows friction.
- **Certificate template versioning** — option (a) regenerate-on-demand carries the risk that template changes alter old certificates. Persistence model (b) sidesteps this by storing the canonical record (cert number, issuance date) and rendering on demand. If we ever change the template significantly, old certs visually update too — but their canonical identity (number, date) is stable. If template stability is later required, add `template_version int` to the certificates row + select renderer by version. Out of scope v1.
- **Email on cert revoke** — intentional UX choice; do not add.
- **Bulk revoke** — no UI surface; per-row only.

---

## Full file/touch list

### Files to CREATE
| Path | Purpose |
|------|---------|
| `supabase/migrations/016_certificates.sql` | Schema + RLS for `certificates` table |
| `lib/db/certificates.ts` | Query layer (5 functions) |
| `lib/certificates/generateNumber.ts` | Cert number generator (pure utility) |
| `lib/actions/certificates.ts` | `issueCertificateAction`, `revokeCertificateAction`, `bulkIssueCertificatesAction` |
| `app/api/student/certificate/[enrollmentId]/route.ts` | PDF GET route (dual-auth: student or teacher) |
| `components/teacher/CertificateDocument.tsx` | `@react-pdf/renderer` document (A4 landscape) |

### Files to EDIT
| Path | Edit type | Change |
|------|-----------|--------|
| `types/domain.ts` | anchor-specific Edit at `EnrollmentStatus` | Add `COMPLETED: 'completed'` |
| `types/domain.ts` | anchor-specific Edit at `EmailType` | Add `CERTIFICATE_ISSUED: 'certificate_issued'` |
| `lib/email/sender.ts` | additive | Add `case 'certificate_issued':` branch |
| `lib/actions/enrollment-management.ts` | additive | Add `markCompleteAction`, `bulkMarkCompleteAction`; extend `revokeEnrollmentAction` to auto-revoke cert |
| `lib/db/enrollments.ts` | additive | Add `getCompletedEnrollmentsByCohort(cohortId)` |
| `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/students/page.tsx` | additive | Fetch certs map; pass to row components; add bulk-issue toolbar |
| `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/students/StudentRowActions.tsx` | additive | Add 4 menu items (mark complete, issue, download, revoke) |
| `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/page.tsx` | additive | Banner CTA when archived + active students remain |
| `app/(student)/student/payments/page.tsx` | additive | Add per-enrollment "Download certificate" button |
| `app/(student)/student/page.tsx` | additive | Dashboard "New certificate available" card |
| `constants/routes.ts` | additive | Add `STUDENT.certificateDownload(enrollmentId)` route helper |

### Files NOT touched (verify before implementer starts)
- `BUILD_PLAN.md` — out of scope per brief.
- `ARCHITECTURE.md` — out of scope per brief.
- Any payment/payout/balance code — certificates have no money implications.

---

## Open questions for team-lead

1. **EnrollmentStatus enum addition `'completed'`:** confirm no other lane in this batch is editing the same const block. (Lanes K and L don't appear to need enrollment status changes per their briefs, but a stale grep is worth doing before merge.)

2. **Auto-revoke cert on enrollment revoke / withdraw:** the plan adds an additive call inside `revokeEnrollmentAction` and the withdrawal-approval action. Confirm this is the desired UX vs. leaving the cert valid after revocation (some platforms keep certs valid because "the work was completed even if the relationship ended"). Default plan: auto-revoke.

3. **Bulk-mark-complete (Step 7d):** included as a teacher convenience. If product would rather force per-student review, drop 7d and 7c's "Mark all active students complete" button. Default: include.

4. **Plan-tier gating:** v1 plan does NOT gate cert issuance to a paid plan — Free teachers can issue. Confirm. If gated, add `FeatureKey.CERTIFICATES` to `constants/features.ts` and `canUseFeature` checks in the issue actions.

5. **Email deep-link target:** plan sends students to `/student/payments` (their enrollment list). Alternative is a redirect-to-login wrapper at `/student/cert-download/[enrollmentId]` that, after auth, 302s to the API route. Cleaner UX but more code. Default: dashboard link in v1.

6. **`teachers.id` ON DELETE behavior:** the migration declares `issued_by_teacher_id REFERENCES teachers(id)` without an ON DELETE clause. If admin teacher-deletion is a real workflow, declare `ON DELETE SET NULL` to avoid blocking the delete. Default: include `ON DELETE SET NULL`.

7. **Reuse vs. fork the PDF route auth pattern:** `app/api/teacher/progress-report/[enrollmentId]/route.ts` uses cookie-auth via `createClient` directly rather than `requireTeacher()` (which redirects). The cert route uses the same direct pattern (returning 401/403 JSON). Confirm preference — alternatively, build a small `requireTeacherOrJson()` / `requireStudentOrJson()` helper. Out of scope v1; just a refactor to track later.
