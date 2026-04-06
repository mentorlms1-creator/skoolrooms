# Design Spec: shadcn/ui Migration + Design Overhaul

**Date:** 2026-04-06
**Status:** Draft
**Scope:** Primarily frontend. Minor backend additions limited to adding date range parameters to existing `lib/db/` query functions for dashboard filtering. No database schema, API route, RLS, or business logic changes.

---

## 1. Overview

Migrate Skool Rooms's custom UI component library to shadcn/ui and overhaul the visual design. The new design is inspired by a reference project management dashboard featuring purple/orange accent colors, bento grid layouts, dark mode, generous spacing, and a clean sidebar navigation with Lucide icons.

### Goals
- Replace 9 custom UI primitives with shadcn equivalents (Radix-based, accessible, iOS-compatible)
- Add dark/light mode with proper dual-palette theming
- Redesign all dashboards with bento grid layouts
- Unify navigation into a shared sidebar for all three roles (teacher, admin, student)
- Add command palette (Cmd+K), notification bell, date range filtering
- Adopt OKLCH color space and Tailwind v4 `@theme inline` pattern

### Non-Goals
- No database schema, API route, RLS, or business logic changes
- No full-text search in command palette (Phase 2)
- No real-time notification dropdown panel (Phase 2)
- No notifications page — bell shows count and links to the relevant page (e.g., payments queue for pending payments). A dedicated notifications page is Phase 2.
- No marketing/public page redesign in this migration — homepage, pricing, explore pages keep current layout with new color tokens only. Full redesign is a separate spec.
- No teacher-public subdomain page redesign — same, token swap only.

### Risks & Caveats
- **OKLCH color values are starting points.** They're extracted from the reference visually but need tuning during implementation by comparing rendered output against reference screenshots.
- **Student layout migration is high-risk.** Converting from top-nav to sidebar changes every student page's spacing assumptions (`pt-14` → `md:ml-64`). Requires thorough per-page testing.
- **`date-fns` coexists with `lib/time/pkt.ts`.** `date-fns` is for shadcn Calendar. Our PKT timezone functions are not replaced.
- **Recharts requires client-side rendering.** Chart components must use `'use client'` + `dynamic(() => import(...), { ssr: false })`. Cannot be Server Components.

---

## 2. New Dependencies

| Package | Purpose | Size Impact |
|---|---|---|
| `@radix-ui/*` | shadcn component primitives (Dialog, Select, Popover, etc.) | Tree-shaken per component |
| `class-variance-authority` | Component variant system (cva) | ~2KB |
| `clsx` + `tailwind-merge` | `cn()` utility for conditional classes | ~3KB |
| `next-themes` | Dark mode toggle + localStorage persistence | ~2KB |
| `sonner` | Toast notifications (replaces custom Toast) | ~8KB |
| `lucide-react` | Icon library (tree-shakeable) | Per-icon, ~1KB each |
| `cmdk` | Command palette (via shadcn/command) | ~5KB |
| `@tanstack/react-table` | Complex table management (sort, filter, column visibility, selection) | ~15KB |
| `recharts` | Dashboard charts (lazy-loaded via dynamic import) | ~200KB (lazy) |
| `date-fns` | Date manipulation for Calendar/DatePicker | ~10KB (tree-shaken) |

**Total:** 10 new top-level dependencies. Recharts is lazy-loaded and won't affect initial page load.

---

## 3. Theme & Color System

### Color Format
OKLCH for all colors. This is shadcn + Tailwind v4's current standard. OKLCH produces perceptually uniform color scales — better than HSL for dark mode adaptation and gradient smoothness.

### CSS Structure

CSS variables defined in `:root` (light) and `.dark` (dark), exposed to Tailwind via `@theme inline`. Dark mode switching via `next-themes` using class strategy with `@custom-variant dark (&:is(.dark *))`.

```css
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

:root {
  /* Page */
  --background: oklch(0.97 0.005 90);        /* warm off-white */
  --foreground: oklch(0.15 0.02 260);         /* near-black */

  /* Cards */
  --card: oklch(1 0 0);                       /* pure white */
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

  /* Borders & inputs */
  --border: oklch(0.90 0.005 260);
  --input: oklch(0.90 0.005 260);
  --ring: oklch(0.55 0.25 285);

  /* Sidebar */
  --sidebar: oklch(0.98 0.005 90);
  --sidebar-foreground: oklch(0.55 0.02 260);

  /* Charts */
  --chart-1: oklch(0.55 0.25 285);
  --chart-2: oklch(0.65 0.20 285);
  --chart-3: oklch(0.75 0.15 285);
  --chart-4: oklch(0.7 0.18 50);              /* orange accent */
  --chart-5: oklch(0.45 0.25 285);

  /* Radius */
  --radius: 0.75rem;
}

.dark {
  --background: oklch(0.13 0.02 275);         /* deep dark navy */
  --foreground: oklch(0.93 0.005 260);
  --card: oklch(0.18 0.02 275);
  --card-foreground: oklch(0.93 0.005 260);
  --popover: oklch(0.18 0.02 275);
  --popover-foreground: oklch(0.93 0.005 260);
  --primary: oklch(0.65 0.25 285);            /* brighter purple */
  --primary-foreground: oklch(0.15 0.02 260);
  --secondary: oklch(0.22 0.02 275);
  --secondary-foreground: oklch(0.9 0.005 260);
  --accent: oklch(0.7 0.18 50);               /* orange stays vivid */
  --accent-foreground: oklch(0.15 0.02 260);
  --muted: oklch(0.22 0.02 275);
  --muted-foreground: oklch(0.65 0.01 260);
  --destructive: oklch(0.55 0.2 25);
  --border: oklch(0.28 0.02 275);
  --input: oklch(0.28 0.02 275);
  --ring: oklch(0.65 0.25 285);
  --sidebar: oklch(0.15 0.02 275);
  --sidebar-foreground: oklch(0.65 0.01 260);
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
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
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
```

### Token Migration

| Current Token | New Token | Usage |
|---|---|---|
| `bg-paper` | `bg-background` | Page backgrounds |
| `bg-surface` | `bg-card` | Card/panel surfaces |
| `text-ink` | `text-foreground` | Primary text |
| `text-muted` | `text-muted-foreground` | Secondary text |
| `bg-brand-50/100/500/600/900` | `bg-primary` + variants | Purple — buttons, links, active states |
| N/A | `bg-accent` | Orange — CTAs, highlights |
| `bg-success` | Keep as custom var | Green success states |
| `bg-warning` | Keep as custom var | Amber warning states |
| `bg-danger` | `bg-destructive` | Red errors, delete actions |
| `shadow-card` | Tailwind `shadow-sm` | Card shadows |
| N/A | `bg-sidebar` | Sidebar-specific background |
| N/A | `--chart-1..5` | Data visualization colors |

### What stays in globals.css
- iOS `cursor: pointer` fix in `@layer base` — removed only in final polish after all components migrated
- iOS tap highlight — same, removed in final polish
- Sidebar checkbox toggle CSS — removed when shadcn Sidebar replaces it

---

## 3b. Provider Hierarchy

```tsx
// app/layout.tsx
<html lang="en" suppressHydrationWarning>
  <body>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  </body>
</html>

// app/(teacher)/dashboard/layout.tsx (and admin, student)
<UIProvider>       {/* toasts via Sonner, sidebar state */}
  <SidebarShell navItems={...} user={...}>
    <main>{children}</main>
  </SidebarShell>
</UIProvider>
```

`ThemeProvider` (next-themes) wraps the entire app at root level. `UIProvider` stays in dashboard layouts for role-specific UI state. `suppressHydrationWarning` on `<html>` prevents next-themes hydration mismatch.

## 3c. Toast Migration

**Current:** `useToast()` hook in `hooks/useToast.ts` → manages toast state in `UIProvider` → renders custom `Toast.tsx`.

**New:** `toast()` function from `sonner` package → `<Toaster />` component in root layout.

**Migration path:**
1. Install Sonner, add `<Toaster />` to root layout (below ThemeProvider)
2. Find-and-replace all `useToast()` imports → `import { toast } from 'sonner'`
3. Replace `addToast({ type: 'success', message: '...' })` → `toast.success('...')`
4. Replace `addToast({ type: 'error', message: '...' })` → `toast.error('...')`
5. Delete `hooks/useToast.ts`
6. Remove toast state from `UIProvider`
7. Delete `components/ui/Toast.tsx`

## 3d. Icon Migration

**Current:** ~25+ inline SVG icons across sidebar components, page headers, and feature sections.

**New:** `lucide-react` icons — tree-shakeable, matches reference design exactly (outline, 1.5px stroke, rounded caps).

**Migration path:**
1. Install `lucide-react`
2. Map each inline SVG to its Lucide equivalent (e.g., dashboard grid → `LayoutDashboard`, courses → `BookOpen`, students → `Users`, etc.)
3. Replace inline SVGs with `<LucideIconName className="h-5 w-5" />`
4. Delete all inline SVG icon functions (DashboardIcon, TeachersIcon, etc. in sidebar files)

## 3e. Auth Pages Design

Auth pages (login, signup, forgot password, reset password, admin login, student login) are NOT in the reference design. Design decision:

- **Layout:** Centered card on `bg-background`, max-w-md, same as current
- **Styling:** Updated to use new tokens (bg-card, text-foreground, border-border)
- **Dark mode:** Fully supported — card surfaces adapt, inputs adapt
- **No split layout or hero images** — keep it simple, fast-loading for Pakistani users on slow connections
- **Logo:** Skool Rooms logo at top of card in `text-primary` (purple)

## 3f. Animations & Transitions

Consistent animation approach matching the reference's smooth feel:

- **Sidebar collapse:** `transition-all duration-200 ease-in-out` on width change
- **Sheet (mobile nav):** shadcn Sheet has built-in slide animation
- **Card hover:** `hover:shadow-md transition-shadow duration-150` on bento cards
- **Charts:** Recharts default entrance animations (fade + slide)
- **Theme toggle:** `transition-colors duration-200` on background/foreground changes (Tailwind handles via `@custom-variant dark`)
- **Buttons:** `transition-colors duration-150` (already standard in shadcn)
- **No spring/bounce physics** — keep it subtle and professional

---

## 4. Component Migration

### Migration Strategy
Layered approach in 3 passes. Each layer is independently testable and shippable.

### Layer 1 — Base Primitives

| Current File | Replaced By | Migration Notes |
|---|---|---|
| `components/ui/Button.tsx` | `shadcn/button` | Map 5 variants (primary, secondary, outline, danger, ghost) + add `accent` variant for orange CTAs. Compose with Spinner for loading state. |
| `components/ui/Input.tsx` | `shadcn/input` + `shadcn/label` | shadcn splits label from input. Use Label + Input + inline error `<p>` directly in forms. No FormField wrapper. `useActionState` pattern unchanged. |
| `components/ui/Select.tsx` | `shadcn/select` | Radix-based accessible dropdown. iOS-compatible natively. |
| `components/ui/Textarea.tsx` | `shadcn/textarea` | Straightforward swap. |
| `components/ui/Modal.tsx` | `shadcn/dialog` | Radix Dialog handles focus traps, escape, scroll lock, iOS touch. |
| `components/ui/ConfirmModal.tsx` | `shadcn/alert-dialog` | Purpose-built for confirm/cancel. |
| `components/ui/Card.tsx` | `shadcn/card` | Card + CardHeader + CardContent + CardFooter — more composable. Maps to bento cells. |
| `components/ui/Toast.tsx` | `sonner` (via shadcn) | Better animations, stacking, mobile swipe-to-dismiss. |
| `components/ui/StatusBadge.tsx` | `shadcn/badge` | Map status types to badge variants. |

**Kept as-is (restyle only):**
- `Spinner.tsx` — shadcn doesn't have one. Restyle to `text-primary`.

### Layer 2 — Compositions

| Current File | Rebuilt With | Notes |
|---|---|---|
| `components/ui/DataTable.tsx` | `shadcn/table` + `@tanstack/react-table` | Rebuild with complex column management. Mobile card view pattern preserved. |
| `components/ui/FileUpload.tsx` | Keep custom, restyle | No shadcn equivalent. Restyle with new tokens. R2 logic + camera capture unchanged. |
| `components/ui/RichTextEditor.tsx` | Keep custom, restyle | TipTap stays. Toolbar restyled with shadcn Button. |
| `components/ui/PageHeader.tsx` | Keep custom, restyle | Update tokens. Add date filter slot for dashboards. |
| `components/ui/EmptyState.tsx` | Keep custom, restyle | Update tokens + use Lucide icons. |
| `components/ui/UsageBars.tsx` | Rebuild using `shadcn/progress` | Custom composition — multiple progress bars with color thresholds. |
| `components/teacher/Sidebar.tsx` | `shadcn/sidebar` | Full replacement. Collapsible, Sheet on mobile, Cmd+K. |
| `components/admin/AdminSidebar.tsx` | `shadcn/sidebar` | Same component, different nav config. |
| `components/student/StudentNav.tsx` | `shadcn/sidebar` | Converted from top nav to sidebar. Same pattern. |
| `components/public/PublicNavbar.tsx` | Keep custom + `shadcn/sheet` | Sheet for mobile menu. Replaces `<details>/<summary>`. |

### Layer 3 — New Components

| Component | shadcn Source | Purpose |
|---|---|---|
| `Command` | `shadcn/command` | Cmd+K palette — page navigation + quick actions |
| `DropdownMenu` | `shadcn/dropdown-menu` | User menu, table row actions |
| `Tooltip` | `shadcn/tooltip` | Icon button hints, stat explanations |
| `Separator` | `shadcn/separator` | Sidebar dividers, card sections |
| `Skeleton` | `shadcn/skeleton` | Loading states (replaces some Spinner usage) |
| `Switch` | `shadcn/switch` | Dark mode toggle, admin settings toggles |
| `Calendar` + `DatePicker` | `shadcn/calendar` + `shadcn/popover` | Date range filter on dashboards |
| `Chart` | `shadcn/chart` (Recharts) | Bento dashboard charts (lazy-loaded) |
| `Sheet` | `shadcn/sheet` | Mobile sidebar/nav drawer |
| `Progress` | `shadcn/progress` | Usage bars, onboarding progress |
| `ThemeToggle` | Custom (uses `next-themes`) | Dark/light mode switch |
| `NotificationBell` | Custom (uses Lucide Bell icon) | Notification indicator for all roles |
| `SidebarShell` | Custom (wraps shadcn Sidebar) | Shared sidebar accepting role-specific config |

### Files Deleted After Migration
- `components/ui/Modal.tsx` → replaced by shadcn Dialog
- `components/ui/ConfirmModal.tsx` → replaced by shadcn AlertDialog
- `components/ui/Toast.tsx` → replaced by Sonner
- `components/ui/Card.tsx` → replaced by shadcn Card
- `components/ui/Button.tsx` → replaced by shadcn Button
- `components/ui/Input.tsx` → replaced by shadcn Input
- `components/ui/Select.tsx` → replaced by shadcn Select
- `components/ui/Textarea.tsx` → replaced by shadcn Textarea
- `components/ui/StatusBadge.tsx` → replaced by shadcn Badge
- `components/student/StudentNav.tsx` → replaced by SidebarShell
- `components/teacher/Sidebar.tsx` → replaced by SidebarShell
- `components/admin/AdminSidebar.tsx` → replaced by SidebarShell

### iOS Fixes Removed After Full Migration
Once all components use Radix-based shadcn primitives:
- `cursor: pointer` global fix → Radix handles button touch natively
- `<details>/<summary>` hamburger pattern → replaced by shadcn Sheet
- Checkbox sidebar toggle + `:has()` CSS → replaced by shadcn Sidebar
- `pointer-events-none` on SVGs → Radix buttons handle touch correctly
- `onTouchEnd` fallbacks → not needed
- `-webkit-tap-highlight-color` → can be removed or kept for non-shadcn elements

---

## 5. Dashboard Bento Layouts

### Grid System
```
Desktop (lg+):  4 columns
Tablet (md):    2 columns
Mobile (<md):   1 column (stacked)
```

All dashboards use the same Tailwind grid:
```tsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
```

### Bento Card Types

**Stat Card (1x1):** Large number (text-3xl font-bold), small label (text-sm text-muted-foreground), optional change badge (+12% green / -5% red).

**Chart Card (2x1):** Title + subtitle at top, Recharts chart fills remaining space. Lazy-loaded.

**List Card (1x1 or 2x1):** Title at top, scrollable list of 3-5 items, "View all" link at bottom.

**Circle Card (1x1):** SVG progress ring centered, label inside ring, stat below.

### Teacher Dashboard

```
Row 1: [Active Courses 1x1] [Total Students 1x1] [Pending Payments 1x1] [Active Days circle 1x1]
Row 2: [Revenue Trends chart 2x1]                 [Plan Usage bars 2x1]
Row 3: [Upcoming Classes list 1x1] [Recent Enrollments list 1x1] [Onboarding Checklist 2x1]
```

### Admin Dashboard

```
Row 1: [MRR 1x1] [Signups This Week 1x1] [Pending Payments 1x1] [Active Cohorts 1x1]
Row 2: [Revenue by Cohort chart 2x1]              [Plan Distribution donut 2x1]
Row 3: [Recent Teachers list 2x1]                 [Total Students 1x1] [Signups This Month 1x1]
```

### Student Dashboard

```
Row 1: [Enrolled Courses 1x1] [Upcoming Classes 1x1] [Pending Fees 1x1] [Attendance Rate circle 1x1]
Row 2: [Today's Schedule list 4x1 full-width — next 3 classes with Meet links, PKT time, teacher name]
Row 3: [Recent Announcements list 2x1]            [Upcoming Assignments list 2x1]
```

### Date Filter (Teacher + Admin only)

Positioned in PageHeader, right-aligned:
```
[Dashboard]                              [This Month v]  [Apr 1 - Apr 30 calendar-icon]
[Welcome back, Ahmed]
```

- **Preset dropdown:** This Week / This Month / This Quarter / This Year / All Time / Custom
- **Custom range:** shadcn Calendar + Popover, two-month view on desktop, single on mobile
- Selecting a preset auto-fills the date range
- Selecting "Custom" opens the date range picker
- Both persist as URL search params (`?period=this_month` or `?period=custom&from=2026-04-01&to=2026-04-30`)
- Works with Server Components — no client state needed for initial data fetch

**Filtered cards:** Stat cards, revenue charts, recent lists. **Unfiltered:** Plan usage, upcoming schedule, onboarding checklist.

Students do not get the date filter — their dashboard is always "what's current and upcoming."

### Dark Mode Behavior
- Cards: slightly lighter than page (`bg-card` vs `bg-background`), subtle `border border-border`
- Charts: purple bars brighten, backgrounds darken, labels lighten — Recharts respects CSS variables
- Stat numbers: high contrast (white text on dark cards)
- Shadows: reduced or removed in dark mode (borders provide separation instead)

---

## 6. Navigation

### Unified Sidebar — SidebarShell

All three roles use the same `SidebarShell` component with role-specific configuration. Built on shadcn's Sidebar component.

```tsx
<SidebarShell
  navItems={TEACHER_NAV_ITEMS}
  user={{ name: "Ahmed Khan", role: "teacher" }}
  roleBadge={null}
  showDateFilter={false}
/>
```

### Desktop States

**Expanded (256px, default):**
- Logo ("Skool Rooms") at top
- Search/Command bar (triggers Cmd+K)
- Nav items with Lucide icons + text labels
- Notification bell with red dot indicator
- Separator
- Dark mode toggle (shadcn Switch)
- User name + Sign Out

**Collapsed (48px, icon-only):**
- Logo icon only
- Search icon only
- Nav icons only (tooltip on hover shows label)
- Bell icon
- Toggle and user avatar only

**Toggle:** Chevron button at sidebar edge, or `Cmd+B` keyboard shortcut.

### Mobile (< md breakpoint)
- Fixed top bar: logo + hamburger icon
- Hamburger opens shadcn Sheet (slide-out from left)
- Sheet contains full sidebar content
- Dark overlay + swipe-to-close
- Radix handles iOS touch natively — no checkbox hacks

### Nav Items Per Role

**Teacher:**
Dashboard, Courses, Students, Payments, Earnings, Analytics, Settings

**Admin:**
Dashboard, Teachers, Payments, Payouts, Plans, Settings, Operations
Badge: "Admin" next to logo

**Student:**
Dashboard, My Courses, Schedule, Payments, Settings

### Icons
`lucide-react` — matches reference design exactly (outline style, 1.5px stroke, rounded caps). Tree-shakeable, ~1KB per icon.

### Command Palette (Cmd+K)

shadcn Command dialog, available in all sidebars:
- **Pages** section: links to all nav items for current role
- **Actions** section: Create Course, Create Cohort, Toggle Dark Mode, etc.
- MVP scope: navigation + quick actions only. No full-text search (Phase 2).

### Notification Bell

Universal across all three roles. Red dot indicator when count > 0.

**Teacher notifications:** Pending payment verifications, new enrollment requests, withdrawal requests, upcoming classes, plan expiring.

**Admin notifications:** Pending subscription screenshots, payout requests, plan expirations.

**Student notifications:** Payment verified/rejected, enrollment approved/rejected, upcoming class (1h before), new assignment, assignment graded, new announcement, fee reminder, withdrawal approved/rejected.

**MVP scope:** Bell with count links to a notifications page. No dropdown panel or real-time updates (Phase 2 with `useRealtime()`).

### Public Navbar (Marketing Pages)

Stays as a separate component (not SidebarShell — marketing pages don't have a sidebar).
- Desktop: horizontal nav bar with logo, links, CTA button
- Mobile: hamburger opens shadcn Sheet from right
- Dark mode: respects system preference, no toggle on public pages

---

## 7. Verification Strategy

Every component swap is verified before moving to the next:

1. **TypeScript** — `npx tsc --noEmit` passes with zero errors
2. **Build** — `npm run build` succeeds
3. **Chrome DevTools screenshots** — Mobile (375x812) and desktop (1440x900) for each changed page, both light and dark mode
4. **Visual comparison** — Screenshots compared against reference design
5. **iOS smoke test** — Verify interactive elements work via ngrok on iPhone (buttons, menus, form submissions)

---

## 8. Migration Phases

### Phase 1: Foundation
- Install shadcn CLI and initialize
- Install all 10 dependencies
- Replace `globals.css` with new OKLCH theme (light + dark)
- Add `next-themes` ThemeProvider to root layout
- Add `cn()` utility (`lib/utils.ts`)
- Set up `components.json` for shadcn CLI
- Verify: all existing pages render correctly with new colors

### Phase 2: Primitives (Layer 1)
- Install and customize shadcn: Button, Input, Label, Select, Textarea, Dialog, AlertDialog, Card, Badge
- Install Sonner, replace Toast
- Update all consumers (every file that imports from `components/ui/`)
- Delete replaced custom components
- Verify: every page works, forms submit, modals open/close

### Phase 3: Compositions (Layer 2)
- Build SidebarShell, install shadcn Sidebar + Sheet
- Replace teacher Sidebar, admin AdminSidebar, student StudentNav
- Update all three layout files
- Rebuild DataTable with shadcn Table + @tanstack/react-table
- Restyle FileUpload, RichTextEditor, PageHeader, EmptyState, UsageBars
- Install Command, build command palette
- Build NotificationBell component
- Build ThemeToggle component
- Verify: navigation works on desktop + mobile, command palette opens, dark mode toggles

### Phase 4: Dashboards + Polish (Layer 2 continued + Layer 3)
- Install shadcn Calendar, Popover, Chart, Progress, Skeleton, Switch, Separator, Tooltip, DropdownMenu
- Build date range filter (preset + custom)
- Add `dateFrom`/`dateTo` parameters to dashboard `lib/db/` query functions (minor backend addition)
- Redesign teacher dashboard with bento grid
- Redesign admin dashboard with bento grid
- Redesign student dashboard with bento grid
- Restyle auth pages (login, signup, forgot password) with new tokens + dark mode
- Restyle remaining pages (settings, course detail, cohort pages, etc.) with new tokens
- Swap marketing/public pages to new color tokens only (no layout redesign)
- Remove iOS CSS hacks from globals.css
- Final screenshot audit of every page (light + dark, mobile + desktop)
- Update ARCHITECTURE.md Section 1 + Section 10
- Update CLAUDE.md component guidance

---

## 9. ARCHITECTURE.md Changes

**Section 10 (UI Architecture)** — Full rewrite:
- Replace theme block with OKLCH dual-mode system
- Replace component list with shadcn component inventory
- Replace "Mobile-First Responsive Patterns" with shadcn-native patterns (Sheet, Sidebar)
- Add dark mode documentation
- Add bento grid layout documentation
- Add date filter pattern documentation
- Remove iOS hack documentation (no longer needed after migration)
- Add command palette documentation
- Add notification bell documentation

**Section 1 (File Structure)** — Update:
- Add `lib/utils.ts` (cn utility)
- Add `components.json` (shadcn config)
- Update `components/ui/` listing to reflect shadcn components
- Add `SidebarShell` to shared components
- Remove deleted custom components
- Note student layout change from top-nav to sidebar

**CLAUDE.md** — Update component guidance:
- "shadcn components live in `components/ui/`. Install via `npx shadcn@latest add <component>`. Customize the installed code directly."
- Update token names in the "never use raw hex" rule
- Add "always support dark mode — use semantic tokens, never hardcode light-only colors"

---

## 10. Files Changed Summary

**New files (~20):**
- `lib/utils.ts` — cn() utility
- `components.json` — shadcn config
- `components/ui/sidebar.tsx` — shadcn Sidebar (installed)
- `components/ui/sheet.tsx` — shadcn Sheet (installed)
- `components/ui/command.tsx` — shadcn Command (installed)
- `components/ui/dropdown-menu.tsx` — shadcn DropdownMenu (installed)
- `components/ui/tooltip.tsx` — shadcn Tooltip (installed)
- `components/ui/separator.tsx` — shadcn Separator (installed)
- `components/ui/skeleton.tsx` — shadcn Skeleton (installed)
- `components/ui/switch.tsx` — shadcn Switch (installed)
- `components/ui/calendar.tsx` — shadcn Calendar (installed)
- `components/ui/popover.tsx` — shadcn Popover (installed)
- `components/ui/chart.tsx` — shadcn Chart wrapper (installed)
- `components/ui/progress.tsx` — shadcn Progress (installed)
- `components/ui/badge.tsx` — shadcn Badge (installed)
- `components/ui/alert-dialog.tsx` — shadcn AlertDialog (installed)
- `components/ui/SidebarShell.tsx` — custom shared sidebar
- `components/ui/ThemeToggle.tsx` — dark mode switch
- `components/ui/NotificationBell.tsx` — notification indicator
- `components/ui/DateRangeFilter.tsx` — preset + custom date filter

**Modified files (~40+):**
- `globals.css` — complete theme rewrite
- `app/layout.tsx` — add ThemeProvider
- `app/(teacher)/dashboard/layout.tsx` — sidebar layout
- `app/(student)/student/layout.tsx` — convert top-nav to sidebar layout
- `app/(platform)/admin/layout.tsx` — sidebar layout
- Every page that imports Button, Input, Select, Card, Modal, Toast, etc.
- All 3 dashboard pages — bento grid redesign
- `providers/UIProvider.tsx` — integrate Sonner
- `ARCHITECTURE.md` — Section 1 + Section 10 updates
- `CLAUDE.md` — component guidance updates

**Deleted files (~12):**
- 9 custom UI primitives replaced by shadcn
- 3 navigation components replaced by SidebarShell
