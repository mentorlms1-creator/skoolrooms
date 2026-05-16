# Themed Lesson Plan PDFs + Railway Migration — Design Spec

**Date:** 2026-05-17
**Status:** Approved for planning
**Scope:** Major feature + hosting infrastructure change
**Prior art:** docs/superpowers/specs/2026-05-16-ai-lesson-planner-design.md, shipped on branch `feat/ai-lesson-planner`

## 1. Purpose

Today's lesson plan PDFs look amateur. Black text on white, one font (DejaVu Sans), basic borders. Compared to what teachers see from Claude.ai artifacts — typography, color, layout, branding — ours feel like a fax from 1998.

Teachers need to **download and share** these PDFs via WhatsApp, Google Meet, email. The download has to be one click and the result has to look like something a teacher is happy to put their name on. Currently it doesn't.

This spec replaces the PDF pipeline with **themed HTML rendered through puppeteer**, gives teachers a choice of 8 distinct visual styles, and migrates hosting from Vercel to Railway to make all of it possible without paying for Vercel Pro.

## 2. Goals and non-goals

### Goals
- **8 themes** to choose from, each visually distinct, covering academic / creative / assessment / primary use cases
- **Themed web detail view** — teacher sees the styled plan in their dashboard before downloading. No surprises in the PDF.
- **Themed PDF download** — same HTML, same theme, rasterized via puppeteer. One click, real file.
- **AI "Auto" theme selection** — model picks an appropriate theme based on inputs, returned inline with the existing generation call (no extra round trip)
- **Theme picker UX** — dropdown with live mini-preview in the New Plan dialog
- **react-pdf fallback** — if puppeteer fails for any reason, the route falls back to today's renderer and serves a plain-but-functional PDF
- **Move hosting to Railway** — no function timeouts, full filesystem for puppeteer, ~$5/mo total cost
- **No data loss** — existing plan migrates to default theme; no breaking changes to existing schema or content
- **Streaming preview inherits theme typography + primary color** — small UX win, cohesion between live preview and final output

### Non-goals
- `CertificateDocument` and `InvoiceDocument` migration — they stay on react-pdf, out of scope
- Teacher-created custom themes — locked to the 8 we ship
- Per-page theme overrides in a multi-week unit — one theme per plan
- A/B testing themes or analytics on theme usage — defer until we have data
- Theme marketplace / community submissions — out of scope
- Print-CSS-only path (no PDF, just `window.print()`) — already rejected; teachers need a file to attach

## 3. Architecture overview

### Hosting

Move the entire Next.js app from Vercel to **Railway Hobby**.
- Single Docker container running `next start` in standalone mode
- ~$5/mo total cost at projected scale (20 teachers / 150 students yields ~$4-5 of actual usage, covered by Hobby's $5 included credit)
- No function timeouts → AI streaming routes work in production
- Full filesystem → puppeteer runs in-process
- Single deployment, single set of env vars, single dashboard
- Railway auto-deploys on git push to a designated branch

### Rendering pipeline

The core insight: **one React component, two consumers.**

```
                        ┌─────────────────────────────┐
                        │  <LessonPlanThemed          │
                        │     plan={...}              │
                        │     theme={themeObject}     │
                        │     context="web" | "pdf"/> │
                        └──────────────┬──────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                │                                             │
   Direct render inside the                       renderToString → puppeteer
   teacher detail page                            .setContent(html) → PDF
   (full app chrome around it)                    (standalone HTML, print CSS)
```

- The web detail view embeds the component as today, with app navigation/chat panel around it
- The PDF route calls `renderToString` to produce a standalone HTML document, hands it to puppeteer via `page.setContent()`, returns the PDF bytes
- Both paths read the same `theme_slug` from the plan row; they always render the same theme

#### What the `context` prop controls

`context="web"`:
- Renders `<article class="plan">` only, no surrounding `<html>`/`<head>`/`<body>` (the Next.js page provides those)
- **Omits the cover header** — the detail page already has a back button + plan title + Download PDF button, so duplicating that header in the article is visual noise
- Skips `@page` and `@media print` CSS rules (only relevant on paper)
- Theme `@font-face` declarations get injected via React-rendered `<style>` tag

`context="pdf"`:
- Renders a complete standalone HTML document (`<!DOCTYPE html><html><head>…</head><body>…</body></html>`)
- **Includes the cover header** with course / teacher / plan title / generated date — this is what the teacher sees first when opening the PDF
- Includes `@page { size: A4; margin: … }`, `@media print { … }`, page-break rules
- Bundles theme `@font-face` declarations in the document head with the actual TTF file contents as data: URIs (so puppeteer doesn't need to fetch them over the network)

### Themes as TypeScript objects

Each theme is a typed object (NOT a markdown file):

```ts
type Theme = {
  slug: ThemeSlug                    // 'classroom-classic' | 'modern-notebook' | ...
  name: string                       // display name for picker
  description: string                // one-line for the picker description card
  tokens: {
    color: { primary, accent, text, muted, surface, divider }
    font:  {
      body, heading, mono            // primary fonts (typically Latin-only)
      urdu                           // Urdu-capable fallback (Noto Naskh Arabic or Noto Nastaliq Urdu)
    }
    space: { tightSection, paragraph, callout }
    page:  { size: 'A4'; margin: string }
    fontFaces?: FontFace[]           // self-hosted @font-face declarations
  }
  components: {                       // per-slot variant choices
    coverHeader:  'standard' | 'name-class-date-strip' | 'cover-page-hero'
    objectives:   'callout-checklist' | 'numbered-list' | 'simple-bullets'
    materials:    'callout-bullets' | 'icon-grid' | 'inline-list'
    markingGrid:  'bordered-table' | 'shaded-table'
    questionRow:  'standard' | 'marks-badge-right' | 'answer-line-below'
    divider:      'thin-rule' | 'ornament' | 'shadow-band'
    figureBox:    'caption-below' | 'sketchpad-frame' | 'gallery-frame'
    callout:      'tinted-left-border' | 'dashed-box' | 'cream-card'
  }
}
```

The 8 themes ship as separate files under `lib/lesson-plan/themes/`. They re-export from `lib/lesson-plan/themes/index.ts` which exposes a typed registry: `Record<ThemeSlug, Theme>`.

#### Urdu / multi-language rendering

Teachers generate plans in `english`, `urdu`, or `roman-urdu`. Theme display fonts (Inter, Caveat, Playfair Display, etc.) almost all lack Urdu glyphs.

Each theme's `tokens.font.urdu` declares a fallback that DOES cover Urdu — we'll standardize on **Noto Naskh Arabic** (self-hosted in `/public/fonts/themed/NotoNaskhArabic-Regular.ttf` + Bold). The rendered CSS resolves to:

```css
body { font-family: 'Inter', 'Noto Naskh Arabic', sans-serif; }
```

Browser/puppeteer's font-fallback chain picks Noto Naskh Arabic glyph-by-glyph for codepoints Inter doesn't have. Same trick we use for emoji-stripping today, but smarter. Roman Urdu uses Latin script so no font work needed.

#### Theme font sources

Themes use a mix of system fonts and custom fonts. All custom fonts are **self-hosted in `/public/fonts/themed/`** — never loaded from Google Fonts at runtime (network unreliable, breaks puppeteer offline, adds 200-500ms per PDF). Each theme's `tokens.fontFaces` declares the `@font-face` rules it needs, and the scaffold injects them into the `<head>` only when that theme is active. Total font payload per page: 1-3 woff2 files, ~100-300KB.

#### Component variant scope for Phase 1

We design the variant interface with all the options listed above, but **ship only the defaults in Phase 1**. Each theme picks its default variant for each slot; we don't need to implement all 24+ variants on day one. Variants get added lazily as real content surfaces a need (e.g. an assessment sheet plan reveals `name-class-date-strip` is needed → build it). This keeps Phase 1 from ballooning to 8 weeks.

### AI metadata contract

The current contract emits:
```
TITLE: <title>
---
<body markdown>
```

New contract extends it with explicit metadata lines BEFORE `TITLE`:

```
THEME: <one of the 8 slugs>
DOC_TYPE: lesson-plan | assessment-sheet | worksheet
TITLE: <title>
---
<body markdown>
```

- `THEME:` — model's pick when the teacher selected "Auto" (otherwise we use the teacher's explicit pick and ignore this line)
- `DOC_TYPE:` — drives smart component injection (e.g. `assessment-sheet` triggers the Name/Class/Date header strip; `worksheet` triggers answer lines)
- Both lines are optional in the parser. Plans generated before this spec lands have neither — we default to `theme='classroom-classic'` and `doc_type='lesson-plan'`

### Smart component injection

The scaffold layout is fixed (it renders any structured markdown). What VARIES per plan is which component handles each named slot. Two inputs to the decision:

1. **`DOC_TYPE`** from the AI metadata — selects scaffold-level components (e.g. cover header style)
2. **Heading text in body markdown** — selects per-section components (e.g. `## Marking Grid` triggers the bordered-table component; `## Materials` triggers callout-bullets)

The theme then overrides which VARIANT of each component to use (e.g. Studio Pad uses `sketchpad-frame` for figures; Canvas uses `gallery-frame`).

This decouples three concerns cleanly:
- **What is this document?** → `DOC_TYPE` from AI
- **What sections does it contain?** → markdown headings parsed in body
- **How should each section look?** → theme.components overrides

### Fallback chain

Each PDF download attempt:

1. Try **puppeteer + themed HTML** path → if success, return PDF
2. On failure (timeout > 30s, puppeteer crash, browser launch failure), log the error and **fall back to react-pdf** with the current plain renderer
3. Return whatever PDF comes out
4. If BOTH fail, return 500 with a clear error code

The user gets either a beautiful PDF or a plain-but-functional one. Never a broken page.

## 4. Hosting migration: Vercel → Railway

### What changes

| | Vercel | Railway |
|---|---|---|
| Compute model | Serverless functions per route | Single long-running Docker container |
| Function timeout | 10s (Hobby) / 60s default (Pro) | None |
| Bundle size limit | 4.5MB unzipped (Hobby) | None — full Docker image |
| Wildcard SSL | Pro-only | Configure via Cloudflare in front |
| Deploy trigger | Git push to GitHub-connected branch | Git push to Railway-connected branch |
| Cost at our scale | $0 (Hobby, but app broken) or $20 (Pro) | ~$5/mo |

### What stays the same

- Codebase structure
- Next.js framework (just `next start` in production instead of Vercel runtime)
- Supabase, Brevo, R2, Cloudflare DNS — all unchanged
- Env var names (we just paste them into Railway's env panel instead of Vercel's)
- The GitHub repo

### Migration mechanics (high-level — detailed steps in the implementation plan)

1. Add `output: 'standalone'` to `next.config.ts`
2. Add a Dockerfile that builds the standalone output and runs `node server.js`
3. Add `railway.json` (or use Railway's auto-detect) configuring the build + start commands
4. Create Railway project, link to GitHub, point to `feat/ai-lesson-planner` (or merge to `master` first — decision in implementation plan)
5. Copy env vars from Vercel to Railway dashboard
6. Add `SETTINGS_ENCRYPTION_KEY`, all AI provider vars, Supabase vars, etc.
7. Deploy and verify base app works on `*.railway.app` URL
8. Set up Cloudflare DNS: point `skoolrooms.com` and the teacher wildcard `*.skoolrooms.com` at Railway via CNAME or Cloudflare's tunnel
9. Use Cloudflare's Origin Cert (free) for wildcard SSL termination at the edge
10. Configure Cloudflare Page Rules / Configuration Rules to bypass buffering on streaming endpoints (`/api/lesson-plans/generate*`, `/api/lesson-plans/*/revise`)
11. **Cut over DNS at 3-4 AM PKT** (lowest traffic window) with rollback DNS values pre-staged
12. Keep Vercel deployment warm for one week post-cutover as instant rollback
13. Decommission Vercel project after confidence is established

The migration **deletes the Vercel-specific TODO from your memory** ("Vercel per-subdomain registration TODO — launch blocker") because Cloudflare's wildcard cert covers all teacher subdomains.

### What we lose vs. Vercel

- Vercel's automatic preview deployments per branch (Railway has them too but configured slightly differently)
- Vercel's edge network (irrelevant: our users are in Pakistan, Railway has Singapore region nearby)
- Vercel Analytics (we can use PostHog, Plausible, or just nothing for now)

### Risk: single point of failure

Railway running on one container means downtime when Railway has an incident. Mitigations:
- Railway's reliability is generally on par with Vercel's
- We can scale to multiple replicas on Hobby if we need redundancy later
- The codebase stays Docker-portable, so worst-case migration to another host is hours not days

## 5. Theme catalog

Final 8 themes confirmed in brainstorming:

| # | Slug | Name | Vibe | Best for (described to the AI in natural language) |
|---|---|---|---|---|
| 1 | `classroom-classic` | Classroom Classic | Notion-derived: neutral slate, sans serif. Safe default. | Anything that doesn't clearly fit another theme |
| 2 | `modern-notebook` | Modern Notebook | Warm cream paper, terracotta serif. | Primary / middle school, warm-feel content |
| 3 | `worksheet-pro` | Worksheet Pro | B&W, monospace, answer lines built in. | Assessment sheets, homework worksheets |
| 4 | `academic-minimal` | Academic Minimal | Refined, lots of whitespace, serif headings. | Multi-week units, formal academic content |
| 5 | `playful-primary` | Playful Primary | Bright accents, friendly. | Early-primary classes (K-3) |
| 6 | `tech-stem` | Tech & STEM | Blue/violet accents, mono for equations. | Math, physics, chemistry, biology, computer science |
| 7 | `studio-pad` | Studio Pad | Sketchbook feel, dotted paper, image placeholders. | Art, craft, drawing, painting, design |
| 8 | `canvas` | Canvas | Gallery aesthetic, sparse, figure boxes. | Photography, film, design, visual portfolios |

**Note on auto-pick:** the "Best for" column is our mental model. The AI doesn't run regex or rules — it reads the natural-language description of each theme in the prompt and picks one that fits the form inputs (subject, grade, scope). The model's judgment is fuzzy; if it picks something we don't expect, that's usually fine because we ship all 8 themes as valid choices anyway.

Each theme is a fork of an open-design DESIGN.md re-implemented as a TypeScript object. Attribution lives in `lib/lesson-plan/themes/CREDITS.md`.

## 6. Theme picker UX

Inside the New Plan dialog, below the existing form fields:

```
Theme
┌──────────────────────────────────────────┐
│ ✨ Auto — let AI pick               ▼   │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│   ●●●●●  Live mini preview rendered     │
│   ●●●●●  in the actual theme CSS        │
│                                          │
│   Heading                                │
│   • Sample bullet                        │
│   • Sample bullet                        │
└──────────────────────────────────────────┘
```

- Dropdown with 9 options (8 themes + "✨ Auto")
- Below the dropdown: a ~150px-tall live preview rendered with the SELECTED theme's actual CSS. Renders 1 sample heading + 2 bullets + 1 callout.
- When user opens the dropdown and hovers different options, the preview updates live (or only on selection — implementation choice, both acceptable)
- For "Auto," the preview shows a stylized "AI will pick based on your inputs" placeholder

This is option C from the brainstorm — strongest signal to the teacher, ~2 extra days of work building the preview component.

## 7. Database changes

Single new migration: `030_lesson_plans_theme_slug.sql`

```sql
alter table public.lesson_plans
  add column if not exists theme_slug text not null default 'classroom-classic';

-- Constraint to prevent typos — only the 8 known slugs are valid
alter table public.lesson_plans
  add constraint lesson_plans_theme_slug_check
  check (theme_slug in (
    'classroom-classic', 'modern-notebook', 'worksheet-pro',
    'academic-minimal', 'playful-primary', 'tech-stem',
    'studio-pad', 'canvas'
  ));
```

- Default `'classroom-classic'` backfills existing rows (there is currently 1 plan)
- Check constraint prevents drift from the registry
- When we add a 9th theme in the future, we update the constraint via a follow-up migration

`DOC_TYPE` is **not** stored — it's a render-time computation from `inputs.scope` plus body markdown patterns. If we later want analytics on doc types, we can add it then.

## 8. AI prompt + parser updates

### `lib/ai/prompts.ts` — extended output format

Add to the system prompt (only when teacher selected "Auto"):

```
You will pick a visual theme for this lesson plan. Your first output line MUST be:

THEME: <one of: classroom-classic, modern-notebook, worksheet-pro, academic-minimal, playful-primary, tech-stem, studio-pad, canvas>

Use these descriptions to choose:
- classroom-classic — neutral, safe default, any subject
- modern-notebook — warm, friendly, primary/middle school
- worksheet-pro — black & white worksheet style, for assessment/homework sheets
- academic-minimal — formal, generous whitespace, multi-week units
- playful-primary — bright/friendly, K-3 ages
- tech-stem — clean blue accent, math/science/computing
- studio-pad — sketchbook feel, art/craft/drawing
- canvas — gallery aesthetic, photography/design

Your second line is the DOC_TYPE:

DOC_TYPE: <one of: lesson-plan, assessment-sheet, worksheet>

Then the existing format:

TITLE: ...
---
<body>
```

When teacher picked a specific theme, prepend the chosen theme as `THEME: <slug>` in the prompt context (so the model doesn't have to choose) and ask it just for `DOC_TYPE:`.

#### Picker-to-server contract

In the New Plan dialog, the theme field submits as one of:
- `null` (or the string `'auto'`, treated equivalently server-side) — teacher selected "✨ Auto"
- A specific `ThemeSlug` from the registry

Server-side `createLessonPlan` action:
- If `null`/`'auto'`: include the THEME-selection block in the AI prompt; persist whatever slug the AI returns
- If specific slug: validate against registry, persist directly; tell the AI the theme is locked

If the AI returns an invalid slug (typo, unknown), server falls back to `'classroom-classic'` and logs a warning.

#### Revise flow keeps THEME sticky

When a teacher revises a plan, the theme should NOT change underneath them. The revise prompt:
- Pre-populates `THEME: <existing slug>` in the AI's context (not in the request body)
- Pre-populates `DOC_TYPE: <existing or inferred>` similarly
- Asks the model to return ONLY `TITLE:` + body in the same format — no THEME line in the response
- Server keeps `theme_slug` unchanged on the row

If a teacher genuinely wants to switch themes, they use the "Change theme" affordance on the detail page (Phase 2 enhancement — not part of initial scope; for v1 they generate a fresh plan).

### `lib/ai/anthropic.ts` — extended parser

Update `parseAIOutput` to extract `THEME:` and `DOC_TYPE:` lines from the head section (before `---`). Both optional. Pass them up the chain alongside title + body.

Return type extends:

```ts
type PlanResult = {
  title: string
  bodyMarkdown: string
  themeSlug?: ThemeSlug
  docType?: DocType
  model: string
  inputTokens?: number
  outputTokens?: number
}
```

If `themeSlug` is present and teacher picked "Auto," we persist it to `lesson_plans.theme_slug`. If teacher picked a specific theme, we ignore the model's pick.

### Backward compatibility

Plans generated before this spec have no `THEME:` or `DOC_TYPE:` lines. The parser silently treats them as absent and falls back to defaults. No migration needed beyond the schema column default.

## 9. Scaffold + component variants

### Scaffold structure (one template)

```
<article class="plan" data-theme={slug} data-doc-type={docType}>
  <CoverHeader />          {/* per theme: standard | name-class-date-strip | cover-page-hero */}
  <PlanBody>
    {parsedMarkdown.map(block => renderBlock(block, theme))}
  </PlanBody>
  <Footer />               {/* theme + page number on PDF */}
</article>
```

`renderBlock` dispatches to themed components:

| Block type | Components (theme picks variant) |
|---|---|
| Heading "Objectives" | `<Objectives variant={theme.components.objectives} />` |
| Heading "Materials" | `<Materials variant={theme.components.materials} />` |
| Heading "Marking Grid" + following table | `<MarkingGrid variant={theme.components.markingGrid} />` |
| Numbered question with `**(N marks)**` | `<QuestionRow variant={theme.components.questionRow} marks={N} />` |
| `---` | `<Divider variant={theme.components.divider} />` |
| Image placeholder / `[image: ...]` | `<FigureBox variant={theme.components.figureBox} />` |
| Generic `## Heading` | themed H2 |
| Generic paragraph | themed paragraph |
| Generic list | themed list |
| Generic table | themed table |

Each component is small (~50-100 lines) and tested in isolation. We start with the 5-6 components most needed and add others lazily as we encounter content patterns that need them.

### Print-specific CSS

Each theme's `tokens.page` includes the page size + margins. When the component renders in puppeteer (vs the browser), we add a `<style>` block:

```css
@page { size: A4; margin: 20mm; }
@media print {
  body { font-size: 11pt; }
  .pagebreak-before { break-before: page; }
  .no-print { display: none; }
}
```

Headings get `break-after: avoid` so they don't end up alone at page bottom. Tables get `break-inside: avoid` (small tables) or no rule (large tables can split). Headers and footers are positioned with `position: fixed` so they appear on every page.

## 10. PDF route refactor

`app/api/lesson-plans/[id]/pdf/route.tsx`:

```ts
export async function GET(req, ctx) {
  // ... existing auth, plan lookup ...

  try {
    return await renderThemedPdf(plan, teacher, course)  // new path
  } catch (err) {
    console.error('[pdf] themed render failed, falling back:', err)
    return await renderReactPdf(plan, teacher, course)    // existing path
  }
}
```

`renderThemedPdf`:
1. Load theme by slug from registry
2. Render `<LessonPlanThemed plan theme>` via `renderToString` → standalone HTML doc
3. Launch puppeteer browser (singleton, reused across requests)
4. Open new page, `await page.setContent(html, { waitUntil: 'networkidle0' })`
5. `await page.pdf({ format: 'A4', printBackground: true, margin: theme.tokens.page.margin })`
6. Return PDF buffer with same response headers as today

`renderReactPdf` = today's implementation, untouched.

### Puppeteer singleton

Launching a fresh Chromium per request is expensive (1-3s). On Railway we keep a singleton browser instance:

```ts
// lib/pdf/browser.ts
let browser: Browser | null = null
export async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await puppeteer.launch({ args: ['--no-sandbox'] })
  }
  return browser
}
```

Each request gets a new `page` from the singleton browser. Memory per page: ~50MB transient. Idle browser: ~200MB held. Acceptable on Railway Hobby's 8GB ceiling.

If browser dies (process crash, OOM), the next request relaunches it.

## 11. Web detail view update

`app/(teacher)/dashboard/courses/[courseId]/lesson-plans/[planId]/page.tsx`:

Replace the current `<ReactMarkdown>` block in the main markdown view with:

```tsx
<LessonPlanThemed
  plan={plan}
  theme={getTheme(plan.theme_slug)}
  context="web"      // omits print-only CSS, allows chrome around
/>
```

The chat panel + back button + Download PDF button stay where they are. Only the central markdown view becomes themed.

## 12. Streaming preview enhancement

In `components/teacher/LessonPlanChat.tsx` and `NewLessonPlanDialog.tsx`, when rendering the live streaming markdown:

```tsx
<article style={{
  fontFamily: selectedTheme.tokens.font.body,
  color: selectedTheme.tokens.color.text,
}}>
  <h1 style={{ color: selectedTheme.tokens.color.primary }}>{title}</h1>
  <ReactMarkdown>{streamingMarkdown}</ReactMarkdown>
</article>
```

Just typography + primary color, no full theme rendering. Cheap UX win that previews the vibe before the plan finishes generating.

## 13. File structure (new + modified)

### New files
```
lib/lesson-plan/
  themes/
    types.ts                          # Theme, ThemeSlug, DocType types
    index.ts                          # registry + getTheme(slug)
    CREDITS.md                        # open-design attribution
    classroom-classic.ts              # the 8 theme files
    modern-notebook.ts
    worksheet-pro.ts
    academic-minimal.ts
    playful-primary.ts
    tech-stem.ts
    studio-pad.ts
    canvas.ts
  parse-blocks.ts                     # markdown → typed blocks
  components/
    LessonPlanThemed.tsx              # the main component (web + PDF)
    blocks/
      CoverHeader.tsx                 # variants per theme
      Objectives.tsx
      Materials.tsx
      MarkingGrid.tsx
      QuestionRow.tsx
      Divider.tsx
      FigureBox.tsx
      Callout.tsx
      Heading.tsx
      Paragraph.tsx
      List.tsx
      Table.tsx

lib/pdf/
  browser.ts                          # puppeteer singleton
  render-themed.ts                    # renderThemedPdf(plan, teacher, course)
  render-fallback.ts                  # wraps existing react-pdf renderer

components/teacher/
  ThemePickerField.tsx                # dropdown + live preview component
  themed-preview/
    SamplePreview.tsx                 # sample block rendered with a theme

supabase/migrations/
  030_lesson_plans_theme_slug.sql

public/fonts/themed/
  NotoNaskhArabic-Regular.ttf         # Urdu fallback (all themes)
  NotoNaskhArabic-Bold.ttf
  Caveat-Regular.ttf                  # Studio Pad
  PlayfairDisplay-Italic.ttf          # Storybook (if revived) / Stage & Score
  Lora-Regular.ttf                    # warm serif themes
  ... per theme as needed             # see lib/lesson-plan/themes/*.ts fontFaces

Dockerfile
railway.json                          # or rely on Railway auto-detect
.dockerignore
```

### Modified files
```
next.config.ts                        # add output: 'standalone'
package.json                          # add puppeteer
lib/ai/prompts.ts                     # extended output format (THEME, DOC_TYPE)
lib/ai/anthropic.ts                   # parse THEME, DOC_TYPE
lib/ai/provider.ts                    # PlanResult type adds themeSlug, docType
lib/actions/lessonPlans.ts            # accept theme_slug from form, persist to DB
app/(teacher)/dashboard/courses/[courseId]/lesson-plans/[planId]/page.tsx
components/teacher/NewLessonPlanDialog.tsx   # add ThemePickerField
components/teacher/LessonPlanChat.tsx         # themed streaming preview
app/api/lesson-plans/[id]/pdf/route.tsx       # try themed → fallback react-pdf
app/api/lesson-plans/generate/route.ts        # accept theme_slug in body
app/api/lesson-plans/[id]/revise/route.ts     # ensure parser handles THEME in revise
types/database.ts                             # regenerate after migration
```

### Files that stay unchanged
```
components/teacher/LessonPlanPdfDocument.tsx        # react-pdf fallback, untouched
components/teacher/CertificateDocument.tsx          # out of scope
components/teacher/InvoiceDocument.tsx              # out of scope
```

## 14. Migration plan for existing data

There is currently **one** plan in the DB (Ahmed Khan's trigonometry plan). After the schema migration:
- Its `theme_slug` becomes `'classroom-classic'` (the column default)
- The PDF route renders it themed if puppeteer succeeds, or falls back to plain
- The web detail view renders it themed in `'classroom-classic'`
- No content lost; no AI re-run; no broken state

For future plans, the picker UI handles the choice from the start.

## 15. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Puppeteer process accumulates zombie children, OOMs the container | Medium | Container restarts, brief downtime | Singleton browser pattern with auto-reconnect; Railway auto-restarts containers on OOM |
| Theme renders badly on edge cases (unusual markdown, long content) | High | Specific plans look broken | Manual QA across all 8 themes × 3 doc types; fallback always returns SOMETHING |
| Cloudflare Origin Cert misconfiguration blocks wildcard subdomains | Medium during migration, Low after | Teacher subdomains unreachable | Test wildcard cert against a couple of `*.skoolrooms.com` URLs before DNS cutover |
| AI emits invalid THEME slug (typo, made-up name) | Low | Auto-pick falls back to default | Parser validates against registry; unknown slug → `'classroom-classic'` |
| Railway has an outage | Low | Full site down | Same risk as Vercel; Docker-portable code means worst-case migration in hours |
| Migration to Railway breaks something unexpected (env, networking) | Medium | Pre-launch, low blast | Keep Vercel project as warm backup during cutover week |
| 8 themes is too many UX choices for teachers | Medium | Choice paralysis | "Auto" default at top of dropdown; teacher who doesn't care doesn't have to think |
| Themed rendering is slower than react-pdf | Likely (1-3s vs <500ms) | Slight UX regression on download | Acceptable — quality matters more than 1-2s; pre-warm browser; users are accustomed to PDF generation taking a moment |
| Using full puppeteer vs @sparticuz/chromium on Railway — unclear which | Low | Wasted dependency choice | Use FULL `puppeteer` package since we have filesystem and memory on Railway — no need for the serverless-optimized variant |
| Cloudflare in front of Railway buffers Server-Sent Events streams | Medium | Streaming preview UX broken — tokens arrive in one burst at end | The streaming routes already set `Cache-Control: no-cache, no-transform` + `X-Accel-Buffering: no`. Cloudflare needs explicit per-route rules: enable "no-buffer" / "no-cache" on `/api/lesson-plans/generate` and `/api/lesson-plans/[id]/revise` paths. Test SSE flow end-to-end after CF + Railway are wired up. |
| DNS cutover at peak traffic disrupts active users | Low | Brief 500s for users mid-session | Schedule cutover for 3-4 AM PKT (lowest traffic). Keep Vercel deployment warm for a week post-cutover as immediate rollback target. Prepare DNS rollback steps in a runbook before cutover. |
| Concurrent puppeteer instances exhaust container memory under burst | Low (at 20-teacher scale) | Some PDF requests queue/fail | Singleton browser pattern means one Chromium process across all requests. Each `page` adds ~50MB transient. 20 simultaneous pages = ~1GB total — well under Hobby's 8GB ceiling. |

## 16. Testing plan

No automated test framework in the project per CLAUDE.md — manual verification only.

### End-to-end smoke test
1. Deploy to Railway, verify base app works on `*.railway.app` URL
2. Log in as Ahmed Khan
3. Generate a new plan with theme = "Auto" → verify model picks a theme, plan persists with `theme_slug` set
4. View the plan in the detail view → verify themed rendering
5. Download PDF → verify themed PDF with correct fonts, colors, layout
6. Try each of the 8 themes manually → screenshot the PDF for each, verify nothing looks broken
7. Trigger fallback by temporarily breaking puppeteer (e.g. set a bad chromium binary path env) → verify react-pdf fallback fires and serves a plain PDF
8. Revise the plan → verify revision keeps the same theme; PDF re-renders cleanly
9. Generate a plan with `Auto` picking each subject type to verify the heuristic descriptions in the prompt are being honored
10. Log in as a second teacher → verify RLS blocks access to Ahmed's plan via the PDF URL

### Doc-type smoke tests
1. Generate a "lesson plan" — verify standard cover header
2. Generate an "assessment sheet" (model emits `DOC_TYPE: assessment-sheet`) — verify Name/Class/Date strip appears at top
3. Generate a "worksheet" — verify answer lines appear under each question

### Wildcard subdomain test
1. After DNS cutover, hit `https://random-teacher.skoolrooms.com/some-path`
2. Verify SSL cert is valid + traffic reaches the app

## 17. Rollout plan

1. **Week 1** — Spec approved. Implementation plan written. Begin theme component implementation locally.
2. **Week 2** — All 8 themes + scaffold + ThemePickerField done locally. Manual QA on Ahmed Khan's plan.
3. **Week 3** — PDF route refactor + puppeteer integration. AI metadata contract live. End-to-end test on `npm run dev`.
4. **Week 4** — Railway migration: Dockerfile, Cloudflare DNS, env var copy. Deploy to Railway. Smoke test. Cut over DNS.
5. **Post-launch** — Monitor PDF latency, Railway memory pressure. Iterate on theme components based on real teacher feedback. Consider adding a 9th theme if a clear gap emerges.

The Vercel project stays warm (deploys still happen automatically on git push) for a week post-cutover as a fallback. After confidence is established, decommission.

## 18. Open questions deferred to the implementation phase

These don't block spec approval but should be decided during plan-writing:

- **Should the puppeteer browser be shared across replicas?** Hobby tier allows up to 5 replicas. If we use multiple replicas later, each gets its own browser instance — fine. No coordination needed.
- **Cold-start mitigation** — should we pre-warm puppeteer at container startup, or lazy-launch on first request? Lazy probably fine for now; revisit if first-PDF-of-the-day complaints surface.
- **Cloudflare Tunnel vs DNS CNAME** for connecting Cloudflare to Railway — both work, Tunnel is more secure; decide in implementation plan.
- **Theme picker preview component** — render the same `<LessonPlanThemed>` with a tiny sample dataset, or hand-author the previews? Probably the former for honesty (no preview drift from real output).
