# Lumscribe — LMS SaaS Platform

## What This Project Is

An LMS SaaS platform for independent tutors, home teachers, and small coaching centers in Pakistan. Teachers sign up, get a branded subdomain (xyz.lumscribe.com), and manage courses, students, Google Meet sessions, and payments from one dashboard. Students enroll via invite links and pay via screenshot verification (bank transfer/JazzCash/EasyPaisa). Platform owner (admin) earns via monthly teacher subscriptions + a percentage cut on every student payment.

## Architecture Reference

Read `ARCHITECTURE.md` before writing ANY code. It is the single source of truth.

| Topic | ARCHITECTURE.md Section |
|-------|------------------------|
| Folder structure | Section 1 |
| Shared types, functions, hooks, constants | Section 2 |
| Database schema (all tables, columns, RLS, indexes, functions) | Section 3 |
| Authentication (teacher, student, admin flows) | Section 4 |
| API routes (every endpoint) | Section 5 |
| Realtime subscriptions | Section 6 |
| Payment flows (gateway, screenshot, manual, payout, refund) | Section 7 |
| Email notifications (every trigger) | Section 8 |
| Critical systems (slot locking, recurring classes, plan limits, rate limiting) | Section 9 |
| UI architecture (theme, components, layouts) | Section 10 |
| Environment variables | Section 11 |
| Build plan (week-by-week) | Section 12 |
| Business rules (plan limits, pricing, timing rules, upload limits) | Section 13 |
| Edge cases (payment, enrollment, content, billing, auth, storage, notifications) | Section 14 |

Build plan is in `BUILD_PLAN.md`.

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 16 (App Router) | Server Components default. `params`/`searchParams` are async (`await`). |
| UI | React 19 | `use()` hook for client-side async. |
| Styling | Tailwind CSS v4 | CSS-first config via `@theme` in `globals.css`. No `tailwind.config.js`. PostCSS: `@tailwindcss/postcss`. |
| Database | Supabase (Postgres + RLS) | 19 RLS policies. Never bypass — use service role only server-side. |
| Auth | Supabase Auth via `@supabase/ssr` | NOT `@supabase/auth-helpers-nextjs` (deprecated). `getAll`/`setAll` cookie pattern. |
| File Storage | Cloudflare R2 | Presigned upload URLs. Content-Length enforced. |
| DNS | Cloudflare DNS API | Auto-creates teacher subdomains on signup. |
| Email | Brevo (`@getbrevo/brevo`) | NOT Resend. 300 emails/day free tier. |
| Hosting | Vercel Pro | Required for wildcard subdomain SSL. |
| Language | TypeScript (strict mode) | No `any` types. |

## Project Structure

```
app/
  (platform)/          Marketing site + admin panel (lumscribe.com/*)
  (teacher)/           Teacher dashboard (lumscribe.com/dashboard/*)
  (student)/           Student portal (students.lumscribe.com/*)
  (teacher-public)/    Teacher subdomain pages ([subdomain].lumscribe.com/*)
  api/                 Webhooks, crons, external integrations ONLY
lib/
  db/                  Service layer — ALL database queries go here
  payment/             PaymentProvider interface + adapters (mock, safepay, payfast)
  plans/               canUseFeature(), getLimit() — plan enforcement
  platform/            platformDomain(), getPlatformSetting() — platform config
  email/               sendEmail() — all emails go through here
  time/                formatPKT(), currentPKT() — timezone handling
  r2/                  getPresignedUploadUrl() — file uploads
  cloudflare/          createSubdomainRecord() — DNS management
components/
  ui/                  Shared primitives — Button, DataTable, StatusBadge, FileUpload, etc.
  teacher/             Teacher-specific compositions (use ui/ primitives)
  student/             Student-specific compositions
  admin/               Admin-specific compositions
  public/              Public page compositions (TeacherCard, CourseCard)
providers/
  TeacherProvider.tsx   Server → Client data bridge for teacher context
  StudentProvider.tsx   Server → Client data bridge for student context
  UIProvider.tsx        Client-side UI state (toasts, modals)
hooks/                 useRealtime(), useToast() — client components ONLY
types/                 database.ts (auto-gen), api.ts, domain.ts
constants/             routes.ts, features.ts, plans.ts
supabase/
  client.ts            Browser Supabase client
  server.ts            Server Supabase client (@supabase/ssr)
  migrations/          001_schema, 002_rls, 003_indexes, 004_functions, 005_seed
```

## Where Things Go

| Code type | Correct location | Never put it in |
|-----------|-----------------|-----------------|
| Database queries | `lib/db/*.ts` | Components, API routes, pages |
| Business logic (plan checks, cuts, balance) | `lib/plans/`, `lib/payment/` | Components |
| API routes | `app/api/` — **webhooks, crons, external integrations ONLY** | Don't create API routes for regular CRUD |
| Mutations (create, update, delete) | Server Actions in the page/component that needs them | Client-side `fetch()` to API routes |
| Initial data fetching | Server Components (`page.tsx`, `layout.tsx`) | Client Components via `useEffect` |
| Realtime subscriptions | `useRealtime()` hook in Client Components | Server Components |
| UI primitives (Button, Table, Badge) | `components/ui/` | Role-specific folders |
| Role-specific compositions | `components/teacher/`, `student/`, `admin/`, `public/` | `components/ui/` |
| Types | `types/*.ts` | Inline in components |
| Constants (routes, feature keys) | `constants/*.ts` | Hardcoded strings anywhere |
| Platform URLs | `platformDomain()`, `teacherSubdomainUrl()` | Hardcoded `lumscribe.com` anywhere |
| Timestamps (display) | `formatPKT()` | `new Date().toLocaleString()` or raw UTC |
| Email sending | `sendEmail()` in `lib/email/sender.ts` | Direct Brevo SDK calls in routes |
| File uploads | `FileUpload` component → `lib/r2/upload.ts` | Direct R2 SDK calls in components |
| Auth guards | `requireTeacher()`, `requireAdmin()`, `requireStudent()` | Manual session checks |
| Environment config | `lib/platform/settings.ts` → `getPlatformSetting()` | Direct `process.env` reads for business config |

## Critical Rules — DO NOT VIOLATE

### Data Rules
1. **All timestamps stored UTC in database.** All display in PKT (UTC+5) via `formatPKT()`. Never use `toLocaleString()`.
2. **All money values are integers in PKR** (not floats, not paisa). `amount_pkr`, `fee_pkr`, `platform_cut_pkr` — all `int`.
3. **Platform cut is calculated and stored at payment time.** `student_payments.platform_cut_pkr` and `teacher_payout_amount_pkr` are permanent records. Never re-derive.
4. **billing_day is 1-28 only.** UI and API both block 29/30/31. No exceptions.

### Security Rules
5. **`SUPABASE_SERVICE_ROLE_KEY` is server-only.** Never import `supabase/server.ts` in a Client Component. Never expose to browser.
6. **All cron routes validate `CRON_SECRET`.** Check `Authorization: Bearer ${CRON_SECRET}` header before executing. No exceptions.
7. **RLS is enabled on every table.** 19 policies enforce data isolation. Teacher A cannot see Teacher B's data. Never bypass RLS from client code.
8. **Admin operations use service role** (`supabaseAdmin`) which bypasses RLS. This is intentional and server-only.
9. **Webhook signatures must be verified** before processing any gateway webhook. Never trust payload without signature check.

### Architecture Rules
10. **Server Components are the default.** Only add `'use client'` when you need interactivity, hooks, or browser APIs. Data fetching happens in Server Components.
11. **Client Components NEVER fetch on mount.** No `useEffect(() => fetch(...))`. Data comes from Server Component props or React Context (TeacherProvider).
12. **Mutations use Server Actions.** NOT client-side `fetch()` to API routes. API routes exist only for: webhooks, crons, and external integrations.
13. **One component, one source.** Every UI primitive lives in `components/ui/`. Never duplicate a Button, Table, Badge, or FileUpload. If it exists in `ui/`, import it.
14. **Theme changes = one file.** All colors, fonts, shadows defined in `@theme` block in `globals.css`. Never use raw hex values or Tailwind defaults (`bg-blue-500`) in components. Always use tokens: `bg-brand-500`, `text-ink`, `border-border`.
15. **Plan limits enforced server-side.** `PlanLimitGuard` is UI-only feedback. Every write route MUST also call `getLimit()` and check. Never trust client-side checks alone.

### Business Rules
16. **Screenshots go directly to teacher's bank.** Platform never holds this money. `teacher_balances` is credited with the net amount (after cut). Platform cut is collected at payout time.
17. **Manual "Mark as Paid" enrollments set `platform_cut_pkr = 0`.** Balance NOT credited. Cash went directly to teacher outside the platform.
18. **Refund deducts `teacher_payout_amount_pkr`** (not full `amount_pkr`). Prevents negative balances.
19. **One active payout request at a time.** Reject new payout if existing one has status `pending` or `processing`.
20. **Archived cohorts are permanently read-only.** No un-archive. All content-write routes check `cohort.status != 'archived'` and return 403 `COHORT_ARCHIVED`.
21. **Free plan never expires.** `plan_expires_at = NULL` = free forever. Grace period and renewal reminders don't apply.
22. **Trial has no grace period.** Trial ends → auto-downgrade to Free immediately. Grace period is only for paid plan expiry.

## Workflow Orientation

### First Principles
- Read your models: use `ARCHITECTURE.md` for all data, API, and architectural decisions.
- Read everything on screen, STOP and re-read if you encounter something surprising.
- When making changes, consider the blast radius. STOP when uncertain.
- Write detailed plans (PLAN.md) with steps and test criteria before building complex features.
- Use sub-agents for research, exploration, and parallel analysis — keep main context clean and focused.
- After ANY complex error, check `LESSONS.md` first — the answer might already be there.

### Workflow
- **Research first.** Before coding any feature, use sub-agents to explore ARCHITECTURE.md for the relevant schema, API routes, edge cases, and business rules. Don't start from memory.
- **Plan before building.** For any task touching 3+ files, write a brief plan first: what files change, what order, what to test. Plans prevent cascading mistakes.
- **Verify before marking done.** Read back the code you just wrote. Does it match the architecture? Does it handle the edge cases from Section 14? Does it respect RLS?
- **One thing at a time.** Finish the current feature completely (including edge cases and tests) before moving to the next. Half-built features create debt.
- **Ask, don't guess.** If the architecture is ambiguous or doesn't cover a scenario, ask the user. Don't invent behavior — it will conflict with something else later.

### While Building
- Use `npx supabase gen types typescript` after any schema change to regenerate `types/database.ts`.
- Every new page: Server Component by default. Only add `'use client'` if you need hooks.
- Every new mutation: Server Action. Not a new API route.
- Every new table query: goes in `lib/db/*.ts`. Never raw Supabase calls in components.
- Every new component: check if `components/ui/` already has it. If yes, use it. If no, add it to `ui/` (not a role folder).

### After Building
- Test the user flow end-to-end (not just the happy path).
- Check that RLS works: log in as Teacher A, verify you can't see Teacher B's data.
- Verify all timestamps display in PKT.
- Check mobile responsiveness (teachers use phones in Pakistan).

### When Things Break
- Find the root cause. No temporary fixes that mask the real problem.
- If an RLS policy is blocking legitimate access, fix the policy — don't bypass RLS.
- If a cron job fails, check the `CRON_SECRET` header first.
- Log the fix in `LESSONS.md` so we don't repeat the same mistake.

### Tasks
- Use tasks to track progress within the current build week.
- Mark tasks `in_progress` when starting, `completed` when done and verified.
- If a task is blocked, note why and move to the next unblocked task.
- Don't carry incomplete tasks across weeks — finish or explicitly defer.

## Lessons System

Maintain a `LESSONS.md` file in the project root. Every time something unexpected happens — a bug caused by a wrong assumption, a pattern that didn't work, a gotcha with a library — log it here.

Format:
```markdown
### [Date] — Short title
**What happened:** One sentence.
**Root cause:** Why it happened.
**Fix:** What we did.
**Rule going forward:** What to always/never do.
```

Before starting any complex task, skim `LESSONS.md` for relevant entries. This prevents repeat mistakes across build weeks.

## Principles

- **Simplicity First.** Every code change is an opportunity for bugs — resist unnecessary complexity. Three lines of repeated code is better than a premature abstraction.
- **Minimal Impact.** Make the smallest change possible. Don't refactor adjacent code. Don't add features that weren't asked for. Don't "improve" things while fixing bugs.
- **Read Before Writing.** Read the existing code, schema, and architecture section before changing anything. Understand what exists before adding to it.
- **User Context.** This platform is for Pakistani tutors — many on mobile, many non-technical. Errors must be clear and in plain language. UI must be fast on slow connections.

## Development Mode

### What's Mocked
| Service | Mock Behavior | Real Service |
|---------|-------------|-------------|
| **Payment Gateway** | `PAYMENT_GATEWAY=mock` — always succeeds, fake checkout URL | Flip to `safepay` or `payfast` when API keys ready (Phase 2) |
| **Email** | Brevo works from day 1 (free tier). No mock needed. | Same |
| **Subdomain DNS** | Cloudflare API works from day 1 (free tier). No mock needed. | Same |
| **File Storage** | R2 works from day 1 (free tier). No mock needed. | Same |
| **Rate Limiting** | In-memory (simple Map). Works locally. | Upgrade to Upstash Redis in Phase 2 |

### Swapping Mocks for Real Services
1. **Payment gateway:** Set `PAYMENT_GATEWAY=safepay` in Vercel env + add Safepay keys + flip `payment_gateway_enabled=true` in Admin → Platform Settings. No code changes.
2. **Screenshot payments:** Toggle `screenshot_payments_enabled` in Admin → Platform Settings. Instant effect on all payment pages. No deploy needed.
3. **Rate limiting:** Add `UPSTASH_REDIS_URL` + `UPSTASH_REDIS_TOKEN` env vars. Change rate limiter import from in-memory to Upstash.

## Current Phase

**Phase 1 — MVP (8 weeks).** See `BUILD_PLAN.md` for week-by-week checklist.

Build in this order:
1. Week 0: Collect all API keys, validate access
2. Week 1: Database + Auth + Shared infrastructure
3. Week 2: Teacher onboarding + Courses
4. Week 3: Cohorts + Scheduling
5. Week 4: Student portal + Enrollment + Screenshot payments
6. Week 5: Announcements + Attendance + Assignments
7. Week 6: Subscriptions + Plan management + Grace period
8. Week 7: Admin panel + Teacher analytics
9. Week 8: Waitlist + Fee reminders + Explore page + Launch prep

Phase 2 (gateway, payouts, messaging, referrals, WhatsApp) starts after MVP is live with real users.
Phase 3 (custom domains, 1-on-1 sessions, parent portal) is deferred — not being built now.
