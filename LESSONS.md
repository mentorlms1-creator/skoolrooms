# Lessons Learned — Skool Rooms LMS

> Log every unexpected issue, wrong assumption, or library gotcha here.
> Check this file BEFORE starting any complex task — the answer might already be here.

---

### 2026-06-11 — Dev server served stale CSS after globals.css edit
**What happened:** New `mk-*` marketing classes appended to `app/globals.css` were missing from the CSS chunk the dev server served — even after restarting `next dev`. The production build contained them fine.
**Root cause:** Next 16's persistent Turbopack cache (under `.next`) kept serving the pre-edit compiled CSS chunk. A `npm run build` running concurrently with the dev server likely poisoned the cache. Restarting the server alone doesn't invalidate it.
**Fix:** Stopped the dev server, deleted `.next`, restarted. CSS compiled fresh and rendered correctly.
**Rule going forward:** If dev styles don't match the source (especially after running `next build` while `next dev` was up), delete `.next` and restart before debugging the CSS itself. Verify by grepping the served chunk for the new selector.

### 2026-06-11 — Featured-teachers query returned IDs that hydrate to nothing
**What happened:** `/students` "Top Tutors" section rendered empty even though `/explore` showed a teacher.
**Root cause:** `getExplorableTeacherIds` filters only on teacher-level flags (listed, not suspended, not downgraded). `getExplorableTeacherDetails` then drops teachers with no published courses. Fetching only 3 IDs returned the 3 newest teachers, none of which survived details hydration.
**Fix:** Fetch a full explore page of IDs (`EXPLORE_PAGE_SIZE`), hydrate details, then sort by `student_count` and take the top 3.
**Rule going forward:** Never call `getExplorableTeacherIds` with a small limit expecting that many renderable teachers — details hydration can drop rows. Over-fetch, hydrate, then trim.

### 2026-05-20 — Profile photo upload showed "Failed to fetch"
**What happened:** Tester uploaded a profile photo on `/onboarding/step-3`; the local FileReader preview rendered but the upload bar shifted to error state with the message "Failed to fetch".
**Root cause:** `FileUpload.tsx` does a cross-origin `PUT` to the R2 presigned URL. The R2 bucket's CORS rules only listed the platform domain that was set in env when `scripts/set-r2-cors.mjs` was last run. During the `.site` → `.com` cutover, the live origin no longer matches the configured CORS, so browsers reject the preflight and `fetch()` throws "Failed to fetch" — which we surfaced verbatim to the user.
**Fix:** Updated `set-r2-cors.mjs` to accept a `CORS_EXTRA_DOMAINS` comma-separated env var so multiple domains can be allowed at once during transitions. Tightened `FileUpload.tsx` to wrap each `fetch()` separately and replace the bare "Failed to fetch" with a domain-specific message (and a console error pointing at the likely CORS cause).
**Rule going forward:** Any time the platform domain changes (Vercel ↔ Railway, `.site` ↔ `.com`, etc.), re-run `set-r2-cors.mjs` with `CORS_EXTRA_DOMAINS` covering BOTH the old and new domain until the cutover is fully complete. Add the same step to any future custom-domain migration checklist (R2 isn't behind our DNS — Cloudflare DNS changes do NOT propagate to R2 CORS automatically).

### 2026-05-20 — Password reset showed "Auth session missing!" on submit
**What happened:** Testers clicked the reset-password email link, landed on the form, submitted a new password, and got "Auth session missing!" from `supabase.auth.updateUser()`.
**Root cause:** `resetPassword` in `lib/auth/actions.ts` set `redirectTo` directly to `/auth/reset-password`. With `@supabase/ssr`'s default PKCE flow, the recovery link arrives as `?code=...` — the bare page never called `exchangeCodeForSession`, so no session cookies were set before the form submission.
**Fix:** Routed `redirectTo` through `/api/auth/callback?next=/auth/reset-password`. The existing API callback exchanges the PKCE code, sets session cookies, then redirects to the reset form — by which point `updateUser({ password })` has a session to attach to.
**Rule going forward:** ANY Supabase email-link flow (`resetPasswordForEmail`, `signInWithOtp`, magic links, etc.) where the next step needs an authenticated session MUST send `redirectTo` through `/api/auth/callback` (PKCE) or `/auth/callback` (implicit / `admin.generateLink`). Never land directly on a page that assumes a session — the URL alone doesn't create one.

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

### 2026-04-06 — React onClick doesn't fire on iOS Safari/Chrome for hamburger menus
**What happened:** The marketing page hamburger menu (PublicNavbar) was completely unresponsive on iPhone Chrome. Desktop and DevTools mobile emulation worked fine. Links (`<a>` tags) worked, but `<button onClick>` did not.
**Root cause:** Two compounding issues: (1) React delegates events to the root — on iOS WebKit, click events don't bubble reliably for non-anchor elements (facebook/react#134, open since 2013). (2) Through slow connections (ngrok), React hydration is delayed, so `onClick` handlers aren't attached when the user taps.
**Fix:** Use `<details>`/`<summary>` HTML elements for dropdown-style mobile menus (PublicNavbar, StudentNav). This is native browser behavior — no JavaScript needed, works before React hydrates. For slide-out drawers (teacher Sidebar, admin AdminSidebar), added `onTouchEnd` alongside `onClick` as a fallback since those are behind auth where JS is already loaded. Also added `pointer-events-none` on SVG icons inside buttons, `cursor: pointer` globally on buttons in globals.css, and `-webkit-tap-highlight-color` for tap feedback.
**Rule going forward:** (1) For simple open/close mobile menus, use `<details>`/`<summary>` — it's the progressive enhancement pattern used by GitHub and GOV.UK. (2) For complex drawers requiring overlays/animations, keep `useState` but always add `onTouchEnd` alongside `onClick` for iOS. (3) Always add `pointer-events-none` on SVGs inside interactive elements. (4) Tailwind v4 sets `cursor: default` on buttons — override with `cursor: pointer` in `@layer base` in globals.css for iOS tap reliability.


### 2026-05-16 — AI lesson planner ship notes
**What:** Shipped in-platform AI lesson planning (generate, chat-revise, PDF export) inside courses.
**Architecture notes:**
- AI provider abstraction at `lib/ai/` uses `@ai-sdk/anthropic` with overridable `baseURL` — works with any Anthropic-compatible endpoint (Anthropic API, OpenRouter via Anthropic protocol, self-hosted proxies). One file (`anthropic.ts`) covers all such providers; new vendors don't need code, only an env/setting change.
- `lib/platform/settings.ts` introduced encrypted-settings infra (pgcrypto `pgp_sym_encrypt`, `SETTINGS_ENCRYPTION_KEY` env). Used only for `ai_provider_api_key`. Migration `024` originally had `set_encrypted_setting` with `search_path = public`, but pgcrypto lives in `extensions` schema in Supabase — fixed in `025`. Also `platform_settings.description` is NOT NULL → fixed in `026` to supply a default description on insert.
- `lesson_plans.teacher_id` originally referenced `auth.users(id)`; migration `028` realigned it to `public.teachers(id)` to match the rest of the codebase, and updated RLS to use the standard `(select id from teachers where supabase_auth_id = auth.uid())` pattern.
- Quota race-condition fix: `insert_lesson_plan_atomic` RPC (migration `029`) wraps quota check + insert in one transaction with `pg_advisory_xact_lock(hashtext(teacher_id))`. Survives PgBouncer transaction-mode pooling because the lock and the dependent work both happen inside one Postgres txn.
- PDF download lives at `app/api/lesson-plans/[id]/pdf/route.tsx` — documented exception to CLAUDE.md rule 12 (no API routes for CRUD). The route serves a generated file, not data. PDFs are regenerated on every download (no caching) because plans change with every revision.
- AI SDK v6 renamed `maxTokens` → `maxOutputTokens` and `usage.promptTokens` → `usage.inputTokens`. The adapter uses v6 naming. Token-usage capture is tolerant of providers that don't return usage at all.

**Rule going forward:** Any new in-platform AI feature should reuse `lib/ai/provider.ts` (don't install a second AI SDK). Add the prompt builder per feature in `lib/ai/prompts.ts` or alongside. Any new sensitive secret in `platform_settings` goes through `setEncryptedSetting`/`getEncryptedSetting`, not plain rows.
