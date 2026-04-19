# Lane G — Auth & Account Plan

## Current State (Audit)

### Login / Signup Pages
- `app/(platform)/login/page.tsx` — Role picker (teacher vs student). No OAuth button.
- `app/(platform)/login/teacher/page.tsx` — Teacher email+password login via `<LoginForm action="teacher">`. No OAuth button.
- `app/(platform)/signup/page.tsx` — Teacher signup via `<SignupForm>`. Email+password only.
- `components/auth/LoginForm.tsx`, `SignupForm.tsx` — Client components, email+password flows only.

### Auth Callback
- `app/api/auth/callback/route.ts` — Handles `code` → `exchangeCodeForSession` for email verification + password reset. **Not yet aware of OAuth provider type** — will need to detect Google OAuth flow and route accordingly (onboarding vs dashboard).

### Cloudflare / Subdomain
- `lib/cloudflare/dns.ts` — `createSubdomainRecord()` and `deleteSubdomainRecord()` both exist and work. Validation regex + `RESERVED_SUBDOMAINS` set live here. No API route for PATCH (subdomain change) exists yet.
- `teachers` table has `subdomain_changed_at timestamptz nullable` column already in schema (ARCHITECTURE.md §3). **No migration needed for this column** — it was in the initial schema.

### Settings Pages
- `app/(teacher)/dashboard/settings/page.tsx` — Profile form (name, bio, city, photo, public listing, subject tags, levels). No subdomain-change UI row.
- `app/(teacher)/dashboard/settings/plan/page.tsx` — Subscription history already rendered here (BUILD_PLAN Phase 2 Teacher Polish item is already done for history display).
- No `settings/privacy/page.tsx` exists yet — subdomain change UI goes here (or added as a section to the existing settings page; see Open Questions).

### Email
- `lib/email/sender.ts` — Central dispatcher via Brevo. `EmailType` in `types/domain.ts` must be extended with `'subdomain_changed'`.
- No `subdomain_changed` email template exists yet.

### API Routes (Cloudflare subdomain)
- `POST /api/cloudflare/subdomain` — exists (onboarding creates subdomain).
- `PATCH /api/cloudflare/subdomain` — **does not exist** (subdomain change).

---

## Gaps vs BUILD_PLAN

| Item | BUILD_PLAN ref | Gap |
|------|---------------|-----|
| Google OAuth teacher login | Phase 2 Retention Features | Not built — no OAuth button, no callback routing, no onboarding upsert |
| Subdomain change flow | Phase 2 Retention Features | PATCH route missing, no UI, no email trigger |
| Subscription history page | Phase 2 Teacher Polish | Already built in `settings/plan/page.tsx` — **no gap** |

---

## Migration 012

`subdomain_changed_at` already exists in the initial schema (migration 001). No DB migration is needed for Lane G.

However, we must add `'subdomain_changed'` to `EmailType` in `types/domain.ts` (TypeScript change, not SQL).

**No SQL migration file needed for Lane G.**

---

## Implementation Plan (Ordered Steps)

---

### Step 1: Google OAuth — Supabase Dashboard (Manual User Step)

**User must do this before any OAuth code works:**

1. Supabase Dashboard → Authentication → Providers → Google → Enable
2. Set "Authorized redirect URI" in Google Cloud Console OAuth 2.0 to:
   `https://<project>.supabase.co/auth/v1/callback`
3. Paste Google Client ID + Secret into Supabase dashboard
4. Set "Redirect URL" in Supabase Auth settings to:
   `https://skoolrooms.com/api/auth/callback`
5. (Local dev) Add `http://localhost:3000/api/auth/callback` as an additional redirect URI

**This is a one-time configuration step. No code changes required for the Supabase side.**

---

### Step 2: Google OAuth — Login Button

**Files to EDIT:**
- `app/(platform)/login/teacher/page.tsx` — Add "Continue with Google" button below the `<LoginForm>` divider
- `components/auth/LoginForm.tsx` — Add `<GoogleOAuthButton>` or inline the button (see below)

**New file to CREATE:**
- `components/auth/GoogleOAuthButton.tsx` — Client Component

```typescript
// components/auth/GoogleOAuthButton.tsx
'use client'
import { createClient } from '@/supabase/client'
import { Button } from '@/components/ui/button'
import { platformUrl } from '@/lib/platform/domain'

export function GoogleOAuthButton() {
  async function handleGoogleSignIn() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: platformUrl('/api/auth/callback?next=/dashboard&provider=google'),
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
  }

  return (
    <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
      {/* Google SVG icon */}
      Continue with Google
    </Button>
  )
}
```

**UI placement in `app/(platform)/login/teacher/page.tsx`:**
```
[LoginForm — email + password]
─── or ───
[GoogleOAuthButton]
```

**Testable:** Clicking "Continue with Google" opens Google OAuth consent screen. After consent, redirects back to `/api/auth/callback?next=/dashboard&provider=google`.

---

### Step 3: Google OAuth — Callback Route Enhancement

**File to EDIT:** `app/api/auth/callback/route.ts`

Current behavior: exchanges code → redirects to `next` param.

**New behavior for Google OAuth:**

```typescript
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const provider = searchParams.get('provider') // 'google' | null

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      if (provider === 'google') {
        // Check if teacher row exists
        const supabaseAdmin = createAdminClient()
        const { data: teacher } = await supabaseAdmin
          .from('teachers')
          .select('id, supabase_auth_id, onboarding_completed')
          .eq('supabase_auth_id', data.user.id)
          .maybeSingle()

        if (!teacher) {
          // New Google signup — check if email matches an existing teacher
          const email = data.user.email!
          const { data: existingTeacher } = await supabaseAdmin
            .from('teachers')
            .select('id, supabase_auth_id')
            .eq('email', email)
            .maybeSingle()

          if (existingTeacher) {
            // Link: update supabase_auth_id to new Google auth user
            await supabaseAdmin
              .from('teachers')
              .update({ supabase_auth_id: data.user.id })
              .eq('id', existingTeacher.id)
            // Also create teacher_balances row if missing (idempotent)
            await supabaseAdmin
              .from('teacher_balances')
              .upsert({ teacher_id: existingTeacher.id }, { onConflict: 'teacher_id' })
            return NextResponse.redirect(`${origin}/dashboard`)
          }

          // Brand new teacher via Google — create teachers + teacher_balances rows
          const name = data.user.user_metadata?.full_name ?? data.user.email!.split('@')[0]
          const { data: newTeacher } = await supabaseAdmin
            .from('teachers')
            .insert({
              supabase_auth_id: data.user.id,
              name,
              email,
              subdomain: '', // placeholder — must complete onboarding
              plan: 'free',
              onboarding_completed: false,
            })
            .select('id')
            .single()

          if (newTeacher) {
            await supabaseAdmin
              .from('teacher_balances')
              .insert({ teacher_id: newTeacher.id })
          }

          // Redirect to onboarding with pre-filled name/email from Google metadata
          const onboardingUrl = new URL(`${origin}/onboarding/step-1`)
          onboardingUrl.searchParams.set('name', name)
          onboardingUrl.searchParams.set('email', email)
          return NextResponse.redirect(onboardingUrl.toString())
        }

        // Existing teacher via Google login
        if (!teacher.onboarding_completed) {
          return NextResponse.redirect(`${origin}/onboarding/step-1`)
        }
        return NextResponse.redirect(`${origin}/dashboard`)
      }

      // Non-OAuth (email verification / password reset) — original behavior
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
```

**Edge cases handled:**
- Google email matches existing email+password teacher → link `supabase_auth_id`, redirect to dashboard
- Brand new Google teacher → create teachers row (subdomain=''), redirect to onboarding with URL params
- Existing Google teacher, onboarding incomplete → redirect to onboarding
- Existing Google teacher, onboarding complete → redirect to dashboard

**Testable:**
- First Google signup → lands on `/onboarding/step-1?name=X&email=Y` with fields pre-filled
- Second Google login → lands on `/dashboard`
- Google login with email matching existing email+password account → linked, lands on `/dashboard`

---

### Step 4: Onboarding Pre-fill from Google

**File to EDIT:** `app/(platform)/onboarding/step-1/page.tsx` (or whatever the first onboarding step page is)

Read `name` and `email` from `searchParams` (async in Next.js 16) and pass as `defaultValues` to the onboarding form. The form already handles name — ensure email field is pre-filled and read-only (it came from a verified Google account).

```typescript
// In step-1 page.tsx (Server Component)
const params = await searchParams
const prefillName = params.name ?? ''
const prefillEmail = params.email ?? ''
```

Pass as props to the client form component. Email field should be shown but disabled (already verified by Google).

**Testable:** After Google OAuth new-signup, step-1 form shows name and email pre-filled from Google profile.

---

### Step 5: Subdomain Change — `changeSubdomainAction` Server Action

**File to CREATE:** `lib/actions/teacher-account.ts`

This is a new Server Actions file for account-level mutations (distinct from `teacher-settings.ts` which handles profile/notification prefs).

```typescript
'use server'

import { requireTeacher } from '@/lib/auth/guards'
import { createAdminClient } from '@/supabase/server'
import { createSubdomainRecord, deleteSubdomainRecord } from '@/lib/cloudflare/dns'
import { sendEmail } from '@/lib/email/sender'
import { teacherSubdomainUrl } from '@/lib/platform/domain'

// Subdomain validation — reuses regex + reserved list from lib/cloudflare/dns.ts
// We re-import the validator from dns.ts. Since SUBDOMAIN_REGEX and RESERVED_SUBDOMAINS
// are module-level constants in dns.ts, we expose a thin validateSubdomain() helper from there.

export async function changeSubdomainAction(newSubdomain: string): Promise<
  { success: true } | { success: false; error: string; code?: string }
> {
  const teacher = await requireTeacher()
  const teacherId = teacher.id as string
  const supabase = createAdminClient()

  // 1. Validate format (delegate to dns.ts validator)
  const formatError = validateSubdomainFormat(newSubdomain)
  if (formatError) return { success: false, error: formatError }

  // 2. Check 30-day cooldown
  if (teacher.subdomain_changed_at) {
    const changedAt = new Date(teacher.subdomain_changed_at as string)
    const cooldownEnd = new Date(changedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
    if (new Date() < cooldownEnd) {
      return {
        success: false,
        error: `You can change your subdomain again after ${cooldownEnd.toLocaleDateString('en-PK')}.`,
        code: 'SUBDOMAIN_COOLDOWN_ACTIVE',
      }
    }
  }

  // 3. Check DB uniqueness
  const { data: existing } = await supabase
    .from('teachers')
    .select('id')
    .eq('subdomain', newSubdomain)
    .maybeSingle()
  if (existing) {
    return { success: false, error: 'This subdomain is already taken. Please choose another.' }
  }

  const oldSubdomain = teacher.subdomain as string

  // 4. Create new DNS record first (if this fails, DB is not changed)
  const createResult = await createSubdomainRecord(newSubdomain)
  if (!createResult.success) {
    return { success: false, error: createResult.error ?? 'Failed to create DNS record.' }
  }

  // 5. Update DB
  const { error: dbError } = await supabase
    .from('teachers')
    .update({
      subdomain: newSubdomain,
      subdomain_changed_at: new Date().toISOString(),
    })
    .eq('id', teacherId)

  if (dbError) {
    // Rollback DNS
    await deleteSubdomainRecord(newSubdomain)
    return { success: false, error: 'Failed to update subdomain. Please try again.' }
  }

  // 6. Delete old DNS record (best-effort — don't fail the action if this fails)
  await deleteSubdomainRecord(oldSubdomain)

  // 7. Send confirmation email
  await sendEmail({
    to: teacher.email as string,
    type: 'subdomain_changed',
    recipientId: teacherId,
    recipientType: 'teacher',
    data: {
      teacherName: teacher.name,
      oldSubdomain,
      newSubdomain,
      oldUrl: teacherSubdomainUrl(oldSubdomain),
      newUrl: teacherSubdomainUrl(newSubdomain),
    },
  })

  return { success: true }
}
```

**Also add to `lib/cloudflare/dns.ts`** — export a thin validator so `changeSubdomainAction` can reuse the same regex + reserved set without duplication:

```typescript
// Add to lib/cloudflare/dns.ts (new export)
export function validateSubdomainFormat(subdomain: string): string | null {
  if (!SUBDOMAIN_REGEX.test(subdomain)) {
    return 'Subdomain must be 3–30 characters, lowercase letters, numbers, and hyphens only. Must start and end with a letter or number.'
  }
  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    return `The subdomain "${subdomain}" is reserved and cannot be used.`
  }
  return null
}
```

**Also add `'subdomain_changed'` to `EmailType` in `types/domain.ts`.**

**Testable:**
- Valid new subdomain, no cooldown → DNS record created, DB updated, old DNS deleted, email sent
- Within 30-day cooldown → returns `SUBDOMAIN_COOLDOWN_ACTIVE` error
- Taken subdomain → "already taken" error
- DNS create fails → DB not touched, returns DNS error
- DB update fails → new DNS record rolled back

---

### Step 6: Subdomain Change — UI (Settings Page)

**Decision:** Add a new "Privacy & Subdomain" section to `app/(teacher)/dashboard/settings/page.tsx` rather than creating a separate `settings/privacy/page.tsx`. This keeps the settings sidebar simple.  
*(See Open Questions — if team-lead prefers a separate page, only the file target changes, not the component logic.)*

**New file to CREATE:** `components/teacher/ChangeSubdomainSection.tsx` — Client Component

```typescript
'use client'
// Props: currentSubdomain: string, subdomainChangedAt: string | null
// State: showModal (boolean), inputValue (string), isLoading, error
//
// Renders:
// - Current subdomain display with URL preview (e.g. ahmed.skoolrooms.com)
// - "Change subdomain" button → opens ConfirmModal
// - ConfirmModal contains:
//   - Warning: "After changing, your old link (ahmed.skoolrooms.com) will stop working immediately.
//               You cannot change again for 30 days."
//   - Input: new subdomain
//   - Live preview: "Your new URL: [input].skoolrooms.com"
//   - Confirm button → calls changeSubdomainAction(newSubdomain)
//   - On success: router.refresh() + success toast
//   - On SUBDOMAIN_COOLDOWN_ACTIVE: show cooldown end date clearly
//
// If within cooldown: show locked state "Next change available: [date]" — no button
```

**File to EDIT:** `app/(teacher)/dashboard/settings/page.tsx`

Add `<ChangeSubdomainSection>` below the profile form, passing `teacher.subdomain` and `teacher.subdomain_changed_at`.

**Testable:**
- Teacher sees current subdomain + "Change subdomain" button
- Button opens confirmation modal with 30-day warning
- Within cooldown: button replaced by "Next change available: [date]" message
- After successful change: toast confirms, page reflects new subdomain

---

### Step 7: Subdomain Change — API Route (PATCH)

Per ARCHITECTURE.md §5, PATCH `/api/cloudflare/subdomain` is documented as an actual API route (not a Server Action) — it's listed under "Actual API Routes" because Cloudflare DNS is an external integration.

**However:** The ARCHITECTURE.md instruction at §5 also says mutations go through Server Actions except for external integrations. Since the subdomain change involves both a DB mutation AND Cloudflare DNS, the cleanest approach per this codebase's pattern is:

- **Server Action** (`changeSubdomainAction` in Step 5) handles the full flow
- No separate PATCH API route needed — the Server Action calls `createSubdomainRecord` / `deleteSubdomainRecord` directly (same as `POST /api/cloudflare/subdomain` does today via the onboarding flow)

This matches how the existing `POST /api/cloudflare/subdomain` route works internally: it is thin and just calls the `createSubdomainRecord` helper. The Server Action pattern is cleaner for a teacher-authenticated mutation.

**Note for team-lead:** ARCHITECTURE.md documents PATCH as an API route, but given the Server Action pattern used throughout Phase 1.5, the Server Action approach is consistent and avoids unnecessary indirection. Flag if you prefer the API route approach instead.

---

## Out of Scope for Lane G

- Redirecting old subdomain to new (DNS-level redirect) — Phase 3 enhancement. Document in LESSONS.md after implementation.
- Student Google OAuth — Phase 1 student flow stays as-is.
- Google OAuth for signup (new teacher) — Step 3's callback already handles new teachers who come via Google. No separate "Sign up with Google" page needed; the same OAuth flow handles both new and returning teachers.

---

## Files Summary

| File | Action | Notes |
|------|--------|-------|
| `components/auth/GoogleOAuthButton.tsx` | CREATE | Client component, calls `supabase.auth.signInWithOAuth` |
| `app/(platform)/login/teacher/page.tsx` | EDIT | Add `<GoogleOAuthButton>` below email form |
| `app/api/auth/callback/route.ts` | EDIT | Add Google OAuth detection + teacher upsert/link logic |
| `app/(platform)/onboarding/step-1/page.tsx` | EDIT | Read `name`/`email` searchParams, pre-fill form |
| `lib/cloudflare/dns.ts` | EDIT | Export `validateSubdomainFormat()` helper |
| `lib/actions/teacher-account.ts` | CREATE | `changeSubdomainAction` Server Action |
| `types/domain.ts` | EDIT | Add `'subdomain_changed'` to `EmailType` |
| `components/teacher/ChangeSubdomainSection.tsx` | CREATE | Subdomain change UI with modal + cooldown display |
| `app/(teacher)/dashboard/settings/page.tsx` | EDIT | Add `<ChangeSubdomainSection>` |

**No SQL migration needed.** `subdomain_changed_at` column already in initial schema.

---

## Open Questions for team-lead

1. **Subdomain change UI location:** Should "Change subdomain" go in a new `settings/privacy/page.tsx` (separate nav item in Settings sidebar) or as a new section in the existing `settings/page.tsx`? Architecture §10b mentions "Settings → Privacy" as the target. If a separate page, the Settings sidebar nav needs a new "Privacy" item — is that Lane G's responsibility or Lane B's (shared layouts)?

2. **Server Action vs API route for subdomain PATCH:** ARCHITECTURE.md documents it as an API route (`PATCH /api/cloudflare/subdomain`). The plan above uses a Server Action instead for consistency with Phase 1.5 patterns. Confirm which approach to implement.

3. **Google OAuth — `GOOGLE_CLIENT_ID` env var:** The Supabase dashboard stores the Google credentials, so no new env var is needed in `.env.local`. Confirm this is correct — or does the app need to read client ID for anything (e.g., pre-rendering the button with Google's brand assets)?

4. **New teacher via Google — subdomain placeholder:** When a new teacher signs up via Google, the callback creates the `teachers` row with `subdomain=''` (placeholder) and redirects to onboarding/step-1. Should `subdomain=''` be allowed in DB (currently `UNIQUE NOT NULL`) or should we use a temp value like `_oauth_{uuid}` until onboarding completes? This needs DB clarification.

5. **`subdomain_changed` email template:** Does Brevo already have a template for this, or does it need to be created? The `sendEmail()` function needs a matching Brevo template ID or the template name map needs extending.

---

## Answers from team-lead

1. **Section in existing settings/page.tsx** — not a separate /settings/privacy page. No new nav item, no Lane B coordination needed. Keeps settings sidebar clean.

2. **Server Action.** Architecture §5's API-route mention is stale Phase 1 documentation; Phase 1.5 + batch 1 consistently use Server Actions for authenticated teacher mutations (CLAUDE.md Rule 12). Your proposed Server Action approach is correct. Do NOT create a PATCH /api/cloudflare/subdomain route.

3. **No new env var.** Google Client ID + Secret live in the Supabase dashboard only. The button just calls `supabase.auth.signInWithOAuth({ provider: 'google' })` — Supabase redirects to Google's OAuth consent, handles the rest. No `GOOGLE_CLIENT_ID` in .env.local.

4. **Placeholder subdomain: `_pending_{teacherId}`.** Format fails SUBDOMAIN_REGEX (starts with underscore) so public subdomain router won't resolve it — correct behavior since the teacher hasn't chosen one. Guaranteed unique (uses UUID). Insert teacher row with `subdomain = '_pending_' + newTeacher.id` AFTER the first insert gets an id back — so the insert pattern is:
   - First insert with a throwaway unique value: `subdomain = '_pending_' || gen_random_uuid()::text` (use crypto.randomUUID() in JS and prefix)
   - OR: two-step — insert with `subdomain = crypto.randomUUID()` then update to `_pending_{id}` after getting id back.
   
   Simplest: `subdomain: \`_pending_${crypto.randomUUID()}\`` at insert time. Unique by construction. Onboarding step 2 updates to real subdomain + creates DNS record (same flow as email+password signup's onboarding).

5. **Inline HTML in lib/email/sender.ts, not Brevo template.** Follow the existing pattern — add `subdomain_changed` to the subject map with inline HTML body including teacherName, oldUrl (marked "no longer active"), newUrl (CTA link). No Brevo dashboard setup needed.

## Additional guidance

- **Do NOT add a Lane B nav item** for "Privacy" — explicit no. Settings page gets a section, that's it.
- `validateSubdomainFormat()` export from `lib/cloudflare/dns.ts` is the right refactor — removes duplication. Also export `SUBDOMAIN_REGEX` and `RESERVED_SUBDOMAINS` if any other Lane G file needs them (probably not).
- **Rollback safety**: in `changeSubdomainAction`, if `createSubdomainRecord(new)` succeeds but DB update fails → delete the new DNS record (you already have this). If DB update succeeds but `deleteSubdomainRecord(old)` fails → best-effort, log a warning, don't fail the action (teacher has the new subdomain, old one orphaned — admin can clean up later, flag as TODO in the code).
- **Cooldown check uses teacher.subdomain_changed_at** — if the column is NULL (teacher never changed), skip the check. Good — your plan handles this.
- **Migration for Lane G: NONE.** No ALTERs, no new tables.
- **Email type added**: `'subdomain_changed'`. Note: Lane C will also add `'referral_credited'`, Lane H will add `'fee_reminder_overdue'`. Coordinate the types/domain.ts edit so none clobber each other — use anchor-specific Edit old_string.

## Cross-lane coordination with Lane C (referrals)

Lane C is building the referral program. Lane G must integrate the referral conversion hook at BOTH teacher signup paths:

- **Email+password signup** (`POST /api/auth/teacher/signup` or equivalent Server Action): if the request URL or form has a `ref` parameter, pass the code to `convertReferralAction(referralCode, newTeacherId)` after the teacher row is created. Lane C exports this action from `lib/actions/referrals.ts`.

- **Google OAuth**: thread `?ref={code}` through the OAuth round-trip. In `GoogleOAuthButton`, read `ref` from the current URL's searchParams (if present on the login page) and append it to `redirectTo`:
  ```typescript
  const ref = new URLSearchParams(window.location.search).get('ref')
  const redirectTo = platformUrl(`/api/auth/callback?next=/dashboard&provider=google${ref ? `&ref=${ref}` : ''}`)
  ```
  Then in `app/api/auth/callback/route.ts`, when creating a brand-new teacher row for Google, read `ref` from `searchParams` and call `convertReferralAction(ref, newTeacher.id)`. Import:
  ```typescript
  import { convertReferralAction } from '@/lib/actions/referrals'
  ```

Implementer-g: SendMessage implementer-c BEFORE wiring the OAuth callback referral hook, to confirm `convertReferralAction` is exported and the signature matches. If the Lane C function isn't ready yet, leave a TODO comment referencing it and finish the rest of Lane G.
