# AI Lesson Planner — Design Spec

**Date:** 2026-05-16
**Status:** Approved for planning
**Scope:** Phase 1 / MVP feature addition

## 1. Purpose

Teachers on Skool Rooms currently use external tools (ChatGPT, Claude.ai) to draft lesson plans, then copy them into their notes. This feature brings that workflow inside the platform: an AI-assisted lesson planner that lives inside each course, lets teachers generate session or unit plans, revise them through chat, save them, and export to PDF.

**Why it belongs in-platform:**
- Keeps teachers in our dashboard (retention + engagement signal).
- Plans live alongside the course they're for — no copy/paste between tools.
- Gives us a clear, valuable AI feature behind paid tiers (quota-gated).
- Pluggable AI provider means we can swap models without code changes as the market shifts.

## 2. User Stories

- As a teacher, I open a course and click "Lesson Plans" → I see all plans I've made for this course.
- As a teacher, I click "New plan", pick scope (single session / full unit), fill a short form, and the AI generates a markdown plan in ~5–15 seconds.
- As a teacher, I read the plan and type "make the warm-up shorter and add a quiz at the end" → AI returns an updated full plan; the chat history is preserved.
- As a teacher, I click "Download PDF" and get a branded PDF I can print or share with a co-teacher.
- As a teacher on Free, I see "2 of 2 plans used this month — upgrade for more" after my second plan.
- As the platform admin, I open Platform Settings → AI Provider, paste a base URL + API key + model name, and all teachers immediately use the new provider.

## 3. Non-Goals (v1)

- Sharing plans with students. Plans are teacher-private. (Section 5 lesson_plans RLS enforces this.)
- Rich text / WYSIWYG editing. Editing happens only through AI chat revisions.
- Per-teacher model selection. The platform admin picks one provider for everyone.
- Multi-provider routing (e.g. "use cheap model for revisions, premium for first generation"). Single provider per platform.
- Plan templates marketplace, collaborative editing, version branching. All deferred.
- Image generation, diagram insertion, attached files. Plain markdown only.

## 4. Architecture Overview

Three new building blocks:

1. **`lib/ai/`** — provider abstraction. Single adapter for Anthropic-compatible endpoints (which is what the user's chosen vendor offers). Configurable base URL + API key + model.
2. **`lesson_plans` table + `lesson_plan_usage` table** — Postgres storage. RLS-protected per teacher.
3. **Course-scoped UI** — new "Lesson Plans" tab inside the existing course detail page, with list / new / detail views.

Data flow:

```
Teacher opens course → "Lesson Plans" tab
  ↓
Server Component fetches plans via lib/db/lessonPlans.ts (RLS)
  ↓
Teacher clicks "New plan" → form → Server Action createLessonPlan()
  ↓
Server Action: quota check → lib/ai/provider.generatePlan() → INSERT row → revalidatePath
  ↓
Detail view streams chat. Teacher revisions → reviseLessonPlan() Server Action → AI call → UPDATE row
  ↓
"Download PDF" → Server Action returns PDF bytes (react-pdf) → browser saves
```

No new API routes. All mutations are Server Actions per CLAUDE.md rule 12.

## 5. Database Schema

Two new tables in a new migration `006_lesson_plans.sql`.

### `lesson_plans`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` primary key, default `gen_random_uuid()` | |
| `teacher_id` | `uuid not null references auth.users(id) on delete cascade` | Owner. RLS pivot. |
| `course_id` | `uuid not null references courses(id) on delete cascade` | Parent course. |
| `scope` | `text not null check (scope in ('session','unit'))` | Single class vs full unit. |
| `title` | `text not null` | AI-generated or teacher-edited title shown in list. |
| `body_markdown` | `text not null` | Current plan content. Overwritten on each revision. |
| `inputs` | `jsonb not null` | Original form input (subject, grade, duration, topic, learning goals, language). |
| `chat_history` | `jsonb not null default '[]'::jsonb` | Array of `{role: 'user' \| 'assistant', content, created_at}` turns. We store the user instruction and a short assistant ack (e.g. `"Plan updated."`) — NOT the full rewritten markdown, since `body_markdown` already holds the current state. |
| `model` | `text not null` | Model name used (snapshot — provider could change later). |
| `created_at` | `timestamptz not null default now()` | UTC, per CLAUDE.md rule 1. |
| `updated_at` | `timestamptz not null default now()` | Bumped on every revision. |

Indexes:
- `(teacher_id, course_id, updated_at desc)` for list view.
- `(course_id)` for cascade lookups.

### `lesson_plan_usage`

Tracks plan-creation events for monthly quota enforcement.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid primary key default gen_random_uuid()` | |
| `teacher_id` | `uuid not null references auth.users(id) on delete cascade` | |
| `lesson_plan_id` | `uuid references lesson_plans(id) on delete set null` | Soft link; we keep usage row even if plan is deleted. |
| `event` | `text not null check (event in ('generate','revise'))` | Only `generate` counts toward quota. `revise` is logged for analytics. |
| `model` | `text not null` | |
| `input_tokens` | `int` | Nullable — best-effort if provider returns usage. |
| `output_tokens` | `int` | Same. |
| `created_at` | `timestamptz not null default now()` | |

Index: `(teacher_id, created_at desc)`.

Quota check is: `count(*) where teacher_id = $1 and event = 'generate' and created_at >= date_trunc('month', now() at time zone 'Asia/Karachi')`.

### RLS Policies

Add to migration `002_rls.sql` (or a follow-up `006_rls_lesson_plans.sql`):

- `lesson_plans` SELECT/INSERT/UPDATE/DELETE: `teacher_id = auth.uid()` only.
- `lesson_plan_usage` SELECT: `teacher_id = auth.uid()`. INSERT only via service role (Server Actions use service role for the insert? — no, Server Action runs under user session, so the policy is `with check (teacher_id = auth.uid())`).
- Admin (service role) bypasses RLS as usual.

Students have no policy = no access. Per non-goal: plans are teacher-private.

## 6. AI Provider Layer (`lib/ai/`)

```
lib/ai/
  provider.ts        // LessonPlanProvider interface + factory
  anthropic.ts       // Single adapter — Anthropic-compatible (Vercel AI SDK)
  prompts.ts         // System + user prompt templates for generate/revise
  config.ts          // Reads platform_settings + env fallback
```

### Interface

```ts
export interface LessonPlanProvider {
  generatePlan(input: PlanInput): Promise<PlanResult>;
  revisePlan(args: { currentMarkdown: string; chatHistory: ChatTurn[]; instruction: string }): Promise<PlanResult>;
}

export type PlanInput = {
  scope: 'session' | 'unit';
  subject: string;
  gradeLevel: string;
  durationMinutes?: number;     // session only
  weekCount?: number;            // unit only
  topic: string;
  learningGoals: string;
  language: 'english' | 'urdu' | 'roman-urdu';
};

export type PlanResult = {
  title: string;
  bodyMarkdown: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
};

export type ChatTurn = { role: 'user' | 'assistant'; content: string; created_at: string };
```

### Anthropic-Compatible Adapter

Uses `@ai-sdk/anthropic` with `createAnthropic({ baseURL, apiKey })`. Calls `generateText` with a structured prompt that instructs the model to return:

```
TITLE: <short title>
---
<markdown body>
```

We split on the first `---` to extract title + body. If the model misformats, we fall back to using the first H1 in the body as title, or "Untitled plan".

### Config Resolution

`lib/ai/config.ts` reads from `platform_settings` table (admin-controlled, runtime-mutable per CLAUDE.md rule on platform config) with env-var fallback:

| Setting key | Env fallback | Notes |
|---|---|---|
| `ai_provider_base_url` | `AI_BASE_URL` | e.g. `https://api.anthropic.com` or the user's vendor URL. |
| `ai_provider_api_key` | `AI_API_KEY` | Stored encrypted in `platform_settings` (see Section 11). |
| `ai_provider_model` | `AI_MODEL` | e.g. `claude-haiku-4-5`. |
| `ai_lesson_planner_enabled` | — | Default false. Master kill-switch. |

The factory in `lib/ai/provider.ts` returns a single `LessonPlanProvider` built from these. No per-call switching.

### Prompts (`prompts.ts`)

System prompt sets the AI's role: "You are an assistant helping a Pakistani tutor draft a lesson plan." It includes formatting rules (markdown only, no preamble, specific section headings: Objectives / Materials / Warm-up / Main Activity / Assessment / Homework for sessions; Week 1 / Week 2 / … structure for units).

Language handling: when `language === 'urdu'` or `'roman-urdu'`, the system prompt instructs the model to write the plan in that language.

Revision prompt: includes the **full current markdown** plus the chat history (last 5 turns) plus the new instruction. Returns the **full updated plan** — not a diff. Simpler to implement and store.

## 7. UI

### Navigation

Inside the existing course detail page (`app/(teacher)/dashboard/courses/[courseId]/`), add a new tab "Lesson Plans" next to existing tabs (Cohorts / Content / Settings / etc — confirm against current course-page tab list during implementation).

### List view — `courses/[courseId]/lesson-plans/page.tsx`

Server Component. Renders:
- Header with course name + "New plan" button. The button is disabled with a tooltip if quota exhausted or feature disabled.
- Quota chip: "3 of 10 used this month" (Premium shows "Unlimited").
- Table/list of plans: title, scope, updated_at (PKT via `formatPKT()`), actions menu (Open / Download PDF / Delete).
- Empty state: illustration + "Generate your first lesson plan with AI" CTA.

### New plan dialog/page

Modal (shadcn `Dialog`) launched from the "New plan" button. Form fields:
- Scope: radio (Session / Unit)
- Subject: text
- Grade level: text
- Duration (minutes) — shown only if scope=session, default 60
- Week count — shown only if scope=unit, default 4
- Topic: text
- Learning goals: textarea
- Language: select (English / Urdu / Roman Urdu) — default English

On submit: calls `createLessonPlan` Server Action, shows loading state with skeleton, redirects to the detail view on success. On failure (quota, AI error), shows inline error toast.

### Detail / chat view — `courses/[courseId]/lesson-plans/[planId]/page.tsx`

Two-column layout on desktop, stacked on mobile (per CLAUDE.md mobile-first note):
- **Left:** Rendered markdown plan. Use `react-markdown` with `remark-gfm`. Sticky header with title + "Download PDF" + "Delete".
- **Right (or below on mobile):** Chat panel. Shows past turns (user instructions + AI rewrite acknowledgements — we display "Plan updated" rather than dumping the full markdown into chat bubbles, since the left pane already shows current state). Input box at bottom with "Send" button. Submitting calls `reviseLessonPlan` Server Action.

While the AI is working, both the markdown pane and chat input are disabled with a "Revising plan…" indicator.

### Admin Platform Settings additions

In `app/(platform)/admin/settings/` (the existing admin platform settings page), add a new section "AI Lesson Planner":
- Master toggle: `ai_lesson_planner_enabled`
- Base URL (text)
- API key (password input, shows `••••••••` after save; "Replace key" button to enter new one)
- Model name (text)
- "Test connection" button — fires a tiny `generateText` ping against the configured provider/model and shows success or the provider's error message.

## 8. Server Actions

All in `app/(teacher)/dashboard/courses/[courseId]/lesson-plans/actions.ts`.

### `createLessonPlan(formData)`

1. `requireTeacher()` — auth guard.
2. Verify `courseId` belongs to the teacher (RLS will enforce too, but explicit check gives a clear error).
3. Verify cohort archived rule does NOT apply — lesson plans are course-level, not cohort-level. (Plans are still creatable even if a course's cohorts are archived. Confirm during implementation that this matches intent.)
4. `await assertLessonPlanQuota(teacherId)` — throws `QUOTA_EXCEEDED` if over limit.
5. `await assertLessonPlannerEnabled()` — throws `FEATURE_DISABLED` if admin toggle is off.
6. Validate form input with zod.
7. `await provider.generatePlan(input)` — wrap with 60s timeout; on timeout throw `AI_TIMEOUT`.
8. Insert `lesson_plans` row.
9. Insert `lesson_plan_usage` row (`event='generate'`, with token counts if returned).
10. `revalidatePath(...)` and redirect to detail page.

### `reviseLessonPlan(planId, instruction)`

1. Auth + ownership check (RLS will block cross-teacher but we still want clean error messages).
2. `assertLessonPlannerEnabled()`.
3. Validate instruction is non-empty, ≤ 2000 chars.
4. Load current plan.
5. `await provider.revisePlan({ currentMarkdown, chatHistory: plan.chat_history.slice(-5), instruction })`.
6. UPDATE `lesson_plans` SET `body_markdown`, `chat_history = chat_history || new_turns`, `updated_at = now()`.
7. INSERT `lesson_plan_usage` (`event='revise'`).
8. `revalidatePath`.

**Revisions do NOT count against the monthly quota** (we logged separately for analytics). Rationale: once a plan exists, teachers should iterate freely. If revision costs become a problem we add a separate per-plan revision cap in v2.

### `deleteLessonPlan(planId)`

Auth + ownership → `DELETE FROM lesson_plans WHERE id = $1 AND teacher_id = auth.uid()`. Cascade leaves `lesson_plan_usage` rows with null `lesson_plan_id` (still useful for quota counting).

### `exportLessonPlanPdf(planId)`

Auth + ownership. Renders the plan via `@react-pdf/renderer`. Returns `Response` with `application/pdf` and `Content-Disposition: attachment; filename="<sanitized-title>.pdf"`.

## 9. Plan Limits

Add to `constants/plans.ts` (or wherever existing tier definitions live):

| Tier | `lessonPlansPerMonth` |
|---|---|
| Free | 2 |
| Starter | 10 |
| Pro | 50 |
| Premium | unlimited (sentinel: `null` or `Infinity` — match existing convention in `lib/plans/`) |

Add `getLessonPlanLimit(plan)` to `lib/plans/limits.ts` (or extend existing `getLimit(feature, plan)` pattern).

Server-side enforcement in `assertLessonPlanQuota` queries `lesson_plan_usage` for the current calendar month (PKT). UI displays counter via the same helper.

Per CLAUDE.md rule 16: server-side enforcement is mandatory; the disabled "New plan" button is UX-only.

## 10. PDF Generation

Library: `@react-pdf/renderer` (no Chromium / Puppeteer).

PDF layout:
- Header: course name + plan title + generated date (PKT).
- Body: markdown rendered to PDF blocks. We **don't** support full markdown rendering in react-pdf out of the box — we'll write a small renderer that handles: H1/H2/H3, paragraphs, ul/ol, bold, italic, code spans. Tables and images are out of scope for v1 (lesson plans rarely need them).
- Footer: "Generated with Skool Rooms" + page number.

Branding: teacher's display name + subdomain shown in header. Logo support deferred (teachers don't upload logos yet in MVP).

## 11. Security & Secrets

- **API key storage:** `platform_settings.ai_provider_api_key` stored encrypted using the same approach as other secrets in `platform_settings`. If no encryption layer exists yet, we use Postgres pgcrypto with a key from `SETTINGS_ENCRYPTION_KEY` env var. Confirm during implementation what existing settings (e.g. Brevo key, Cloudflare token) do — match that pattern, don't introduce a new one.
- Service role only on the server. The API key never reaches the client.
- The "Test connection" button does NOT echo the key back; only success/failure.
- No prompt injection mitigation needed for v1 — the AI's output is rendered as markdown via `react-markdown` (sanitizes by default; no raw HTML), and the teacher is the only user who sees it. We do strip script-like content from the markdown before storing as a defense-in-depth measure.
- Rate limit Server Actions per-teacher: 1 generation per 10 seconds, 1 revision per 5 seconds. Uses existing in-memory rate limiter per CLAUDE.md tech-stack notes.

## 12. Error Handling

| Error | User-facing message | HTTP-ish code |
|---|---|---|
| Quota exhausted | "You've used all X plans for this month. Upgrade to create more." + upgrade CTA | `QUOTA_EXCEEDED` |
| Feature disabled (admin off) | "AI lesson planning is currently unavailable. Please try later." | `FEATURE_DISABLED` |
| AI timeout (>60s) | "The AI took too long to respond. Please try again." | `AI_TIMEOUT` |
| AI provider error (4xx/5xx) | "Couldn't generate the plan right now. Please try again in a minute." (log full provider response server-side) | `AI_PROVIDER_ERROR` |
| Malformed AI output (no TITLE/--- separator) | Salvage with fallback parser; never user-facing. Log a warning. | — |
| Course not owned by teacher | "Course not found." (don't leak existence) | `NOT_FOUND` |
| Plan deleted while revising | "This plan no longer exists." | `NOT_FOUND` |
| Network failure on PDF download | Browser-handled; no Server Action specific handling. | — |

All user-facing strings should read clearly in plain English (CLAUDE.md user-context note). Urdu translations deferred — feature ships in English UI even when generating Urdu content.

## 13. Edge Cases

- **Course deleted while plan exists:** Cascade deletes plans. No orphaning.
- **Teacher downgrades plan mid-month:** Existing plans remain; new ones blocked once they hit the lower tier's quota. We do **not** retro-delete plans.
- **Admin disables feature mid-revision:** The in-flight Server Action completes (already past the gate). New attempts after the toggle see `FEATURE_DISABLED`.
- **Admin rotates the API key mid-revision:** Mid-flight call uses the old key (already loaded into the provider instance for that request). Next request loads new key. Provider config is read fresh on each Server Action — no long-lived module-scope provider.
- **Teacher generates 2 plans simultaneously while at quota 1/2:** Quota check is read-then-write. Race condition possible. Mitigation: wrap quota check + insert in a single Postgres transaction using `SERIALIZABLE` isolation, OR rely on the in-memory rate limiter's 10s gap which makes this effectively impossible. v1 uses the rate-limiter approach; document the residual risk.
- **AI returns 50KB of markdown:** Cap `body_markdown` at 32KB; if exceeded, truncate with a "…(truncated)" marker. Lesson plans are not novels.
- **Teacher in Roman Urdu generates a plan, then revises with English instruction:** The current plan stays in Roman Urdu; the revision instruction in English is fine — model handles mixed-language context naturally. No special handling.

## 14. Files to Create / Modify

**Create:**
- `lib/ai/provider.ts`
- `lib/ai/anthropic.ts`
- `lib/ai/prompts.ts`
- `lib/ai/config.ts`
- `lib/db/lessonPlans.ts`
- `lib/db/lessonPlanUsage.ts`
- `supabase/migrations/006_lesson_plans.sql`
- `supabase/migrations/006_lesson_plans_rls.sql` (or fold into the above)
- `app/(teacher)/dashboard/courses/[courseId]/lesson-plans/page.tsx`
- `app/(teacher)/dashboard/courses/[courseId]/lesson-plans/[planId]/page.tsx`
- `app/(teacher)/dashboard/courses/[courseId]/lesson-plans/actions.ts`
- `components/teacher/LessonPlanList.tsx`
- `components/teacher/NewLessonPlanDialog.tsx`
- `components/teacher/LessonPlanChat.tsx`
- `components/teacher/LessonPlanPdfDocument.tsx` (react-pdf doc)

**Modify:**
- `constants/plans.ts` — add `lessonPlansPerMonth` to each tier
- `lib/plans/limits.ts` — add `getLessonPlanLimit`
- `types/database.ts` — regenerate after migration
- Course detail page — add "Lesson Plans" tab link
- Admin platform settings page — add AI Provider section
- `nav-items.ts` if course-tab list is centralized there

## 15. Testing

End-to-end happy path:
1. Admin enables feature, sets base URL/key/model, "Test connection" succeeds.
2. Teacher creates a course, opens Lesson Plans tab, generates a session plan → PDF downloads correctly.
3. Teacher revises the plan → updated markdown renders, chat history shows the revision.
4. Free teacher generates 2 plans → 3rd attempt shows quota message.

RLS verification:
- Teacher A creates a plan in Course A. Teacher B (different account) cannot fetch it by ID. Confirmed by hitting `lib/db/lessonPlans.ts` from Teacher B's session.

Provider swap test:
- With base URL pointed at vendor X and a valid key, generation works.
- Change base URL/key to vendor Y in admin (no deploy). Next generation uses vendor Y. Token usage logged correctly.

Mobile check:
- Detail view stacks chat below markdown. Buttons remain tappable. PDF download works on mobile Chrome.

## 16. Rollout

- Ship behind `ai_lesson_planner_enabled = false` default. Admin flips on after smoke-testing in production with their own teacher account.
- No migration data backfill needed.
- No breaking changes to existing tables — purely additive.
- Document in `LESSONS.md` any provider-specific quirks discovered during the first week (e.g. token-limit differences, response-format variance).
