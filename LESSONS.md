# Lessons Learned — Lumscribe LMS

> Log every unexpected issue, wrong assumption, or library gotcha here.
> Check this file BEFORE starting any complex task — the answer might already be here.

---

### 2026-03-30 — Seed data diverged from ARCHITECTURE.md Section 13
**What happened:** Plan limits in 005_seed_data.sql used different values than ARCHITECTURE.md Section 13 (e.g., Free max_courses was 3 instead of 1).
**Root cause:** The seed data was generated from Section 3 (which had aspirational/future values) instead of Section 13 (the authoritative business rules).
**Fix:** Updated seed SQL and corrected live database to match Section 13.
**Rule going forward:** Always use ARCHITECTURE.md Section 13 for plan limits and feature flags. When in doubt, Section 13 is the source of truth for business rules.

### 2026-03-30 — createAdminClient should not use cookies
**What happened:** The service-role Supabase client was reading cookies, creating unnecessary coupling with user sessions.
**Root cause:** Copy-paste from the user-facing createClient pattern.
**Fix:** Made createAdminClient return empty cookies (no-op getAll/setAll). Changed from async to sync since it no longer needs `await cookies()`.
**Rule going forward:** Admin/service-role clients never touch cookies. They operate independently of user sessions.

### 2026-03-30 — Onboarding wizard steps vs checklist steps are different concepts
**What happened:** The onboarding_steps_json used wrong step names (email_verified, subjects_selected, subdomain_set) instead of the 5 checklist steps from ARCHITECTURE.md (profile_complete, payment_details_set, course_created, cohort_created, link_shared).
**Root cause:** Confused the 3-step UI wizard with the 5-step business checklist. The wizard (subjects → subdomain → profile) is a one-time flow. The checklist (profile → payment → course → cohort → link) tracks milestones over time.
**Fix:** Use correct step names. Only step 3 (profile) of the wizard marks a checklist step. Dashboard redirect checks profile_complete, not onboarding_completed (which requires all 5 steps).
**Rule going forward:** Wizard = UI flow (3 steps). Checklist = business milestones (5 steps). They are separate concepts. The checklist is informational on the dashboard, not a gate.

### 2026-03-30 — Course mutations must verify teacher ownership
**What happened:** updateCourseAction and deleteCourseAction accepted courseId without checking it belongs to the authenticated teacher. Since lib/db uses createAdminClient (bypasses RLS), any teacher could modify any course.
**Root cause:** Admin client bypasses RLS by design, so ownership checks must be explicit in Server Actions.
**Fix:** Fetch the course first, verify course.teacher_id === teacher.id before mutating.
**Rule going forward:** Every Server Action that mutates a resource must verify ownership. Never assume RLS protects you when using createAdminClient.

### 2026-03-30 — Always sanitize user-generated HTML before rendering
**What happened:** Course descriptions (user-generated HTML from TipTap) were rendered with dangerouslySetInnerHTML without sanitization — XSS vulnerability.
**Root cause:** TipTap limits input in the editor UI, but users can bypass the editor and submit raw HTML via FormData.
**Fix:** Added sanitize-html package, sanitize before rendering.
**Rule going forward:** Always sanitize HTML from user input before dangerouslySetInnerHTML. Use sanitize-html on the server side.

### 2026-03-30 — Always check canUseFeature for plan-gated features
**What happened:** createSessionAction allowed Free-plan teachers to create recurring sessions. The recurring_classes feature flag was never checked.
**Root cause:** The feature gate was only in the plan but not enforced in the server action code.
**Fix:** Added canUseFeature('recurring_classes') check before recurring expansion.
**Rule going forward:** Before implementing any feature that has a plan flag in ARCHITECTURE.md Section 13, add canUseFeature() check in the server action. Review the feature matrix when building new features.

### 2026-03-30 — Every dangerouslySetInnerHTML needs sanitize-html, no exceptions
**What happened:** Assignment descriptions from TipTap were rendered with dangerouslySetInnerHTML without sanitization (XSS), while announcement bodies were correctly sanitized. Inconsistent application of the rule.
**Root cause:** Different subagents implemented announcements vs assignments, one remembered the rule and the other didn't.
**Fix:** Added sanitize-html to assignment-list.tsx. Checked all other dangerouslySetInnerHTML uses.
**Rule going forward:** grep for dangerouslySetInnerHTML after every week. EVERY instance must use sanitizeHtml(). No exceptions.

### 2026-03-30 — Duplicate server actions across files cause bugs
**What happened:** approveSubscriptionAction existed in both admin.ts and subscriptions.ts. The admin.ts version was incomplete (no snapshot, no grace clearing), but was the one imported by the UI component.
**Root cause:** Week 7 agent created duplicate actions without checking Week 6 already had them.
**Fix:** Removed duplicates from admin.ts, updated imports to use the canonical subscriptions.ts versions.
**Rule going forward:** Before creating a new server action, grep the codebase to check if it already exists. One action, one source.

### 2026-03-30 — Enrollment API must check is_registration_open and revoked students
**What happened:** Enrollment API only checked cohort archived status but not registration closed or revoked student blocks.
**Root cause:** Focused on the happy path (archived guard) but missed the other enrollment eligibility checks from ARCHITECTURE.md Section 14.
**Fix:** Added is_registration_open check and per-teacher revoked student check in enrollment route.
**Rule going forward:** For enrollment/access endpoints, check ALL eligibility: archived, registration open, revoked, course published, cohort full. Don't rely on UI-side checks alone.

### 2026-03-30 — Supabase .in() doesn't accept subqueries — use two-step
**What happened:** Tried to use `.in('cohort_id', supabase.from('cohorts').select('id')...)` but Supabase JS doesn't support subquery parameters.
**Root cause:** PostgrestFilterBuilder is not an array — it's a query builder.
**Fix:** Fetch the IDs first, then use `.in('cohort_id', idArray)`.
**Rule going forward:** Supabase JS client does not support SQL subqueries. Always fetch IDs first, then use them in .in() as an array.

### 2026-03-30 — Validate URL fields to prevent stored XSS
**What happened:** Meet link field accepted any string including javascript: URLs — stored XSS vector.
**Root cause:** Only checked for non-empty, didn't validate URL format.
**Fix:** Added https:// prefix validation on meet_link.
**Rule going forward:** All URL fields (meet_link, any user-provided URLs) must validate they start with https://. Never render user-provided URLs without validation.

### 2026-03-30 — Wrong-portal login leaves session dangling
**What happened:** When a teacher logged in on the student portal, signIn succeeded and created a session, but the portal mismatch check only showed an error — the session persisted.
**Root cause:** The signIn server action authenticates before the client-side role check runs.
**Fix:** Call `supabase.auth.signOut()` via the browser client when detecting a portal mismatch.
**Rule going forward:** Always clean up auth state on mismatch. Use the browser Supabase client for client-side sign-out (the server action signOut redirects, which isn't suitable here).
