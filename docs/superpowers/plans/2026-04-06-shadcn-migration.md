# shadcn/ui Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Skool Rooms's custom UI to shadcn/ui with purple+orange theme, dark mode, bento dashboards, and unified sidebar navigation.

**Architecture:** Layered migration in 4 phases — Foundation (theme + deps), Primitives (9 component swaps), Compositions (sidebar + data table + command palette), Dashboards + Polish (bento grids + charts + final audit). Each phase is independently shippable. Each component swap verified with TypeScript check + Chrome DevTools screenshots.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4 (CSS-first), shadcn/ui, Radix UI, next-themes, Sonner, @tanstack/react-table, Recharts, Lucide React, date-fns

**Spec:** `docs/superpowers/specs/2026-04-06-shadcn-migration-design.md`

**Impact Summary:**
- Button: 41 files, Card: 52 files, Input: 20 files, StatusBadge: 23 files, PageHeader: 32 files
- Token `text-ink`: 321 occurrences/96 files, `text-muted`: 394/88 files, `bg-paper`: 76/47 files
- Total: ~70+ files modified, ~20 new files, ~12 files deleted

---

## Phase 1: Foundation

### Task 1: Install dependencies and initialize shadcn

**Files:**
- Modify: `package.json`
- Create: `components.json`
- Create: `lib/utils.ts`

- [ ] **Step 1: Install shadcn CLI prerequisites**

```bash
cd D:/cli-projects/saadgpt
npm install class-variance-authority clsx tailwind-merge lucide-react next-themes sonner
```

- [ ] **Step 2: Create cn() utility**

Create `lib/utils.ts`:

```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 3: Create components.json for shadcn CLI**

Create `components.json` in project root:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 4: Verify installation**

```bash
npx tsc --noEmit
```

Expected: zero errors (no components changed yet)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/utils.ts components.json
git commit -m "chore: install shadcn prerequisites — cva, clsx, tailwind-merge, lucide, next-themes, sonner"
```

---

### Task 2: Replace globals.css with OKLCH theme

**Files:**
- Modify: `app/globals.css` (complete rewrite)

- [ ] **Step 1: Replace globals.css with new theme**

Replace the entire contents of `app/globals.css` with:

```css
/* app/globals.css — shadcn/ui + Tailwind CSS v4 (OKLCH dual-mode theme) */
/* Theme change = edit THIS ONE FILE. All components use semantic tokens. */
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

:root {
  /* Page */
  --background: oklch(0.97 0.005 90);
  --foreground: oklch(0.15 0.02 260);

  /* Cards */
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.15 0.02 260);

  /* Popover */
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.15 0.02 260);

  /* Primary (purple) */
  --primary: oklch(0.55 0.25 285);
  --primary-foreground: oklch(0.98 0 0);

  /* Secondary */
  --secondary: oklch(0.93 0.01 260);
  --secondary-foreground: oklch(0.2 0.02 260);

  /* Accent (orange) */
  --accent: oklch(0.7 0.18 50);
  --accent-foreground: oklch(0.98 0 0);

  /* Muted */
  --muted: oklch(0.93 0.005 90);
  --muted-foreground: oklch(0.55 0.02 260);

  /* Destructive */
  --destructive: oklch(0.55 0.2 25);
  --destructive-foreground: oklch(0.98 0 0);

  /* Success + Warning (kept from current, as OKLCH) */
  --success: oklch(0.55 0.17 145);
  --warning: oklch(0.75 0.15 85);

  /* Borders & inputs */
  --border: oklch(0.90 0.005 260);
  --input: oklch(0.90 0.005 260);
  --ring: oklch(0.55 0.25 285);

  /* Sidebar */
  --sidebar: oklch(0.98 0.005 90);
  --sidebar-foreground: oklch(0.55 0.02 260);
  --sidebar-accent: oklch(0.93 0.005 90);
  --sidebar-accent-foreground: oklch(0.2 0.02 260);
  --sidebar-border: oklch(0.90 0.005 260);
  --sidebar-ring: oklch(0.55 0.25 285);
  --sidebar-primary: oklch(0.55 0.25 285);
  --sidebar-primary-foreground: oklch(0.98 0 0);

  /* Charts */
  --chart-1: oklch(0.55 0.25 285);
  --chart-2: oklch(0.65 0.20 285);
  --chart-3: oklch(0.75 0.15 285);
  --chart-4: oklch(0.7 0.18 50);
  --chart-5: oklch(0.45 0.25 285);

  /* Radius */
  --radius: 0.75rem;
}

.dark {
  --background: oklch(0.13 0.02 275);
  --foreground: oklch(0.93 0.005 260);
  --card: oklch(0.18 0.02 275);
  --card-foreground: oklch(0.93 0.005 260);
  --popover: oklch(0.18 0.02 275);
  --popover-foreground: oklch(0.93 0.005 260);
  --primary: oklch(0.65 0.25 285);
  --primary-foreground: oklch(0.15 0.02 260);
  --secondary: oklch(0.22 0.02 275);
  --secondary-foreground: oklch(0.9 0.005 260);
  --accent: oklch(0.7 0.18 50);
  --accent-foreground: oklch(0.15 0.02 260);
  --muted: oklch(0.22 0.02 275);
  --muted-foreground: oklch(0.65 0.01 260);
  --destructive: oklch(0.55 0.2 25);
  --destructive-foreground: oklch(0.98 0 0);
  --success: oklch(0.55 0.17 145);
  --warning: oklch(0.75 0.15 85);
  --border: oklch(0.28 0.02 275);
  --input: oklch(0.28 0.02 275);
  --ring: oklch(0.65 0.25 285);
  --sidebar: oklch(0.15 0.02 275);
  --sidebar-foreground: oklch(0.65 0.01 260);
  --sidebar-accent: oklch(0.22 0.02 275);
  --sidebar-accent-foreground: oklch(0.9 0.005 260);
  --sidebar-border: oklch(0.28 0.02 275);
  --sidebar-ring: oklch(0.65 0.25 285);
  --sidebar-primary: oklch(0.65 0.25 285);
  --sidebar-primary-foreground: oklch(0.15 0.02 260);
  --chart-1: oklch(0.65 0.25 285);
  --chart-2: oklch(0.55 0.20 285);
  --chart-3: oklch(0.45 0.15 285);
  --chart-4: oklch(0.7 0.18 50);
  --chart-5: oklch(0.75 0.25 285);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

/* RULE: Never use raw hex or hardcoded colors in components. */
/* Always use semantic tokens: bg-primary, text-foreground, border-border, etc. */
/* Always support dark mode — test with both themes. */

/* iOS WebKit fix: cursor:pointer for reliable tap events on buttons.
   Keep until all components migrated to shadcn (Radix handles it natively). */
@layer base {
  button, [role="button"] {
    cursor: pointer;
    -webkit-tap-highlight-color: oklch(0.55 0.25 285 / 0.1);
  }
  a {
    -webkit-tap-highlight-color: oklch(0.55 0.25 285 / 0.1);
  }
}

/* CSS-only mobile sidebar toggle — keep until shadcn Sidebar replaces it in Phase 3. */
body:has(#admin-sidebar-toggle:checked) .admin-sidebar-overlay,
body:has(#teacher-sidebar-toggle:checked) .teacher-sidebar-overlay {
  display: block;
}
body:has(#admin-sidebar-toggle:checked) .admin-sidebar-drawer,
body:has(#teacher-sidebar-toggle:checked) .teacher-sidebar-drawer {
  transform: translateX(0) !important;
}
@media (min-width: 768px) {
  .admin-sidebar-overlay, .teacher-sidebar-overlay {
    display: none !important;
  }
}
```

- [ ] **Step 2: Verify the page still renders**

```bash
npm run dev &
sleep 10
curl -s http://localhost:3000 -o /dev/null -w "%{http_code}"
```

Expected: 200. The page will look broken (old token classes like `bg-paper` no longer exist) — that's expected and fixed in Task 3.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: replace theme with OKLCH dual-mode (light + dark) for shadcn"
```

---

### Task 3: Batch token migration across all files

**Files:**
- Modify: ~96 files (every file using old token classes)

This task does a bulk find-and-replace of old CSS token classes to new shadcn tokens. The mapping:

| Old | New | Occurrences |
|-----|-----|-------------|
| `bg-paper` | `bg-background` | 76 in 47 files |
| `bg-surface` | `bg-card` | 47 in 29 files |
| `text-ink` | `text-foreground` | 321 in 96 files |
| `text-muted` | `text-muted-foreground` | 394 in 88 files |
| `bg-danger` | `bg-destructive` | 30 in 24 files |
| `text-danger` | `text-destructive` | grep to find count |
| `shadow-card-hover` | `shadow-md` | grep to find count |
| `shadow-card` | `shadow-sm` | 19 in 14 files |
| `bg-brand-600` | `bg-primary` | grep to find count |
| `bg-brand-500` | `bg-primary/90` | grep to find count |
| `bg-brand-50` | `bg-primary/10` | grep to find count |
| `bg-brand-100` | `bg-primary/20` | grep to find count |
| `bg-brand-900` | `bg-primary-foreground` (dark shade) | grep to find count |
| `text-brand-600` | `text-primary` | grep to find count |
| `border-brand-600` | `border-primary` | grep to find count |
| `ring-brand-500` | `ring-primary` | grep to find count |
| `hover:bg-brand-500` | `hover:bg-primary/90` | grep to find count |
| `hover:bg-brand-50` | `hover:bg-primary/10` | grep to find count |
| `focus-visible:ring-brand-500` | `focus-visible:ring-ring` | grep to find count |
| `focus-visible:ring-danger` | `focus-visible:ring-destructive` | grep to find count |

- [ ] **Step 1: Run batch replacements**

Use a subagent to perform these replacements across all `.tsx`, `.ts`, and `.css` files in `app/`, `components/`, `providers/`, `hooks/`. Exclude `node_modules/`, `.next/`, `docs/`.

For each replacement:
1. Use `grep` to find all files containing the old token
2. Use `Edit` tool with `replace_all: true` per file to swap old → new
3. Handle order-dependent replacements carefully (e.g., `shadow-card-hover` before `shadow-card`, `bg-brand-600` before `bg-brand-50`)

The subagent should process replacements in this order to avoid partial matches:
1. `shadow-card-hover` → `shadow-md` (before shadow-card)
2. `shadow-card` → `shadow-sm`
3. `bg-brand-900` → `bg-primary/5` (darkest, for pressed states)
4. `bg-brand-600` → `bg-primary`
5. `bg-brand-500` → `bg-primary/90`
6. `bg-brand-100` → `bg-primary/20`
7. `bg-brand-50` → `bg-primary/10`
8. `text-brand-600` → `text-primary`
9. `text-brand-500` → `text-primary`
10. `border-brand-600` → `border-primary`
11. `ring-brand-500` → `ring-ring`
12. `hover:bg-brand-500` → `hover:bg-primary/90`
13. `hover:bg-brand-50` → `hover:bg-primary/10`
14. `hover:text-brand-500` → `hover:text-primary/90`
15. `focus-visible:ring-brand-500` → `focus-visible:ring-ring`
16. `focus-visible:ring-danger` → `focus-visible:ring-destructive`
17. `bg-paper` → `bg-background`
18. `bg-surface` → `bg-card`
19. `text-ink` → `text-foreground`
20. `text-muted` → `text-muted-foreground` (careful: only bare `text-muted`, not `text-muted-foreground`)
21. `bg-danger` → `bg-destructive`
22. `text-danger` → `text-destructive`
23. `bg-danger/10` → `bg-destructive/10`
24. `bg-danger/90` → `bg-destructive/90`

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors (class names are strings, TypeScript doesn't validate them)

- [ ] **Step 3: Visual verification**

Start dev server, open Chrome DevTools at `http://localhost:3000`. Take screenshots of:
- Homepage (mobile 375x812 + desktop 1440x900)
- Login page
- Admin dashboard (if logged in session exists)

The app should render with the new purple/warm-gray color scheme. If any element is invisible or has no background, a token was missed — grep for the old class name.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: migrate all CSS tokens from custom to shadcn semantic system"
```

---

### Task 4: Add ThemeProvider for dark mode

**Files:**
- Modify: `app/layout.tsx`
- Create: `components/ui/ThemeToggle.tsx`

- [ ] **Step 1: Add ThemeProvider to root layout**

Modify `app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: "Skool Rooms — LMS for Tutors",
  description:
    "An LMS platform for independent tutors, home teachers, and small coaching centers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans bg-background text-foreground antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create ThemeToggle component**

Create `components/ui/ThemeToggle.tsx`:

```tsx
'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-9 w-9" /> // placeholder to prevent layout shift

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </button>
  )
}
```

- [ ] **Step 3: Verify dark mode works**

Open Chrome DevTools at `http://localhost:3000`. Run in console:

```js
document.documentElement.classList.add('dark')
```

The page should switch to dark colors. Run:

```js
document.documentElement.classList.remove('dark')
```

It should switch back to light. Take screenshots of both states.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx components/ui/ThemeToggle.tsx
git commit -m "feat: add dark mode support via next-themes ThemeProvider"
```

---

## Phase 2: Primitives (Layer 1)

### Task 5: Install shadcn Button and migrate all consumers

**Files:**
- Replace: `components/ui/Button.tsx` (41 consumers)

- [ ] **Step 1: Install shadcn button**

```bash
npx shadcn@latest add button
```

This overwrites `components/ui/button.tsx` (lowercase). Our current file is `Button.tsx` (uppercase). shadcn creates lowercase. We need to handle the casing.

- [ ] **Step 2: Customize shadcn button with our variants**

Edit the installed `components/ui/button.tsx` to add our variant mapping and loading state:

```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/Spinner"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70 border border-border",
        outline: "border border-primary text-primary bg-transparent hover:bg-primary/10 active:bg-primary/20",
        danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80",
        ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground active:bg-secondary/80",
        accent: "bg-accent text-accent-foreground hover:bg-accent/90 active:bg-accent/80",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-3 text-sm min-h-[2.75rem]",
        md: "h-10 px-4 py-2 text-sm min-h-[2.75rem]",
        lg: "h-11 px-6 py-3 text-base min-h-[2.75rem]",
        icon: "h-10 w-10 min-h-[2.75rem] min-w-[2.75rem]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Spinner size="sm" className="text-current" />}
        {children}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

- [ ] **Step 3: Delete old Button.tsx and fix import casing**

Delete `components/ui/Button.tsx` (uppercase). The new file is `components/ui/button.tsx` (lowercase). Update all 41 consumer files:

Search for `from '@/components/ui/Button'` and replace with `from '@/components/ui/button'` across the entire codebase.

No API changes needed — the component name is still `Button`, props `variant`, `size`, `loading`, `disabled`, `className` all work the same. The only breaking change is that variant `"default"` doesn't exist in our mapping — but we never used it (our default was `"primary"` which stays).

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

Then take Chrome DevTools screenshots of any page with buttons (login page, admin dashboard).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: replace custom Button with shadcn button — 41 consumers migrated"
```

---

### Task 6: Install shadcn Card and migrate all consumers

**Files:**
- Replace: `components/ui/Card.tsx` (52 consumers)

- [ ] **Step 1: Install shadcn card**

```bash
npx shadcn@latest add card
```

- [ ] **Step 2: Delete old Card.tsx, fix import casing**

Delete `components/ui/Card.tsx`. Replace all imports:
`from '@/components/ui/Card'` → `from '@/components/ui/card'`

- [ ] **Step 3: Update consumer usage pattern**

Our old Card API was:
```tsx
<Card className="..." hover={true}>content</Card>
```

shadcn Card API is:
```tsx
<Card className="...">
  <CardHeader><CardTitle>...</CardTitle></CardHeader>
  <CardContent>content</CardContent>
</Card>
```

For this migration, **keep it simple**: most of our Card usages are just wrappers with `className` and `children`. The shadcn Card base component works the same way — it's just a styled div. The `hover` prop needs to be replaced with `className="hover:shadow-md transition-shadow"` on the instances that used it.

Search all 52 files for `hover={true}` or `hover` prop on Card and replace with the hover class. Then update imports to include `CardHeader`, `CardContent`, `CardFooter` only where the structured layout is needed (dashboard bento cards in Phase 4).

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

Take screenshots of pages with cards (dashboard, course detail, settings).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: replace custom Card with shadcn card — 52 consumers migrated"
```

---

### Task 7: Install shadcn Input + Label and migrate consumers

**Files:**
- Replace: `components/ui/Input.tsx` (20 consumers)
- Install: `components/ui/label.tsx`

- [ ] **Step 1: Install shadcn input and label**

```bash
npx shadcn@latest add input label
```

- [ ] **Step 2: Understand the API change**

Our old Input had `label` and `error` props built in:
```tsx
<Input label="Email" name="email" type="email" error={errors.email} />
```

shadcn Input is just a styled `<input>`. Label is separate. The migration for each consumer:
```tsx
<div>
  <Label htmlFor="email">Email</Label>
  <Input id="email" name="email" type="email" />
  {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
</div>
```

- [ ] **Step 3: Delete old Input.tsx, update all 20 consumers**

Delete `components/ui/Input.tsx`. Fix import casing. For each of the 20 consumer files:
1. Add `Label` import: `import { Label } from '@/components/ui/label'`
2. Update `Input` import: `from '@/components/ui/input'`
3. Replace each `<Input label="X" error={Y} ...rest />` with the Label + Input + error pattern

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

Test form submission on login page, signup page, settings page via Chrome DevTools.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: replace custom Input with shadcn input + label — 20 consumers migrated"
```

---

### Task 8: Install shadcn Select and migrate consumers

**Files:**
- Replace: `components/ui/Select.tsx` (5 consumers)

- [ ] **Step 1: Install shadcn select**

```bash
npx shadcn@latest add select
```

- [ ] **Step 2: Understand the API change**

Our old Select:
```tsx
<Select label="Subject" options={[{value: 'math', label: 'Math'}]} error={err} />
```

shadcn Select (Radix-based):
```tsx
<div>
  <Label>Subject</Label>
  <Select>
    <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
    <SelectContent>
      <SelectItem value="math">Math</SelectItem>
    </SelectContent>
  </Select>
  {err && <p className="text-sm text-destructive mt-1">{err}</p>}
</div>
```

- [ ] **Step 3: Delete old Select.tsx, update 5 consumers**

Delete `components/ui/Select.tsx`. Update import paths. Transform each consumer to the Radix Select pattern. The 5 consumers are likely: ExploreFilters, DataTable (page size), and form pages.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

Test dropdowns open/close, value selection works. Chrome DevTools screenshots.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: replace custom Select with shadcn select (Radix) — 5 consumers migrated"
```

---

### Task 9: Install shadcn Textarea, Dialog, AlertDialog, Badge and migrate consumers

**Files:**
- Replace: `components/ui/Textarea.tsx` (6 consumers)
- Replace: `components/ui/Modal.tsx` (3 consumers)
- Replace: `components/ui/ConfirmModal.tsx` (1 consumer)
- Replace: `components/ui/StatusBadge.tsx` (23 consumers)

- [ ] **Step 1: Install all four components**

```bash
npx shadcn@latest add textarea dialog alert-dialog badge
```

- [ ] **Step 2: Migrate Textarea (6 consumers)**

Same pattern as Input — our Textarea had `label` and `error` built in. Replace with Label + Textarea + error `<p>`. Delete old `Textarea.tsx`, fix import casing.

- [ ] **Step 3: Migrate Modal → Dialog (3 consumers)**

Our old API:
```tsx
<Modal isOpen={open} onClose={close} title="Edit Course" size="md">content</Modal>
```

shadcn Dialog:
```tsx
<Dialog open={open} onOpenChange={close}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader><DialogTitle>Edit Course</DialogTitle></DialogHeader>
    content
  </DialogContent>
</Dialog>
```

Size mapping: `sm` → `sm:max-w-sm`, `md` → `sm:max-w-md`, `lg` → `sm:max-w-lg`.

Update the 3 consumers. Delete old `Modal.tsx`.

- [ ] **Step 4: Migrate ConfirmModal → AlertDialog (1 consumer)**

Our old API:
```tsx
<ConfirmModal isOpen onClose onConfirm title="Delete?" message="Are you sure?" confirmVariant="danger" loading />
```

shadcn AlertDialog:
```tsx
<AlertDialog open={isOpen} onOpenChange={onClose}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete?</AlertDialogTitle>
      <AlertDialogDescription>Are you sure?</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground" disabled={loading}>
        {loading ? <Spinner size="sm" /> : 'Delete'}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

The 1 consumer is UIProvider which renders it globally. Update UIProvider. Delete old `ConfirmModal.tsx`.

- [ ] **Step 5: Migrate StatusBadge → Badge (23 consumers)**

Our old API:
```tsx
<StatusBadge status="active" size="sm" />
```

shadcn Badge with our status mapping:
```tsx
<Badge variant={statusVariant(status)}>{status}</Badge>
```

Create a small helper or extend the Badge component to map our status strings to badge variants (e.g., 'active' → 'default' with green, 'pending' → 'secondary' with amber, 'rejected' → 'destructive'). This can be a wrapper `StatusBadge` that uses shadcn Badge internally — keeping the same import path so the 23 consumers don't need import changes, just install Badge underneath.

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
```

Test: modals open/close (admin teacher actions), confirm dialogs (delete course), badges render on student list, payment queue. Chrome DevTools screenshots.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: replace Textarea, Modal, ConfirmModal, StatusBadge with shadcn equivalents"
```

---

### Task 10: Replace Toast with Sonner

**Files:**
- Delete: `components/ui/Toast.tsx`
- Delete: `hooks/useToast.ts`
- Modify: `providers/UIProvider.tsx`
- Modify: `app/layout.tsx`
- Modify: all files importing `useToast` (grep to find exact list)

- [ ] **Step 1: Add Sonner Toaster to root layout**

In `app/layout.tsx`, add inside ThemeProvider:

```tsx
import { Toaster } from 'sonner'

// Inside ThemeProvider:
<Toaster richColors position="top-right" />
```

- [ ] **Step 2: Find all useToast consumers**

```bash
grep -r "useToast\|addToast" app/ components/ lib/ --include="*.tsx" --include="*.ts" -l
```

For each file found:
1. Replace `import { useToast } from '@/hooks/useToast'` with `import { toast } from 'sonner'`
2. Remove `const { addToast } = useToast()` line
3. Replace `addToast({ type: 'success', message: 'X' })` with `toast.success('X')`
4. Replace `addToast({ type: 'error', message: 'X' })` with `toast.error('X')`
5. Replace `addToast({ type: 'warning', message: 'X' })` with `toast.warning('X')`

- [ ] **Step 3: Clean up UIProvider**

Remove toast state management from `providers/UIProvider.tsx`. Remove the Toast rendering. Keep only non-toast UI state (if any remains — check if UIProvider still has purpose after toast removal).

- [ ] **Step 4: Delete old files**

Delete `hooks/useToast.ts` and `components/ui/Toast.tsx`.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
```

Trigger a toast in the UI (e.g., try logging in with wrong credentials — should show error toast). Chrome DevTools screenshot of toast appearing.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: replace custom Toast + useToast with Sonner — all consumers migrated"
```

---

### Task 11: Restyle Spinner

**Files:**
- Modify: `components/ui/Spinner.tsx`

- [ ] **Step 1: Update Spinner to use new tokens**

The Spinner is kept custom (no shadcn equivalent). Just update its color class from any old brand colors to `text-primary`:

Read the file, replace any `text-brand-*` or hardcoded colors with `text-primary`. Ensure `className` prop is composed with `cn()`.

- [ ] **Step 2: Commit**

```bash
git add components/ui/Spinner.tsx
git commit -m "feat: restyle Spinner with new theme tokens"
```

---

## Phase 2 Checkpoint

At this point, all 9 custom primitives are replaced with shadcn equivalents. The app should be fully functional with the new purple theme and all existing features working.

**Verification checklist:**
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run build` — succeeds
- [ ] Chrome DevTools screenshots (mobile + desktop) of:
  - Homepage
  - Login page
  - Admin login → Admin dashboard
  - Teacher dashboard
  - Student portal
  - Settings pages
  - Any page with forms, modals, badges
- [ ] Dark mode toggle works (add `.dark` class manually in DevTools console for now — ThemeToggle not wired into nav yet)

---

## Phase 3: Compositions (Layer 2)

### Task 12: Install shadcn Sidebar + Sheet and build SidebarShell

**Files:**
- Install: `components/ui/sidebar.tsx`, `components/ui/sheet.tsx`, `components/ui/separator.tsx`, `components/ui/tooltip.tsx`
- Create: `components/ui/SidebarShell.tsx`
- Create: `components/ui/NotificationBell.tsx`
- Create: `constants/nav-items.ts`

- [ ] **Step 1: Install shadcn components**

```bash
npx shadcn@latest add sidebar sheet separator tooltip switch
```

- [ ] **Step 2: Create nav items constants**

Create `constants/nav-items.ts` with Lucide icon imports and nav configuration for all three roles:

```tsx
import {
  LayoutDashboard, BookOpen, Users, CreditCard, Wallet,
  BarChart3, Settings, Shield, Clock, FileText, Calendar,
  Bell
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'

export type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

export const TEACHER_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: ROUTES.TEACHER.dashboard, icon: LayoutDashboard },
  { label: 'Courses', href: ROUTES.TEACHER.courses, icon: BookOpen },
  { label: 'Students', href: ROUTES.TEACHER.students, icon: Users },
  { label: 'Payments', href: ROUTES.TEACHER.payments, icon: CreditCard },
  { label: 'Earnings', href: ROUTES.TEACHER.earnings, icon: Wallet },
  { label: 'Analytics', href: ROUTES.TEACHER.analytics, icon: BarChart3 },
  { label: 'Settings', href: ROUTES.TEACHER.settings, icon: Settings },
]

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: ROUTES.ADMIN.dashboard, icon: LayoutDashboard },
  { label: 'Teachers', href: ROUTES.ADMIN.teachers, icon: Users },
  { label: 'Payments', href: ROUTES.ADMIN.payments, icon: CreditCard },
  { label: 'Settings', href: ROUTES.ADMIN.settings, icon: Settings },
  { label: 'Operations', href: ROUTES.ADMIN.operations, icon: Shield },
]

export const STUDENT_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: ROUTES.STUDENT.dashboard, icon: LayoutDashboard },
  { label: 'My Courses', href: ROUTES.STUDENT.courses, icon: BookOpen },
  { label: 'Schedule', href: ROUTES.STUDENT.schedule, icon: Calendar },
  { label: 'Payments', href: ROUTES.STUDENT.payments, icon: CreditCard },
  { label: 'Settings', href: ROUTES.STUDENT.settings, icon: Settings },
]
```

Note: Verify exact route constants exist in `constants/routes.ts` — check and add any missing ones.

- [ ] **Step 3: Create NotificationBell component**

Create `components/ui/NotificationBell.tsx`:

```tsx
import { Bell } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type NotificationBellProps = {
  count: number
  href: string
  className?: string
}

export function NotificationBell({ count, href, className }: NotificationBellProps) {
  return (
    <Link href={href} className={cn("relative inline-flex items-center justify-center", className)}>
      <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
```

- [ ] **Step 4: Build SidebarShell**

Create `components/ui/SidebarShell.tsx`. This is the shared sidebar that all three roles use. It wraps shadcn's Sidebar component with:
- Logo at top
- Command bar trigger (Cmd+K)
- Nav items with active state
- Notification bell
- Separator
- Theme toggle
- User info + sign out

The implementation should use shadcn's `Sidebar`, `SidebarContent`, `SidebarHeader`, `SidebarFooter`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarTrigger`, `SidebarProvider`, and `SidebarInset` components.

Read the installed `components/ui/sidebar.tsx` to understand the exact API, then build SidebarShell using it.

Props:
```tsx
type SidebarShellProps = {
  navItems: NavItem[]
  user: { name: string; role: string }
  roleBadge?: string | null
  notificationCount?: number
  notificationHref?: string
  signOutAction: () => Promise<void>
  children: React.ReactNode
}
```

- [ ] **Step 5: Replace teacher Sidebar**

Update `app/(teacher)/dashboard/layout.tsx` to use SidebarShell:
```tsx
import { SidebarShell } from '@/components/ui/SidebarShell'
import { TEACHER_NAV_ITEMS } from '@/constants/nav-items'
import { signOut } from '@/lib/auth/actions'

// In the layout:
<SidebarShell
  navItems={TEACHER_NAV_ITEMS}
  user={{ name: teacher.name, role: 'teacher' }}
  notificationCount={pendingPaymentsCount}
  notificationHref="/dashboard/payments"
  signOutAction={signOut}
>
  {children}
</SidebarShell>
```

Delete `components/teacher/Sidebar.tsx`.

- [ ] **Step 6: Replace admin AdminSidebar**

Update `app/(platform)/admin/layout.tsx` similarly with `ADMIN_NAV_ITEMS` and admin-specific notification count. Add `roleBadge="Admin"`.

Delete `components/admin/AdminSidebar.tsx`.

- [ ] **Step 7: Replace student StudentNav with sidebar**

Update `app/(student)/student/layout.tsx` to use SidebarShell instead of the top nav. Change layout from `pt-14` to sidebar offset `md:ml-64 md:pt-0`.

Delete `components/student/StudentNav.tsx`.

- [ ] **Step 8: Remove old sidebar CSS from globals.css**

Remove the checkbox toggle CSS:
```css
/* Delete these lines: */
body:has(#admin-sidebar-toggle:checked) ...
body:has(#teacher-sidebar-toggle:checked) ...
@media (min-width: 768px) { .admin-sidebar-overlay ... }
```

- [ ] **Step 9: Verify**

```bash
npx tsc --noEmit
```

Chrome DevTools screenshots:
- Teacher dashboard with sidebar (desktop expanded, desktop collapsed, mobile sheet)
- Admin dashboard with sidebar + "Admin" badge
- Student dashboard with sidebar (new layout — was top nav before)
- Dark mode for all three

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: unified SidebarShell replaces all 3 navigation components — Lucide icons, Sheet mobile, dark mode toggle"
```

---

### Task 13: Install Command palette

**Files:**
- Install: `components/ui/command.tsx`
- Create: `components/ui/CommandPalette.tsx`
- Modify: `components/ui/SidebarShell.tsx`

- [ ] **Step 1: Install shadcn command**

```bash
npx shadcn@latest add command
```

- [ ] **Step 2: Build CommandPalette**

Create `components/ui/CommandPalette.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  CommandDialog, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList, CommandSeparator
} from '@/components/ui/command'
import type { NavItem } from '@/constants/nav-items'

type CommandPaletteProps = {
  navItems: NavItem[]
  actions?: { label: string; onSelect: () => void; icon?: React.ComponentType<{ className?: string }> }[]
}

export function CommandPalette({ navItems, actions = [] }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { setTheme, theme } = useTheme()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {navItems.map((item) => (
            <CommandItem
              key={item.href}
              onSelect={() => { router.push(item.href); setOpen(false) }}
            >
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          {actions.map((action) => (
            <CommandItem key={action.label} onSelect={() => { action.onSelect(); setOpen(false) }}>
              {action.icon && <action.icon className="mr-2 h-4 w-4" />}
              {action.label}
            </CommandItem>
          ))}
          <CommandItem onSelect={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setOpen(false) }}>
            Toggle Dark Mode
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

export function useCommandPalette() {
  return {
    open: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
  }
}
```

- [ ] **Step 3: Wire CommandPalette into SidebarShell**

Add `CommandPalette` to SidebarShell. Add a search button in the sidebar header that triggers it. The search button shows "Search..." text when expanded, just the search icon when collapsed.

- [ ] **Step 4: Verify**

Open any dashboard page. Press `Cmd+K` (or `Ctrl+K`). Command palette should open with page links and actions. Navigate to a page via the palette.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add command palette (Cmd+K) with page navigation and quick actions"
```

---

### Task 14: Rebuild DataTable with @tanstack/react-table

**Files:**
- Install: `@tanstack/react-table`
- Install: `components/ui/table.tsx` (shadcn), `components/ui/dropdown-menu.tsx`
- Rebuild: `components/ui/DataTable.tsx`

- [ ] **Step 1: Install dependencies**

```bash
npm install @tanstack/react-table
npx shadcn@latest add table dropdown-menu
```

- [ ] **Step 2: Rebuild DataTable**

Read the current `components/ui/DataTable.tsx` to understand the existing API (columns, data, searchable, searchPlaceholder, emptyMessage). Rebuild using `@tanstack/react-table` with shadcn Table for rendering. Preserve:
- Column sort (click header to sort)
- Search/filter input
- Pagination (page size selector, prev/next)
- Mobile card view pattern (`hidden md:block` for table, `md:hidden` for cards)
- Empty state via EmptyState component

The new DataTable should accept `@tanstack/react-table` ColumnDef types for columns.

- [ ] **Step 3: Update all DataTable consumers**

Check each consumer to update column definitions to the `@tanstack/react-table` ColumnDef format. The DataTable is used in 1 file directly but the old DataTable may be used in other pages that we need to check (admin teacher list, payment queue, etc. may use it indirectly).

- [ ] **Step 4: Verify**

Test sorting, filtering, pagination on a table page. Chrome DevTools screenshots (desktop table + mobile card view).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: rebuild DataTable with @tanstack/react-table + shadcn table"
```

---

### Task 15: Restyle remaining custom components

**Files:**
- Modify: `components/ui/FileUpload.tsx` (restyle)
- Modify: `components/ui/RichTextEditor.tsx` (restyle toolbar)
- Modify: `components/ui/PageHeader.tsx` (restyle + add filter slot)
- Modify: `components/ui/EmptyState.tsx` (restyle + Lucide icons)
- Rebuild: `components/ui/UsageBars.tsx` (use shadcn Progress)
- Modify: `components/public/PublicNavbar.tsx` (Sheet for mobile)

- [ ] **Step 1: Install shadcn progress**

```bash
npx shadcn@latest add progress
```

- [ ] **Step 2: Restyle FileUpload**

Read `components/ui/FileUpload.tsx`. Replace old token classes with new (bg-surface → bg-card, etc.). Keep all R2 upload logic and camera capture. Use `cn()` for class composition.

- [ ] **Step 3: Restyle RichTextEditor toolbar**

Read `components/ui/RichTextEditor.tsx`. Replace toolbar buttons with shadcn Button (variant="ghost", size="icon"). Use Lucide icons for bold/italic/list/link toolbar actions.

- [ ] **Step 4: Restyle PageHeader and add filter slot**

Read `components/ui/PageHeader.tsx`. Update tokens. Add an optional `filter` prop (ReactNode) that renders right-aligned in the header — this is where the date range filter will go in Phase 4.

```tsx
type PageHeaderProps = {
  title: string
  description?: string
  action?: React.ReactNode
  filter?: React.ReactNode    // new — for date range filter
  backHref?: string
}
```

- [ ] **Step 5: Restyle EmptyState**

Read `components/ui/EmptyState.tsx`. Update tokens. The `icon` prop currently accepts SVG component types — keep that but also support Lucide icon components (they use the same signature).

- [ ] **Step 6: Rebuild UsageBars with shadcn Progress**

Read `components/ui/UsageBars.tsx`. Replace the custom progress bars with shadcn `Progress` component. Keep the color threshold logic (amber at 80%, red at 95%, block at 100%) by setting `className` on the Progress indicator:

```tsx
<Progress
  value={(current / max) * 100}
  className={cn(
    percentage >= 95 ? '[&>div]:bg-destructive' :
    percentage >= 80 ? '[&>div]:bg-warning' :
    '[&>div]:bg-primary'
  )}
/>
```

- [ ] **Step 7: Update PublicNavbar mobile menu to use Sheet**

Read `components/public/PublicNavbar.tsx`. Replace the `<details>/<summary>` pattern with shadcn Sheet:

```tsx
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu } from 'lucide-react'

// Mobile:
<Sheet>
  <SheetTrigger asChild>
    <Button variant="ghost" size="icon" className="sm:hidden">
      <Menu className="h-6 w-6" />
    </Button>
  </SheetTrigger>
  <SheetContent side="right">
    {/* nav links */}
  </SheetContent>
</Sheet>
```

- [ ] **Step 8: Verify**

```bash
npx tsc --noEmit
```

Chrome DevTools screenshots of:
- FileUpload on payment page
- RichTextEditor on announcement create
- PageHeader on any dashboard page
- EmptyState on an empty list (e.g., no courses)
- UsageBars on teacher dashboard
- PublicNavbar mobile menu (Sheet opening)

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: restyle FileUpload, RTE, PageHeader, EmptyState, UsageBars, PublicNavbar with shadcn"
```

---

## Phase 3 Checkpoint

All compositions are rebuilt. The app has a unified sidebar, command palette, and all components use shadcn.

**Verification:**
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run build` — succeeds
- [ ] Sidebar works on all 3 roles (desktop collapse, mobile sheet)
- [ ] Command palette opens with Cmd+K
- [ ] Dark mode toggles from sidebar
- [ ] DataTable sorts, filters, paginates
- [ ] PublicNavbar Sheet opens on mobile

---

## Phase 4: Dashboards + Polish

### Task 16: Install remaining shadcn components

**Files:**
- Install: calendar, popover, chart, skeleton

- [ ] **Step 1: Install**

```bash
npx shadcn@latest add calendar popover skeleton chart
npm install @tanstack/react-table recharts date-fns
```

Note: @tanstack/react-table may already be installed from Task 14.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: install shadcn calendar, popover, skeleton, chart + recharts, date-fns"
```

---

### Task 17: Build DateRangeFilter component

**Files:**
- Create: `components/ui/DateRangeFilter.tsx`

- [ ] **Step 1: Build the date range filter**

Create `components/ui/DateRangeFilter.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, startOfWeek, startOfMonth, startOfQuarter, startOfYear } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const PRESETS = [
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'all_time', label: 'All Time' },
  { value: 'custom', label: 'Custom' },
] as const

type DateRange = { from: Date; to: Date }

export function DateRangeFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentPeriod = searchParams.get('period') || 'this_month'

  const [dateRange, setDateRange] = useState<DateRange | null>(null)

  function handlePresetChange(preset: string) {
    if (preset === 'custom') return // custom opens the calendar

    const now = new Date()
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', preset)
    params.delete('from')
    params.delete('to')
    router.push(`?${params.toString()}`)
  }

  function handleCustomRange(range: DateRange) {
    setDateRange(range)
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', 'custom')
    params.set('from', format(range.from, 'yyyy-MM-dd'))
    params.set('to', format(range.to, 'yyyy-MM-dd'))
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={currentPeriod} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {currentPeriod === 'custom' && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[220px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange ? `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d')}` : 'Pick a date range'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={dateRange ? { from: dateRange.from, to: dateRange.to } : undefined}
              onSelect={(range) => {
                if (range?.from && range?.to) handleCustomRange({ from: range.from, to: range.to })
              }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/DateRangeFilter.tsx
git commit -m "feat: build DateRangeFilter with presets + custom calendar range"
```

---

### Task 18: Redesign Teacher Dashboard with bento grid

**Files:**
- Modify: `app/(teacher)/dashboard/page.tsx`
- Modify: `components/ui/PageHeader.tsx` (wire filter)

- [ ] **Step 1: Read current teacher dashboard**

Read `app/(teacher)/dashboard/page.tsx` to understand current data fetching and layout.

- [ ] **Step 2: Rebuild with bento grid**

Rewrite the page with the bento layout from the spec:

```
Row 1: [Active Courses 1x1] [Total Students 1x1] [Pending Payments 1x1] [Active Days circle 1x1]
Row 2: [Revenue Trends chart 2x1]                 [Plan Usage bars 2x1]
Row 3: [Upcoming Classes list 1x1] [Recent Enrollments list 1x1] [Onboarding Checklist 2x1]
```

Use shadcn Card for each bento cell. Use Recharts for the revenue bar chart (lazy-loaded). Use shadcn Progress for plan usage bars. Use SVG for the circular progress ring.

Add DateRangeFilter to PageHeader via the `filter` prop.

Data fetching stays in the Server Component — pass date range from searchParams to db queries.

- [ ] **Step 3: Add date range params to db queries**

Check which `lib/db/` functions the dashboard calls. Add optional `dateFrom`/`dateTo` parameters where needed (e.g., revenue stats, enrollment counts). This is the minor backend addition noted in the spec.

- [ ] **Step 4: Verify**

Chrome DevTools screenshots:
- Desktop (1440x900): bento grid visible, 4 columns
- Tablet (768x1024): 2 columns
- Mobile (375x812): single column stacked
- Dark mode for all three
- Date filter changes data

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: teacher dashboard bento grid with charts, date filter, and dark mode"
```

---

### Task 19: Redesign Admin Dashboard with bento grid

**Files:**
- Modify: `app/(platform)/admin/page.tsx`

- [ ] **Step 1: Read current admin dashboard and rebuild**

Same approach as Task 18 but with admin-specific layout:

```
Row 1: [MRR 1x1] [Signups Week 1x1] [Pending Payments 1x1] [Active Cohorts 1x1]
Row 2: [Revenue by Cohort chart 2x1]              [Plan Distribution donut 2x1]
Row 3: [Recent Teachers list 2x1]                 [Total Students 1x1] [Signups Month 1x1]
```

Add DateRangeFilter. Recharts for charts (bar + pie/donut).

- [ ] **Step 2: Verify**

Chrome DevTools screenshots (desktop, tablet, mobile, light, dark).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: admin dashboard bento grid with charts, date filter, and dark mode"
```

---

### Task 20: Redesign Student Dashboard with bento grid

**Files:**
- Modify: `app/(student)/student/page.tsx`

- [ ] **Step 1: Read current student dashboard and rebuild**

Student layout:

```
Row 1: [Enrolled Courses 1x1] [Upcoming Classes 1x1] [Pending Fees 1x1] [Attendance Rate circle 1x1]
Row 2: [Today's Schedule full-width list]
Row 3: [Recent Announcements list 2x1]            [Upcoming Assignments list 2x1]
```

No date filter for students.

- [ ] **Step 2: Verify**

Chrome DevTools screenshots (desktop, mobile, light, dark).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: student dashboard bento grid with schedule, announcements, assignments"
```

---

### Task 21: Restyle auth pages

**Files:**
- Modify: `app/(platform)/login/page.tsx`
- Modify: `app/(platform)/signup/page.tsx`
- Modify: `app/(platform)/admin-login/page.tsx`
- Modify: `app/(platform)/student-login/page.tsx` (actually at `app/student-login/page.tsx`)
- Modify: `app/(platform)/forgot-password/page.tsx`
- Modify: `app/(platform)/auth/reset-password/page.tsx`
- Modify: `components/auth/LoginForm.tsx`
- Modify: `components/auth/SignupForm.tsx`
- Modify: `components/auth/ForgotPasswordForm.tsx`
- Modify: `components/auth/ResetPasswordForm.tsx`

- [ ] **Step 1: Restyle all auth pages**

Each auth page: centered card on `bg-background`, logo in `text-primary`, card uses `bg-card border border-border`. Update form components to use shadcn Input + Label pattern. Ensure dark mode works.

- [ ] **Step 2: Verify**

Chrome DevTools screenshots of login page (light + dark, mobile + desktop).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: restyle auth pages with new theme + dark mode support"
```

---

### Task 22: Restyle remaining pages (token swap)

**Files:**
- Modify: all remaining pages in `app/` that haven't been touched

- [ ] **Step 1: Find and fix remaining old tokens**

```bash
grep -r "bg-paper\|bg-surface\|text-ink\|bg-brand-\|shadow-card\|text-brand" app/ components/ --include="*.tsx" -l
```

Any files found still have old tokens. Fix them.

- [ ] **Step 2: Fix marketing/public pages**

Update `app/(platform)/page.tsx` (homepage), `app/(platform)/pricing/page.tsx`, `app/(platform)/explore/page.tsx`, and teacher-public pages with new tokens. Layout stays the same — just color swap.

- [ ] **Step 3: Verify**

```bash
grep -r "bg-paper\|bg-surface\|text-ink\|bg-brand-\|shadow-card\|text-brand" app/ components/ --include="*.tsx" -l
```

Expected: zero results.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: complete token migration — zero old tokens remaining"
```

---

### Task 23: Remove iOS CSS hacks + final cleanup

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Remove iOS hacks from globals.css**

Remove these blocks (shadcn/Radix handles all of this now):
- `cursor: pointer` + `-webkit-tap-highlight-color` from `@layer base`
- Sidebar checkbox toggle CSS (`body:has(#admin-sidebar-toggle:checked)` etc.)

Keep: the `@custom-variant dark` line, all `:root`/`.dark` variables, `@theme inline`.

- [ ] **Step 2: Delete unused files**

Verify and delete any remaining old files:
- `hooks/useToast.ts` (should already be deleted)
- Old sidebar/nav files (should already be deleted)
- Any other dead code

- [ ] **Step 3: Verify everything still works**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove iOS CSS hacks — shadcn/Radix handles touch natively"
```

---

### Task 24: Update ARCHITECTURE.md and CLAUDE.md

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update ARCHITECTURE.md Section 1 (File Structure)**

- Add `lib/utils.ts`, `components.json`
- Update `components/ui/` listing to reflect shadcn components
- Add `SidebarShell`, `ThemeToggle`, `NotificationBell`, `CommandPalette`, `DateRangeFilter`
- Remove deleted components
- Add `constants/nav-items.ts`
- Update student layout description (sidebar, not top nav)

- [ ] **Step 2: Update ARCHITECTURE.md Section 10 (UI Architecture)**

Full rewrite:
- Replace theme block with OKLCH dual-mode system
- Replace component list with shadcn inventory
- Document dark mode (next-themes, ThemeProvider, `@custom-variant dark`)
- Document bento grid pattern
- Document date filter pattern
- Document sidebar (SidebarShell, shadcn Sidebar, Sheet for mobile)
- Document command palette (Cmd+K)
- Document notification bell
- Remove old iOS hack documentation
- Remove old mobile menu patterns (details/summary, checkbox toggle)

- [ ] **Step 3: Update CLAUDE.md**

Update the Tech Stack table, component guidance, and token rules:
- Add shadcn/ui to tech stack
- Update "where things go" table for shadcn components
- Update critical rules: "always support dark mode — use semantic tokens"
- Update the token rule: "use `bg-primary`, `text-foreground`, `border-border` — not raw hex or old tokens"
- Add: "Install new shadcn components via `npx shadcn@latest add <name>`"

- [ ] **Step 4: Commit**

```bash
git add ARCHITECTURE.md CLAUDE.md
git commit -m "docs: update ARCHITECTURE.md and CLAUDE.md for shadcn migration"
```

---

### Task 25: Final audit

- [ ] **Step 1: Full TypeScript and build check**

```bash
npx tsc --noEmit
npm run build
```

Both must pass with zero errors.

- [ ] **Step 2: Chrome DevTools screenshot audit**

Take screenshots of every major page in 4 modes (light mobile, light desktop, dark mobile, dark desktop):

1. Homepage (marketing)
2. Login page
3. Admin login → Admin dashboard
4. Admin teachers page
5. Admin settings
6. Teacher dashboard (with bento grid)
7. Teacher courses list
8. Teacher course detail
9. Teacher cohort students
10. Teacher settings
11. Student dashboard (with bento grid)
12. Student courses
13. Student settings

For each screenshot, verify:
- Colors match the reference design (purple primary, orange accent, warm backgrounds)
- Dark mode has proper dark card surfaces with subtle borders
- Bento grid has 4 columns on desktop, 2 on tablet, 1 on mobile
- Sidebar collapses properly
- No old tokens visible (no blue brand colors, no raw hex)

- [ ] **Step 3: iOS smoke test via ngrok**

Start ngrok, open on iPhone:
- Sidebar hamburger opens (Sheet)
- Dark mode toggle works
- Login form submits
- Navigation between pages works
- Command palette opens (Cmd+K won't work on phone — but the search button in sidebar should trigger it)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: shadcn/ui migration complete — purple theme, dark mode, bento dashboards, unified sidebar"
```

---

## Summary

| Phase | Tasks | Key Deliverables |
|-------|-------|-----------------|
| 1: Foundation | 1-4 | Dependencies, OKLCH theme, token migration, dark mode provider |
| 2: Primitives | 5-11 | 9 shadcn component swaps (Button, Card, Input, Select, Textarea, Dialog, AlertDialog, Badge, Sonner) |
| 3: Compositions | 12-15 | SidebarShell, Command palette, DataTable rebuild, component restyling |
| 4: Dashboards + Polish | 16-25 | Bento grids, charts, date filter, auth restyling, final audit, docs |
