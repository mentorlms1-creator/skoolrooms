# Themed PDF Lesson Plans + Railway Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the react-pdf renderer with themed HTML rendered through puppeteer (8 themes), and migrate hosting from Vercel to Railway so the new pipeline (plus the existing AI streaming) actually runs in production.

**Architecture:** One React component (`<LessonPlanThemed>`) renders the same themed view in two places: directly inside the teacher detail page, and via `renderToString` + puppeteer for PDF download. Themes are TypeScript objects with both style tokens and per-slot component variants. AI emits explicit `THEME:` and `DOC_TYPE:` metadata inline with the existing generation call. react-pdf stays as a fallback path. Hosting moves to Railway Hobby (~$5/mo) running a single Docker container — no function timeouts, full filesystem for puppeteer.

**Tech Stack:** Next.js 16 (App Router, standalone output), React 19, TypeScript strict, `puppeteer` (full bundle, not @sparticuz/chromium), `react-dom/server` for HTML rendering, Tailwind v4 for styling, Supabase Postgres for data, Railway for hosting, Cloudflare for DNS + wildcard SSL.

**Spec:** `docs/superpowers/specs/2026-05-17-themed-pdf-railway-design.md` — read it before starting.

**Testing convention:** This project has no automated test framework. Each task's "verify" step describes how to manually check the change works. Don't add a test framework — out of scope.

**Phase structure:**
- **Phase A** (Tasks 1–30): Build themed system locally on `npm run dev`. No deployment changes.
- **Phase B** (Tasks 31–38): Railway migration. App is now hosted on Railway.
- **Phase C** (Tasks 39–45): Production smoke tests, monitoring, cleanup.

Each phase ends in a deployable, working state.

---

## File map

### New files (most created in Phase A)
```
lib/lesson-plan/
  themes/
    types.ts                          # Theme, ThemeSlug, DocType, FontFace types
    index.ts                          # registry + getTheme(slug) + DEFAULT_THEME
    CREDITS.md                        # open-design attribution
    common-fontfaces.ts               # shared @font-face declarations (Noto Naskh Arabic)
    classroom-classic.ts              # 8 theme files
    modern-notebook.ts
    worksheet-pro.ts
    academic-minimal.ts
    playful-primary.ts
    tech-stem.ts
    studio-pad.ts
    canvas.ts
  parse-blocks.ts                     # parseBlocks(markdown): Block[]
  blocks/
    index.ts                          # re-exports all block components
    Heading.tsx
    Paragraph.tsx
    List.tsx
    Table.tsx
    Divider.tsx
    Callout.tsx
    CoverHeader.tsx                   # variants: standard | name-class-date-strip
    Objectives.tsx                    # variants: callout-checklist | simple-bullets
    Materials.tsx                     # variants: callout-bullets | inline-list
    MarkingGrid.tsx                   # variants: bordered-table | shaded-table
    QuestionRow.tsx                   # variants: standard | marks-badge-right
    FigureBox.tsx                     # variants: caption-below | sketchpad-frame | gallery-frame
  LessonPlanThemed.tsx                # main themed component

lib/pdf/
  browser.ts                          # puppeteer singleton + getBrowser()
  render-themed.ts                    # renderThemedPdf(plan, teacher, course)
  render-fallback.ts                  # renderReactPdf(plan, teacher, course) wrapping existing
  fonts.ts                            # readFontAsDataUri() for embedding in HTML head

components/teacher/
  ThemePickerField.tsx                # dropdown + live preview
  ThemePreviewCard.tsx                # the live mini-preview component

supabase/migrations/
  030_lesson_plans_theme_slug.sql

public/fonts/themed/
  NotoNaskhArabic-Regular.ttf
  NotoNaskhArabic-Bold.ttf
  Caveat-Regular.ttf                  # Studio Pad
  Lora-Regular.ttf                    # Modern Notebook
  Lora-Bold.ttf
  PlayfairDisplay-Regular.ttf         # Storybook-style themes
  CrimsonText-Regular.ttf             # Modern Notebook fallback
  # any others a theme needs

Dockerfile
.dockerignore
railway.json
```

### Modified files
```
next.config.ts                                  # add output: 'standalone'
package.json                                    # add puppeteer
lib/ai/prompts.ts                               # extended output format
lib/ai/anthropic.ts                             # parse THEME, DOC_TYPE
lib/ai/provider.ts                              # PlanResult adds themeSlug, docType
lib/actions/lessonPlans.ts                      # accept + persist theme_slug
app/(teacher)/dashboard/courses/[courseId]/lesson-plans/[planId]/page.tsx
components/teacher/NewLessonPlanDialog.tsx
components/teacher/LessonPlanChat.tsx
app/api/lesson-plans/[id]/pdf/route.tsx
app/api/lesson-plans/generate/route.ts
app/api/lesson-plans/[id]/revise/route.ts
types/database.ts
```

### Unchanged
```
components/teacher/LessonPlanPdfDocument.tsx   # react-pdf fallback path
components/teacher/CertificateDocument.tsx     # out of scope
components/teacher/InvoiceDocument.tsx         # out of scope
```

---

# PHASE A — Build themed system locally

## Task 1: Schema migration — add `theme_slug` column

**Files:**
- Create: `supabase/migrations/030_lesson_plans_theme_slug.sql`

- [ ] **Step 1: Verify migration number is free**

Run: `Get-ChildItem supabase/migrations/ | Sort-Object Name | Select-Object -Last 3`
Expected: latest is `029_*`. If `030_*` exists, bump to next free.

- [ ] **Step 2: Write the migration**

```sql
-- Add theme_slug column to lesson_plans for the themed PDF feature.
-- Default 'classroom-classic' covers existing rows; CHECK constraint
-- prevents drift from the theme registry.

alter table public.lesson_plans
  add column if not exists theme_slug text not null default 'classroom-classic';

alter table public.lesson_plans
  add constraint lesson_plans_theme_slug_check
  check (theme_slug in (
    'classroom-classic', 'modern-notebook', 'worksheet-pro',
    'academic-minimal', 'playful-primary', 'tech-stem',
    'studio-pad', 'canvas'
  ));
```

- [ ] **Step 3: Apply migration via Supabase MCP**

Use `mcp__plugin_supabase_supabase__apply_migration` with project_id `eqmomcwrmfatzftkbdbb`, name `lesson_plans_theme_slug`, query = the SQL above.

Expected: `{"success": true}`

- [ ] **Step 4: Verify**

Use `mcp__plugin_supabase_supabase__execute_sql` to run:
```sql
select id, theme_slug from lesson_plans;
```
Expected: every existing row has `theme_slug = 'classroom-classic'`.

- [ ] **Step 5: Commit**

```
git add supabase/migrations/030_lesson_plans_theme_slug.sql
git commit -m "feat(db): add theme_slug column to lesson_plans"
```

---

## Task 2: Regenerate database types

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Regenerate types via MCP**

Use `mcp__plugin_supabase_supabase__generate_typescript_types` with project_id `eqmomcwrmfatzftkbdbb`.

- [ ] **Step 2: Write the output to `types/database.ts`**

Extract `inner.types` from the MCP result JSON and write the string to `types/database.ts` with UTF-8 encoding, no trailing newline injection.

PowerShell pattern (controller will handle this via a one-liner — agents that need to write types should adapt to whatever extraction worked in previous migrations on this branch).

- [ ] **Step 3: Verify `theme_slug` is present**

Run:
```
Select-String -Path types/database.ts -Pattern 'theme_slug' | Select-Object -First 3 | ForEach-Object { $_.Line.Trim() }
```
Expected: shows `theme_slug: string` (Row), `theme_slug?: string` (Insert), `theme_slug?: string` (Update).

- [ ] **Step 4: Typecheck**

```
npx tsc --noEmit
```
Expected: no errors in non-`.next/` files.

- [ ] **Step 5: Commit**

```
git add types/database.ts
git commit -m "chore(types): regenerate after theme_slug migration"
```

---

## Task 3: Define theme TypeScript types

**Files:**
- Create: `lib/lesson-plan/themes/types.ts`

- [ ] **Step 1: Write the types file**

```ts
// =============================================================================
// lib/lesson-plan/themes/types.ts — Theme system type definitions.
// Themes are pure TypeScript objects (see ./classroom-classic.ts etc.) so
// the type system catches typos in token names and component variant slugs.
// =============================================================================

export const THEME_SLUGS = [
  'classroom-classic',
  'modern-notebook',
  'worksheet-pro',
  'academic-minimal',
  'playful-primary',
  'tech-stem',
  'studio-pad',
  'canvas',
] as const

export type ThemeSlug = (typeof THEME_SLUGS)[number]

export const DOC_TYPES = ['lesson-plan', 'assessment-sheet', 'worksheet'] as const
export type DocType = (typeof DOC_TYPES)[number]

export type ColorTokens = {
  primary: string
  accent: string
  text: string
  muted: string
  surface: string        // page background
  divider: string        // hr / table borders
}

export type FontTokens = {
  body: string           // CSS font-family stack
  heading: string
  mono: string
  urdu: string           // Latin font with Urdu fallback appended
}

export type SpaceTokens = {
  tightSection: string   // e.g. '8px'
  paragraph: string
  callout: string
}

export type PageTokens = {
  size: 'A4'
  margin: string         // CSS margin shorthand, e.g. '20mm'
}

export type FontFace = {
  family: string
  src: string            // path relative to /public, e.g. '/fonts/themed/Lora-Regular.ttf'
  weight: 400 | 500 | 600 | 700
  style?: 'normal' | 'italic'
}

export type ComponentVariants = {
  coverHeader:  'standard' | 'name-class-date-strip' | 'cover-page-hero'
  objectives:   'callout-checklist' | 'numbered-list' | 'simple-bullets'
  materials:    'callout-bullets' | 'icon-grid' | 'inline-list'
  markingGrid:  'bordered-table' | 'shaded-table'
  questionRow:  'standard' | 'marks-badge-right' | 'answer-line-below'
  divider:      'thin-rule' | 'ornament' | 'shadow-band'
  figureBox:    'caption-below' | 'sketchpad-frame' | 'gallery-frame'
  callout:      'tinted-left-border' | 'dashed-box' | 'cream-card'
}

export type Theme = {
  slug: ThemeSlug
  name: string
  description: string
  tokens: {
    color: ColorTokens
    font: FontTokens
    space: SpaceTokens
    page: PageTokens
    fontFaces?: FontFace[]
  }
  components: ComponentVariants
}
```

- [ ] **Step 2: Typecheck**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```
git add lib/lesson-plan/themes/types.ts
git commit -m "feat(themes): theme type definitions"
```

---

## Task 4: Download self-hosted font files

**Files:**
- Create: `public/fonts/themed/NotoNaskhArabic-Regular.ttf`
- Create: `public/fonts/themed/NotoNaskhArabic-Bold.ttf`
- Create: `public/fonts/themed/Lora-Regular.ttf`
- Create: `public/fonts/themed/Lora-Bold.ttf`
- Create: `public/fonts/themed/Caveat-Regular.ttf`
- Create: `public/fonts/themed/PlayfairDisplay-Regular.ttf`
- Create: `public/fonts/themed/CrimsonText-Regular.ttf`

- [ ] **Step 1: Create directory**

```powershell
if (!(Test-Path public/fonts/themed)) { New-Item -ItemType Directory -Path public/fonts/themed -Force | Out-Null }
```

- [ ] **Step 2: Download fonts from jsdelivr CDN**

PowerShell, one block:
```powershell
$base = 'https://cdn.jsdelivr.net/npm/@fontsource'
$files = @(
  @{ pkg='noto-naskh-arabic'; file='files/noto-naskh-arabic-arabic-400-normal.ttf'; out='NotoNaskhArabic-Regular.ttf' },
  @{ pkg='noto-naskh-arabic'; file='files/noto-naskh-arabic-arabic-700-normal.ttf'; out='NotoNaskhArabic-Bold.ttf' },
  @{ pkg='lora'; file='files/lora-latin-400-normal.ttf'; out='Lora-Regular.ttf' },
  @{ pkg='lora'; file='files/lora-latin-700-normal.ttf'; out='Lora-Bold.ttf' },
  @{ pkg='caveat'; file='files/caveat-latin-400-normal.ttf'; out='Caveat-Regular.ttf' },
  @{ pkg='playfair-display'; file='files/playfair-display-latin-400-normal.ttf'; out='PlayfairDisplay-Regular.ttf' },
  @{ pkg='crimson-text'; file='files/crimson-text-latin-400-normal.ttf'; out='CrimsonText-Regular.ttf' }
)
foreach ($f in $files) {
  $url = "$base/$($f.pkg)@5/$($f.file)"
  Invoke-WebRequest -Uri $url -OutFile "public/fonts/themed/$($f.out)"
}
Get-ChildItem public/fonts/themed | Select-Object Name, Length | Format-Table -AutoSize
```

Expected: 7 files, each between 50KB and 200KB.

- [ ] **Step 3: Verify font directory contents**

```powershell
Get-ChildItem public/fonts/themed | Measure-Object | Select-Object -ExpandProperty Count
```
Expected: `7`

- [ ] **Step 4: Update .gitignore (NO — fonts are committed)**

Confirm fonts are NOT in `.gitignore`. They get committed so Vercel/Railway have them at deploy time.

```
Select-String -Path .gitignore -Pattern 'fonts'
```
Expected: no output (fonts not gitignored).

- [ ] **Step 5: Commit**

```
git add public/fonts/themed/
git commit -m "chore(fonts): bundle Noto Naskh Arabic + theme display fonts"
```

---

## Task 5: Common font faces declaration

**Files:**
- Create: `lib/lesson-plan/themes/common-fontfaces.ts`

- [ ] **Step 1: Write the shared font faces**

```ts
// =============================================================================
// lib/lesson-plan/themes/common-fontfaces.ts — @font-face declarations
// used by all themes. Noto Naskh Arabic is everywhere so Urdu glyphs in
// Latin-font themes fall back to readable Arabic-script characters.
// =============================================================================

import type { FontFace } from './types'

export const NOTO_NASKH_ARABIC: FontFace[] = [
  {
    family: 'Noto Naskh Arabic',
    src: '/fonts/themed/NotoNaskhArabic-Regular.ttf',
    weight: 400,
  },
  {
    family: 'Noto Naskh Arabic',
    src: '/fonts/themed/NotoNaskhArabic-Bold.ttf',
    weight: 700,
  },
]
```

- [ ] **Step 2: Typecheck + commit**

```
npx tsc --noEmit
git add lib/lesson-plan/themes/common-fontfaces.ts
git commit -m "feat(themes): shared Noto Naskh Arabic font faces"
```

---

## Task 6: Theme — Classroom Classic

**Files:**
- Create: `lib/lesson-plan/themes/classroom-classic.ts`

- [ ] **Step 1: Write the theme**

```ts
// =============================================================================
// Classroom Classic — Notion-derived neutral default.
// Sans-serif, slate accent, restrained color. Safe for any subject.
// =============================================================================

import type { Theme } from './types'
import { NOTO_NASKH_ARABIC } from './common-fontfaces'

export const classroomClassic: Theme = {
  slug: 'classroom-classic',
  name: 'Classroom Classic',
  description: 'Neutral, sans serif, slate accent — safe default for any subject.',
  tokens: {
    color: {
      primary: '#37352f',    // Notion graphite
      accent:  '#1e3a8a',    // navy
      text:    '#37352f',
      muted:   '#787774',
      surface: '#ffffff',
      divider: '#e9e9e7',
    },
    font: {
      body:    "-apple-system, ui-sans-serif, system-ui, 'Segoe UI', Roboto, sans-serif",
      heading: "-apple-system, ui-sans-serif, system-ui, 'Segoe UI', Roboto, sans-serif",
      mono:    "ui-monospace, 'JetBrains Mono', Menlo, monospace",
      urdu:    "'Noto Naskh Arabic', -apple-system, ui-sans-serif, sans-serif",
    },
    space: {
      tightSection: '8px',
      paragraph:    '12px',
      callout:      '12px',
    },
    page: {
      size: 'A4',
      margin: '20mm',
    },
    fontFaces: [...NOTO_NASKH_ARABIC],
  },
  components: {
    coverHeader:  'standard',
    objectives:   'simple-bullets',
    materials:    'callout-bullets',
    markingGrid:  'bordered-table',
    questionRow:  'standard',
    divider:      'thin-rule',
    figureBox:    'caption-below',
    callout:      'tinted-left-border',
  },
}
```

- [ ] **Step 2: Typecheck + commit**

```
npx tsc --noEmit
git add lib/lesson-plan/themes/classroom-classic.ts
git commit -m "feat(themes): Classroom Classic theme"
```

---

## Task 7: Theme — Modern Notebook

**Files:**
- Create: `lib/lesson-plan/themes/modern-notebook.ts`

- [ ] **Step 1: Write the theme**

```ts
// =============================================================================
// Modern Notebook — Anthropic / warm editorial fork.
// Cream paper background, terracotta serif accent. Primary / middle school.
// =============================================================================

import type { Theme } from './types'
import { NOTO_NASKH_ARABIC } from './common-fontfaces'

export const modernNotebook: Theme = {
  slug: 'modern-notebook',
  name: 'Modern Notebook',
  description: 'Cream paper, terracotta serif headings — warm, primary / middle school feel.',
  tokens: {
    color: {
      primary: '#9a3412',    // terracotta
      accent:  '#ca8a04',    // amber
      text:    '#3a2e1f',
      muted:   '#78716c',
      surface: '#faf6ef',    // cream paper
      divider: '#e7e2d8',
    },
    font: {
      body:    "'Lora', Georgia, 'Iowan Old Style', serif",
      heading: "'Lora', 'Iowan Old Style', Georgia, serif",
      mono:    "ui-monospace, Menlo, monospace",
      urdu:    "'Noto Naskh Arabic', 'Lora', Georgia, serif",
    },
    space: { tightSection: '8px', paragraph: '12px', callout: '12px' },
    page: { size: 'A4', margin: '22mm' },
    fontFaces: [
      ...NOTO_NASKH_ARABIC,
      { family: 'Lora', src: '/fonts/themed/Lora-Regular.ttf', weight: 400 },
      { family: 'Lora', src: '/fonts/themed/Lora-Bold.ttf', weight: 700 },
    ],
  },
  components: {
    coverHeader:  'standard',
    objectives:   'simple-bullets',
    materials:    'callout-bullets',
    markingGrid:  'bordered-table',
    questionRow:  'standard',
    divider:      'thin-rule',
    figureBox:    'caption-below',
    callout:      'cream-card',
  },
}
```

- [ ] **Step 2: Commit**

```
npx tsc --noEmit
git add lib/lesson-plan/themes/modern-notebook.ts
git commit -m "feat(themes): Modern Notebook theme"
```

---

## Task 8: Theme — Worksheet Pro

**Files:**
- Create: `lib/lesson-plan/themes/worksheet-pro.ts`

- [ ] **Step 1: Write the theme**

```ts
// =============================================================================
// Worksheet Pro — Vercel fork.
// B&W, monospace, dense, answer lines built in. For assessments / worksheets.
// =============================================================================

import type { Theme } from './types'
import { NOTO_NASKH_ARABIC } from './common-fontfaces'

export const worksheetPro: Theme = {
  slug: 'worksheet-pro',
  name: 'Worksheet Pro',
  description: 'B&W, monospace, answer lines — printable assessments and homework.',
  tokens: {
    color: {
      primary: '#000000',
      accent:  '#000000',
      text:    '#000000',
      muted:   '#525252',
      surface: '#ffffff',
      divider: '#000000',
    },
    font: {
      body:    "ui-monospace, 'JetBrains Mono', Menlo, monospace",
      heading: "ui-monospace, 'JetBrains Mono', Menlo, monospace",
      mono:    "ui-monospace, 'JetBrains Mono', Menlo, monospace",
      urdu:    "'Noto Naskh Arabic', ui-monospace, monospace",
    },
    space: { tightSection: '6px', paragraph: '10px', callout: '10px' },
    page: { size: 'A4', margin: '18mm' },
    fontFaces: [...NOTO_NASKH_ARABIC],
  },
  components: {
    coverHeader:  'name-class-date-strip',
    objectives:   'simple-bullets',
    materials:    'inline-list',
    markingGrid:  'bordered-table',
    questionRow:  'answer-line-below',
    divider:      'thin-rule',
    figureBox:    'caption-below',
    callout:      'dashed-box',
  },
}
```

- [ ] **Step 2: Commit**

```
npx tsc --noEmit
git add lib/lesson-plan/themes/worksheet-pro.ts
git commit -m "feat(themes): Worksheet Pro theme"
```

---

## Task 9: Theme — Academic Minimal

**Files:**
- Create: `lib/lesson-plan/themes/academic-minimal.ts`

- [ ] **Step 1: Write the theme**

```ts
// =============================================================================
// Academic Minimal — Apple fork.
// Mostly white, generous whitespace, refined sans + serif headings.
// O-Level / Cambridge / formal academic content.
// =============================================================================

import type { Theme } from './types'
import { NOTO_NASKH_ARABIC } from './common-fontfaces'

export const academicMinimal: Theme = {
  slug: 'academic-minimal',
  name: 'Academic Minimal',
  description: 'Refined, generous whitespace, serif headings — formal academic content.',
  tokens: {
    color: {
      primary: '#000000',
      accent:  '#1c1c1e',
      text:    '#1c1c1e',
      muted:   '#3a3a3c',
      surface: '#ffffff',
      divider: '#d2d2d7',
    },
    font: {
      body:    "-apple-system, 'SF Pro Text', system-ui, sans-serif",
      heading: "'PlayfairDisplay', 'New York', 'Times New Roman', serif",
      mono:    "ui-monospace, 'SF Mono', Menlo, monospace",
      urdu:    "'Noto Naskh Arabic', -apple-system, system-ui, sans-serif",
    },
    space: { tightSection: '12px', paragraph: '16px', callout: '14px' },
    page: { size: 'A4', margin: '25mm' },
    fontFaces: [
      ...NOTO_NASKH_ARABIC,
      { family: 'PlayfairDisplay', src: '/fonts/themed/PlayfairDisplay-Regular.ttf', weight: 400 },
    ],
  },
  components: {
    coverHeader:  'cover-page-hero',
    objectives:   'numbered-list',
    materials:    'inline-list',
    markingGrid:  'shaded-table',
    questionRow:  'standard',
    divider:      'thin-rule',
    figureBox:    'caption-below',
    callout:      'tinted-left-border',
  },
}
```

- [ ] **Step 2: Commit**

```
npx tsc --noEmit
git add lib/lesson-plan/themes/academic-minimal.ts
git commit -m "feat(themes): Academic Minimal theme"
```

---

## Task 10: Theme — Playful Primary

**Files:**
- Create: `lib/lesson-plan/themes/playful-primary.ts`

- [ ] **Step 1: Write the theme**

```ts
// =============================================================================
// Playful Primary — Material fork.
// Bright accents, larger fonts, friendly. K-3.
// =============================================================================

import type { Theme } from './types'
import { NOTO_NASKH_ARABIC } from './common-fontfaces'

export const playfulPrimary: Theme = {
  slug: 'playful-primary',
  name: 'Playful Primary',
  description: 'Bright accents, friendly type — early primary classes (K-3).',
  tokens: {
    color: {
      primary: '#7c3aed',    // purple
      accent:  '#ec4899',    // pink
      text:    '#1a1a2e',
      muted:   '#52525b',
      surface: '#ffffff',
      divider: '#fce7f3',
    },
    font: {
      body:    "system-ui, 'Lexend', -apple-system, sans-serif",
      heading: "system-ui, 'Lexend', -apple-system, sans-serif",
      mono:    "ui-monospace, monospace",
      urdu:    "'Noto Naskh Arabic', system-ui, sans-serif",
    },
    space: { tightSection: '10px', paragraph: '14px', callout: '14px' },
    page: { size: 'A4', margin: '20mm' },
    fontFaces: [...NOTO_NASKH_ARABIC],
  },
  components: {
    coverHeader:  'standard',
    objectives:   'callout-checklist',
    materials:    'icon-grid',
    markingGrid:  'shaded-table',
    questionRow:  'standard',
    divider:      'ornament',
    figureBox:    'caption-below',
    callout:      'cream-card',
  },
}
```

- [ ] **Step 2: Commit**

```
npx tsc --noEmit
git add lib/lesson-plan/themes/playful-primary.ts
git commit -m "feat(themes): Playful Primary theme"
```

---

## Task 11: Theme — Tech & STEM

**Files:**
- Create: `lib/lesson-plan/themes/tech-stem.ts`

- [ ] **Step 1: Write the theme**

```ts
// =============================================================================
// Tech & STEM — Stripe fork.
// Blue/violet accents, mono for equations. Math, physics, chem, bio, comp sci.
// =============================================================================

import type { Theme } from './types'
import { NOTO_NASKH_ARABIC } from './common-fontfaces'

export const techStem: Theme = {
  slug: 'tech-stem',
  name: 'Tech & STEM',
  description: 'Blue/violet accents, mono code — math, physics, chemistry, biology, computing.',
  tokens: {
    color: {
      primary: '#635bff',    // Stripe violet
      accent:  '#0a2540',    // deep navy
      text:    '#0a2540',
      muted:   '#425466',
      surface: '#ffffff',
      divider: '#e3e8ee',
    },
    font: {
      body:    "'Inter', -apple-system, system-ui, sans-serif",
      heading: "'Inter', -apple-system, system-ui, sans-serif",
      mono:    "ui-monospace, 'JetBrains Mono', Menlo, monospace",
      urdu:    "'Noto Naskh Arabic', 'Inter', system-ui, sans-serif",
    },
    space: { tightSection: '8px', paragraph: '12px', callout: '12px' },
    page: { size: 'A4', margin: '20mm' },
    fontFaces: [...NOTO_NASKH_ARABIC],
  },
  components: {
    coverHeader:  'standard',
    objectives:   'numbered-list',
    materials:    'callout-bullets',
    markingGrid:  'bordered-table',
    questionRow:  'marks-badge-right',
    divider:      'thin-rule',
    figureBox:    'caption-below',
    callout:      'tinted-left-border',
  },
}
```

- [ ] **Step 2: Commit**

```
npx tsc --noEmit
git add lib/lesson-plan/themes/tech-stem.ts
git commit -m "feat(themes): Tech & STEM theme"
```

---

## Task 12: Theme — Studio Pad

**Files:**
- Create: `lib/lesson-plan/themes/studio-pad.ts`

- [ ] **Step 1: Write the theme**

```ts
// =============================================================================
// Studio Pad — sketchbook feel.
// Dotted paper, hand-drawn-style accents, image placeholders prominent.
// Art / craft / drawing / design.
// =============================================================================

import type { Theme } from './types'
import { NOTO_NASKH_ARABIC } from './common-fontfaces'

export const studioPad: Theme = {
  slug: 'studio-pad',
  name: 'Studio Pad',
  description: 'Sketchbook feel, dotted paper, image placeholders — art and craft subjects.',
  tokens: {
    color: {
      primary: '#a16207',    // ochre
      accent:  '#ca8a04',
      text:    '#1f2937',
      muted:   '#6b7280',
      surface: '#fefce8',    // pale cream
      divider: '#fef3c7',
    },
    font: {
      body:    "'Caveat', system-ui, sans-serif",
      heading: "'Caveat', system-ui, sans-serif",
      mono:    "ui-monospace, monospace",
      urdu:    "'Noto Naskh Arabic', system-ui, sans-serif",
    },
    space: { tightSection: '8px', paragraph: '14px', callout: '14px' },
    page: { size: 'A4', margin: '20mm' },
    fontFaces: [
      ...NOTO_NASKH_ARABIC,
      { family: 'Caveat', src: '/fonts/themed/Caveat-Regular.ttf', weight: 400 },
    ],
  },
  components: {
    coverHeader:  'standard',
    objectives:   'simple-bullets',
    materials:    'icon-grid',
    markingGrid:  'bordered-table',
    questionRow:  'standard',
    divider:      'ornament',
    figureBox:    'sketchpad-frame',
    callout:      'dashed-box',
  },
}
```

- [ ] **Step 2: Commit**

```
npx tsc --noEmit
git add lib/lesson-plan/themes/studio-pad.ts
git commit -m "feat(themes): Studio Pad theme"
```

---

## Task 13: Theme — Canvas

**Files:**
- Create: `lib/lesson-plan/themes/canvas.ts`

- [ ] **Step 1: Write the theme**

```ts
// =============================================================================
// Canvas — gallery aesthetic.
// Sparse, mostly white, figure-with-caption boxes prominent.
// Photography / film / design.
// =============================================================================

import type { Theme } from './types'
import { NOTO_NASKH_ARABIC } from './common-fontfaces'

export const canvas: Theme = {
  slug: 'canvas',
  name: 'Canvas',
  description: 'Gallery aesthetic, sparse, figure-with-caption — photography / film / design.',
  tokens: {
    color: {
      primary: '#171717',
      accent:  '#404040',
      text:    '#171717',
      muted:   '#737373',
      surface: '#ffffff',
      divider: '#e5e5e5',
    },
    font: {
      body:    "'Inter', -apple-system, system-ui, sans-serif",
      heading: "'Inter', -apple-system, system-ui, sans-serif",
      mono:    "ui-monospace, Menlo, monospace",
      urdu:    "'Noto Naskh Arabic', 'Inter', system-ui, sans-serif",
    },
    space: { tightSection: '12px', paragraph: '18px', callout: '14px' },
    page: { size: 'A4', margin: '25mm' },
    fontFaces: [...NOTO_NASKH_ARABIC],
  },
  components: {
    coverHeader:  'cover-page-hero',
    objectives:   'simple-bullets',
    materials:    'inline-list',
    markingGrid:  'bordered-table',
    questionRow:  'standard',
    divider:      'shadow-band',
    figureBox:    'gallery-frame',
    callout:      'tinted-left-border',
  },
}
```

- [ ] **Step 2: Commit**

```
npx tsc --noEmit
git add lib/lesson-plan/themes/canvas.ts
git commit -m "feat(themes): Canvas theme"
```

---

## Task 14: Theme registry index

**Files:**
- Create: `lib/lesson-plan/themes/index.ts`

- [ ] **Step 1: Write the registry**

```ts
// =============================================================================
// lib/lesson-plan/themes/index.ts — Typed registry of all themes.
// Adding a theme: import it here, add to THEMES, and add the slug to
// THEME_SLUGS in types.ts (which also drives the DB CHECK constraint).
// =============================================================================

import type { Theme, ThemeSlug } from './types'
import { classroomClassic } from './classroom-classic'
import { modernNotebook }   from './modern-notebook'
import { worksheetPro }     from './worksheet-pro'
import { academicMinimal }  from './academic-minimal'
import { playfulPrimary }   from './playful-primary'
import { techStem }         from './tech-stem'
import { studioPad }        from './studio-pad'
import { canvas }           from './canvas'

export const THEMES: Record<ThemeSlug, Theme> = {
  'classroom-classic': classroomClassic,
  'modern-notebook':   modernNotebook,
  'worksheet-pro':     worksheetPro,
  'academic-minimal':  academicMinimal,
  'playful-primary':   playfulPrimary,
  'tech-stem':         techStem,
  'studio-pad':        studioPad,
  'canvas':            canvas,
}

export const DEFAULT_THEME_SLUG: ThemeSlug = 'classroom-classic'

/** Returns the theme by slug, falling back to DEFAULT_THEME if unknown. */
export function getTheme(slug: string | null | undefined): Theme {
  if (slug && slug in THEMES) return THEMES[slug as ThemeSlug]
  return THEMES[DEFAULT_THEME_SLUG]
}

export * from './types'
```

- [ ] **Step 2: Typecheck**

```
npx tsc --noEmit
```
Expected: no errors. All 8 theme files resolve.

- [ ] **Step 3: Commit**

```
git add lib/lesson-plan/themes/index.ts
git commit -m "feat(themes): registry + getTheme(slug) helper"
```

---

## Task 15: Open-design attribution

**Files:**
- Create: `lib/lesson-plan/themes/CREDITS.md`

- [ ] **Step 1: Write attribution**

```markdown
# Theme attribution

The 8 themes in this directory are inspired by and partially derived from the
open-design project (https://github.com/nexu-io/open-design), specifically
their DESIGN.md format for encoding visual design systems.

We re-implemented those design systems as typed TypeScript objects with
educational-context-specific component variants (Objectives, Materials,
MarkingGrid, etc.) that open-design's general-purpose templates don't include.

| Our theme            | Inspired by open-design DESIGN.md |
|----------------------|-----------------------------------|
| Classroom Classic    | Notion                            |
| Modern Notebook      | Anthropic / warm editorial        |
| Worksheet Pro        | Vercel                            |
| Academic Minimal     | Apple                             |
| Playful Primary      | Material (Google)                 |
| Tech & STEM          | Stripe                            |
| Studio Pad           | original (sketchbook concept)     |
| Canvas               | original (gallery concept)        |

open-design is Apache 2.0 licensed.
```

- [ ] **Step 2: Commit**

```
git add lib/lesson-plan/themes/CREDITS.md
git commit -m "docs(themes): open-design attribution"
```

---

## Task 16: Markdown block parser

**Files:**
- Create: `lib/lesson-plan/parse-blocks.ts`

- [ ] **Step 1: Write the parser**

```ts
// =============================================================================
// lib/lesson-plan/parse-blocks.ts — Parses AI markdown into typed blocks
// for our themed renderer. We don't use react-markdown here because we need
// to detect named sections (Objectives, Materials, Marking Grid) and route
// them to specific themed components rather than render generic markdown.
// =============================================================================

export type Block =
  | { kind: 'h1' | 'h2' | 'h3'; text: string; namedSection?: NamedSection }
  | { kind: 'p'; text: string }
  | { kind: 'li'; text: string; ordered: boolean; marks?: number }
  | { kind: 'hr' }
  | { kind: 'table'; header: string[]; rows: string[][] }
  | { kind: 'code'; lang: string; text: string }

/** Section names we render with themed components. Case-insensitive match. */
export type NamedSection =
  | 'objectives' | 'materials' | 'warm-up' | 'main-activity'
  | 'assessment' | 'homework' | 'exit-ticket'
  | 'marking-grid' | 'teacher-comments'

const NAMED_SECTIONS: { keyword: RegExp; section: NamedSection }[] = [
  { keyword: /^objectives?\b/i,        section: 'objectives' },
  { keyword: /^materials?\b/i,         section: 'materials' },
  { keyword: /^warm[\s-]*up\b/i,       section: 'warm-up' },
  { keyword: /^main\s+activity\b/i,    section: 'main-activity' },
  { keyword: /^assessment\b/i,         section: 'assessment' },
  { keyword: /^homework\b/i,           section: 'homework' },
  { keyword: /^exit\s+ticket\b/i,      section: 'exit-ticket' },
  { keyword: /^marking\s+grid\b/i,     section: 'marking-grid' },
  { keyword: /^teacher.?s\s+comments?\b/i, section: 'teacher-comments' },
]

function detectNamedSection(text: string): NamedSection | undefined {
  for (const { keyword, section } of NAMED_SECTIONS) {
    if (keyword.test(text.trim())) return section
  }
  return undefined
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((c) => c.trim())
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
}

function isTableRow(line: string): boolean {
  const t = line.trim()
  return t.startsWith('|') && t.endsWith('|') && t.includes('|', 1)
}

/** Extracts "(N marks)" from a list item, returns number or undefined. */
function extractMarks(text: string): number | undefined {
  const m = text.match(/\(\s*(\d+)\s+marks?\s*\)/i)
  return m ? Number(m[1]) : undefined
}

export function parseBlocks(md: string): Block[] {
  const lines = md.split('\n').map((l) => l.replace(/\r$/, ''))
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code fence
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim() || ''
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      blocks.push({ kind: 'code', lang, text: buf.join('\n') })
      i++ // skip closing fence
      continue
    }

    // Table
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = parseTableRow(line)
      const rows: string[][] = []
      i += 2
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(parseTableRow(lines[i]))
        i++
      }
      blocks.push({ kind: 'table', header, rows })
      continue
    }

    if (!line.trim()) {
      // skip blank lines (paragraphs get spacing from CSS, not blank blocks)
      i++
      continue
    }
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push({ kind: 'hr' })
    } else if (line.startsWith('### ')) {
      const text = line.slice(4)
      blocks.push({ kind: 'h3', text, namedSection: detectNamedSection(text) })
    } else if (line.startsWith('## ')) {
      const text = line.slice(3)
      blocks.push({ kind: 'h2', text, namedSection: detectNamedSection(text) })
    } else if (line.startsWith('# ')) {
      const text = line.slice(2)
      blocks.push({ kind: 'h1', text, namedSection: detectNamedSection(text) })
    } else if (/^\s*[-*]\s+/.test(line)) {
      const text = line.replace(/^\s*[-*]\s+/, '')
      blocks.push({ kind: 'li', text, ordered: false, marks: extractMarks(text) })
    } else if (/^\s*\d+\.\s+/.test(line)) {
      const text = line.replace(/^\s*\d+\.\s+/, '')
      blocks.push({ kind: 'li', text, ordered: true, marks: extractMarks(text) })
    } else {
      blocks.push({ kind: 'p', text: line })
    }
    i++
  }

  return blocks
}
```

- [ ] **Step 2: Typecheck**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```
git add lib/lesson-plan/parse-blocks.ts
git commit -m "feat(themes): parseBlocks markdown parser with named-section detection"
```

---

## Task 17: Inline strip + emoji + Urdu detection helpers

**Files:**
- Create: `lib/lesson-plan/inline.ts`

- [ ] **Step 1: Write helpers**

```ts
// =============================================================================
// lib/lesson-plan/inline.ts — Inline text helpers for themed rendering.
// =============================================================================

const EMOJI_RE = /\p{Extended_Pictographic}/gu
const URDU_RANGE_RE = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/

/** Removes emoji codepoints + inline markdown markers (** * `). */
export function stripInline(text: string): string {
  return text
    .replace(EMOJI_RE, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** True if the text contains any Urdu/Arabic-script codepoints. */
export function hasUrduChars(text: string): boolean {
  return URDU_RANGE_RE.test(text)
}

/** Splits text into Latin and Urdu segments. Each segment renders with its
 *  appropriate font. Used for mixed-language content (e.g. English headings
 *  with Urdu body text). */
export type InlineSegment = { text: string; isUrdu: boolean }
export function segmentByScript(text: string): InlineSegment[] {
  if (!hasUrduChars(text)) return [{ text, isUrdu: false }]
  // Simple bidirectional split: chunk by character class transitions.
  const segments: InlineSegment[] = []
  let buf = ''
  let bufIsUrdu = URDU_RANGE_RE.test(text[0] ?? '')
  for (const ch of text) {
    const chIsUrdu = URDU_RANGE_RE.test(ch)
    if (chIsUrdu === bufIsUrdu) {
      buf += ch
    } else {
      if (buf) segments.push({ text: buf, isUrdu: bufIsUrdu })
      buf = ch
      bufIsUrdu = chIsUrdu
    }
  }
  if (buf) segments.push({ text: buf, isUrdu: bufIsUrdu })
  return segments
}
```

- [ ] **Step 2: Commit**

```
npx tsc --noEmit
git add lib/lesson-plan/inline.ts
git commit -m "feat(themes): inline text helpers (strip, urdu detection, script segmentation)"
```

---

## Task 18: Block components — basic blocks

**Files:**
- Create: `lib/lesson-plan/blocks/Heading.tsx`
- Create: `lib/lesson-plan/blocks/Paragraph.tsx`
- Create: `lib/lesson-plan/blocks/List.tsx`
- Create: `lib/lesson-plan/blocks/Table.tsx`
- Create: `lib/lesson-plan/blocks/Divider.tsx`
- Create: `lib/lesson-plan/blocks/index.ts`

- [ ] **Step 1: Write Heading**

```tsx
// lib/lesson-plan/blocks/Heading.tsx
import type { Theme } from '../themes/types'
import { stripInline } from '../inline'

type Props = { level: 1 | 2 | 3; text: string; theme: Theme }

export function Heading({ level, text, theme }: Props) {
  const t = stripInline(text)
  const style = {
    fontFamily: theme.tokens.font.heading,
    color: theme.tokens.color.primary,
    margin: level === 1 ? '0 0 12px' : level === 2 ? '14px 0 8px' : '12px 0 6px',
    fontSize: level === 1 ? '1.6rem' : level === 2 ? '1.2rem' : '1rem',
    fontWeight: 700,
    breakAfter: 'avoid' as const,
  }
  if (level === 1) return <h1 style={style}>{t}</h1>
  if (level === 2) return <h2 style={style}>{t}</h2>
  return <h3 style={style}>{t}</h3>
}
```

- [ ] **Step 2: Write Paragraph**

```tsx
// lib/lesson-plan/blocks/Paragraph.tsx
import type { Theme } from '../themes/types'
import { stripInline } from '../inline'

export function Paragraph({ text, theme }: { text: string; theme: Theme }) {
  return (
    <p style={{
      fontFamily: theme.tokens.font.body,
      color: theme.tokens.color.text,
      margin: `0 0 ${theme.tokens.space.paragraph}`,
      lineHeight: 1.55,
    }}>{stripInline(text)}</p>
  )
}
```

- [ ] **Step 3: Write List**

```tsx
// lib/lesson-plan/blocks/List.tsx
import type { Theme } from '../themes/types'
import { stripInline } from '../inline'

type Item = { text: string; ordered: boolean; marks?: number }
type Props = { items: Item[]; theme: Theme }

export function List({ items, theme }: Props) {
  // Decide ol vs ul based on first item — mixed lists are rare and CSS handles it OK
  const ordered = items[0]?.ordered ?? false
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag style={{
      fontFamily: theme.tokens.font.body,
      color: theme.tokens.color.text,
      paddingLeft: '20px',
      margin: `0 0 ${theme.tokens.space.paragraph}`,
      lineHeight: 1.55,
    }}>
      {items.map((it, i) => (
        <li key={i} style={{ marginBottom: '4px' }}>{stripInline(it.text)}</li>
      ))}
    </Tag>
  )
}
```

- [ ] **Step 4: Write Table**

```tsx
// lib/lesson-plan/blocks/Table.tsx
import type { Theme } from '../themes/types'
import { stripInline } from '../inline'

type Props = { header: string[]; rows: string[][]; theme: Theme }

export function Table({ header, rows, theme }: Props) {
  const borderColor = theme.tokens.color.divider
  return (
    <table style={{
      width: '100%',
      borderCollapse: 'collapse',
      margin: `8px 0 ${theme.tokens.space.paragraph}`,
      fontFamily: theme.tokens.font.body,
      fontSize: '.95em',
    }}>
      <thead>
        <tr>
          {header.map((h, i) => (
            <th key={i} style={{
              border: `1px solid ${borderColor}`,
              padding: '6px 8px',
              background: theme.tokens.color.divider + '40',
              textAlign: 'left',
              fontWeight: 600,
            }}>{stripInline(h)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {Array.from({ length: header.length }).map((_, j) => (
              <td key={j} style={{
                border: `1px solid ${borderColor}`,
                padding: '6px 8px',
              }}>{stripInline(row[j] ?? '')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 5: Write Divider**

```tsx
// lib/lesson-plan/blocks/Divider.tsx
import type { Theme } from '../themes/types'

export function Divider({ theme }: { theme: Theme }) {
  const variant = theme.components.divider
  if (variant === 'ornament') {
    return (
      <div style={{
        textAlign: 'center',
        margin: '16px 0',
        color: theme.tokens.color.muted,
        fontSize: '.8em',
        letterSpacing: '.5em',
      }}>✦ ✦ ✦</div>
    )
  }
  if (variant === 'shadow-band') {
    return (
      <div style={{
        height: '6px',
        margin: '20px 0',
        background: `linear-gradient(180deg, ${theme.tokens.color.divider}80, transparent)`,
      }} />
    )
  }
  return <hr style={{
    border: 'none',
    borderTop: `1px solid ${theme.tokens.color.divider}`,
    margin: '12px 0',
  }} />
}
```

- [ ] **Step 6: Write index.ts barrel**

```ts
// lib/lesson-plan/blocks/index.ts
export { Heading } from './Heading'
export { Paragraph } from './Paragraph'
export { List } from './List'
export { Table } from './Table'
export { Divider } from './Divider'
```

- [ ] **Step 7: Typecheck + commit**

```
npx tsc --noEmit
git add lib/lesson-plan/blocks/
git commit -m "feat(themes): basic block components (heading/paragraph/list/table/divider)"
```

---

## Task 19: Block component — CoverHeader

**Files:**
- Create: `lib/lesson-plan/blocks/CoverHeader.tsx`

- [ ] **Step 1: Write CoverHeader**

```tsx
// lib/lesson-plan/blocks/CoverHeader.tsx
import type { Theme } from '../themes/types'

type Props = {
  theme: Theme
  courseName: string
  teacherName: string
  title: string
  updatedAtPkt: string
  /** When 'assessment-sheet' or 'worksheet', themes can use name-class-date-strip variant. */
  docType: 'lesson-plan' | 'assessment-sheet' | 'worksheet'
}

export function CoverHeader(props: Props) {
  const { theme, courseName, teacherName, title, updatedAtPkt, docType } = props
  const variant = theme.components.coverHeader
  const isWorksheet = docType !== 'lesson-plan'
  // Worksheet themes override variant to name-class-date-strip implicitly
  const useNameStrip = variant === 'name-class-date-strip' || isWorksheet

  if (variant === 'cover-page-hero') {
    return (
      <header style={{
        textAlign: 'center',
        margin: '0 0 32px',
        paddingBottom: '20px',
        borderBottom: `1px solid ${theme.tokens.color.divider}`,
      }}>
        <div style={{ fontSize: '.8em', color: theme.tokens.color.muted, marginBottom: '6px' }}>
          {teacherName} · {courseName}
        </div>
        <h1 style={{
          fontFamily: theme.tokens.font.heading,
          color: theme.tokens.color.primary,
          fontSize: '1.8em',
          margin: '8px 0',
          fontWeight: 700,
        }}>{title}</h1>
        <div style={{ fontSize: '.75em', color: theme.tokens.color.muted, marginTop: '8px' }}>
          Last updated {updatedAtPkt} (PKT)
        </div>
      </header>
    )
  }

  if (useNameStrip) {
    return (
      <header style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '.8em', color: theme.tokens.color.muted }}>
          {teacherName} · {courseName}
        </div>
        <h1 style={{
          fontFamily: theme.tokens.font.heading,
          color: theme.tokens.color.primary,
          fontSize: '1.5em',
          margin: '4px 0 12px',
          fontWeight: 700,
        }}>{title}</h1>
        <div style={{
          padding: '8px 0',
          borderTop: `1.5px solid ${theme.tokens.color.divider}`,
          borderBottom: `1.5px solid ${theme.tokens.color.divider}`,
          fontFamily: theme.tokens.font.mono,
          fontSize: '.9em',
        }}>
          Name: ________________________ Class: _____ Section: _____ Date: __________
        </div>
        <div style={{ fontSize: '.7em', color: theme.tokens.color.muted, marginTop: '6px' }}>
          Generated {updatedAtPkt} (PKT)
        </div>
      </header>
    )
  }

  // standard variant
  return (
    <header style={{
      marginBottom: '16px',
      paddingBottom: '8px',
      borderBottom: `1px solid ${theme.tokens.color.divider}`,
    }}>
      <div style={{ fontSize: '.75em', color: theme.tokens.color.muted }}>
        {teacherName} · {courseName}
      </div>
      <h1 style={{
        fontFamily: theme.tokens.font.heading,
        color: theme.tokens.color.primary,
        fontSize: '1.4em',
        margin: '4px 0',
        fontWeight: 700,
      }}>{title}</h1>
      <div style={{ fontSize: '.7em', color: theme.tokens.color.muted, marginTop: '4px' }}>
        Last updated {updatedAtPkt} (PKT)
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Update blocks/index.ts to export CoverHeader**

Append:
```ts
export { CoverHeader } from './CoverHeader'
```

- [ ] **Step 3: Typecheck + commit**

```
npx tsc --noEmit
git add lib/lesson-plan/blocks/CoverHeader.tsx lib/lesson-plan/blocks/index.ts
git commit -m "feat(themes): CoverHeader block with 3 variants"
```

---

## Task 20: Block component — Callout (used for Objectives, Materials default)

**Files:**
- Create: `lib/lesson-plan/blocks/Callout.tsx`

- [ ] **Step 1: Write Callout**

```tsx
// lib/lesson-plan/blocks/Callout.tsx
import type { Theme } from '../themes/types'

type Props = {
  theme: Theme
  children: React.ReactNode
  variant?: Theme['components']['callout']
}

export function Callout({ theme, children, variant }: Props) {
  const v = variant ?? theme.components.callout
  const base = {
    margin: `4px 0 ${theme.tokens.space.callout}`,
    padding: '8px 12px',
    color: theme.tokens.color.text,
    fontFamily: theme.tokens.font.body,
    fontSize: '.95em',
  }

  if (v === 'cream-card') {
    return <div style={{
      ...base,
      background: theme.tokens.color.surface === '#ffffff' ? '#fef9c3' : '#fef3c7',
      border: `1px solid ${theme.tokens.color.divider}`,
      borderRadius: '4px',
    }}>{children}</div>
  }

  if (v === 'dashed-box') {
    return <div style={{
      ...base,
      border: `1.5px dashed ${theme.tokens.color.muted}`,
      borderRadius: '4px',
    }}>{children}</div>
  }

  // tinted-left-border (default)
  return <div style={{
    ...base,
    borderLeft: `3px solid ${theme.tokens.color.primary}`,
    background: theme.tokens.color.surface === '#ffffff' ? '#fafafa' : theme.tokens.color.divider + '30',
    paddingLeft: '12px',
  }}>{children}</div>
}
```

- [ ] **Step 2: Append to blocks/index.ts**

```ts
export { Callout } from './Callout'
```

- [ ] **Step 3: Typecheck + commit**

```
npx tsc --noEmit
git add lib/lesson-plan/blocks/Callout.tsx lib/lesson-plan/blocks/index.ts
git commit -m "feat(themes): Callout block with 3 variants"
```

---

## Task 21: Themed wrapper component — LessonPlanThemed

**Files:**
- Create: `lib/lesson-plan/LessonPlanThemed.tsx`

- [ ] **Step 1: Write the main component**

```tsx
// =============================================================================
// lib/lesson-plan/LessonPlanThemed.tsx — Themed lesson plan renderer.
// One component, two consumers:
//   - context="web"  → renders <article> only, no <html> wrapper,
//                       no @page CSS, no cover header (page has title already)
//   - context="pdf"  → renders a complete standalone HTML document with
//                       print CSS, embedded font @font-face rules, cover header
// =============================================================================

import type { Theme, DocType, FontFace } from './themes/types'
import { parseBlocks, type Block } from './parse-blocks'
import {
  Heading, Paragraph, List, Table, Divider, Callout, CoverHeader,
} from './blocks'

type RenderContext = 'web' | 'pdf'

type Props = {
  theme: Theme
  context: RenderContext
  title: string
  bodyMarkdown: string
  courseName: string
  teacherName: string
  updatedAtPkt: string
  docType?: DocType
}

function renderBlock(block: Block, theme: Theme, key: number): React.ReactNode {
  switch (block.kind) {
    case 'h1':
      return <Heading key={key} level={1} text={block.text} theme={theme} />
    case 'h2':
      return <Heading key={key} level={2} text={block.text} theme={theme} />
    case 'h3':
      return <Heading key={key} level={3} text={block.text} theme={theme} />
    case 'p':
      return <Paragraph key={key} text={block.text} theme={theme} />
    case 'hr':
      return <Divider key={key} theme={theme} />
    case 'table':
      // If preceding heading was Marking Grid, the Table styling could be
      // tightened here; for v1 we use the same Table component everywhere.
      return <Table key={key} header={block.header} rows={block.rows} theme={theme} />
    case 'code':
      return (
        <pre key={key} style={{
          fontFamily: theme.tokens.font.mono,
          fontSize: '.85em',
          background: theme.tokens.color.divider + '40',
          padding: '8px 12px',
          borderRadius: '4px',
          margin: '8px 0',
          overflow: 'auto',
        }}>{block.text}</pre>
      )
    case 'li':
      // We collapse consecutive li blocks into a single List in renderBody below
      // (this is a single fallback for an orphan li that shouldn't happen)
      return (
        <List key={key} items={[{ text: block.text, ordered: block.ordered, marks: block.marks }]} theme={theme} />
      )
  }
}

function renderBody(blocks: Block[], theme: Theme): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let i = 0
  while (i < blocks.length) {
    const block = blocks[i]
    if (block.kind === 'li') {
      const items: { text: string; ordered: boolean; marks?: number }[] = []
      while (i < blocks.length && blocks[i].kind === 'li') {
        const b = blocks[i] as Extract<Block, { kind: 'li' }>
        items.push({ text: b.text, ordered: b.ordered, marks: b.marks })
        i++
      }
      nodes.push(<List key={i} items={items} theme={theme} />)
    } else {
      nodes.push(renderBlock(block, theme, i))
      i++
    }
  }
  return nodes
}

function buildFontFaceCss(faces: FontFace[] | undefined): string {
  if (!faces) return ''
  return faces.map((f) =>
    `@font-face {
      font-family: '${f.family}';
      src: url('${f.src}') format('truetype');
      font-weight: ${f.weight};
      font-style: ${f.style ?? 'normal'};
      font-display: swap;
    }`
  ).join('\n')
}

function buildPrintCss(theme: Theme): string {
  return `
    @page {
      size: ${theme.tokens.page.size};
      margin: ${theme.tokens.page.margin};
    }
    @media print {
      body { font-size: 11pt; }
      h1, h2, h3 { break-after: avoid; }
      table { break-inside: auto; }
    }
  `
}

export function LessonPlanThemed(props: Props) {
  const { theme, context, title, bodyMarkdown, courseName, teacherName, updatedAtPkt, docType = 'lesson-plan' } = props
  const blocks = parseBlocks(bodyMarkdown)

  const article = (
    <article style={{
      fontFamily: theme.tokens.font.body,
      color: theme.tokens.color.text,
      background: theme.tokens.color.surface,
      maxWidth: context === 'pdf' ? 'none' : '760px',
      margin: context === 'pdf' ? '0' : '0 auto',
      padding: context === 'pdf' ? '0' : '0',
      lineHeight: 1.55,
    }}>
      {context === 'pdf' && (
        <CoverHeader
          theme={theme}
          courseName={courseName}
          teacherName={teacherName}
          title={title}
          updatedAtPkt={updatedAtPkt}
          docType={docType}
        />
      )}
      {renderBody(blocks, theme)}
    </article>
  )

  if (context === 'web') {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: buildFontFaceCss(theme.tokens.fontFaces) }} />
        {article}
      </>
    )
  }

  // context === 'pdf' — return a complete standalone HTML document
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>{title}</title>
        <style dangerouslySetInnerHTML={{ __html: buildFontFaceCss(theme.tokens.fontFaces) }} />
        <style dangerouslySetInnerHTML={{ __html: buildPrintCss(theme) }} />
        <style dangerouslySetInnerHTML={{ __html: `
          body { margin: 0; background: ${theme.tokens.color.surface}; }
        ` }} />
      </head>
      <body>{article}</body>
    </html>
  )
}
```

- [ ] **Step 2: Typecheck**

```
npx tsc --noEmit
```
Expected: clean. The `<html>` inside a component is fine for renderToString output.

- [ ] **Step 3: Commit**

```
git add lib/lesson-plan/LessonPlanThemed.tsx
git commit -m "feat(themes): LessonPlanThemed main component (web + pdf contexts)"
```

---

## Task 22: Update AI prompts for THEME + DOC_TYPE metadata

**Files:**
- Modify: `lib/ai/prompts.ts`

- [ ] **Step 1: Read existing prompts**

Open `lib/ai/prompts.ts` to see current `buildSystemPrompt`, `buildGeneratePrompt`, `buildRevisePrompt`.

- [ ] **Step 2: Append new exports for the metadata-enabled flow**

Add to `lib/ai/prompts.ts`:

```ts
import type { ThemeSlug } from '@/lib/lesson-plan/themes/types'

const THEME_DESCRIPTIONS = `
- classroom-classic — neutral, safe default, any subject
- modern-notebook — warm, friendly, primary / middle school
- worksheet-pro — black & white worksheet style, for assessment / homework
- academic-minimal — formal, generous whitespace, multi-week units
- playful-primary — bright/friendly, K-3 ages
- tech-stem — clean blue accent, math / science / computing
- studio-pad — sketchbook feel, art / craft / drawing
- canvas — gallery aesthetic, photography / design
`

const METADATA_FORMAT_AUTO = `
You will pick a visual theme for this lesson plan. Your first two output lines MUST be:

THEME: <one of: classroom-classic, modern-notebook, worksheet-pro, academic-minimal, playful-primary, tech-stem, studio-pad, canvas>
DOC_TYPE: <one of: lesson-plan, assessment-sheet, worksheet>

Use these theme descriptions to choose:
${THEME_DESCRIPTIONS}

Then the existing format:
TITLE: <a short descriptive title, max 200 characters>
---
<the lesson plan body in markdown>
`

const METADATA_FORMAT_FIXED = (slug: ThemeSlug) => `
Your first two output lines MUST be:

THEME: ${slug}
DOC_TYPE: <one of: lesson-plan, assessment-sheet, worksheet>

Then the existing format:
TITLE: <a short descriptive title, max 200 characters>
---
<the lesson plan body in markdown>
`

export function buildSystemPromptThemed(
  input: import('./provider').PlanInput,
  themeSlug: ThemeSlug | null,
): string {
  const meta = themeSlug ? METADATA_FORMAT_FIXED(themeSlug) : METADATA_FORMAT_AUTO
  return [
    'You are an assistant helping a Pakistani tutor draft a lesson plan.',
    'The teacher is in Pakistan. Be aware of curricula (Federal Board, Cambridge, CBSE).',
    'Use metric units. If money is mentioned, use PKR.',
    input.language === 'urdu'
      ? 'Write the BODY content in Urdu. Keep section HEADINGS in English.'
      : input.language === 'roman-urdu'
        ? 'Write the BODY content in Roman Urdu (Urdu transliterated in Latin script). Keep section HEADINGS in English.'
        : 'Write the entire plan in English.',
    input.scope === 'session'
      ? 'For a single-session plan use H2 headings: Objectives, Materials, Warm-up, Main Activity, Assessment, Homework.'
      : 'For a multi-week unit plan structure with H2 per week (Week 1, Week 2, ...) and H3 sub-sections Objectives / Activities / Assessment.',
    meta,
    'Do not include any preamble, commentary, or trailing notes outside this format.',
  ].join('\n\n')
}

export function buildRevisePromptThemed(args: {
  themeSlug: ThemeSlug
  docType: import('@/lib/lesson-plan/themes/types').DocType
  currentMarkdown: string
  chatHistory: import('./provider').ChatTurn[]
  instruction: string
}): { system: string; prompt: string } {
  const system = [
    "You are revising an existing lesson plan. Keep the teacher's intent and the existing structure unless the instruction says otherwise.",
    `The theme is ${args.themeSlug} and document type is ${args.docType} — DO NOT change these.`,
    'You MUST respond in exactly this format and nothing else:',
    '',
    'TITLE: <a short descriptive title, max 200 characters>',
    '---',
    '<the full updated lesson plan body in markdown>',
    '',
    'Do NOT include THEME: or DOC_TYPE: lines in your revision output.',
    'Do not include any preamble, commentary, or trailing notes outside this format.',
  ].join('\n')

  const recent = args.chatHistory
    .slice(-5)
    .map((t) => `${t.role.toUpperCase()}: ${t.content.slice(0, 500)}`)
    .join('\n')
  const prompt = [
    'Current lesson plan:',
    '```markdown',
    args.currentMarkdown,
    '```',
    '',
    'Recent conversation:',
    recent || '(none)',
    '',
    `New instruction from the teacher: ${args.instruction}`,
    '',
    'Return the FULL updated plan in the required TITLE/--- format.',
  ].join('\n')

  return { system, prompt }
}
```

- [ ] **Step 3: Typecheck**

```
npx tsc --noEmit
```
Expected: no errors. (We keep the original `buildSystemPrompt` / `buildGeneratePrompt` / `buildRevisePrompt` exports for backward compat with code paths not yet migrated.)

- [ ] **Step 4: Commit**

```
git add lib/ai/prompts.ts
git commit -m "feat(ai): add themed prompts (THEME + DOC_TYPE metadata)"
```

---

## Task 23: Update AI parser to extract THEME + DOC_TYPE

**Files:**
- Modify: `lib/ai/anthropic.ts`

- [ ] **Step 1: Read current parseAIOutput**

Open `lib/ai/anthropic.ts` and locate `parseAIOutput`.

- [ ] **Step 2: Add metadata parsing**

Replace `parseAIOutput` and update `PlanResult` shape. First, update `lib/ai/provider.ts`:

```ts
// In lib/ai/provider.ts — add to PlanResult type
import type { ThemeSlug, DocType } from '@/lib/lesson-plan/themes/types'

export type PlanResult = {
  title: string
  bodyMarkdown: string
  themeSlug?: ThemeSlug
  docType?: DocType
  model: string
  inputTokens?: number
  outputTokens?: number
}
```

Then in `lib/ai/anthropic.ts`, replace `parseAIOutput` with:

```ts
import { THEME_SLUGS, DOC_TYPES, type ThemeSlug, type DocType } from '@/lib/lesson-plan/themes/types'

export function parseAIOutput(raw: string): {
  title: string
  body: string
  themeSlug?: ThemeSlug
  docType?: DocType
} {
  // Extract head (before ---) and body
  const idx = raw.indexOf('---')
  const head = idx >= 0 ? raw.slice(0, idx) : ''
  let body = idx >= 0 ? raw.slice(idx + 3).trim() : raw

  // Parse head lines: THEME, DOC_TYPE, TITLE
  let title = ''
  let themeSlug: ThemeSlug | undefined
  let docType: DocType | undefined
  for (const line of head.split('\n')) {
    const t = line.trim()
    if (!t) continue
    const themeMatch = t.match(/^THEME:\s*([\w-]+)/i)
    if (themeMatch) {
      const cand = themeMatch[1].toLowerCase()
      if ((THEME_SLUGS as readonly string[]).includes(cand)) {
        themeSlug = cand as ThemeSlug
      }
      continue
    }
    const docMatch = t.match(/^DOC_TYPE:\s*([\w-]+)/i)
    if (docMatch) {
      const cand = docMatch[1].toLowerCase()
      if ((DOC_TYPES as readonly string[]).includes(cand)) {
        docType = cand as DocType
      }
      continue
    }
    const titleMatch = t.match(/^TITLE:\s*(.+)/i)
    if (titleMatch) title = titleMatch[1].trim()
  }

  if (!title) {
    const h1 = body.match(/^#\s+(.+)/m)
    title = h1 ? h1[1].trim() : 'Untitled plan'
  }
  title = title.slice(0, 200)

  const MAX_BODY_BYTES = 65_536
  if (body.length > MAX_BODY_BYTES) {
    body = body.slice(0, MAX_BODY_BYTES - 16) + '\n\n…(truncated)'
  }

  return { title, body, themeSlug, docType }
}
```

Then find usages of `parseAIOutput` inside `anthropic.ts` and update them to pass `themeSlug` and `docType` through. Specifically, in `callAI` (or wherever the result is constructed):

```ts
const { title, body, themeSlug, docType } = parseAIOutput(text)
// ... existing checks ...
return {
  title,
  bodyMarkdown: body,
  themeSlug,
  docType,
  model: config.model,
  ...usage,
}
```

- [ ] **Step 3: Typecheck**

```
npx tsc --noEmit
```
Expected: no errors. The `PlanResult` type adds optional fields so existing callers don't break.

- [ ] **Step 4: Commit**

```
git add lib/ai/anthropic.ts lib/ai/provider.ts
git commit -m "feat(ai): parse THEME + DOC_TYPE from AI output"
```

---

## Task 24: Update generate streaming route to accept theme_slug + emit fixed THEME

**Files:**
- Modify: `app/api/lesson-plans/generate/route.ts`

- [ ] **Step 1: Update the input schema + system-prompt selection**

Open `app/api/lesson-plans/generate/route.ts`. Find `PlanInputSchema` and add an optional `themeSlug` field. Find the `provider.streamPlan(input)` call site.

Add to the imports at top:
```ts
import { THEME_SLUGS, type ThemeSlug } from '@/lib/lesson-plan/themes/types'
import { buildSystemPromptThemed } from '@/lib/ai/prompts'
```

Update schema:
```ts
const PlanInputSchema = z.object({
  // ... existing fields ...
  themeSlug: z.enum(THEME_SLUGS).nullable().optional(),
})
```

The streaming adapter currently uses `buildSystemPrompt` from prompts.ts internally. We need to pass the chosen theme through. Look in `lib/ai/anthropic.ts` for where `streamPlan` builds its system prompt — replace with `buildSystemPromptThemed(input, input.themeSlug ?? null)`.

Practically: add a new method `streamPlanThemed` to the provider OR pass `themeSlug` through `PlanInput`. The cleanest path:

Update `lib/ai/provider.ts` PlanInput:
```ts
export type PlanInput = {
  // ... existing fields ...
  themeSlug?: ThemeSlug | null   // null/undefined = "Auto"
}
```

Then in `lib/ai/anthropic.ts`'s `streamPlan` (and `generatePlan`), call `buildSystemPromptThemed(input, input.themeSlug ?? null)` instead of `buildSystemPrompt(input)`.

- [ ] **Step 2: Persist the model's emitted THEME in the route handler**

In `app/api/lesson-plans/generate/route.ts`, the `done` event currently sends `{planId}`. After the atomic insert succeeds, if the AI emitted a `themeSlug` AND the teacher's input was `null` (Auto), update the row's `theme_slug`:

After parsing the accumulated text:
```ts
const { title, body: bodyMarkdown, themeSlug: aiThemeSlug, docType } = parseAIOutput(trimmed)

// Resolve final theme:
const finalThemeSlug = input.themeSlug ?? aiThemeSlug ?? 'classroom-classic'
```

Then pass `finalThemeSlug` into the atomic RPC insert (we'll extend the RPC in Task 25).

- [ ] **Step 3: Defer commit until Task 25**

The full route change requires the atomic RPC update. Hold commit.

---

## Task 25: Extend insert_lesson_plan_atomic RPC to accept theme_slug

**Files:**
- Create: `supabase/migrations/031_atomic_insert_with_theme.sql`

- [ ] **Step 1: Write migration**

```sql
-- Extend insert_lesson_plan_atomic to accept p_theme_slug.
-- Drop and recreate the function (signature change).

drop function if exists public.insert_lesson_plan_atomic(
  uuid, uuid, text, text, text, jsonb, text, int
);

create or replace function public.insert_lesson_plan_atomic(
  p_teacher_id uuid,
  p_course_id uuid,
  p_scope text,
  p_title text,
  p_body_markdown text,
  p_inputs jsonb,
  p_model text,
  p_limit int,
  p_theme_slug text default 'classroom-classic'
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

  v_month_start := date_trunc('month', (now() at time zone 'Asia/Karachi'))
                   at time zone 'Asia/Karachi';

  if p_limit is not null then
    select count(*) into v_count
    from public.lesson_plan_usage
    where teacher_id = p_teacher_id
      and event = 'generate'
      and created_at >= v_month_start;

    if v_count >= p_limit then
      return query select null::uuid, 'quota_exceeded'::text;
      return;
    end if;
  end if;

  insert into public.lesson_plans
    (teacher_id, course_id, scope, title, body_markdown, inputs, chat_history, model, theme_slug)
  values
    (p_teacher_id, p_course_id, p_scope, p_title, p_body_markdown, p_inputs, '[]'::jsonb, p_model, p_theme_slug)
  returning id into v_plan_id;

  return query select v_plan_id, 'ok'::text;
end;
$$;

revoke all on function public.insert_lesson_plan_atomic(uuid, uuid, text, text, text, jsonb, text, int, text) from public;
grant execute on function public.insert_lesson_plan_atomic(uuid, uuid, text, text, text, jsonb, text, int, text) to service_role;
```

- [ ] **Step 2: Apply migration via MCP**

Use `mcp__plugin_supabase_supabase__apply_migration` with name `atomic_insert_with_theme` and the SQL above.

- [ ] **Step 3: Update generate route to pass theme_slug to RPC**

In `app/api/lesson-plans/generate/route.ts`, the rpc call:
```ts
const { data: rpcRows, error: rpcErr } = await admin.rpc(
  'insert_lesson_plan_atomic',
  {
    p_teacher_id: teacher.id,
    p_course_id: input.courseId,
    p_scope: input.scope,
    p_title: title,
    p_body_markdown: bodyMarkdown,
    p_inputs: input as unknown as Record<string, unknown>,
    p_model: handle.model,
    p_limit: limitParam,
    p_theme_slug: finalThemeSlug,   // ← NEW
  },
)
```

- [ ] **Step 4: Regenerate types**

```
mcp__plugin_supabase_supabase__generate_typescript_types(project_id='eqmomcwrmfatzftkbdbb')
```
Write result to `types/database.ts`.

- [ ] **Step 5: Typecheck + commit**

```
npx tsc --noEmit
git add supabase/migrations/031_atomic_insert_with_theme.sql types/database.ts \
        app/api/lesson-plans/generate/route.ts lib/ai/prompts.ts \
        lib/ai/anthropic.ts lib/ai/provider.ts
git commit -m "feat(actions): atomic insert RPC + generate route pass theme_slug end-to-end"
```

---

## Task 26: Update revise route — keep THEME sticky

**Files:**
- Modify: `app/api/lesson-plans/[id]/revise/route.ts`
- Modify: `lib/ai/anthropic.ts` (the streamRevision call)

- [ ] **Step 1: Update streamRevision to use themed prompt**

In `lib/ai/anthropic.ts`, the `streamRevision` method currently passes the old `buildRevisePrompt`. Change it to use `buildRevisePromptThemed`:

```ts
streamRevision: (
  args: { currentMarkdown: string; chatHistory: ChatTurn[]; instruction: string; themeSlug: ThemeSlug; docType: DocType },
  signal?: AbortSignal,
) => {
  const { system, prompt } = buildRevisePromptThemed(args)
  return openStream({ system, prompt, signal })
}
```

Update the type signature on `LessonPlanProvider.streamRevision` in `lib/ai/provider.ts` accordingly.

- [ ] **Step 2: Pass theme + doc_type from the route**

In `app/api/lesson-plans/[id]/revise/route.ts`:

```ts
const plan = await getLessonPlanById(teacher.id, planId)
if (!plan) return jsonErr('NOT_FOUND', 404)

const history = readChatHistory(plan)
// Infer docType from inputs OR default to 'lesson-plan' (later we'd store it)
const docType = 'lesson-plan'  // future: store on row

const handle = provider.streamRevision(
  {
    currentMarkdown: plan.body_markdown,
    chatHistory: history,
    instruction,
    themeSlug: plan.theme_slug as ThemeSlug,
    docType,
  },
  abortController.signal,
)
```

- [ ] **Step 3: Typecheck + commit**

```
npx tsc --noEmit
git add lib/ai/anthropic.ts lib/ai/provider.ts app/api/lesson-plans/[id]/revise/route.ts
git commit -m "feat(actions): revise keeps THEME sticky via themed prompt"
```

---

## Task 27: ThemePickerField component with live preview

**Files:**
- Create: `components/teacher/ThemePickerField.tsx`

- [ ] **Step 1: Write the field**

```tsx
'use client'

import { useMemo } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { THEMES, type Theme } from '@/lib/lesson-plan/themes'
import type { ThemeSlug } from '@/lib/lesson-plan/themes/types'

export type ThemePickerValue = ThemeSlug | null  // null = "Auto"

type Props = {
  value: ThemePickerValue
  onChange: (next: ThemePickerValue) => void
  disabled?: boolean
}

function MiniPreview({ theme }: { theme: Theme }) {
  return (
    <div style={{
      background: theme.tokens.color.surface,
      color: theme.tokens.color.text,
      fontFamily: theme.tokens.font.body,
      padding: '12px 14px',
      borderRadius: '6px',
      border: `1px solid ${theme.tokens.color.divider}`,
      fontSize: '12px',
      lineHeight: 1.4,
      minHeight: '120px',
    }}>
      <div style={{
        fontFamily: theme.tokens.font.heading,
        color: theme.tokens.color.primary,
        fontSize: '14px',
        fontWeight: 700,
        marginBottom: '4px',
      }}>Introduction to Trigonometry</div>
      <div style={{ fontSize: '10px', color: theme.tokens.color.muted, marginBottom: '8px' }}>
        Class 9 · 60 min
      </div>
      <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '2px' }}>Objectives</div>
      <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '10px' }}>
        <li>Define sin / cos / tan ratios</li>
        <li>Apply Pythagoras to right triangles</li>
      </ul>
    </div>
  )
}

function AutoPreview() {
  return (
    <div style={{
      background: '#fafafa',
      color: '#525252',
      padding: '12px 14px',
      borderRadius: '6px',
      border: '1px dashed #d4d4d4',
      fontSize: '12px',
      minHeight: '120px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
    }}>
      ✨ AI will pick a theme based on subject, grade, and scope when you generate.
    </div>
  )
}

export function ThemePickerField({ value, onChange, disabled }: Props) {
  const selectedTheme = useMemo(() => value ? THEMES[value] : null, [value])

  return (
    <div className="space-y-2">
      <Label htmlFor="theme-slug">Theme</Label>
      <Select
        value={value ?? 'auto'}
        onValueChange={(v) => onChange(v === 'auto' ? null : (v as ThemeSlug))}
        disabled={disabled}
      >
        <SelectTrigger id="theme-slug"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">✨ Auto — let AI pick</SelectItem>
          {(Object.values(THEMES)).map((t) => (
            <SelectItem key={t.slug} value={t.slug}>{t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="mt-2">
        {selectedTheme ? <MiniPreview theme={selectedTheme} /> : <AutoPreview />}
      </div>
      <p className="text-xs text-muted-foreground">
        {selectedTheme ? selectedTheme.description : 'Auto picks based on your inputs.'}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```
npx tsc --noEmit
git add components/teacher/ThemePickerField.tsx
git commit -m "feat(teacher): ThemePickerField with live mini preview"
```

---

## Task 28: Wire ThemePickerField into NewLessonPlanDialog

**Files:**
- Modify: `components/teacher/NewLessonPlanDialog.tsx`

- [ ] **Step 1: Add state + field**

Open `components/teacher/NewLessonPlanDialog.tsx`. Add:

```tsx
import { ThemePickerField, type ThemePickerValue } from './ThemePickerField'

// inside the component:
const [themeSlug, setThemeSlug] = useState<ThemePickerValue>(null)  // null = Auto
```

Insert the field in the form JSX (right before the "Generate" buttons row, after the Language select):

```tsx
<ThemePickerField value={themeSlug} onChange={setThemeSlug} />
```

Update the `stream.start` call to include `themeSlug`:

```tsx
stream.start({
  url: '/api/lesson-plans/generate',
  body: {
    courseId,
    scope,
    subject,
    gradeLevel,
    durationMinutes: scope === 'session' ? Number(duration) : undefined,
    weekCount: scope === 'unit' ? Number(weeks) : undefined,
    topic,
    learningGoals: goals,
    language,
    themeSlug,   // ← NEW
  },
})
```

- [ ] **Step 2: Typecheck + commit**

```
npx tsc --noEmit
git add components/teacher/NewLessonPlanDialog.tsx
git commit -m "feat(teacher): theme picker in new plan dialog"
```

---

## Task 29: Use LessonPlanThemed on the detail page

**Files:**
- Modify: `app/(teacher)/dashboard/courses/[courseId]/lesson-plans/[planId]/page.tsx`

- [ ] **Step 1: Replace the ReactMarkdown view with themed render**

Find the current `<article className="...">` block that uses `<ReactMarkdown>`. Replace with:

```tsx
import { LessonPlanThemed } from '@/lib/lesson-plan/LessonPlanThemed'
import { getTheme } from '@/lib/lesson-plan/themes'
// ... existing imports ...

const theme = getTheme(plan.theme_slug)

// in JSX, replace the existing article + ReactMarkdown:
<div className="overflow-y-auto rounded-lg border border-border bg-card p-6">
  <LessonPlanThemed
    theme={theme}
    context="web"
    title={plan.title}
    bodyMarkdown={plan.body_markdown}
    courseName={/* course.title from existing query, or empty string */ ''}
    teacherName={teacher.name || teacher.email}
    updatedAtPkt={formatPKT(plan.updated_at, 'datetime')}
  />
</div>
```

You may need to fetch the course title; if you don't already, add a quick query.

- [ ] **Step 2: Typecheck + commit**

```
npx tsc --noEmit
git add 'app/(teacher)/dashboard/courses/[courseId]/lesson-plans/[planId]/page.tsx'
git commit -m "feat(teacher): themed detail view replaces ReactMarkdown"
```

---

## Task 30: Streaming preview inherits theme typography + primary color

**Files:**
- Modify: `components/teacher/NewLessonPlanDialog.tsx`
- Modify: `components/teacher/LessonPlanChat.tsx`

- [ ] **Step 1: Pass theme tokens to streaming preview in dialog**

In `NewLessonPlanDialog.tsx`, the streaming view wraps `<ReactMarkdown>` in an `<article>`. Add theme-aware styling:

```tsx
import { THEMES } from '@/lib/lesson-plan/themes'

const previewTheme = themeSlug
  ? THEMES[themeSlug]
  : null

<article style={{
  fontFamily: previewTheme?.tokens.font.body,
  color: previewTheme?.tokens.color.text,
}} className="...">
  {/* live markdown */}
</article>
```

Also style the H1 / streaming header in the same color:
```tsx
<h2 style={{ color: previewTheme?.tokens.color.primary ?? undefined }}>Writing your lesson plan…</h2>
```

(For "Auto", previewTheme is null → falls back to default platform styling.)

- [ ] **Step 2: Same treatment in LessonPlanChat**

In `LessonPlanChat.tsx`, when streaming, pass theme tokens from the parent plan to the streaming preview area. The plan row has `theme_slug` — the page server-component already loads it; pass it as prop to the chat.

- [ ] **Step 3: Typecheck + commit**

```
npx tsc --noEmit
git add components/teacher/NewLessonPlanDialog.tsx components/teacher/LessonPlanChat.tsx
git commit -m "feat(teacher): streaming preview inherits theme typography + primary color"
```

---

## Task 31: Install puppeteer

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install puppeteer (full bundle)**

```
npm install puppeteer
```

This downloads ~280MB of Chromium. Adds ~5-10s to npm install. Necessary on Railway because we control filesystem.

- [ ] **Step 2: Verify package versions**

```
Get-Content package.json | Select-String 'puppeteer'
```
Expected: `"puppeteer": "^XX.Y.Z"` in dependencies.

- [ ] **Step 3: Commit**

```
git add package.json package-lock.json
git commit -m "chore(deps): add puppeteer for themed PDF rendering"
```

---

## Task 32: Puppeteer browser singleton

**Files:**
- Create: `lib/pdf/browser.ts`

- [ ] **Step 1: Write the singleton**

```ts
// =============================================================================
// lib/pdf/browser.ts — Singleton puppeteer browser instance.
// Launching Chromium per request costs 1-3s. Holding one browser process
// across requests means each PDF render only spends ~50MB transient page
// memory. Idle browser holds ~200MB. Auto-relaunches on disconnect.
// =============================================================================

import type { Browser } from 'puppeteer'

let browser: Browser | null = null
let launching: Promise<Browser> | null = null

export async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser
  if (launching) return launching

  const puppeteer = (await import('puppeteer')).default
  launching = puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  })
  browser = await launching
  launching = null

  // If browser disconnects (crash), force relaunch on next call
  browser.on('disconnected', () => {
    browser = null
  })

  return browser
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close().catch(() => {})
    browser = null
  }
}
```

- [ ] **Step 2: Typecheck**

```
npx tsc --noEmit
```
Expected: no errors. The `puppeteer` types are available because we installed the full package.

- [ ] **Step 3: Commit**

```
git add lib/pdf/browser.ts
git commit -m "feat(pdf): puppeteer browser singleton with auto-relaunch"
```

---

## Task 33: Themed PDF renderer

**Files:**
- Create: `lib/pdf/render-themed.ts`

- [ ] **Step 1: Write the renderer**

```ts
// =============================================================================
// lib/pdf/render-themed.ts — Render a lesson plan to PDF via themed HTML.
// Uses renderToString to produce a standalone HTML document, then puppeteer
// page.setContent → page.pdf.
// =============================================================================

import { renderToString } from 'react-dom/server'
import { getBrowser } from './browser'
import { LessonPlanThemed } from '@/lib/lesson-plan/LessonPlanThemed'
import { getTheme } from '@/lib/lesson-plan/themes'
import type { Database } from '@/types/database'
import { formatPKT } from '@/lib/time/pkt'

type LessonPlanRow = Database['public']['Tables']['lesson_plans']['Row']

export async function renderThemedPdf(args: {
  plan: LessonPlanRow
  courseName: string
  teacherName: string
}): Promise<Buffer> {
  const { plan, courseName, teacherName } = args
  const theme = getTheme(plan.theme_slug)

  const html = '<!DOCTYPE html>' + renderToString(
    LessonPlanThemed({
      theme,
      context: 'pdf',
      title: plan.title,
      bodyMarkdown: plan.body_markdown,
      courseName,
      teacherName,
      updatedAtPkt: formatPKT(plan.updated_at, 'datetime'),
      docType: 'lesson-plan',  // future: read from row
    })
  )

  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 25_000 })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
    })
    return Buffer.from(pdf)
  } finally {
    await page.close().catch(() => {})
  }
}
```

- [ ] **Step 2: Typecheck**

```
npx tsc --noEmit
```
Expected: no errors. (`react-dom/server` is available because we're on React 19.)

- [ ] **Step 3: Commit**

```
git add lib/pdf/render-themed.ts
git commit -m "feat(pdf): themed renderer (renderToString → puppeteer)"
```

---

## Task 34: Fallback renderer wrapping existing react-pdf

**Files:**
- Create: `lib/pdf/render-fallback.ts`

- [ ] **Step 1: Wrap the existing react-pdf path**

```ts
// =============================================================================
// lib/pdf/render-fallback.ts — Fallback PDF renderer using the existing
// react-pdf path. Invoked when the themed puppeteer path throws.
// =============================================================================

import { renderToBuffer } from '@react-pdf/renderer'
import { LessonPlanPdfDocument } from '@/components/teacher/LessonPlanPdfDocument'
import type { Database } from '@/types/database'
import { formatPKT } from '@/lib/time/pkt'

type LessonPlanRow = Database['public']['Tables']['lesson_plans']['Row']

export async function renderReactPdf(args: {
  plan: LessonPlanRow
  courseName: string
  teacherName: string
}): Promise<Buffer> {
  const { plan, courseName, teacherName } = args
  const pdf = await renderToBuffer(
    LessonPlanPdfDocument({
      courseName,
      teacherName,
      title: plan.title,
      bodyMarkdown: plan.body_markdown,
      updatedAtPkt: formatPKT(plan.updated_at, 'datetime'),
    }) as unknown as Parameters<typeof renderToBuffer>[0]
  )
  return Buffer.from(pdf)
}
```

- [ ] **Step 2: Commit**

```
npx tsc --noEmit
git add lib/pdf/render-fallback.ts
git commit -m "feat(pdf): fallback renderer wrapping react-pdf path"
```

---

## Task 35: PDF route uses themed renderer with fallback

**Files:**
- Modify: `app/api/lesson-plans/[id]/pdf/route.tsx`

- [ ] **Step 1: Update the route**

Replace the existing render-and-return logic (which uses `renderToBuffer(LessonPlanPdfDocument(...))`) with a try-themed-then-fallback:

```tsx
import { renderThemedPdf } from '@/lib/pdf/render-themed'
import { renderReactPdf } from '@/lib/pdf/render-fallback'

// inside GET, replace the current renderToBuffer block:
const courseName = course?.title ?? 'Course'
const teacherName = teacher.name || teacher.email

let pdf: Buffer
try {
  pdf = await renderThemedPdf({ plan, courseName, teacherName })
} catch (e) {
  console.error('[pdf] themed render failed, falling back to react-pdf:', e)
  pdf = await renderReactPdf({ plan, courseName, teacherName })
}

const safeTitle =
  plan.title.replace(/[^a-zA-Z0-9-_ ]/g, '').slice(0, 60).trim() || 'lesson-plan'

return new Response(pdf as unknown as BodyInit, {
  status: 200,
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${safeTitle}.pdf"`,
    'Cache-Control': 'private, no-store',
  },
})
```

- [ ] **Step 2: Typecheck + commit**

```
npx tsc --noEmit
git add 'app/api/lesson-plans/[id]/pdf/route.tsx'
git commit -m "feat(pdf): route tries themed renderer, falls back to react-pdf"
```

---

## Phase A SMOKE TEST

Before moving to Phase B, verify Phase A works on local dev.

- [ ] **Step 1: Restart dev server**

```
Ctrl+C the running npm run dev
npm run dev
```

- [ ] **Step 2: Generate a new plan with a specific theme**

Open the dashboard, click "New Plan", pick "Modern Notebook" theme. Generate.

Expected:
- Plan streams in
- Plan persists with `theme_slug = 'modern-notebook'`
- Detail page renders the plan with terracotta serif heading

Verify via SQL (Supabase MCP `execute_sql`):
```sql
select id, title, theme_slug from lesson_plans order by created_at desc limit 1;
```

- [ ] **Step 3: Download the PDF**

Click "Download PDF" on the detail page.

Expected:
- PDF opens
- Header uses Lora serif font in terracotta
- Cream paper background
- All Greek/math glyphs render correctly

- [ ] **Step 4: Generate with "Auto"**

Generate another plan, leave theme on "Auto". Pick subject = "Photography", grade level = "Class 10".

Expected: AI picks `canvas` (gallery theme).

- [ ] **Step 5: Revise a plan**

On an existing plan, type a revision instruction. Verify theme doesn't change.

- [ ] **Step 6: Verify fallback works**

Temporarily break puppeteer (rename `node_modules/puppeteer` to `node_modules/puppeteer-disabled`):
```
Move-Item node_modules/puppeteer node_modules/puppeteer-disabled
```

Restart dev server. Try downloading a PDF. Expected: returns plain react-pdf output without crashing.

Restore:
```
Move-Item node_modules/puppeteer-disabled node_modules/puppeteer
```

- [ ] **Step 7: Phase A complete — commit a checkpoint tag**

```
git tag phase-a-themed-pdfs-local
```

---

# PHASE B — Migrate hosting to Railway

## Task 36: next.config.ts standalone output + Dockerfile

**Files:**
- Modify: `next.config.ts`
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Update next.config.ts**

Add `output: 'standalone'`:

```ts
const nextConfig: NextConfig = {
  output: 'standalone',
  images: { /* existing */ },
  outputFileTracingIncludes: { /* existing */ },
}
```

Remove the existing `outputFileTracingIncludes` for PDF fonts if present — standalone output handles this automatically.

- [ ] **Step 2: Write Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1.4

# ----- Builder stage -----
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# ----- Runner stage -----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Chromium dependencies for puppeteer
RUN apk add --no-cache \
    chromium nss freetype harfbuzz ca-certificates ttf-freefont \
    nodejs

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 3: Write .dockerignore**

```
node_modules
.next
.git
.env*
.dockerignore
Dockerfile
README.md
.superpowers
.vercel
```

- [ ] **Step 4: Update puppeteer config to use system Chromium**

In `lib/pdf/browser.ts`, update launch to honor `PUPPETEER_EXECUTABLE_PATH`:

```ts
const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
}
if (process.env.PUPPETEER_EXECUTABLE_PATH) {
  launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
}
launching = puppeteer.launch(launchOptions)
```

- [ ] **Step 5: Test docker build locally**

```
docker build -t skoolrooms:test .
```

Expected: builds successfully. Image size: ~800MB-1.2GB (Node + Chromium + app).

- [ ] **Step 6: Run container locally to verify**

```
docker run -p 3001:3000 -e DATABASE_URL=... [other env vars] skoolrooms:test
```

Open `http://localhost:3001`. Expected: app loads. (Skip PDF testing in local docker because env vars may be incomplete — just verify the app boots.)

- [ ] **Step 7: Commit**

```
git add next.config.ts Dockerfile .dockerignore lib/pdf/browser.ts
git commit -m "feat(infra): standalone output + Dockerfile + Chromium runtime"
```

---

## Task 37: railway.json + env var checklist

**Files:**
- Create: `railway.json`
- Create: `docs/RAILWAY_ENV_VARS.md` (for human use, not committed-to-track)

- [ ] **Step 1: Write railway.json**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" },
  "deploy": {
    "startCommand": "node server.js",
    "healthcheckPath": "/",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

- [ ] **Step 2: Write env vars checklist**

```
docs/RAILWAY_ENV_VARS.md
```

```markdown
# Railway env vars checklist

When creating the Railway project, paste these env vars from Vercel (Project Settings → Environment Variables):

## Supabase
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

## AI provider
- AI_BASE_URL (= https://api.claudexia.tech/v1)
- AI_API_KEY (current value from Vercel)
- AI_MODEL (= claude-opus-4-7 or whatever you've set)
- SETTINGS_ENCRYPTION_KEY (CRITICAL — must match the value from Vercel to decrypt existing platform_settings rows)

## Brevo
- BREVO_API_KEY
- BREVO_FROM_EMAIL (= noreply@skoolrooms.com)

## Cloudflare
- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ZONE_ID
- CLOUDFLARE_ACCOUNT_ID

## R2
- CLOUDFLARE_R2_ACCESS_KEY
- CLOUDFLARE_R2_SECRET_KEY
- CLOUDFLARE_R2_BUCKET
- CLOUDFLARE_R2_ENDPOINT
- CLOUDFLARE_R2_PUBLIC_URL

## Other
- NEXT_PUBLIC_PLATFORM_DOMAIN (= skoolrooms.com)
- ADMIN_EMAIL
- CRON_SECRET
- PAYMENT_GATEWAY (= mock)

## Auto-set by Railway
- PORT (Railway sets this; our Dockerfile honors it)
- NODE_ENV=production (set in Dockerfile)
- PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true (set in Dockerfile)
- PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser (set in Dockerfile)
```

- [ ] **Step 3: Commit**

```
git add railway.json docs/RAILWAY_ENV_VARS.md
git commit -m "feat(infra): railway.json + env var checklist for migration"
```

---

## Task 38: USER ACTION — Railway project setup + first deploy

⚠️ **This task requires user actions outside the codebase. The implementer agent CAN NOT do these. Surface the steps to the user as a checklist.**

- [ ] **Step 1: Create Railway account + project**

User does:
1. Sign up at https://railway.com (Hobby plan, $5/mo)
2. Click "New Project" → "Deploy from GitHub repo"
3. Authorize Railway to access the `skoolrooms` repo
4. Select branch: `feat/ai-lesson-planner`

- [ ] **Step 2: Paste env vars**

User does:
1. In the Railway service settings → "Variables" tab
2. Paste each env var from `docs/RAILWAY_ENV_VARS.md`
3. Click "Save Changes" — triggers a rebuild

- [ ] **Step 3: Verify first deploy**

User does:
1. Wait for build to complete (~5-10 min first time)
2. Railway assigns a `*.up.railway.app` URL — open it
3. Verify app loads, login works, dashboard renders

Report back with the railway URL.

- [ ] **Step 4: Smoke-test PDF on Railway**

User does:
1. Log in
2. Generate a new plan
3. Download PDF
4. Confirm PDF renders correctly with the chosen theme

If PDF fails with puppeteer errors, check Railway logs for `chromium`-related messages.

---

## Task 39: USER ACTION — Cloudflare DNS + wildcard SSL

⚠️ **User actions required.**

- [ ] **Step 1: Add custom domain in Railway**

User does:
1. In Railway service → Settings → Domains
2. Click "Custom Domain" → enter `skoolrooms.com`
3. Add another: `*.skoolrooms.com`
4. Railway shows a CNAME target — copy it (looks like `xyz.up.railway.app`)

- [ ] **Step 2: Update Cloudflare DNS**

User does:
1. Log in to Cloudflare → skoolrooms.com zone → DNS
2. Add/update A record for `@` (or CNAME if Railway provides one) → point to Railway target
3. Add wildcard CNAME `*` → same Railway target
4. **Set proxy status to Proxied (orange cloud)** for both records — Cloudflare handles SSL termination
5. SSL/TLS mode: Full (strict)

- [ ] **Step 3: Configure CF Page Rules / Configuration Rules for SSE**

User does:
1. Cloudflare → Rules → Configuration Rules
2. Add rule: When `URI Path` matches `/api/lesson-plans/generate` OR `/api/lesson-plans/*/revise`
3. Setting: Cache Level = Bypass, Browser Cache TTL = Respect existing headers
4. (If available) Setting: Disable buffering / "no buffer" / Streaming

This prevents Cloudflare from buffering SSE event streams.

- [ ] **Step 4: Test wildcard subdomain**

User does:
1. Open `https://test-subdomain.skoolrooms.com` (any random subdomain)
2. Expect: SSL cert is valid, app loads (probably 404 since the subdomain isn't a registered teacher, but valid HTTPS)

Report back when this works.

---

## Task 40: USER ACTION — DNS cutover during low-traffic window

⚠️ **Scheduled migration step. Do at 3-4 AM PKT.**

- [ ] **Step 1: Pre-cutover verification**

User does (the evening before cutover):
1. Verify Railway deployment is green
2. Verify Railway URL works end-to-end (login, generate plan, download PDF)
3. Verify Cloudflare config is correct
4. Note current Vercel DNS values (write them down as rollback)

- [ ] **Step 2: Cutover at 3-4 AM PKT**

User does:
1. In Cloudflare DNS, the records pointing to Railway are already in place (Task 39)
2. If currently pointing to Vercel, switch them to Railway target
3. Set proxy status: Proxied

DNS propagation takes 1-5 min with Cloudflare.

- [ ] **Step 3: Smoke test at cutover**

User does:
1. Hit `https://skoolrooms.com` from a fresh browser window
2. Verify it loads from Railway (check response headers for `Server: railway` or similar)
3. Log in, generate a plan, download PDF
4. Hit `https://test.skoolrooms.com` to verify wildcard

If anything is broken, revert DNS to Vercel values immediately.

- [ ] **Step 4: Keep Vercel warm for a week**

User: don't decommission Vercel yet. Push commits to the branch as usual; Vercel continues building. If Railway has an outage, switch DNS back to Vercel.

---

# PHASE C — Final validation + cleanup

## Task 41: Verify Phase C smoke tests in production

- [ ] **Step 1: Full end-to-end test as Ahmed Khan**

User actions:
1. Log in as `teacher@test.com` on the Railway-hosted site (`skoolrooms.com`)
2. Open the existing trigonometry plan → verify themed detail view
3. Download PDF → verify rich themed output
4. Generate a NEW plan with each of the 8 themes → 8 PDFs
5. Verify Auto picker fires for new plans
6. Revise an existing plan → verify theme doesn't change

- [ ] **Step 2: Test fallback on production**

In Railway logs, no themed-render errors should occur during normal operation. If puppeteer fails, the route silently falls back to react-pdf — verify by looking at server logs for `[pdf] themed render failed`.

- [ ] **Step 3: Test SSE streaming through Cloudflare**

Generate a plan from the dashboard. The streaming preview in the dialog should show tokens arriving incrementally, NOT all at once at the end.

If tokens arrive in a single burst → Cloudflare is buffering. Revisit Task 39 step 3.

---

## Task 42: Remove debug logging + dead Vercel artifacts

**Files:**
- Modify: any files with debug `console.log` left from earlier debugging

- [ ] **Step 1: Scan for debug logs**

```
Get-ChildItem app, components, lib -Recurse -Include *.ts,*.tsx | Select-String -Pattern 'console.log.*\[pdf\]' | Select-Object -First 10
```

Remove leftover instrumentation lines like `console.log('[pdf] auth user id=', ...)`.

- [ ] **Step 2: Remove Vercel-specific configs that no longer apply**

In `next.config.ts`, remove `outputFileTracingIncludes` if you added it just for Vercel function bundling. Standalone output handles this.

In `lib/pdf/browser.ts`, the existing `@sparticuz/chromium` handling can be removed since we use system Chromium now.

- [ ] **Step 3: Update memory notes**

Append to `LESSONS.md`:

```markdown
### 2026-05-17 — Migrated hosting Vercel → Railway

**Why:** Vercel Hobby's 10s function timeout broke AI streaming; Pro
($20/mo) was the cheapest fix on Vercel but Railway Hobby (~$5/mo) gave
us no timeout, full filesystem for puppeteer, and Cloudflare wildcard
SSL in one shot.

**Key learnings:**
- Puppeteer in serverless functions (Vercel) requires @sparticuz/chromium
  and is brittle; in a long-running container (Railway), use full
  puppeteer + system Chromium (alpine `chromium` package).
- Cloudflare buffers SSE by default — explicit Configuration Rules
  needed on streaming endpoints to keep token streams unbuffered.
- Railway Hobby's $5 includes $5 usage credit; at our scale (~20
  teachers, 150 students) the bill stays exactly $5/mo because actual
  usage is well under the credit.

**Rule going forward:** When the app needs long-running operations
(streaming, headless browser, heavy compute) AND we're not paying
Vercel Pro money, deploy as a Docker container on Railway. The
serverless model is wrong for these workloads.
```

- [ ] **Step 4: Commit**

```
git add LESSONS.md next.config.ts lib/pdf/browser.ts
# any other files where you cleaned debug logs
git commit -m "chore: cleanup post-Railway migration + LESSONS.md note"
```

---

## Task 43: Update memory — delete the Vercel TODO

**Files:**
- Delete: `C:\Users\Saad TXB\.claude\projects\D--cli-projects-saadgpt\memory\vercel_subdomain_registration_todo.md`
- Modify: `C:\Users\Saad TXB\.claude\projects\D--cli-projects-saadgpt\memory\MEMORY.md`

- [ ] **Step 1: Remove the memory entry**

Delete `vercel_subdomain_registration_todo.md` from the memory folder. The wildcard SSL is now handled by Cloudflare.

- [ ] **Step 2: Update MEMORY.md index**

Open `MEMORY.md` and delete the line referencing `vercel_subdomain_registration_todo.md`.

- [ ] **Step 3: Add a new memory note for the Railway hosting state**

Create `C:\Users\Saad TXB\.claude\projects\D--cli-projects-saadgpt\memory\hosting_railway.md`:

```markdown
---
name: hosting-railway
description: App is hosted on Railway Hobby (~$5/mo), not Vercel. Cloudflare in front for wildcard SSL + DNS.
metadata:
  type: project
---

The Skool Rooms app moved from Vercel to Railway on 2026-05-17 to solve the
Vercel Hobby 10s function timeout (which killed AI streaming) without
upgrading to Vercel Pro ($20/mo).

**Stack now:**
- Railway runs a single Docker container (Node 20 alpine + Chromium).
- Cloudflare proxies traffic, terminates SSL (including wildcard `*.skoolrooms.com`).
- Configuration Rules on Cloudflare disable buffering for `/api/lesson-plans/generate` and `/api/lesson-plans/*/revise` so SSE streams pass through.

**Why:** Why this lets us run puppeteer in-process for themed PDFs, supports unbounded function execution time for AI streaming, and costs $5/mo all-in.

**How to apply:** When debugging deploys, check Railway dashboard (not Vercel). When DNS / SSL acts up, the issue is almost always Cloudflare proxy settings, not Railway.
```

Add to MEMORY.md:
```
- [Hosting on Railway](hosting_railway.md) — app moved off Vercel on 2026-05-17; single Docker container + Cloudflare in front
```

- [ ] **Step 4: No git commit for memory files** (they're outside the project repo).

---

## Task 44: Push branch + open PR

- [ ] **Step 1: Push**

```
git push origin feat/ai-lesson-planner
```

- [ ] **Step 2: Open PR**

```
gh pr create --title "Themed lesson plan PDFs + Railway hosting migration" --body "$(cat <<'EOF'
## Summary

- 8 themes (Notion/Anthropic/Vercel/Apple/Material/Stripe + 2 originals) rendered via puppeteer-on-Railway
- Web detail view + PDF use the same themed React component
- AI emits explicit THEME + DOC_TYPE metadata; no pattern matching
- react-pdf stays as fallback if puppeteer fails
- Hosting migrated Vercel → Railway Hobby (~\$5/mo)
- Cloudflare wildcard SSL replaces per-subdomain registration TODO

## Test plan

- [ ] Generate a plan with each of 8 themes; verify PDF + web view match
- [ ] Auto picker chooses sensible themes for different subjects
- [ ] Revise keeps THEME sticky across iterations
- [ ] Fallback renderer fires when puppeteer is unavailable
- [ ] Streaming preview renders incrementally through Cloudflare (not all-at-once)
- [ ] Wildcard subdomain SSL works (`https://random-name.skoolrooms.com`)
- [ ] DNS cutover smoke-tested at 3-4 AM PKT

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Task 45: After 1 week stable — decommission Vercel

⚠️ **Defer this for at least 7 days post-cutover.**

- [ ] **Step 1: Confirm Railway has been stable**

User: look at uptime, error rates, PDF success rate over the past week.

- [ ] **Step 2: Decommission Vercel**

User does:
1. Log in to Vercel
2. Project Settings → Advanced → Delete Project (or just disconnect from Git so it stops auto-deploying)
3. Keep the project archived for 30 more days in case of catastrophic Railway issue

- [ ] **Step 3: Cancel any Vercel paid features**

If you ever upgraded a feature in Vercel and it's still billing — cancel.

---

## Self-Review Findings

I checked the plan against the spec:

- **Spec coverage:** All 18 sections of the spec have implementing tasks. Themes (5 → Tasks 6-13), AI metadata (8 → Tasks 22-23), picker UX (6 → Task 27), database (7 → Tasks 1-2), scaffold (9 → Tasks 16-21), PDF route (10 → Tasks 33-35), Railway migration (4 → Tasks 36-40), risks/testing (15-16 → Tasks 41 Phase C). ✓
- **Placeholder scan:** No "TBD" / "TODO" / "implement later" in the plan body. Tasks 38-40 are explicitly "user actions" — that's by design since the implementer agent can't run Railway dashboard clicks. ✓
- **Type consistency:** `ThemeSlug`, `DocType`, `PlanResult`, `ThemePickerValue`, `Theme` are all defined once in Task 3 and used consistently afterward. The `theme_slug` column name is the same in migration (Task 1), types regen (Task 2), RPC (Task 25), action (Task 28), route (Task 29). ✓
- **One refinement during writing:** the original spec said "atomic insert RPC migration 029" exists from earlier work. I added Task 25 to extend it (`031_atomic_insert_with_theme.sql`) because adding a column to lesson_plans + the RPC's INSERT statement both need theme_slug. The spec's "single new migration 030" stays — Task 25's 031 is a small follow-up specific to the RPC signature.
- **Component variant scope** is intentionally narrow in this plan (defaults only). Variants (`cover-page-hero`, `sketchpad-frame`, etc.) get added lazily in future tasks not in this plan — per the spec section on "Component variant scope for Phase 1."
