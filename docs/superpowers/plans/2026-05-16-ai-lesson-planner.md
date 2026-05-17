# AI Lesson Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an in-platform AI lesson planner so teachers generate, revise, and PDF-export session/unit plans without leaving Skool Rooms.

**Architecture:** New `lib/ai/` provider abstraction (Anthropic-compatible, baseURL-configurable). Two new tables (`lesson_plans`, `lesson_plan_usage`) with RLS. New `pgcrypto`-backed encrypted-settings infrastructure for the AI API key. Course sub-route at `/dashboard/courses/[courseId]/lesson-plans/`. PDF via Route Handler (documented exception to the "no API routes for CRUD" rule). Quota race fixed with a Postgres advisory lock per teacher.

**Tech Stack:** Next.js 16 (Server Components + Server Actions), Supabase (Postgres + RLS), Vercel AI SDK (`ai` + `@ai-sdk/anthropic`), `@react-pdf/renderer`, `react-markdown` + `remark-gfm`, shadcn/ui, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-05-16-ai-lesson-planner-design.md` — read it before starting.

**Testing convention:** The project has no automated test framework. Each task's "verify" step describes how to manually check the change. Don't add a test framework — that's out of scope.

## Verified Codebase Conventions (use these exact imports/names)

These were verified by inspecting the codebase. The plan's earlier code samples may show old/wrong paths — when in doubt, use these:

| Need | Exact import / API |
|---|---|
| Admin Supabase client (service role) | `import { createAdminClient } from '@/supabase/server'` |
| Auth guards | `import { requireTeacher, requireAdmin } from '@/lib/auth/guards'` |
| Platform settings | `import { getPlatformSetting } from '@/lib/platform/settings'` — returns `Promise<string \| null>` |
| Rate limiter | `import { rateLimit } from '@/lib/rate-limit'` — `rateLimit(key, maxRequests, windowMs)` returns `{ allowed, remaining }` |
| Plan limit lookup | `import { getLimit } from '@/lib/plans/limits'` — `getLimit(teacherId, limitKey)`. **Existing `LimitKey` union must be extended** to add `'lesson_plans_per_month'`. |
| PKT formatter | `import { formatPKT } from '@/lib/time/pkt'` — signature is `formatPKT(date, format)` where format is `'date' \| 'time' \| 'datetime' \| 'relative'`. Use `'datetime'` for full timestamps, `'date'` for date-only. |
| Toasts | Sonner. `import { toast } from 'sonner'`. Use `toast.success('...')`, `toast.error('...', { description })`. **No `useToast` hook exists** — replace all uses of `useToast()` in the plan samples accordingly. |
| Plan tier column | `plans.slug` (NOT `tier` or `name`). Values: `'free'`, `'solo'`, `'academy'`. Type: `PlanSlug` in `types/domain.ts`. |
| Path alias `@/` | Resolves to project root (`tsconfig.json paths: { "@/*": ["./*"] }`). |
| Migration command | No project script. Run `npx supabase db push` manually after writing each migration. |
| tsx runner | Not installed as devDep; use `npx tsx` ad hoc (matches existing `validate-env` script). |
| Missing shadcn primitive | `radio-group` is NOT in `components/ui/`. Task 17 must install it: `npx shadcn@latest add radio-group`. All other primitives this plan needs (dialog, select, textarea, sheet, switch, label, input, button) are already present. |

---

## File Map

**New files:**
- `lib/ai/provider.ts` — interface + factory
- `lib/ai/anthropic.ts` — Anthropic-compatible adapter
- `lib/ai/prompts.ts` — generate/revise prompt templates
- `lib/ai/config.ts` — reads platform_settings + env fallback
- `lib/db/lessonPlans.ts` — DB service (CRUD)
- `lib/db/lessonPlanUsage.ts` — DB service (usage events)
- `lib/actions/lessonPlans.ts` — Server Actions
- `lib/actions/adminAIProvider.ts` — admin test-connection action
- `supabase/migrations/023_lesson_plans.sql` — schema
- `supabase/migrations/024_lesson_plans_rls_and_encryption.sql` — RLS + pgcrypto helpers
- `app/(teacher)/dashboard/courses/[courseId]/lesson-plans/page.tsx` — list view
- `app/(teacher)/dashboard/courses/[courseId]/lesson-plans/[planId]/page.tsx` — detail view
- `app/api/lesson-plans/[id]/pdf/route.ts` — PDF download
- `components/teacher/LessonPlanList.tsx`
- `components/teacher/NewLessonPlanDialog.tsx`
- `components/teacher/LessonPlanChat.tsx` (desktop side panel)
- `components/teacher/LessonPlanChatSheet.tsx` (mobile drawer)
- `components/teacher/LessonPlanPdfDocument.tsx` (react-pdf doc)
- `components/admin/AIProviderSettings.tsx`

**Modified files:**
- `package.json` — add `ai`, `@ai-sdk/anthropic`, `react-markdown`, `remark-gfm`
- `lib/platform/settings.ts` — add `getEncryptedSetting`, `setEncryptedSetting`
- Plan limits file (audit during Task 9) — add `lesson_plans_per_month`
- Existing course detail page — add "Lesson Plans" nav link
- Existing admin platform-settings form — embed `<AIProviderSettings />`
- `.env.example` — add `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `SETTINGS_ENCRYPTION_KEY`

---

## Task 1: Install dependencies & env vars

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Install AI + markdown libraries**

Run:
```
npm install ai @ai-sdk/anthropic react-markdown remark-gfm
```

Expected: packages added to `dependencies`, lockfile updated. No type errors at install time.

- [ ] **Step 2: Add env var placeholders**

Add to `.env.example`:
```
# AI Lesson Planner (Anthropic-compatible provider)
AI_BASE_URL=https://api.anthropic.com
AI_API_KEY=
AI_MODEL=claude-haiku-4-5

# Encryption key for sensitive platform_settings rows
# Generate: openssl rand -base64 48
SETTINGS_ENCRYPTION_KEY=
```

- [ ] **Step 3: Set local dev env vars**

In your local `.env.local`, set real values for `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, and generate a `SETTINGS_ENCRYPTION_KEY` with `openssl rand -base64 48` (or any 48-byte random base64 string). These are local dev only — production Vercel env is set later in Task 21.

- [ ] **Step 4: Verify dev server boots**

Run: `npm run dev`
Expected: server starts on :3000 without env-validation errors. (If `scripts/validate-env.ts` enforces these vars, you'll see a clean boot. If it complains about the new vars, register them in that script following the existing pattern.)

- [ ] **Step 5: Commit**

```
git add package.json package-lock.json .env.example
git commit -m "chore(deps): add Vercel AI SDK + markdown libs for lesson planner"
```

---

## Task 2: Database migration — `lesson_plans` and `lesson_plan_usage` tables

**Files:**
- Create: `supabase/migrations/023_lesson_plans.sql`

- [ ] **Step 1: Verify migration number is free**

Run: `ls supabase/migrations/`
Expected: latest existing is `022_*`. If `023_*` is already taken, bump to next free number and update all references throughout this plan.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/023_lesson_plans.sql`:

```sql
-- AI lesson planner schema.
-- Two tables: plans + usage events. RLS in 024.

create table public.lesson_plans (
  id              uuid primary key default gen_random_uuid(),
  teacher_id      uuid not null references auth.users(id) on delete cascade,
  course_id       uuid not null references public.courses(id) on delete cascade,
  scope           text not null check (scope in ('session','unit')),
  title           text not null check (length(title) between 1 and 200),
  body_markdown   text not null check (length(body_markdown) between 1 and 65536),
  inputs          jsonb not null,
  chat_history    jsonb not null default '[]'::jsonb,
  model           text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index lesson_plans_teacher_course_updated_idx
  on public.lesson_plans (teacher_id, course_id, updated_at desc);
create index lesson_plans_course_idx
  on public.lesson_plans (course_id);

-- Maintain updated_at on revision
create or replace function public.touch_lesson_plan_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger lesson_plans_touch_updated_at
  before update on public.lesson_plans
  for each row execute function public.touch_lesson_plan_updated_at();

create table public.lesson_plan_usage (
  id              uuid primary key default gen_random_uuid(),
  teacher_id      uuid not null references auth.users(id) on delete cascade,
  lesson_plan_id  uuid references public.lesson_plans(id) on delete set null,
  event           text not null check (event in ('generate','revise')),
  model           text not null,
  input_tokens    int,
  output_tokens   int,
  created_at      timestamptz not null default now()
);

create index lesson_plan_usage_teacher_event_created_idx
  on public.lesson_plan_usage (teacher_id, event, created_at desc);
```

- [ ] **Step 3: Apply locally**

Run: `npx supabase db push` (or whichever migration command the project uses — check `BUILD_PLAN.md` or recent migration commits).

Expected: migration applies cleanly. If there's no `gen_random_uuid()`, the `001_initial_schema.sql` should already enable `pgcrypto` — verify.

- [ ] **Step 4: Verify tables exist**

In Supabase SQL editor or `psql`:
```sql
\d public.lesson_plans
\d public.lesson_plan_usage
```
Expected: both tables present with all columns and the two indexes per table.

- [ ] **Step 5: Commit**

```
git add supabase/migrations/023_lesson_plans.sql
git commit -m "feat(db): lesson_plans and lesson_plan_usage tables"
```

---

## Task 3: Database migration — RLS + encrypted-settings helpers

**Files:**
- Create: `supabase/migrations/024_lesson_plans_rls_and_encryption.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/024_lesson_plans_rls_and_encryption.sql`:

```sql
-- RLS for lesson_plans tables, plus encrypted-settings infrastructure
-- for the AI provider API key.

-- ============= RLS =============

alter table public.lesson_plans enable row level security;
alter table public.lesson_plan_usage enable row level security;

create policy lesson_plans_owner_all
  on public.lesson_plans
  for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy lesson_plan_usage_owner_select
  on public.lesson_plan_usage
  for select
  using (teacher_id = auth.uid());

create policy lesson_plan_usage_owner_insert
  on public.lesson_plan_usage
  for insert
  with check (teacher_id = auth.uid());

-- ============= Encrypted platform_settings =============

create extension if not exists pgcrypto;

alter table public.platform_settings
  add column if not exists is_encrypted boolean not null default false;

create or replace function public.set_encrypted_setting(
  p_key text,
  p_value text,
  p_encryption_key text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.platform_settings (key, value, is_encrypted, updated_at)
  values (p_key, encode(pgp_sym_encrypt(p_value, p_encryption_key), 'base64'), true, now())
  on conflict (key) do update
    set value = excluded.value,
        is_encrypted = true,
        updated_at = now();
end;
$$;

create or replace function public.get_decrypted_setting(
  p_key text,
  p_encryption_key text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v text;
begin
  select value into v
  from public.platform_settings
  where key = p_key and is_encrypted = true;

  if v is null then return null; end if;

  begin
    return pgp_sym_decrypt(decode(v, 'base64'), p_encryption_key);
  exception when others then
    -- Wrong key or corrupt data — return null rather than throw,
    -- so the feature degrades gracefully.
    return null;
  end;
end;
$$;

-- Restrict RPC execution to service role only
revoke all on function public.set_encrypted_setting(text, text, text) from public;
revoke all on function public.get_decrypted_setting(text, text) from public;
grant execute on function public.set_encrypted_setting(text, text, text) to service_role;
grant execute on function public.get_decrypted_setting(text, text) to service_role;
```

- [ ] **Step 2: Apply migration**

Run the project's migration command. Expected: clean apply.

- [ ] **Step 3: Verify RLS isolation manually**

In Supabase SQL editor (as `authenticated` role, simulating a teacher):

```sql
-- Set auth.uid() to some valid teacher_id, then:
select * from lesson_plans where teacher_id <> auth.uid();
```
Expected: 0 rows even if data exists for other teachers.

- [ ] **Step 4: Smoke-test encryption RPCs**

In SQL editor as service role:
```sql
select set_encrypted_setting('test_key', 'hello-world', 'my-encryption-key');
select get_decrypted_setting('test_key', 'my-encryption-key');  -- → 'hello-world'
select get_decrypted_setting('test_key', 'wrong-key');           -- → NULL
select value from platform_settings where key='test_key';        -- → base64 ciphertext, NOT 'hello-world'
delete from platform_settings where key='test_key';
```

- [ ] **Step 5: Commit**

```
git add supabase/migrations/024_lesson_plans_rls_and_encryption.sql
git commit -m "feat(db): RLS for lesson plans and encrypted platform_settings infra"
```

---

## Task 4: Regenerate database types

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Regenerate**

Run: `npx supabase gen types typescript --local > types/database.ts` (use the exact command the project uses for type generation — check existing scripts).

Expected: `Database['public']['Tables']['lesson_plans']` and `Database['public']['Tables']['lesson_plan_usage']` appear; `Database['public']['Functions']['set_encrypted_setting']` and `get_decrypted_setting` appear.

- [ ] **Step 2: Verify no type breakage**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```
git add types/database.ts
git commit -m "chore(types): regenerate after lesson planner migration"
```

---

## Task 5: Encrypted-settings helpers in `lib/platform/settings.ts`

**Files:**
- Modify: `lib/platform/settings.ts`

- [ ] **Step 1: Inspect current file**

Read `lib/platform/settings.ts` to see existing `getPlatformSetting` / `setPlatformSetting` API. Match its style (server client choice, error handling, return types) for the new functions.

- [ ] **Step 2: Add encrypted helpers**

Append to `lib/platform/settings.ts`:

```ts
import { createAdminClient } from '@/supabase/admin';  // adjust import to match project

function requireEncryptionKey(): string {
  const k = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!k) throw new Error('SETTINGS_ENCRYPTION_KEY is not set');
  return k;
}

export async function getEncryptedSetting(key: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('get_decrypted_setting', {
    p_key: key,
    p_encryption_key: requireEncryptionKey(),
  });
  if (error) {
    console.error(`getEncryptedSetting(${key}) failed:`, error);
    return null;
  }
  return (data as string | null) ?? null;
}

export async function setEncryptedSetting(key: string, value: string): Promise<void> {
  if (!value) throw new Error('setEncryptedSetting: empty value');
  const supabase = createAdminClient();
  const { error } = await supabase.rpc('set_encrypted_setting', {
    p_key: key,
    p_value: value,
    p_encryption_key: requireEncryptionKey(),
  });
  if (error) throw new Error(`setEncryptedSetting(${key}) failed: ${error.message}`);
}

export async function hasEncryptedSetting(key: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('platform_settings')
    .select('key')
    .eq('key', key)
    .eq('is_encrypted', true)
    .maybeSingle();
  if (error) return false;
  return !!data;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If `createAdminClient` import path differs, fix it.

- [ ] **Step 4: Manual smoke test via tsx**

Create a temp file `scripts/test-encrypted-settings.ts`:
```ts
import { getEncryptedSetting, setEncryptedSetting } from '@/lib/platform/settings';
(async () => {
  await setEncryptedSetting('smoke_test', 'hello');
  console.log(await getEncryptedSetting('smoke_test')); // → 'hello'
})();
```

Run: `npx tsx scripts/test-encrypted-settings.ts`
Expected: prints `hello`. Then delete the temp file and the row:
```sql
delete from platform_settings where key='smoke_test';
```

- [ ] **Step 5: Commit**

```
git add lib/platform/settings.ts
git commit -m "feat(platform): encrypted settings helpers"
```

---

## Task 6: AI provider config (`lib/ai/config.ts`)

**Files:**
- Create: `lib/ai/config.ts`

- [ ] **Step 1: Write config module**

```ts
import { getPlatformSetting, getEncryptedSetting } from '@/lib/platform/settings';

export type ProviderConfig = {
  enabled: boolean;
  baseURL: string;
  apiKey: string;
  model: string;
};

const PLAIN_KEYS = {
  enabled: 'ai_lesson_planner_enabled',
  baseURL: 'ai_provider_base_url',
  model: 'ai_provider_model',
} as const;

const ENCRYPTED_KEY = 'ai_provider_api_key';

export async function getProviderConfig(): Promise<ProviderConfig> {
  const [enabledRaw, baseURL, model, apiKey] = await Promise.all([
    getPlatformSetting(PLAIN_KEYS.enabled),
    getPlatformSetting(PLAIN_KEYS.baseURL),
    getPlatformSetting(PLAIN_KEYS.model),
    getEncryptedSetting(ENCRYPTED_KEY),
  ]);

  const resolvedBaseURL = baseURL || process.env.AI_BASE_URL || '';
  const resolvedModel = model || process.env.AI_MODEL || '';
  const resolvedKey = apiKey || process.env.AI_API_KEY || '';
  const enabled =
    (enabledRaw === 'true' || enabledRaw === '1') &&
    !!resolvedBaseURL &&
    !!resolvedKey &&
    !!resolvedModel;

  return {
    enabled,
    baseURL: resolvedBaseURL,
    apiKey: resolvedKey,
    model: resolvedModel,
  };
}

export const AI_SETTING_KEYS = { ...PLAIN_KEYS, apiKey: ENCRYPTED_KEY } as const;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`. Expected: no errors. Match `getPlatformSetting` return type — if it returns `{ value: string | null }`, adapt.

- [ ] **Step 3: Commit**

```
git add lib/ai/config.ts
git commit -m "feat(ai): provider config reader (platform_settings + env fallback)"
```

---

## Task 7: Prompts (`lib/ai/prompts.ts`)

**Files:**
- Create: `lib/ai/prompts.ts`

- [ ] **Step 1: Write prompt module**

```ts
import type { PlanInput, ChatTurn } from './provider';

const OUTPUT_FORMAT = `
You MUST respond in exactly this format and nothing else:

TITLE: <a short descriptive title, max 200 characters>
---
<the lesson plan body in markdown>

Do not include any preamble, commentary, or trailing notes outside this format.
`;

const SECTION_RULES_SESSION = `
For a single-session plan, use these markdown H2 headings in order:
## Objectives
## Materials
## Warm-up
## Main Activity
## Assessment
## Homework
`;

const SECTION_RULES_UNIT = `
For a multi-week unit plan, structure as H2 headings per week:
## Week 1: <topic for this week>
### Objectives
### Activities
### Assessment

Repeat for each week up to the requested week count.
`;

const PAKISTAN_CONTEXT = `
The teacher is in Pakistan. Be aware of curricula (Federal Board, Cambridge, CBSE).
Use metric units. If money is mentioned, use PKR.
`;

function languageInstruction(lang: PlanInput['language']): string {
  switch (lang) {
    case 'urdu':
      return 'Write the BODY content in Urdu. Keep section HEADINGS in English.';
    case 'roman-urdu':
      return 'Write the BODY content in Roman Urdu (Urdu transliterated in Latin script). Keep section HEADINGS in English.';
    default:
      return 'Write the entire plan in English.';
  }
}

export function buildSystemPrompt(input: PlanInput): string {
  return [
    'You are an assistant helping a Pakistani tutor draft a lesson plan.',
    PAKISTAN_CONTEXT,
    languageInstruction(input.language),
    input.scope === 'session' ? SECTION_RULES_SESSION : SECTION_RULES_UNIT,
    OUTPUT_FORMAT,
  ].join('\n');
}

export function buildGeneratePrompt(input: PlanInput): string {
  const lines = [
    `Subject: ${input.subject}`,
    `Grade level: ${input.gradeLevel}`,
    `Topic: ${input.topic}`,
    `Learning goals: ${input.learningGoals}`,
  ];
  if (input.scope === 'session') {
    lines.push(`Duration: ${input.durationMinutes ?? 60} minutes`);
  } else {
    lines.push(`Number of weeks: ${input.weekCount ?? 4}`);
  }
  return `Create a ${input.scope === 'session' ? 'single-session' : 'multi-week unit'} lesson plan with the following details:\n\n${lines.join('\n')}`;
}

export function buildRevisePrompt(args: {
  currentMarkdown: string;
  chatHistory: ChatTurn[];
  instruction: string;
}): string {
  const recent = args.chatHistory.slice(-5)
    .map(t => `${t.role.toUpperCase()}: ${t.content.slice(0, 500)}`)
    .join('\n');
  return [
    'Here is the current lesson plan:',
    '```markdown',
    args.currentMarkdown,
    '```',
    '',
    'Recent conversation:',
    recent || '(none)',
    '',
    `New instruction from the teacher: ${args.instruction}`,
    '',
    'Return the FULL updated lesson plan in the required TITLE/--- format.',
  ].join('\n');
}
```

- [ ] **Step 2: Commit**

```
git add lib/ai/prompts.ts
git commit -m "feat(ai): generate/revise prompt builders"
```

---

## Task 8: Provider interface + Anthropic-compatible adapter

**Files:**
- Create: `lib/ai/provider.ts`
- Create: `lib/ai/anthropic.ts`

- [ ] **Step 1: Write interface**

`lib/ai/provider.ts`:

```ts
export type PlanInput = {
  scope: 'session' | 'unit';
  subject: string;
  gradeLevel: string;
  durationMinutes?: number;
  weekCount?: number;
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

export type ChatTurn = {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export interface LessonPlanProvider {
  generatePlan(input: PlanInput): Promise<PlanResult>;
  revisePlan(args: {
    currentMarkdown: string;
    chatHistory: ChatTurn[];
    instruction: string;
  }): Promise<PlanResult>;
  testConnection(): Promise<{ ok: true } | { ok: false; error: string }>;
}

export type ProviderConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
};
```

- [ ] **Step 2: Write Anthropic adapter**

`lib/ai/anthropic.ts`:

```ts
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { buildSystemPrompt, buildGeneratePrompt, buildRevisePrompt } from './prompts';
import type { LessonPlanProvider, PlanInput, PlanResult, ChatTurn, ProviderConfig } from './provider';

const MAX_BODY_BYTES = 65536;

function parseAIOutput(raw: string): { title: string; body: string } {
  const idx = raw.indexOf('---');
  let title = '';
  let body = raw;
  if (idx >= 0) {
    const head = raw.slice(0, idx);
    body = raw.slice(idx + 3).trim();
    const m = head.match(/TITLE:\s*(.+)/i);
    if (m) title = m[1].trim();
  }
  if (!title) {
    const h1 = body.match(/^#\s+(.+)/m);
    title = h1 ? h1[1].trim() : 'Untitled plan';
  }
  title = title.slice(0, 200);
  // Body length cap in bytes (UTF-8 safe-ish — we measure JS string length, which is char count;
  // close enough for our 64KB ceiling, and the DB check constraint will hard-reject anything past).
  if (body.length > MAX_BODY_BYTES) {
    body = body.slice(0, MAX_BODY_BYTES - 16) + '\n\n…(truncated)';
  }
  return { title, body };
}

function safeUsage(u: unknown): { inputTokens?: number; outputTokens?: number } {
  try {
    const o = u as { promptTokens?: number; completionTokens?: number } | undefined;
    return {
      inputTokens: typeof o?.promptTokens === 'number' ? o.promptTokens : undefined,
      outputTokens: typeof o?.completionTokens === 'number' ? o.completionTokens : undefined,
    };
  } catch {
    return {};
  }
}

class AIError extends Error {
  code: 'AI_PROVIDER_ERROR' | 'AI_TIMEOUT' = 'AI_PROVIDER_ERROR';
  constructor(message: string, code: 'AI_PROVIDER_ERROR' | 'AI_TIMEOUT' = 'AI_PROVIDER_ERROR') {
    super(message);
    this.code = code;
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new AIError('Timed out', 'AI_TIMEOUT')), ms)),
  ]);
}

export function makeAnthropicProvider(config: ProviderConfig): LessonPlanProvider {
  const anthropic = createAnthropic({ baseURL: config.baseURL, apiKey: config.apiKey });
  const model = anthropic(config.model);

  async function callAI(args: { system: string; prompt: string }): Promise<PlanResult> {
    let result;
    try {
      result = await withTimeout(
        generateText({
          model,
          system: args.system,
          prompt: args.prompt,
          maxTokens: 4096,
        }),
        60_000,
      );
    } catch (e) {
      if (e instanceof AIError) throw e;
      throw new AIError((e as Error)?.message || 'Provider error', 'AI_PROVIDER_ERROR');
    }
    const text = (result?.text ?? '').trim();
    if (!text) throw new AIError('Empty response from provider');
    const { title, body } = parseAIOutput(text);
    if (!body.trim()) throw new AIError('Empty plan body after parsing');
    const usage = safeUsage(result.usage);
    return { title, bodyMarkdown: body, model: config.model, ...usage };
  }

  return {
    generatePlan: (input: PlanInput) =>
      callAI({ system: buildSystemPrompt(input), prompt: buildGeneratePrompt(input) }),

    revisePlan: (args) =>
      callAI({
        system: 'You are revising an existing lesson plan. Keep the user\'s intent. Return the FULL updated plan in the required format.',
        prompt: buildRevisePrompt(args),
      }),

    async testConnection() {
      try {
        const r = await withTimeout(
          generateText({ model, prompt: 'Reply with the single word OK.', maxTokens: 10 }),
          15_000,
        );
        return r?.text?.trim() ? { ok: true } : { ok: false, error: 'Empty response' };
      } catch (e) {
        return { ok: false, error: (e as Error)?.message || 'Unknown error' };
      }
    },
  };
}

export { AIError };
```

- [ ] **Step 3: Add factory to `provider.ts`**

Append to `lib/ai/provider.ts`:

```ts
import { getProviderConfig } from './config';
import { makeAnthropicProvider } from './anthropic';

export async function getLessonPlanProvider(): Promise<LessonPlanProvider | null> {
  const config = await getProviderConfig();
  if (!config.enabled) return null;
  return makeAnthropicProvider({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    model: config.model,
  });
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`. Expected: clean.

- [ ] **Step 5: Manual smoke test**

Temp script `scripts/test-ai.ts`:
```ts
import { getLessonPlanProvider } from '@/lib/ai/provider';
(async () => {
  const p = await getLessonPlanProvider();
  if (!p) { console.log('Disabled — set platform_settings or env vars'); return; }
  console.log(await p.testConnection());
})();
```

You'll need either the platform_settings row OR env vars set. Run: `npx tsx scripts/test-ai.ts`
Expected: `{ ok: true }`. Delete the script after.

- [ ] **Step 6: Commit**

```
git add lib/ai/provider.ts lib/ai/anthropic.ts
git commit -m "feat(ai): Anthropic-compatible adapter with timeout, parsing, and testConnection"
```

---

## Task 9: DB service — `lib/db/lessonPlans.ts` and `lib/db/lessonPlanUsage.ts`

**Files:**
- Create: `lib/db/lessonPlans.ts`
- Create: `lib/db/lessonPlanUsage.ts`

- [ ] **Step 1: Inspect existing db file pattern**

Read one existing service file in `lib/db/` (e.g. `lib/db/courses.ts` if present) to match exact patterns: client import, function naming, error handling.

- [ ] **Step 2: Write `lib/db/lessonPlans.ts`**

```ts
import { createAdminClient } from '@/supabase/admin';
import type { Database } from '@/types/database';

type Row = Database['public']['Tables']['lesson_plans']['Row'];
type Insert = Database['public']['Tables']['lesson_plans']['Insert'];

export async function getLessonPlansForCourse(teacherId: string, courseId: string): Promise<Row[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('lesson_plans')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('course_id', courseId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getLessonPlanById(teacherId: string, planId: string): Promise<Row | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('lesson_plans')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('id', planId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function insertLessonPlan(row: Insert): Promise<Row> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('lesson_plans').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateLessonPlan(
  teacherId: string,
  planId: string,
  patch: Partial<Pick<Row, 'title' | 'body_markdown' | 'chat_history'>>
): Promise<Row> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('lesson_plans')
    .update(patch)
    .eq('teacher_id', teacherId)
    .eq('id', planId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteLessonPlan(teacherId: string, planId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('lesson_plans')
    .delete()
    .eq('teacher_id', teacherId)
    .eq('id', planId);
  if (error) throw error;
}
```

- [ ] **Step 3: Write `lib/db/lessonPlanUsage.ts`**

```ts
import { createAdminClient } from '@/supabase/admin';
import type { Database } from '@/types/database';

type Insert = Database['public']['Tables']['lesson_plan_usage']['Insert'];

export async function insertUsageEvent(row: Insert): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from('lesson_plan_usage').insert(row);
  if (error) throw error;
}

export async function countGenerationsThisMonth(teacherId: string): Promise<number> {
  const supabase = createAdminClient();
  // PKT month boundary, converted to UTC for the timestamptz comparison.
  // We use a raw SQL fragment via .rpc() if available, otherwise compute in JS.
  // JS fallback (simpler):
  const now = new Date();
  const pktOffsetMs = 5 * 60 * 60 * 1000;
  const pktNow = new Date(now.getTime() + pktOffsetMs);
  const monthStartPKT = new Date(Date.UTC(pktNow.getUTCFullYear(), pktNow.getUTCMonth(), 1));
  const monthStartUTC = new Date(monthStartPKT.getTime() - pktOffsetMs);
  const { count, error } = await supabase
    .from('lesson_plan_usage')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
    .eq('event', 'generate')
    .gte('created_at', monthStartUTC.toISOString());
  if (error) throw error;
  return count ?? 0;
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`. Expected: clean.

- [ ] **Step 5: Commit**

```
git add lib/db/lessonPlans.ts lib/db/lessonPlanUsage.ts
git commit -m "feat(db): lesson plan service layer"
```

---

## Task 10: Plan limits

**Files:**
- Modify: existing plan limits source (audit step 1)
- Modify: `plans` table seed/migration if columns are stored in DB

- [ ] **Step 1: Audit current limits structure**

Run:
```
grep -r "max_courses" --include="*.ts" --include="*.sql"
grep -r "getLimit" --include="*.ts"
```

Find where existing limits like `max_courses`, `max_students` are defined. They may be:
- Columns on the `plans` table (seed migration), OR
- Constants in `constants/plans.ts`, OR
- A combo (DB row + helper in `lib/plans/limits.ts`).

Note the exact pattern — match it for `lesson_plans_per_month`.

- [ ] **Step 2: If DB-backed: add migration**

Create `supabase/migrations/025_plans_lesson_plans_limit.sql`:

```sql
alter table public.plans
  add column if not exists lesson_plans_per_month int;

-- Free: 2, Solo: 25, Academy: NULL (unlimited — matches existing convention)
update public.plans set lesson_plans_per_month = 2  where tier = 'free';
update public.plans set lesson_plans_per_month = 25 where tier = 'solo';
update public.plans set lesson_plans_per_month = null where tier = 'academy';
```

(Adjust the WHERE clause and NULL-vs-sentinel convention to whatever the codebase uses for "unlimited" on `max_courses`.)

Apply migration. Verify with `select tier, lesson_plans_per_month from plans;`.

- [ ] **Step 3: If constants-based: add to file**

In `constants/plans.ts` (or equivalent), add `lessonPlansPerMonth` to each tier object using the same shape as existing limits.

- [ ] **Step 4: Add `getLessonPlanLimit` helper**

In `lib/plans/limits.ts` (or wherever `getLimit` lives), add or wire up a getter so that `getLimit(teacherId, 'lesson_plans_per_month')` works. If `getLimit` is already key-driven, no new function needed — verify by reading it.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`. Expected: clean.

- [ ] **Step 6: Commit**

```
git add <touched files>
git commit -m "feat(plans): add lesson_plans_per_month limit (free=2, solo=25, academy=unlimited)"
```

---

## Task 11: Server Action — `createLessonPlan` (with advisory lock)

**Files:**
- Create: `lib/actions/lessonPlans.ts`

- [ ] **Step 1: Inspect existing action pattern**

Read an existing file in `lib/actions/` (e.g. `lib/auth/actions.ts` or `lib/actions/admin.ts`) to match: `'use server'` directive, error-throwing pattern, return shape (commonly `{ ok: true } | { ok: false; error: string }`).

- [ ] **Step 2: Scaffold the actions file**

Create `lib/actions/lessonPlans.ts`:

```ts
'use server';

export const maxDuration = 60;

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireTeacher } from '@/lib/auth/guards';
import { createAdminClient } from '@/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { getLessonPlanProvider } from '@/lib/ai/provider';
import { getLimit } from '@/lib/plans/limits';
import {
  insertLessonPlan,
  getLessonPlanById,
  updateLessonPlan,
  deleteLessonPlan as dbDeleteLessonPlan,
} from '@/lib/db/lessonPlans';
import {
  insertUsageEvent,
  countGenerationsThisMonth,
} from '@/lib/db/lessonPlanUsage';
import { AIError } from '@/lib/ai/anthropic';

const PlanInputSchema = z.object({
  courseId: z.string().uuid(),
  scope: z.enum(['session', 'unit']),
  subject: z.string().min(1).max(100),
  gradeLevel: z.string().min(1).max(50),
  durationMinutes: z.number().int().min(15).max(240).optional(),
  weekCount: z.number().int().min(1).max(24).optional(),
  topic: z.string().min(1).max(200),
  learningGoals: z.string().min(1).max(2000),
  language: z.enum(['english', 'urdu', 'roman-urdu']),
});

export type ActionError =
  | 'FEATURE_DISABLED'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'AI_TIMEOUT'
  | 'AI_PROVIDER_ERROR'
  | 'NOT_FOUND'
  | 'COURSE_NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED';

class ActionFailed extends Error {
  code: ActionError;
  constructor(code: ActionError, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

async function acquireTeacherLock(teacherId: string): Promise<void> {
  // Postgres advisory lock — serializes concurrent requests per teacher.
  // Released automatically at end of session/transaction.
  const supabase = createAdminClient();
  // Use the lock-by-text variant. hashtext() produces an int4; we wrap in a function call via RPC-style raw sql.
  // Since supabase-js doesn't expose raw SQL directly, we use a SECURITY DEFINER function added below.
  const { error } = await supabase.rpc('acquire_lesson_plan_lock', { p_teacher_id: teacherId });
  if (error) throw error;
}

export async function createLessonPlan(rawInput: unknown): Promise<{ ok: true; planId: string } | { ok: false; error: ActionError }> {
  let teacher;
  try {
    teacher = await requireTeacher();
  } catch {
    return { ok: false, error: 'UNAUTHORIZED' };
  }

  const parsed = PlanInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: 'VALIDATION_FAILED' };
  const input = parsed.data;

  const rl = rateLimit(`lpgen:${teacher.id}`, 1, 10_000);
  if (!rl.allowed) return { ok: false, error: 'RATE_LIMITED' };

  try {
    await acquireTeacherLock(teacher.id);

    const provider = await getLessonPlanProvider();
    if (!provider) throw new ActionFailed('FEATURE_DISABLED');

    // Verify course ownership
    const supabase = createAdminClient();
    const { data: course } = await supabase
      .from('courses')
      .select('id, deleted_at')
      .eq('id', input.courseId)
      .eq('teacher_id', teacher.id)
      .maybeSingle();
    if (!course || course.deleted_at) throw new ActionFailed('COURSE_NOT_FOUND');

    // Quota
    const limit = await getLimit(teacher.id, 'lesson_plans_per_month');
    if (limit !== null && limit !== undefined && limit >= 0) {
      const used = await countGenerationsThisMonth(teacher.id);
      if (used >= limit) throw new ActionFailed('QUOTA_EXCEEDED');
    }

    // AI call
    const result = await provider.generatePlan({
      scope: input.scope,
      subject: input.subject,
      gradeLevel: input.gradeLevel,
      durationMinutes: input.durationMinutes,
      weekCount: input.weekCount,
      topic: input.topic,
      learningGoals: input.learningGoals,
      language: input.language,
    });

    // Insert plan
    const plan = await insertLessonPlan({
      teacher_id: teacher.id,
      course_id: input.courseId,
      scope: input.scope,
      title: result.title,
      body_markdown: result.bodyMarkdown,
      inputs: input as unknown as Record<string, unknown>,
      chat_history: [],
      model: result.model,
    });

    // Usage event
    await insertUsageEvent({
      teacher_id: teacher.id,
      lesson_plan_id: plan.id,
      event: 'generate',
      model: result.model,
      input_tokens: result.inputTokens ?? null,
      output_tokens: result.outputTokens ?? null,
    });

    revalidatePath(`/dashboard/courses/${input.courseId}/lesson-plans`);
    return { ok: true, planId: plan.id };
  } catch (e) {
    if (e instanceof ActionFailed) return { ok: false, error: e.code };
    if (e instanceof AIError) return { ok: false, error: e.code };
    console.error('createLessonPlan failed:', e);
    return { ok: false, error: 'AI_PROVIDER_ERROR' };
  }
}
```

- [ ] **Step 3: Add advisory-lock RPC to migration 024**

We can't run raw SQL from supabase-js directly, so add this RPC to migration 024 (append, then re-run migration or write a small 026 migration with just this function — choose whichever fits your workflow):

```sql
create or replace function public.acquire_lesson_plan_lock(p_teacher_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_teacher_id::text));
end;
$$;

revoke all on function public.acquire_lesson_plan_lock(uuid) from public;
grant execute on function public.acquire_lesson_plan_lock(uuid) to service_role;
```

NOTE: `pg_advisory_xact_lock` requires a transaction. Since supabase-js RPCs run in implicit transactions, the lock is held for the duration of the RPC call only — not across subsequent calls in the same Server Action. This means the lock as written **does not** protect the AI call. We need a different approach:

**Revised approach:** Use a **session-level** advisory lock with explicit acquire/release:

```sql
create or replace function public.try_acquire_lesson_plan_lock(p_teacher_id uuid, p_timeout_ms int default 30000)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  start_ts timestamptz := clock_timestamp();
  got boolean;
begin
  loop
    got := pg_try_advisory_lock(hashtext('lp:' || p_teacher_id::text));
    if got then return true; end if;
    if extract(epoch from (clock_timestamp() - start_ts)) * 1000 > p_timeout_ms then
      return false;
    end if;
    perform pg_sleep(0.1);
  end loop;
end;
$$;

create or replace function public.release_lesson_plan_lock(p_teacher_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_unlock(hashtext('lp:' || p_teacher_id::text));
end;
$$;

revoke all on function public.try_acquire_lesson_plan_lock(uuid, int) from public;
revoke all on function public.release_lesson_plan_lock(uuid) from public;
grant execute on function public.try_acquire_lesson_plan_lock(uuid, int) to service_role;
grant execute on function public.release_lesson_plan_lock(uuid) to service_role;
```

**Caveat:** supabase-js uses connection pooling (PgBouncer in transaction mode by default). Session-level advisory locks may not work reliably with PgBouncer transaction-mode pooling, because each RPC may use a different physical connection.

**Pragmatic fallback (recommended for v1):** Use a database-side advisory lock + atomic check-and-insert inside a single PostgreSQL function. Replace the JS-side quota check with one RPC that takes the row and inserts it only if quota allows:

```sql
create or replace function public.insert_lesson_plan_atomic(
  p_teacher_id uuid,
  p_course_id uuid,
  p_scope text,
  p_title text,
  p_body_markdown text,
  p_inputs jsonb,
  p_model text,
  p_limit int,             -- null = unlimited
  p_pkt_offset_seconds int default 18000  -- +5h in seconds
) returns table (plan_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_plan_id uuid;
  v_month_start timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('lp:' || p_teacher_id::text));

  v_month_start := date_trunc('month', (now() at time zone 'Asia/Karachi')) at time zone 'Asia/Karachi';

  if p_limit is not null then
    select count(*) into v_count from public.lesson_plan_usage
      where teacher_id = p_teacher_id
        and event = 'generate'
        and created_at >= v_month_start;
    if v_count >= p_limit then
      return query select null::uuid, 'quota_exceeded'::text;
      return;
    end if;
  end if;

  insert into public.lesson_plans (teacher_id, course_id, scope, title, body_markdown, inputs, chat_history, model)
  values (p_teacher_id, p_course_id, p_scope, p_title, p_body_markdown, p_inputs, '[]'::jsonb, p_model)
  returning id into v_plan_id;

  return query select v_plan_id, 'ok'::text;
end;
$$;

revoke all on function public.insert_lesson_plan_atomic(uuid, uuid, text, text, text, jsonb, text, int, int) from public;
grant execute on function public.insert_lesson_plan_atomic(uuid, uuid, text, text, text, jsonb, text, int, int) to service_role;
```

This wraps the quota check + insert in a single transaction with a transaction-scoped advisory lock. Concurrent calls from the same teacher serialize cleanly. Add this function in a new migration `025_atomic_plan_insert.sql`.

- [ ] **Step 4: Refactor `createLessonPlan` to use the atomic RPC**

Replace the quota-check + insert block in the action with:

```ts
const limit = await getLimit(teacher.id, 'lesson_plans_per_month');
const limitParam = limit === null || limit === undefined || limit < 0 ? null : limit;

const supabase = createAdminClient();
const { data: rpcRows, error: rpcErr } = await supabase.rpc('insert_lesson_plan_atomic', {
  p_teacher_id: teacher.id,
  p_course_id: input.courseId,
  p_scope: input.scope,
  p_title: result.title,
  p_body_markdown: result.bodyMarkdown,
  p_inputs: input as unknown as Record<string, unknown>,
  p_model: result.model,
  p_limit: limitParam,
});
if (rpcErr) throw rpcErr;
const row = rpcRows?.[0];
if (!row) throw new ActionFailed('AI_PROVIDER_ERROR');
if (row.status === 'quota_exceeded') throw new ActionFailed('QUOTA_EXCEEDED');

await insertUsageEvent({
  teacher_id: teacher.id,
  lesson_plan_id: row.plan_id,
  event: 'generate',
  model: result.model,
  input_tokens: result.inputTokens ?? null,
  output_tokens: result.outputTokens ?? null,
});

return { ok: true, planId: row.plan_id };
```

Remove the `acquireTeacherLock` helper from the file — it's superseded by the in-RPC lock.

- [ ] **Step 5: Write migration 025**

Create `supabase/migrations/025_atomic_plan_insert.sql` containing the `insert_lesson_plan_atomic` function from Step 3.

Apply migration. Verify with:
```sql
select * from insert_lesson_plan_atomic(
  '<some teacher uuid>', '<some course uuid>', 'session', 'Test', '## body', '{}'::jsonb, 'test-model', 2);
```
Expected: returns one row `{plan_id: <uuid>, status: 'ok'}`. Then clean up the test row.

- [ ] **Step 6: Type-check + smoke test**

Run: `npx tsc --noEmit`. Expected: clean.

(Full E2E smoke happens in Task 22.)

- [ ] **Step 7: Commit**

```
git add lib/actions/lessonPlans.ts supabase/migrations/025_atomic_plan_insert.sql
git commit -m "feat(actions): createLessonPlan with atomic quota+insert RPC"
```

---

## Task 12: Server Action — `reviseLessonPlan`

**Files:**
- Modify: `lib/actions/lessonPlans.ts`

- [ ] **Step 1: Append revise action**

Append to `lib/actions/lessonPlans.ts`:

```ts
const ReviseSchema = z.object({
  planId: z.string().uuid(),
  instruction: z.string().min(1).max(2000),
});

export async function reviseLessonPlan(rawInput: unknown): Promise<{ ok: true } | { ok: false; error: ActionError }> {
  let teacher;
  try { teacher = await requireTeacher(); } catch { return { ok: false, error: 'UNAUTHORIZED' }; }

  const parsed = ReviseSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: 'VALIDATION_FAILED' };
  const { planId, instruction } = parsed.data;

  const rl = rateLimit(`lprev:${teacher.id}`, 1, 5_000);
  if (!rl.allowed) return { ok: false, error: 'RATE_LIMITED' };

  try {
    const provider = await getLessonPlanProvider();
    if (!provider) throw new ActionFailed('FEATURE_DISABLED');

    const plan = await getLessonPlanById(teacher.id, planId);
    if (!plan) throw new ActionFailed('NOT_FOUND');

    const result = await provider.revisePlan({
      currentMarkdown: plan.body_markdown,
      chatHistory: (plan.chat_history as { role: 'user' | 'assistant'; content: string; created_at: string }[]) ?? [],
      instruction,
    });

    const newTurns = [
      { role: 'user' as const, content: instruction, created_at: new Date().toISOString() },
      { role: 'assistant' as const, content: 'Plan updated.', created_at: new Date().toISOString() },
    ];
    const newHistory = [...((plan.chat_history as unknown[]) ?? []), ...newTurns];

    await updateLessonPlan(teacher.id, planId, {
      title: result.title,
      body_markdown: result.bodyMarkdown,
      chat_history: newHistory as unknown as never,
    });

    await insertUsageEvent({
      teacher_id: teacher.id,
      lesson_plan_id: planId,
      event: 'revise',
      model: result.model,
      input_tokens: result.inputTokens ?? null,
      output_tokens: result.outputTokens ?? null,
    });

    revalidatePath(`/dashboard/courses/${plan.course_id}/lesson-plans/${planId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof ActionFailed) return { ok: false, error: e.code };
    if (e instanceof AIError) return { ok: false, error: e.code };
    console.error('reviseLessonPlan failed:', e);
    return { ok: false, error: 'AI_PROVIDER_ERROR' };
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`. Clean.

- [ ] **Step 3: Commit**

```
git add lib/actions/lessonPlans.ts
git commit -m "feat(actions): reviseLessonPlan"
```

---

## Task 13: Server Action — `deleteLessonPlan`

**Files:**
- Modify: `lib/actions/lessonPlans.ts`

- [ ] **Step 1: Append delete action**

```ts
const DeleteSchema = z.object({ planId: z.string().uuid(), courseId: z.string().uuid() });

export async function deleteLessonPlanAction(rawInput: unknown): Promise<{ ok: true } | { ok: false; error: ActionError }> {
  let teacher;
  try { teacher = await requireTeacher(); } catch { return { ok: false, error: 'UNAUTHORIZED' }; }
  const parsed = DeleteSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: 'VALIDATION_FAILED' };

  try {
    await dbDeleteLessonPlan(teacher.id, parsed.data.planId);
    revalidatePath(`/dashboard/courses/${parsed.data.courseId}/lesson-plans`);
    return { ok: true };
  } catch (e) {
    console.error('deleteLessonPlan failed:', e);
    return { ok: false, error: 'NOT_FOUND' };
  }
}
```

- [ ] **Step 2: Commit**

```
git add lib/actions/lessonPlans.ts
git commit -m "feat(actions): deleteLessonPlan"
```

---

## Task 14: Admin Server Action — `testAIProviderAction`

**Files:**
- Create: `lib/actions/adminAIProvider.ts`

- [ ] **Step 1: Write the action file**

```ts
'use server';

export const maxDuration = 30;

import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/guards';
import { makeAnthropicProvider } from '@/lib/ai/anthropic';
import { getProviderConfig } from '@/lib/ai/config';
import { setEncryptedSetting } from '@/lib/platform/settings';
import { createAdminClient } from '@/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { revalidatePath } from 'next/cache';

const TestSchema = z.object({
  baseURL: z.string().url().optional(),
  apiKey: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
});

export async function testAIProviderAction(input: unknown) {
  await requireAdmin();
  const parsed = TestSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: 'Invalid input' };

  const rl = rateLimit('ai-test:admin', 1, 5_000);
  if (!rl.allowed) return { ok: false as const, error: 'Please wait a moment and try again.' };

  const current = await getProviderConfig();
  const baseURL = parsed.data.baseURL || current.baseURL;
  const apiKey = parsed.data.apiKey || current.apiKey;
  const model = parsed.data.model || current.model;

  if (!baseURL || !apiKey || !model) {
    return { ok: false as const, error: 'Missing base URL, API key, or model.' };
  }

  const provider = makeAnthropicProvider({ baseURL, apiKey, model });
  return await provider.testConnection();
}

const SaveSchema = z.object({
  enabled: z.boolean(),
  baseURL: z.string().url(),
  model: z.string().min(1),
  apiKey: z.string().min(1).optional(), // empty/missing = don't change
});

export async function saveAIProviderAction(input: unknown) {
  await requireAdmin();
  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: 'Invalid input' };

  const supabase = createAdminClient();
  const upserts = [
    { key: 'ai_lesson_planner_enabled', value: parsed.data.enabled ? 'true' : 'false' },
    { key: 'ai_provider_base_url', value: parsed.data.baseURL },
    { key: 'ai_provider_model', value: parsed.data.model },
  ];
  const { error } = await supabase.from('platform_settings').upsert(upserts);
  if (error) return { ok: false as const, error: error.message };

  if (parsed.data.apiKey) {
    await setEncryptedSetting('ai_provider_api_key', parsed.data.apiKey);
  }

  revalidatePath('/admin/settings');
  return { ok: true as const };
}
```

- [ ] **Step 2: Type-check + commit**

```
npx tsc --noEmit
git add lib/actions/adminAIProvider.ts
git commit -m "feat(actions): admin AI provider test + save actions"
```

---

## Task 15: PDF Route Handler + react-pdf document

**Files:**
- Create: `components/teacher/LessonPlanPdfDocument.tsx`
- Create: `app/api/lesson-plans/[id]/pdf/route.ts`

- [ ] **Step 1: Write the PDF document component**

```tsx
// components/teacher/LessonPlanPdfDocument.tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica', color: '#111' },
  header: { borderBottom: '1pt solid #888', paddingBottom: 8, marginBottom: 16 },
  courseLine: { fontSize: 10, color: '#666' },
  title: { fontSize: 16, fontWeight: 700, marginTop: 4 },
  meta: { fontSize: 9, color: '#888', marginTop: 4 },
  h1: { fontSize: 14, fontWeight: 700, marginTop: 12, marginBottom: 6 },
  h2: { fontSize: 12, fontWeight: 700, marginTop: 10, marginBottom: 4 },
  h3: { fontSize: 11, fontWeight: 700, marginTop: 8, marginBottom: 4 },
  p:  { marginBottom: 4, lineHeight: 1.4 },
  li: { marginLeft: 14, marginBottom: 2 },
  footer: { position: 'absolute', bottom: 20, left: 40, right: 40, fontSize: 8, color: '#999', textAlign: 'center' },
});

type Block =
  | { kind: 'h1' | 'h2' | 'h3' | 'p'; text: string }
  | { kind: 'li'; text: string; ordered: boolean };

// Minimal markdown → blocks. Handles #, ##, ###, paragraphs, - and 1. lists, **bold**, *italic*, `code`.
function parseMarkdown(md: string): Block[] {
  const lines = md.split('\n');
  const blocks: Block[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');
    if (!line.trim()) { blocks.push({ kind: 'p', text: '' }); continue; }
    if (line.startsWith('### ')) blocks.push({ kind: 'h3', text: line.slice(4) });
    else if (line.startsWith('## ')) blocks.push({ kind: 'h2', text: line.slice(3) });
    else if (line.startsWith('# ')) blocks.push({ kind: 'h1', text: line.slice(2) });
    else if (/^\s*[-*]\s+/.test(line)) blocks.push({ kind: 'li', text: line.replace(/^\s*[-*]\s+/, ''), ordered: false });
    else if (/^\s*\d+\.\s+/.test(line)) blocks.push({ kind: 'li', text: line.replace(/^\s*\d+\.\s+/, ''), ordered: true });
    else blocks.push({ kind: 'p', text: line });
  }
  return blocks;
}

function stripInline(text: string): string {
  // For the PDF we drop inline formatting markers — keep it readable, not fancy.
  return text.replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
}

export function LessonPlanPdfDocument(props: {
  courseName: string;
  teacherName: string;
  title: string;
  bodyMarkdown: string;
  generatedAtPkt: string;
}) {
  const blocks = parseMarkdown(props.bodyMarkdown);
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.courseLine}>{props.teacherName} · {props.courseName}</Text>
          <Text style={s.title}>{props.title}</Text>
          <Text style={s.meta}>Generated {props.generatedAtPkt} (PKT)</Text>
        </View>
        {blocks.map((b, i) => {
          const t = stripInline(b.text);
          if (b.kind === 'h1') return <Text key={i} style={s.h1}>{t}</Text>;
          if (b.kind === 'h2') return <Text key={i} style={s.h2}>{t}</Text>;
          if (b.kind === 'h3') return <Text key={i} style={s.h3}>{t}</Text>;
          if (b.kind === 'li') return <Text key={i} style={s.li}>{b.ordered ? `• ${t}` : `• ${t}`}</Text>;
          return <Text key={i} style={s.p}>{t}</Text>;
        })}
        <Text style={s.footer} render={({ pageNumber, totalPages }) => `Generated with Skool Rooms · ${pageNumber}/${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: Write the Route Handler**

```ts
// app/api/lesson-plans/[id]/pdf/route.ts
import { NextRequest } from 'next/server';
import { requireTeacher } from '@/lib/auth/guards';
import { getLessonPlanById } from '@/lib/db/lessonPlans';
import { createAdminClient } from '@/supabase/admin';
import { renderToBuffer } from '@react-pdf/renderer';
import { LessonPlanPdfDocument } from '@/components/teacher/LessonPlanPdfDocument';
import { formatPKT } from '@/lib/time';

export const maxDuration = 30;
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let teacher;
  try { teacher = await requireTeacher(); }
  catch { return new Response('Unauthorized', { status: 401 }); }

  const plan = await getLessonPlanById(teacher.id, id);
  if (!plan) return new Response('Not found', { status: 404 });

  const supabase = createAdminClient();
  const { data: course } = await supabase
    .from('courses')
    .select('title')
    .eq('id', plan.course_id)
    .maybeSingle();

  const pdf = await renderToBuffer(
    LessonPlanPdfDocument({
      courseName: course?.title ?? 'Course',
      teacherName: teacher.profile?.full_name ?? teacher.email ?? 'Teacher',
      title: plan.title,
      bodyMarkdown: plan.body_markdown,
      generatedAtPkt: formatPKT(new Date()),
    }) as unknown as Parameters<typeof renderToBuffer>[0]
  );

  const safeTitle = plan.title.replace(/[^a-zA-Z0-9-_ ]/g, '').slice(0, 60).trim() || 'lesson-plan';
  return new Response(pdf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeTitle}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
```

(Adjust `teacher.profile?.full_name` to match the actual shape returned by `requireTeacher()`.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`. Expected: clean. Fix any path mismatches.

- [ ] **Step 4: Commit**

```
git add app/api/lesson-plans/[id]/pdf/route.ts components/teacher/LessonPlanPdfDocument.tsx
git commit -m "feat(pdf): lesson plan PDF route handler + react-pdf document"
```

---

## Task 16: List view page

**Files:**
- Create: `app/(teacher)/dashboard/courses/[courseId]/lesson-plans/page.tsx`
- Create: `components/teacher/LessonPlanList.tsx`

- [ ] **Step 1: Write list component**

```tsx
// components/teacher/LessonPlanList.tsx
'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { formatPKT } from '@/lib/time';
import { deleteLessonPlanAction } from '@/lib/actions/lessonPlans';
import { useToast } from '@/hooks/useToast'; // adjust to project's toast hook

export type LessonPlanRow = {
  id: string;
  title: string;
  scope: 'session' | 'unit';
  updated_at: string;
};

export function LessonPlanList(props: { courseId: string; plans: LessonPlanRow[] }) {
  const [pending, start] = useTransition();
  const { toast } = useToast();

  if (props.plans.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <p className="text-lg font-medium text-foreground">No lesson plans yet</p>
        <p className="mt-2 text-sm text-muted-foreground">Generate your first lesson plan with AI.</p>
      </div>
    );
  }

  function onDelete(planId: string) {
    if (!confirm('Delete this lesson plan? This cannot be undone.')) return;
    start(async () => {
      const res = await deleteLessonPlanAction({ planId, courseId: props.courseId });
      if (!res.ok) toast({ title: 'Could not delete', description: res.error, variant: 'destructive' });
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-muted-foreground">
          <tr><th className="px-4 py-2">Title</th><th className="px-4 py-2">Scope</th><th className="px-4 py-2">Updated</th><th className="px-4 py-2"/></tr>
        </thead>
        <tbody>
          {props.plans.map(p => (
            <tr key={p.id} className="border-t border-border">
              <td className="px-4 py-2">
                <Link href={`/dashboard/courses/${props.courseId}/lesson-plans/${p.id}`} className="font-medium text-primary hover:underline">{p.title}</Link>
              </td>
              <td className="px-4 py-2 capitalize">{p.scope}</td>
              <td className="px-4 py-2 text-muted-foreground">{formatPKT(new Date(p.updated_at))}</td>
              <td className="px-4 py-2 text-right">
                <a href={`/api/lesson-plans/${p.id}/pdf`} className="mr-2 text-sm text-primary hover:underline">PDF</a>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => onDelete(p.id)}>Delete</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Write list page**

```tsx
// app/(teacher)/dashboard/courses/[courseId]/lesson-plans/page.tsx
import { requireTeacher } from '@/lib/auth/guards';
import { getLessonPlansForCourse } from '@/lib/db/lessonPlans';
import { countGenerationsThisMonth } from '@/lib/db/lessonPlanUsage';
import { getLimit } from '@/lib/plans/limits';
import { getProviderConfig } from '@/lib/ai/config';
import { LessonPlanList } from '@/components/teacher/LessonPlanList';
import { NewLessonPlanDialog } from '@/components/teacher/NewLessonPlanDialog';
import { createAdminClient } from '@/supabase/admin';
import { notFound } from 'next/navigation';

export default async function LessonPlansPage(props: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await props.params;
  const teacher = await requireTeacher();

  const supabase = createAdminClient();
  const { data: course } = await supabase
    .from('courses').select('id, title, deleted_at')
    .eq('id', courseId).eq('teacher_id', teacher.id).maybeSingle();
  if (!course || course.deleted_at) notFound();

  const [plans, used, limit, providerCfg] = await Promise.all([
    getLessonPlansForCourse(teacher.id, courseId),
    countGenerationsThisMonth(teacher.id),
    getLimit(teacher.id, 'lesson_plans_per_month'),
    getProviderConfig(),
  ]);

  const limitDisplay = limit === null || limit === undefined || limit < 0 ? 'Unlimited' : `${used} of ${limit} used this month`;
  const canCreate = providerCfg.enabled && (limit === null || limit === undefined || limit < 0 || used < limit);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Lesson Plans</h1>
          <p className="text-sm text-muted-foreground">{course.title} · {limitDisplay}</p>
        </div>
        <NewLessonPlanDialog
          courseId={courseId}
          disabled={!canCreate}
          disabledReason={!providerCfg.enabled ? 'AI lesson planning is currently unavailable.' : 'Monthly limit reached. Upgrade for more.'}
        />
      </div>
      <LessonPlanList courseId={courseId} plans={plans.map(p => ({ id: p.id, title: p.title, scope: p.scope as 'session'|'unit', updated_at: p.updated_at }))} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```
git add app/\(teacher\)/dashboard/courses/[courseId]/lesson-plans/page.tsx components/teacher/LessonPlanList.tsx
git commit -m "feat(teacher): lesson plans list view"
```

---

## Task 17: New plan dialog

**Files:**
- Create: `components/teacher/NewLessonPlanDialog.tsx`

- [ ] **Step 1: Write the dialog**

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/useToast';
import { createLessonPlan, type ActionError } from '@/lib/actions/lessonPlans';

const ERROR_MESSAGES: Record<ActionError, string> = {
  QUOTA_EXCEEDED: "You've used all your plans for this month. Upgrade to create more.",
  FEATURE_DISABLED: 'AI lesson planning is currently unavailable.',
  AI_TIMEOUT: 'The AI took too long to respond. Please try again.',
  AI_PROVIDER_ERROR: "Couldn't generate the plan right now. Please try again in a minute.",
  RATE_LIMITED: 'Slow down a bit — try again in a few seconds.',
  NOT_FOUND: 'Lesson plan not found.',
  COURSE_NOT_FOUND: 'Course not found.',
  VALIDATION_FAILED: 'Please check the form fields.',
  UNAUTHORIZED: 'Please sign in again.',
};

export function NewLessonPlanDialog(props: { courseId: string; disabled?: boolean; disabledReason?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const [scope, setScope] = useState<'session' | 'unit'>('session');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [duration, setDuration] = useState('60');
  const [weeks, setWeeks] = useState('4');
  const [topic, setTopic] = useState('');
  const [goals, setGoals] = useState('');
  const [language, setLanguage] = useState<'english'|'urdu'|'roman-urdu'>('english');

  function submit() {
    start(async () => {
      const res = await createLessonPlan({
        courseId: props.courseId,
        scope,
        subject,
        gradeLevel,
        durationMinutes: scope === 'session' ? Number(duration) : undefined,
        weekCount: scope === 'unit' ? Number(weeks) : undefined,
        topic,
        learningGoals: goals,
        language,
      });
      if (res.ok) {
        setOpen(false);
        router.push(`/dashboard/courses/${props.courseId}/lesson-plans/${res.planId}`);
      } else {
        toast({ title: 'Could not generate plan', description: ERROR_MESSAGES[res.error], variant: 'destructive' });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={props.disabled} title={props.disabled ? props.disabledReason : undefined}>
          New plan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New lesson plan</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Scope</Label>
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as 'session'|'unit')} className="mt-1 flex gap-4">
              <label className="flex items-center gap-2"><RadioGroupItem value="session" /> Single session</label>
              <label className="flex items-center gap-2"><RadioGroupItem value="unit" /> Full unit</label>
            </RadioGroup>
          </div>
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" value={subject} onChange={e => setSubject(e.target.value)} maxLength={100} />
          </div>
          <div>
            <Label htmlFor="grade">Grade level</Label>
            <Input id="grade" value={gradeLevel} onChange={e => setGradeLevel(e.target.value)} maxLength={50} placeholder="e.g. Class 8, O-Level, Grade 5" />
          </div>
          {scope === 'session' ? (
            <div>
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input id="duration" type="number" min={15} max={240} value={duration} onChange={e => setDuration(e.target.value)} />
            </div>
          ) : (
            <div>
              <Label htmlFor="weeks">Number of weeks</Label>
              <Input id="weeks" type="number" min={1} max={24} value={weeks} onChange={e => setWeeks(e.target.value)} />
            </div>
          )}
          <div>
            <Label htmlFor="topic">Topic</Label>
            <Input id="topic" value={topic} onChange={e => setTopic(e.target.value)} maxLength={200} />
          </div>
          <div>
            <Label htmlFor="goals">Learning goals</Label>
            <Textarea id="goals" value={goals} onChange={e => setGoals(e.target.value)} maxLength={2000} rows={3} />
          </div>
          <div>
            <Label>Language</Label>
            <Select value={language} onValueChange={(v) => setLanguage(v as 'english'|'urdu'|'roman-urdu')}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="english">English</SelectItem>
                <SelectItem value="urdu">Urdu</SelectItem>
                <SelectItem value="roman-urdu">Roman Urdu</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={submit} disabled={pending || !subject || !gradeLevel || !topic || !goals}>
              {pending ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify required shadcn components exist**

Run: `ls components/ui/` and check that `dialog`, `radio-group`, `select`, `textarea`, `input`, `button`, `label` are present. If any are missing, install with `npx shadcn@latest add <name>`.

- [ ] **Step 3: Type-check + commit**

```
npx tsc --noEmit
git add components/teacher/NewLessonPlanDialog.tsx
git commit -m "feat(teacher): NewLessonPlanDialog form"
```

---

## Task 18: Detail view + chat (desktop)

**Files:**
- Create: `app/(teacher)/dashboard/courses/[courseId]/lesson-plans/[planId]/page.tsx`
- Create: `components/teacher/LessonPlanChat.tsx`

- [ ] **Step 1: Write chat component**

```tsx
// components/teacher/LessonPlanChat.tsx
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/useToast';
import { reviseLessonPlan, type ActionError } from '@/lib/actions/lessonPlans';

const ERR: Record<ActionError, string> = {
  QUOTA_EXCEEDED: "You've used all your plans for this month.",
  FEATURE_DISABLED: 'AI lesson planning is currently unavailable.',
  AI_TIMEOUT: 'The AI took too long to respond. Please try again.',
  AI_PROVIDER_ERROR: "Couldn't revise the plan right now. Please try again.",
  RATE_LIMITED: 'Slow down a bit — try again in a few seconds.',
  NOT_FOUND: 'This plan no longer exists.',
  COURSE_NOT_FOUND: 'Course not found.',
  VALIDATION_FAILED: 'Instruction is required.',
  UNAUTHORIZED: 'Please sign in again.',
};

type Turn = { role: 'user' | 'assistant'; content: string; created_at: string };

export function LessonPlanChat(props: { planId: string; chatHistory: Turn[] }) {
  const [pending, start] = useTransition();
  const [text, setText] = useState('');
  const { toast } = useToast();

  function submit() {
    if (!text.trim()) return;
    const instruction = text.trim();
    start(async () => {
      const res = await reviseLessonPlan({ planId: props.planId, instruction });
      if (res.ok) setText('');
      else toast({ title: 'Could not revise', description: ERR[res.error], variant: 'destructive' });
    });
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-2 text-sm font-medium text-foreground">Revise with AI</div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {props.chatHistory.length === 0 && (
          <p className="text-sm text-muted-foreground">Tell the AI how to revise this plan — e.g. "make the warm-up shorter and add a quiz at the end".</p>
        )}
        {props.chatHistory.map((t, i) => (
          <div key={i} className={t.role === 'user' ? 'rounded-md bg-primary/10 p-2 text-sm' : 'rounded-md bg-muted p-2 text-sm text-muted-foreground'}>
            <div className="text-xs uppercase tracking-wide opacity-60">{t.role === 'user' ? 'You' : 'AI'}</div>
            <div>{t.content}</div>
          </div>
        ))}
        {pending && <div className="text-sm text-muted-foreground">Revising plan…</div>}
      </div>
      <div className="border-t border-border p-3">
        <Textarea value={text} onChange={e => setText(e.target.value)} placeholder="Type your revision instruction…" rows={3} disabled={pending} maxLength={2000} />
        <div className="mt-2 flex justify-end">
          <Button onClick={submit} disabled={pending || !text.trim()}>{pending ? 'Sending…' : 'Send'}</Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write detail page**

```tsx
// app/(teacher)/dashboard/courses/[courseId]/lesson-plans/[planId]/page.tsx
import { requireTeacher } from '@/lib/auth/guards';
import { getLessonPlanById } from '@/lib/db/lessonPlans';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LessonPlanChat } from '@/components/teacher/LessonPlanChat';
import { LessonPlanChatSheet } from '@/components/teacher/LessonPlanChatSheet';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function LessonPlanDetail(props: { params: Promise<{ courseId: string; planId: string }> }) {
  const { courseId, planId } = await props.params;
  const teacher = await requireTeacher();
  const plan = await getLessonPlanById(teacher.id, planId);
  if (!plan) notFound();

  const history = ((plan.chat_history as unknown) as { role: 'user'|'assistant'; content: string; created_at: string }[]) ?? [];

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <Link href={`/dashboard/courses/${courseId}/lesson-plans`} className="text-sm text-muted-foreground hover:underline">← Back</Link>
          <h1 className="mt-1 text-xl font-semibold text-foreground">{plan.title}</h1>
        </div>
        <Button asChild><a href={`/api/lesson-plans/${plan.id}/pdf`}>Download PDF</a></Button>
      </div>

      {/* Desktop: side-by-side; mobile: full markdown + floating chat */}
      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-[1fr_360px]">
        <article className="prose prose-sm max-w-none overflow-y-auto rounded-lg border border-border bg-card p-6 dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{plan.body_markdown}</ReactMarkdown>
        </article>
        <aside className="hidden md:block">
          <LessonPlanChat planId={plan.id} chatHistory={history} />
        </aside>
      </div>

      <LessonPlanChatSheet planId={plan.id} chatHistory={history} />
    </div>
  );
}
```

- [ ] **Step 3: Verify `prose` styles**

If Tailwind Typography (`@tailwindcss/typography`) isn't installed, install: `npm install -D @tailwindcss/typography` and add `@plugin "@tailwindcss/typography";` to `globals.css` (Tailwind v4 plugin syntax). Otherwise replace `prose` classes with manual `space-y-4 text-foreground [&_h2]:text-lg [&_h2]:font-semibold ...`.

- [ ] **Step 4: Commit**

```
git add app/\(teacher\)/dashboard/courses/[courseId]/lesson-plans/[planId]/page.tsx components/teacher/LessonPlanChat.tsx
git commit -m "feat(teacher): lesson plan detail view with desktop chat panel"
```

---

## Task 19: Mobile chat sheet

**Files:**
- Create: `components/teacher/LessonPlanChatSheet.tsx`

- [ ] **Step 1: Write the sheet**

```tsx
'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Sparkles } from 'lucide-react';
import { LessonPlanChat } from './LessonPlanChat';

type Turn = { role: 'user' | 'assistant'; content: string; created_at: string };

export function LessonPlanChatSheet(props: { planId: string; chatHistory: Turn[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg md:hidden"
          aria-label="Revise with AI"
        >
          <Sparkles className="h-4 w-4" />
          Revise with AI
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] p-0">
        <div className="h-full">
          <LessonPlanChat planId={props.planId} chatHistory={props.chatHistory} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Verify `sheet` component exists**

`ls components/ui/sheet*`. If missing: `npx shadcn@latest add sheet`.

- [ ] **Step 3: Commit**

```
git add components/teacher/LessonPlanChatSheet.tsx
git commit -m "feat(teacher): mobile chat sheet with floating action button"
```

---

## Task 20: Admin AI provider settings UI

**Files:**
- Create: `components/admin/AIProviderSettings.tsx`
- Modify: existing admin platform-settings page (audit step 1)

- [ ] **Step 1: Inspect existing admin settings page**

Read `app/(platform)/admin/settings/page.tsx` and any existing form component. Note where to embed a new section.

- [ ] **Step 2: Add server-side check for existing key**

Add to `lib/platform/settings.ts` if not already present:
```ts
// already added in Task 5: hasEncryptedSetting
```

- [ ] **Step 3: Write the component**

```tsx
// components/admin/AIProviderSettings.tsx
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/useToast';
import { saveAIProviderAction, testAIProviderAction } from '@/lib/actions/adminAIProvider';

export function AIProviderSettings(props: {
  initialEnabled: boolean;
  initialBaseURL: string;
  initialModel: string;
  hasKey: boolean;
}) {
  const [enabled, setEnabled] = useState(props.initialEnabled);
  const [baseURL, setBaseURL] = useState(props.initialBaseURL);
  const [model, setModel] = useState(props.initialModel);
  const [keyMode, setKeyMode] = useState<'masked' | 'edit'>(props.hasKey ? 'masked' : 'edit');
  const [apiKey, setApiKey] = useState('');
  const [pending, start] = useTransition();
  const { toast } = useToast();

  function onTest() {
    start(async () => {
      const res = await testAIProviderAction({ baseURL, apiKey: keyMode === 'edit' ? apiKey : undefined, model });
      if (res.ok) toast({ title: 'Connection OK' });
      else toast({ title: 'Connection failed', description: res.error, variant: 'destructive' });
    });
  }

  function onSave() {
    start(async () => {
      const res = await saveAIProviderAction({
        enabled,
        baseURL,
        model,
        apiKey: keyMode === 'edit' && apiKey ? apiKey : undefined,
      });
      if (res.ok) {
        toast({ title: 'Settings saved' });
        if (apiKey) { setKeyMode('masked'); setApiKey(''); }
      } else {
        toast({ title: 'Save failed', description: res.error, variant: 'destructive' });
      }
    });
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-6">
      <header>
        <h2 className="text-lg font-semibold">AI Lesson Planner</h2>
        <p className="text-sm text-muted-foreground">Configure the AI provider used to generate lesson plans.</p>
      </header>
      <div className="flex items-center justify-between">
        <Label htmlFor="ai-enabled">Enabled</Label>
        <Switch id="ai-enabled" checked={enabled} onCheckedChange={setEnabled} />
      </div>
      <div>
        <Label htmlFor="ai-base-url">Base URL</Label>
        <Input id="ai-base-url" value={baseURL} onChange={e => setBaseURL(e.target.value)} placeholder="https://api.anthropic.com" />
      </div>
      <div>
        <Label htmlFor="ai-model">Model</Label>
        <Input id="ai-model" value={model} onChange={e => setModel(e.target.value)} placeholder="claude-haiku-4-5" />
      </div>
      <div>
        <Label htmlFor="ai-key">API Key</Label>
        {keyMode === 'masked' ? (
          <div className="mt-1 flex items-center gap-2">
            <Input id="ai-key" type="text" value="••••••••" readOnly />
            <Button variant="ghost" onClick={() => setKeyMode('edit')}>Replace key</Button>
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-2">
            <Input id="ai-key" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Paste new key" />
            {props.hasKey && <Button variant="ghost" onClick={() => { setKeyMode('masked'); setApiKey(''); }}>Cancel</Button>}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onTest} disabled={pending}>Test connection</Button>
        <Button onClick={onSave} disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Embed in admin settings page**

In the admin settings page (Server Component), load current values and pass them in:

```tsx
import { getPlatformSetting, hasEncryptedSetting } from '@/lib/platform/settings';
import { AIProviderSettings } from '@/components/admin/AIProviderSettings';
import { requireAdmin } from '@/lib/auth/guards';

// inside the existing default export:
const [enabledRaw, baseURL, model, hasKey] = await Promise.all([
  getPlatformSetting('ai_lesson_planner_enabled'),
  getPlatformSetting('ai_provider_base_url'),
  getPlatformSetting('ai_provider_model'),
  hasEncryptedSetting('ai_provider_api_key'),
]);

// in JSX, alongside existing settings sections:
<AIProviderSettings
  initialEnabled={enabledRaw === 'true' || enabledRaw === '1'}
  initialBaseURL={baseURL ?? ''}
  initialModel={model ?? ''}
  hasKey={hasKey}
/>
```

- [ ] **Step 5: Verify `switch` shadcn component**

`ls components/ui/switch*`. If missing: `npx shadcn@latest add switch`.

- [ ] **Step 6: Type-check + commit**

```
npx tsc --noEmit
git add components/admin/AIProviderSettings.tsx app/\(platform\)/admin/settings/page.tsx
git commit -m "feat(admin): AI provider settings section in platform settings"
```

---

## Task 21: Wire Lesson Plans link into course navigation

**Files:**
- Modify: existing course detail page or course navigation component

- [ ] **Step 1: Find course-level nav**

Look at how `curriculum/` is linked from the course detail page — e.g. a sidebar component, breadcrumbs, or a tabs row. Search:
```
grep -rn "curriculum" app/\(teacher\)/dashboard/courses/
```

- [ ] **Step 2: Add Lesson Plans entry**

Mirror the existing curriculum link with a new entry labelled "Lesson Plans" pointing to `/dashboard/courses/${courseId}/lesson-plans`. Use the `BookOpenText` (or similar) Lucide icon.

- [ ] **Step 3: Verify in dev**

`npm run dev`, log in as a teacher, open any course → confirm "Lesson Plans" link is visible and routes to the new list page.

- [ ] **Step 4: Commit**

```
git add <touched files>
git commit -m "feat(teacher): add Lesson Plans nav link to course detail"
```

---

## Task 22: End-to-end smoke test + Vercel env + LESSONS.md

**Files:**
- Modify: `LESSONS.md`

- [ ] **Step 1: Set production env vars**

In Vercel project settings → Environment Variables, add:
- `SETTINGS_ENCRYPTION_KEY` (48-byte base64; generate with `openssl rand -base64 48`). **Do not lose this — losing it makes the stored API key undecryptable.**
- `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` (fallback defaults; admin can override in UI).

Redeploy.

- [ ] **Step 2: Run E2E checklist on production (or preview)**

In order:

1. Log in as platform admin → Admin → Settings → AI Lesson Planner section appears.
2. Fill base URL + API key + model → click "Test connection" → see "Connection OK".
3. Toggle Enabled → Save → see "Settings saved".
4. Log in as a Free teacher → open any course → "Lesson Plans" link visible.
5. Click "New plan" → fill form (session, 60 min, English) → Generate.
6. Plan appears on detail page with rendered markdown.
7. Type "make the warm-up 5 minutes shorter" → Send → plan updates; chat shows user turn + "Plan updated."
8. Click "Download PDF" → PDF downloads, opens, shows correct title + body + footer.
9. Back to list → quota chip shows "1 of 2 used this month".
10. Generate a second plan. Quota chip shows "2 of 2". The "New plan" button is now disabled with hover tooltip.
11. Attempt to call `createLessonPlan` via DevTools (e.g. re-submit the dialog form) → returns `QUOTA_EXCEEDED`.
12. Log in as a second teacher account → confirm previous teacher's plans are NOT visible (RLS).
13. Try fetching `/api/lesson-plans/<other-teacher-plan-id>/pdf` directly → 404.

If any step fails, fix the underlying issue and rerun. Don't proceed to step 3 until all 13 pass.

- [ ] **Step 3: Add LESSONS.md entry**

Append to `LESSONS.md`:

```markdown
### 2026-05-16 — AI lesson planner shipped
**What:** New feature: AI-generated lesson plans (session + unit), chat-revise, PDF export.
**Architecture notes:**
- AI provider abstraction lives at `lib/ai/` — anthropic-compatible, baseURL-configurable from `platform_settings`.
- Encrypted `platform_settings` rows use `pgp_sym_encrypt`. Encryption key is `SETTINGS_ENCRYPTION_KEY` env. Do not lose it.
- Quota race is handled by `insert_lesson_plan_atomic` RPC (transaction-scoped advisory lock + check-and-insert).
- PDF download is a Route Handler (`app/api/lesson-plans/[id]/pdf/route.ts`) — a documented exception to "API routes for webhooks/crons only" since this serves a generated file, not CRUD.
**Rule going forward:** Any other "in-platform AI" features should reuse `lib/ai/provider.ts`, NOT introduce a second provider library. Add the prompt builder per feature.
```

- [ ] **Step 4: Commit + push**

```
git add LESSONS.md
git commit -m "docs(lessons): AI lesson planner ship notes"
git push
```

---

## Self-Review Findings

I checked the plan against the spec:

- All spec sections (1–16) have implementing tasks. ✓
- No placeholders (no "TBD", "TODO", "implement later"). ✓
- Type names and function signatures are consistent across tasks (e.g. `LessonPlanProvider.generatePlan`, `createLessonPlan`, `getProviderConfig`). ✓
- One refinement made during writing: the advisory-lock approach in the spec (acquire-then-AI-call) wouldn't work reliably across PgBouncer transaction-mode pooling. Task 11 now uses a transaction-scoped lock inside an `insert_lesson_plan_atomic` RPC, which serializes the **post-AI-call** insert. The AI call itself isn't locked, but that's fine — the race condition is in the quota check + insert, not in the AI call. Trade-off: a teacher could fire two simultaneous AI generations (paying AI cost twice) but only one will land in the DB. The other returns `QUOTA_EXCEEDED`. Documented in the LESSONS.md entry.
- One additional migration was added (`025_atomic_plan_insert.sql`) to support the atomic insert. Task list updated.
