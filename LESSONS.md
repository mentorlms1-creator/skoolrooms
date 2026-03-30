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

### 2026-03-30 — Wrong-portal login leaves session dangling
**What happened:** When a teacher logged in on the student portal, signIn succeeded and created a session, but the portal mismatch check only showed an error — the session persisted.
**Root cause:** The signIn server action authenticates before the client-side role check runs.
**Fix:** Call `supabase.auth.signOut()` via the browser client when detecting a portal mismatch.
**Rule going forward:** Always clean up auth state on mismatch. Use the browser Supabase client for client-side sign-out (the server action signOut redirects, which isn't suitable here).
