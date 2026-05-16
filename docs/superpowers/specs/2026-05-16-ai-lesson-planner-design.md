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

- Sharing plans with students. Plans are teacher-private.
- Rich text / WYSIWYG editing. Editing happens only through AI chat revisions.
- Per-teacher model selection. The platform admin picks one provider for everyone.
- Multi-provider routing. Single provider per platform.
- Plan templates marketplace, collaborative editing, version branching. All deferred.
- Image generation, diagram insertion, attached files. Plain markdown only.
- PDF caching/archiving. PDFs are generated fresh on every download.
- Urdu UI strings. Feature ships with English UI; generated content can be in English, Urdu, or Roman Urdu.

## 4. Architecture Overview

Three new building blocks:

1. **`lib/ai/`** — provider abstraction. Single adapter for Anthropic-compatible endpoints. Configurable base URL + API key + model.
2. **`lesson_plans` table + `lesson_plan_usage` table** — Postgres storage. RLS-protected per teacher.
3. **Course-scoped UI** — new sub-route `app/(teacher)/dashboard/courses/[courseId]/lesson-plans/` following the existing `curriculum/` sub-route pattern (no tabs).

Data flow:

```
Teacher opens course → "Lesson Plans" sub-route
  ↓
Server Component fetches plans via lib/db/lessonPlans.ts (uses admin client; RLS enforced at DB)
  ↓
Teacher clicks "New plan" → form → Server Action lib/actions/lessonPlans.ts → createLessonPlan
  ↓
Server Action: advisory lock → enabled check → quota check → lib/ai/provider.generatePlan() → INSERT row → INSERT usage row → revalidatePath
  ↓
Detail view shows plan + chat. Teacher revisions → reviseLessonPlan Server Action → AI call → UPDATE row
  ↓
"Download PDF" → GET /api/lesson-plans/[id]/pdf (Route Handler) → streams PDF
```

**API route exception:** The PDF download is the **only** new API route. This is a documented exception to CLAUDE.md rule 12 — the route serves a generated file response, not CRUD. All mutations remain Server Actions.

## 5. Database Schema

Two new tables. Migrations `023_lesson_plans.sql` (schema + indexes) and `024_lesson_plans_rls.sql` (RLS policies + encryption helpers). Latest existing migration is `022_trial_started_at.sql`.

### `lesson_plans`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` primary key, default `gen_random_uuid()` | |
| `teacher_id` | `uuid not null references auth.users(id) on delete cascade` | Owner. RLS pivot. |
| `course_id` | `uuid not null references courses(id) on delete cascade` | Parent course. |
| `scope` | `text not null check (scope in ('session','unit'))` | Single class vs full unit. |
| `title` | `text not null` | AI-generated or fallback "Untitled plan". Max 200 chars. |
| `body_markdown` | `text not null check (length(body_markdown) between 1 and 65536)` | Current plan content. Overwritten on each revision. ~64KB cap. |
| `inputs` | `jsonb not null` | Original form input (subject, grade, duration/weeks, topic, learning goals, language). |
| `chat_history` | `jsonb not null default '[]'::jsonb` | Array of `{role: 'user' \| 'assistant', content, created_at}` turns. Stores user instructions + short assistant acks (e.g. `"Plan updated."`) — NOT the full rewritten markdown, since `body_markdown` holds the current state. |
| `model` | `text not null` | Model name snapshot (provider could change later). |
| `created_at` | `timestamptz not null default now()` | UTC. |
| `updated_at` | `timestamptz not null default now()` | Bumped on every revision. Trigger maintains this. |

Indexes:
- `(teacher_id, course_id, updated_at desc)` for list view.
- `(course_id)` for cascade lookups.

### `lesson_plan_usage`

Tracks generation/revision events for monthly quota enforcement and cost analytics.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid primary key default gen_random_uuid()` | |
| `teacher_id` | `uuid not null references auth.users(id) on delete cascade` | |
| `lesson_plan_id` | `uuid references lesson_plans(id) on delete set null` | Soft link; usage row survives plan deletion (so deletions don't reset quotas mid-month). |
| `event` | `text not null check (event in ('generate','revise'))` | Only `generate` counts toward quota. `revise` is logged for analytics only. |
| `model` | `text not null` | |
| `input_tokens` | `int` | NULL if provider didn't return usage or returned a malformed shape. |
| `output_tokens` | `int` | Same. |
| `created_at` | `timestamptz not null default now()` | |

Index: `(teacher_id, event, created_at desc)` — supports the quota query directly.

### Quota query

```sql
SELECT count(*)
FROM lesson_plan_usage
WHERE teacher_id = $1
  AND event = 'generate'
  AND created_at >= (date_trunc('month', now() AT TIME ZONE 'Asia/Karachi')) AT TIME ZONE 'Asia/Karachi';
```

The inner expression returns the PKT month-start as a `timestamp`; the outer `AT TIME ZONE 'Asia/Karachi'` converts back to a `timestamptz` (UTC) for comparison against `created_at` (which is UTC). This means the quota cycle aligns with Pakistan calendar months.

### RLS Policies

All new policies in `024_lesson_plans_rls.sql`:

- `lesson_plans`: SELECT/INSERT/UPDATE/DELETE WHERE `teacher_id = auth.uid()`.
- `lesson_plan_usage`: SELECT and INSERT (with check) WHERE `teacher_id = auth.uid()`. No UPDATE/DELETE (history is immutable).
- Service role (used by `createAdminClient()` in `lib/db/`) bypasses RLS as standard. `lib/db/lessonPlans.ts` and `lib/db/lessonPlanUsage.ts` must take `teacherId` as an arg and include it in every WHERE clause — same pattern as existing `lib/db/` files.

Students have no policy = no access. Plans are teacher-private.

### Encrypted platform_settings infrastructure

This feature introduces a new pattern: secrets stored in `platform_settings` table, encrypted at rest. Existing secrets (Brevo, R2, Cloudflare) stay in env vars for now — only **new** AI provider settings use the encrypted pattern.

Migration `024_lesson_plans_rls.sql` adds:

```sql
create extension if not exists pgcrypto;

-- Marker column to distinguish encrypted values
alter table platform_settings
  add column if not exists is_encrypted boolean not null default false;

-- Encrypt with pgp_sym_encrypt using a key passed in as a session GUC
-- so we never store the encryption key in the database.
create or replace function set_encrypted_setting(p_key text, p_value text, p_encryption_key text)
returns void language plpgsql security definer as $$
begin
  insert into platform_settings (key, value, is_encrypted, updated_at)
  values (p_key, encode(pgp_sym_encrypt(p_value, p_encryption_key), 'base64'), true, now())
  on conflict (key) do update
    set value = excluded.value,
        is_encrypted = true,
        updated_at = now();
end;
$$;

create or replace function get_decrypted_setting(p_key text, p_encryption_key text)
returns text language plpgsql security definer as $$
declare v text;
begin
  select value into v from platform_settings where key = p_key and is_encrypted = true;
  if v is null then return null; end if;
  return pgp_sym_decrypt(decode(v, 'base64'), p_encryption_key);
end;
$$;
```

`SETTINGS_ENCRYPTION_KEY` env var (added to Vercel) is passed in as `p_encryption_key`. Server-only — never reaches the client. Key rotation deferred to a separate maintenance task (re-encrypt all rows with new key in a single transaction).

`lib/platform/settings.ts` gets two new helpers:
- `getEncryptedSetting(key: string): Promise<string | null>` — calls `get_decrypted_setting` RPC.
- `setEncryptedSetting(key: string, value: string): Promise<void>` — calls `set_encrypted_setting` RPC.

Both use `createAdminClient()` (service role).

## 6. AI Provider Layer (`lib/ai/`)

```
lib/ai/
  provider.ts        // LessonPlanProvider interface + factory
  anthropic.ts       // Single adapter — Anthropic-compatible (Vercel AI SDK)
  prompts.ts         // System + user prompt templates for generate/revise
  config.ts          // Reads platform_settings + env fallback
```

### Dependencies to add

`package.json`:
- `ai` (Vercel AI SDK core)
- `@ai-sdk/anthropic`
- `@react-pdf/renderer` (already present per codebase audit)
- `react-markdown` + `remark-gfm` (for in-app rendering)

### Interface

```ts
export interface LessonPlanProvider {
  generatePlan(input: PlanInput): Promise<PlanResult>;
  revisePlan(args: {
    currentMarkdown: string;
    chatHistory: ChatTurn[];
    instruction: string;
  }): Promise<PlanResult>;
  testConnection(): Promise<{ ok: true } | { ok: false; error: string }>;
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

Uses `@ai-sdk/anthropic`:

```ts
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

const anthropic = createAnthropic({ baseURL, apiKey });
const result = await generateText({
  model: anthropic(modelName),
  system: SYSTEM_PROMPT,
  prompt: userPrompt,
  maxTokens: 4096,
});
```

The adapter accepts `{ baseURL, apiKey, model }` from `config.ts`. Most third-party Anthropic-compatible providers work by simply pointing `baseURL` at their endpoint.

**Output format:** AI must return:

```
TITLE: <short title>
---
<markdown body>
```

We split on the first `---` line to extract title + body. Fallback parsing:
1. If no `---`, use the first H1 in body as title; full output as body.
2. If body is empty or whitespace-only after parsing → throw `AI_PROVIDER_ERROR` (treat as a bad response).
3. If title is empty → use "Untitled plan".
4. Title is truncated to 200 chars; body is truncated to 65536 bytes (64KB) with a `…(truncated)` marker if exceeded.

**Token usage capture:** AI SDK's `generateText` returns `usage.{promptTokens,completionTokens,totalTokens}`. Third-party providers may not return usage or may return a different shape. The adapter wraps usage extraction in a try/catch and returns `undefined` for both fields if anything goes wrong. We never throw on missing usage.

**`testConnection()`:** sends a 1-token "ping" prompt. Returns `{ok: true}` if any non-empty response, `{ok: false, error: <provider message or 'Unknown error'>}` otherwise.

### Config Resolution

`lib/ai/config.ts` reads from `platform_settings` with env-var fallback. Re-read on every call (no module-scope caching) so admin changes take effect immediately:

| Setting key | Storage | Env fallback | Notes |
|---|---|---|---|
| `ai_lesson_planner_enabled` | plain | — | boolean. Default false. Master kill-switch. |
| `ai_provider_base_url` | plain | `AI_BASE_URL` | e.g. `https://api.anthropic.com` |
| `ai_provider_model` | plain | `AI_MODEL` | e.g. `claude-haiku-4-5` |
| `ai_provider_api_key` | **encrypted** | `AI_API_KEY` | Stored via `set_encrypted_setting`; read via `get_decrypted_setting`. |

`getProviderConfig()` returns `{ enabled, baseURL, apiKey, model }`. If any required field is missing → returns `{ enabled: false, ... }`, which means `assertLessonPlannerEnabled()` throws `FEATURE_DISABLED`.

`testConnection()` takes optional **candidate** values `{baseURL, apiKey, model}` so the admin can test new credentials before saving:

```ts
async function testProviderConnection(candidate?: Partial<ProviderConfig>) {
  const config = { ...await getProviderConfig(), ...candidate };
  return makeProvider(config).testConnection();
}
```

### Prompts (`prompts.ts`)

System prompt sets the AI's role and formatting rules. Includes:
- Markdown only, no preamble or trailing commentary.
- Specific section headings for sessions: Objectives / Materials / Warm-up / Main Activity / Assessment / Homework.
- Specific structure for units: Week 1 / Week 2 / … with weekly Objectives + Activities + Assessment.
- Output format header (`TITLE: ... \n--- \n ...`).
- Pakistani educational context note (CBSE/Cambridge/Federal Board awareness; metric units; PKR currency in any cost-related examples).

Language handling: when `language === 'urdu'` or `'roman-urdu'`, system prompt instructs the model to write the **body content** in that language. Section headings stay in English for consistent parsing. Roman Urdu = Urdu transliterated in Latin script (common with Pakistani teachers).

Revision prompt: includes the **full current markdown** + the chat history (last 5 turns, each truncated to 500 chars) + the new instruction. Asks the model to return the **full updated plan** in the same TITLE/--- format. Not a diff.

## 7. UI

### Routing

Sub-route under the existing course page, matching the `curriculum/` precedent:

```
app/(teacher)/dashboard/courses/[courseId]/lesson-plans/page.tsx     # list
app/(teacher)/dashboard/courses/[courseId]/lesson-plans/[planId]/page.tsx  # detail + chat
```

Course page navigation (existing breadcrumb / side links) gets a "Lesson Plans" link.

### List view

Server Component. Renders:
- Header with course name + "New plan" button. Button is disabled (with tooltip) if quota exhausted, feature disabled, or course soft-deleted.
- Quota chip: "3 of 10 used this month" — Academy/unlimited shows "Unlimited".
- List of plans: title, scope badge, `updated_at` (PKT via `formatPKT()`), actions menu (Open / Download PDF / Delete).
- Empty state: "Generate your first lesson plan with AI" CTA.

### New plan dialog

shadcn `Dialog` launched from the "New plan" button. Form fields:
- Scope: radio (Session / Unit) — default Session
- Subject: text (required, ≤100 chars)
- Grade level: text (required, ≤50 chars)
- Duration (minutes): number, shown only when Session, default 60, range 15–240
- Week count: number, shown only when Unit, default 4, range 1–24
- Topic: text (required, ≤200 chars)
- Learning goals: textarea (required, ≤2000 chars)
- Language: select (English / Urdu / Roman Urdu) — default English

On submit: optimistic loading state with a skeleton; calls `createLessonPlan` Server Action; on success redirects to detail page; on failure shows inline error toast with the message from the error table in Section 12.

### Detail view (desktop)

Two-column layout:
- **Left:** Rendered markdown plan via `react-markdown` + `remark-gfm`. Sticky header with title + "Download PDF" button + "Delete" menu.
- **Right:** Chat panel. Past turns shown as bubbles (user instruction + a short `"Plan updated."` ack from the assistant). Input box at the bottom with "Send" button. Submitting calls `reviseLessonPlan`.

While AI is working, both panels are disabled with a "Revising plan…" indicator and a cancel button (cancels the client-side loading state only; the server call still completes — its result will be reflected on the next page refresh via `revalidatePath`).

### Detail view (mobile)

The desktop two-column layout doesn't work on mobile — stacking chat below the markdown would force teachers to scroll past the entire plan to revise. Instead:

- Full-width markdown view.
- Floating action button bottom-right: "Revise with AI" with a sparkle icon.
- Tapping it opens a shadcn `Sheet` (slide-up drawer, ~80% viewport height) containing the chat panel.
- After a successful revision, the sheet stays open with the new turn visible; the markdown behind it refreshes via `revalidatePath`.

### Admin Platform Settings additions

New section "AI Lesson Planner" in the existing `app/(platform)/admin/settings/` form:

- Master toggle: `ai_lesson_planner_enabled`
- Base URL (text input)
- Model name (text input)
- API key: write-only password input. On load, shows `••••••••` if a key is set (server returns `{has_key: true}` not the value). A "Replace key" button reveals an empty input for a new value. The form submits the new key only when the input is non-empty (avoiding accidental clears).
- "Test connection" button: submits **candidate values** from the current form state (even if unsaved) to a `testAIProviderAction` Server Action. Returns success or provider error message.
- Save button: persists all four settings. Encrypted setting only updates if the API key input is non-empty.

## 8. Server Actions

All in `lib/actions/lessonPlans.ts` (matching existing convention — Server Actions live in `lib/actions/`, not colocated with pages).

All Server Action files: `export const maxDuration = 60;` to allow up to 60s for AI calls (Vercel Pro supports this).

### `createLessonPlan(formData)`

1. `await requireTeacher()` — auth guard.
2. `await pg.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [teacherId])` — serializes generations per teacher (race-condition fix). Wrapped in a Postgres transaction.
3. Verify `courseId` belongs to the teacher (RLS will block too, but explicit check yields a cleaner error).
4. `await assertLessonPlannerEnabled()` — throws `FEATURE_DISABLED` if admin toggle is off.
5. `await assertLessonPlanQuota(teacherId)` — throws `QUOTA_EXCEEDED` if over limit (uses query from Section 5).
6. `await rateLimit(teacherId + ':gen', 1, 10_000)` — 1 generation per 10s as a UX guard (cheap defense before AI cost is incurred).
7. Validate form input with zod.
8. `await getProviderConfig()` → build provider → `provider.generatePlan(input)`, with a 60s timeout. On timeout throw `AI_TIMEOUT`. On thrown provider error throw `AI_PROVIDER_ERROR` (full provider message logged server-side, generic message shown to user).
9. INSERT `lesson_plans` row.
10. INSERT `lesson_plan_usage` row (`event='generate'`, with token counts or NULL).
11. Commit transaction → `revalidatePath(...)` → return `{ id }`.

The advisory lock + transaction means: if a duplicate submit arrives while the first is mid-AI-call, it blocks until the first commits, then sees the freshly-inserted usage row in the quota count and throws `QUOTA_EXCEEDED` (if appropriate). No duplicate plans.

### `reviseLessonPlan(planId, instruction)`

1. `await requireTeacher()`.
2. `await assertLessonPlannerEnabled()`.
3. Validate `instruction`: non-empty, ≤2000 chars.
4. Load current plan (filter by `teacher_id` for ownership — also enforced by RLS).
5. `await rateLimit(teacherId + ':rev', 1, 5_000)` — 1 revision per 5s.
6. `provider.revisePlan({ currentMarkdown, chatHistory: plan.chat_history.slice(-5), instruction })` with 60s timeout.
7. UPDATE `lesson_plans` SET `body_markdown`, `title` (if AI revised it), `chat_history = chat_history || jsonb_build_array(<user_turn>, <assistant_ack_turn>)`, `updated_at = now()`.
8. INSERT `lesson_plan_usage` (`event='revise'`).
9. `revalidatePath`.

**Revisions do NOT count against the monthly quota.** Rationale: once a plan exists, teachers should iterate freely. If revision costs become a problem, v2 adds a per-plan revision cap.

### `deleteLessonPlan(planId)`

`requireTeacher()` → `DELETE FROM lesson_plans WHERE id = $1 AND teacher_id = $teacherId`. Cascade leaves `lesson_plan_usage` rows with `lesson_plan_id = null` so quotas remain accurate.

### `testAIProviderAction(candidate)`

Admin-only (`requireAdmin()`). Accepts optional `{baseURL, apiKey, model}` candidate values. Calls `testProviderConnection(candidate)`. Returns `{ok, error?}`. Never logs or stores the candidate API key.

## 9. PDF Generation

**Route Handler:** `app/api/lesson-plans/[id]/pdf/route.ts` (GET). Documented exception to CLAUDE.md rule 12 — this serves a generated file, not CRUD.

Handler flow:
1. `await requireTeacher()` — same auth as Server Actions.
2. Load plan by id, scoped to `teacher_id` (RLS + explicit filter).
3. If not found → 404.
4. Render via `@react-pdf/renderer` → `Response` with `application/pdf`, `Content-Disposition: attachment; filename="<sanitized-title>.pdf"`.

PDF layout:
- Header: teacher display name + course name + plan title + generated date in PKT.
- Body: a small markdown-to-react-pdf renderer (in `components/teacher/LessonPlanPdfDocument.tsx`) handling: H1/H2/H3, paragraphs, ul/ol (nested up to 2 levels), bold, italic, code spans. Tables and images: out of scope for v1.
- Footer: "Generated with Skool Rooms" + page number.

PDFs are regenerated on every download. No caching to R2 — plans change with every revision, so a cached PDF would be stale by definition.

## 10. Plan Limits

Existing plan tiers (verified in codebase): `free`, `solo`, `academy`.

Add to plan limit definitions (`constants/plans.ts` or `lib/plans/limits.ts` per existing pattern):

| Tier | `lesson_plans_per_month` |
|---|---|
| `free` | 2 |
| `solo` | 25 |
| `academy` | unlimited (sentinel: existing convention — likely `null` or `-1`, match what `max_courses`/`max_students` use) |

`getLimit(teacherId, 'lesson_plans_per_month')` follows existing API. Add corresponding column to the `plans` table if that's the existing pattern (audit during implementation).

`assertLessonPlanQuota(teacherId)`:
1. Look up teacher's current plan via `teacher_subscriptions`. If no active subscription found → default to `free`.
2. Get limit. If unlimited → return.
3. Count `lesson_plan_usage` rows where `event='generate'` and `created_at >= PKT month start`.
4. If count ≥ limit → throw `QUOTA_EXCEEDED`.

UI displays the counter via the same helper. Per CLAUDE.md rule 16: server-side enforcement is mandatory; the disabled "New plan" button is UX-only.

## 11. Security & Secrets

- **API key storage:** Encrypted in `platform_settings` via `pgp_sym_encrypt` (Section 5). Encryption key in `SETTINGS_ENCRYPTION_KEY` env var (added to Vercel). Decryption only happens server-side inside Server Actions / Route Handlers.
- **Service role only on server.** The API key never reaches the client.
- **"Test connection" button** does NOT echo the key back; only success/failure. Candidate key submitted via Server Action runs the test inline and is discarded.
- **Markdown rendering:** `react-markdown` sanitizes by default (no raw HTML). We additionally strip `<script>`, `<iframe>`, and `javascript:` URI patterns before storing `body_markdown` (defense-in-depth, even though only the teacher sees their own plans).
- **Rate limit Server Actions per-teacher:**
  - Generation: 1 per 10 seconds (`rateLimit(teacherId + ':gen', 1, 10_000)`)
  - Revision: 1 per 5 seconds (`rateLimit(teacherId + ':rev', 1, 5_000)`)
  - Test connection (admin): 1 per 5 seconds
  Uses existing `lib/rate-limit.ts`.
- **Vercel function timeout:** `export const maxDuration = 60;` on all Server Action files and the PDF Route Handler. Requires Vercel Pro (already required for wildcard SSL).

## 12. Error Handling

All errors thrown by Server Actions are caught at the page/component level and surfaced via toast or inline error.

| Error code | User-facing message | When |
|---|---|---|
| `QUOTA_EXCEEDED` | "You've used all X plans for this month. Upgrade to create more." + upgrade CTA | Quota check fails |
| `FEATURE_DISABLED` | "AI lesson planning is currently unavailable. Please try again later." | Master toggle off or config missing |
| `AI_TIMEOUT` | "The AI took too long to respond. Please try again." | 60s timeout |
| `AI_PROVIDER_ERROR` | "Couldn't generate the plan right now. Please try again in a minute." | Provider 4xx/5xx, empty response, or malformed output. Full provider response logged server-side. |
| `RATE_LIMITED` | "Slow down a bit — try again in a few seconds." | Hits rate limiter |
| `NOT_FOUND` | "Lesson plan not found." | Plan ID invalid or not owned by teacher |
| `COURSE_NOT_FOUND` | "Course not found." | Course missing or not owned |
| `VALIDATION_FAILED` | Field-specific message from zod | Form input invalid |

All user-facing strings in plain English (CLAUDE.md user-context note). Provider errors are NEVER passed through verbatim to the user (could leak internal details or be confusing).

## 13. Edge Cases

- **Course deleted / soft-deleted while plan exists:** Hard delete cascades to plans. Soft delete (`deleted_at`) — list view filters `deleted_at IS NULL`; new-plan button disabled if course is soft-deleted.
- **Teacher downgrades plan mid-month:** Existing plans remain; new ones blocked once they hit the lower tier's quota for the current month.
- **Teacher with no active subscription:** Treated as `free`. (Confirm against existing `getLimit()` behavior — match it.)
- **Admin disables feature mid-revision:** In-flight Server Action completes (already past the gate). Next attempt sees `FEATURE_DISABLED`.
- **Admin rotates API key mid-revision:** In-flight call uses the loaded key. Next request loads new key from `platform_settings` (no module-scope caching in `lib/ai/config.ts`).
- **Concurrent generations from one teacher (race condition):** Postgres advisory lock per teacher (Section 8) serializes them. Second request blocks ~5-30s waiting for the first; on resume sees fresh quota state.
- **AI returns 100KB markdown:** Truncated to 64KB with a `…(truncated)` marker. Logged for analytics.
- **AI returns empty / whitespace-only output:** Treated as `AI_PROVIDER_ERROR`. Plan is not created. Quota not consumed (transaction rolls back).
- **Provider returns malformed usage object:** Token fields stored as NULL; no error.
- **Teacher in Roman Urdu generates a plan, then revises with English instruction:** Mixed-language context — model handles naturally. No special handling.
- **Client-side timeout but server completed (idempotency):** Not addressed in v1. Documented limitation: teacher refreshes → may see the plan was created. If they re-submit before seeing it, advisory lock + the freshly-inserted usage row will trigger `QUOTA_EXCEEDED` for Free tier (limit was 2, now 1 was used by the orphan attempt) — surfacing a confusing message. v2: idempotency key based on form hash.
- **Encryption key (`SETTINGS_ENCRYPTION_KEY`) missing or wrong:** Decryption returns NULL. `getProviderConfig()` returns `enabled: false`. Feature gracefully disables. Admin sees a clear "configuration error" state.
- **First-time setup (settings rows don't exist yet):** All `get*` helpers return NULL. Feature is disabled. Admin form shows empty inputs; saving creates the rows.

## 14. Files to Create / Modify

**Create:**
- `lib/ai/provider.ts`
- `lib/ai/anthropic.ts`
- `lib/ai/prompts.ts`
- `lib/ai/config.ts`
- `lib/db/lessonPlans.ts`
- `lib/db/lessonPlanUsage.ts`
- `lib/actions/lessonPlans.ts` (Server Actions)
- `lib/actions/adminAIProvider.ts` (test connection action)
- `supabase/migrations/023_lesson_plans.sql`
- `supabase/migrations/024_lesson_plans_rls.sql` (includes pgcrypto + encrypted-settings helpers)
- `app/(teacher)/dashboard/courses/[courseId]/lesson-plans/page.tsx`
- `app/(teacher)/dashboard/courses/[courseId]/lesson-plans/[planId]/page.tsx`
- `app/api/lesson-plans/[id]/pdf/route.ts`
- `components/teacher/LessonPlanList.tsx`
- `components/teacher/NewLessonPlanDialog.tsx`
- `components/teacher/LessonPlanChat.tsx`
- `components/teacher/LessonPlanChatSheet.tsx` (mobile drawer)
- `components/teacher/LessonPlanPdfDocument.tsx`
- `components/admin/AIProviderSettings.tsx`

**Modify:**
- `package.json` — add `ai`, `@ai-sdk/anthropic`, `react-markdown`, `remark-gfm`
- `lib/platform/settings.ts` — add `getEncryptedSetting` / `setEncryptedSetting`
- Existing plan limits file (`constants/plans.ts` or `lib/plans/limits.ts`) — add `lesson_plans_per_month` to free/solo/academy
- Existing course detail page — add "Lesson Plans" link
- Existing admin platform settings form / page — embed `<AIProviderSettings />`
- `types/database.ts` — regenerate after migration
- `.env.example` — add `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `SETTINGS_ENCRYPTION_KEY`

## 15. Testing

End-to-end happy path:
1. Admin sets `SETTINGS_ENCRYPTION_KEY` in Vercel, enables feature, sets base URL/key/model, "Test connection" succeeds.
2. Free teacher creates a course, opens Lesson Plans, generates a session plan → PDF downloads with correct branded header.
3. Teacher revises ("make it 30 min") → markdown updates; chat shows the instruction + ack.
4. Free teacher generates 2 plans → 3rd attempt shows `QUOTA_EXCEEDED`.
5. Admin rotates the API key → teacher's next generation uses new key (verify by intentionally setting wrong base URL and seeing `AI_PROVIDER_ERROR`).

Race-condition test:
- Free teacher with 1/2 used. Open two browser tabs, generate simultaneously. Verify exactly one plan is created and the other tab shows `QUOTA_EXCEEDED`.

RLS verification:
- Teacher A creates a plan. Teacher B (different account, same course id used in URL) cannot fetch it via the detail page or the PDF route → 404.

Mobile check (Chrome on a real Android device, since teachers are mobile-heavy):
- Detail view: markdown full-width, "Revise with AI" FAB visible, tapping opens Sheet, revision works, PDF download works.

Encryption check:
- After setting the API key, verify the row in `platform_settings` contains base64-encoded ciphertext, not the plaintext key.
- Rotate `SETTINGS_ENCRYPTION_KEY` in env (without re-encrypting rows) → feature disables gracefully (decryption fails, returns NULL).

## 16. Rollout

- Ship behind `ai_lesson_planner_enabled = false` by default. Admin enables after smoke-testing on production with their own teacher account.
- Add `SETTINGS_ENCRYPTION_KEY` to Vercel **before** deploy (32+ random bytes, base64-encoded).
- No data backfill. Purely additive.
- Document in `LESSONS.md` any provider quirks discovered during the first week (token-limit differences, response-format variance, latency outliers).
