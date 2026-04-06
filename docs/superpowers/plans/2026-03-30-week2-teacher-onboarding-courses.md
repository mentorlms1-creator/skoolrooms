# Week 2: Teacher Onboarding + Course Creation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A teacher can complete onboarding (subject/level, subdomain, profile photo + bio), access a sidebar dashboard, create/publish courses with rich text descriptions and thumbnails, and have a public subdomain page showing their courses and bio. Marketing homepage at root domain.

**Architecture:** Next.js 16 App Router with Server Components default. Mutations use Server Actions (NOT API routes). Only webhooks, crons, and external integrations get API routes. Database queries go in `lib/db/*.ts`. UI uses theme tokens from `globals.css` exclusively. Plan limits enforced server-side via `getLimit()`.

**Tech Stack:** Next.js 16, React 19, Supabase (Postgres + RLS), Tailwind CSS v4, TipTap (rich text), Cloudflare R2 (file storage), TypeScript strict.

---

## File Structure

### New files to create:

```
# API routes (external integrations only)
app/api/r2/presign/route.ts              — R2 presigned URL generation
app/api/cloudflare/subdomain/route.ts    — Cloudflare DNS subdomain creation

# Database service layer
lib/db/teachers.ts                        — Teacher CRUD queries
lib/db/courses.ts                         — Course CRUD queries

# Teacher dashboard
app/(teacher)/layout.tsx                  — Auth guard + TeacherProvider wrapper
app/(teacher)/dashboard/layout.tsx        — Sidebar layout
app/(teacher)/dashboard/page.tsx          — Dashboard home (stats, usage, checklist)
app/(teacher)/dashboard/courses/page.tsx  — Course list
app/(teacher)/dashboard/courses/new/page.tsx — Create course form
app/(teacher)/dashboard/courses/[courseId]/page.tsx — Course detail
app/(teacher)/dashboard/courses/[courseId]/edit/page.tsx — Edit course form

# Onboarding
app/(teacher)/onboarding/layout.tsx       — Minimal onboarding layout (no sidebar)
app/(teacher)/onboarding/step-1/page.tsx  — Subject + teaching level
app/(teacher)/onboarding/step-2/page.tsx  — Subdomain picker
app/(teacher)/onboarding/step-3/page.tsx  — Profile photo + bio

# Teacher public pages (subdomain)
app/(teacher-public)/[subdomain]/layout.tsx — Public page layout
app/(teacher-public)/[subdomain]/page.tsx   — Teacher landing page

# Marketing
app/(platform)/page.tsx                   — Homepage (replace placeholder)
app/(platform)/pricing/page.tsx           — Pricing page

# Components
components/teacher/Sidebar.tsx            — Dashboard sidebar navigation
components/teacher/OnboardingChecklist.tsx — 5-step checklist widget
components/teacher/PlanLimitGuard.tsx      — Plan limit gate + upgrade nudge
components/teacher/UpgradeNudge.tsx        — Contextual upgrade banner
components/ui/RichTextEditor.tsx           — TipTap wrapper component
components/ui/Textarea.tsx                 — Multiline text input
components/public/CourseCard.tsx           — Course card for public pages
components/public/TeacherBio.tsx           — Teacher bio section

# Server actions
lib/actions/onboarding.ts                 — Onboarding step completion
lib/actions/courses.ts                    — Course create/update/delete
```

---

## Task 1: R2 Presign API Route + Cloudflare Subdomain API Route

These are the two API routes needed (external integrations — per CLAUDE.md, these stay as API routes).

**Files:**
- Create: `app/api/r2/presign/route.ts`
- Create: `app/api/cloudflare/subdomain/route.ts`

- [ ] **Step 1: Create R2 presign route**

```typescript
// app/api/r2/presign/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { getPresignedUploadUrl } from '@/lib/r2/upload'
import { UPLOAD_LIMITS, UPLOAD_ALLOWED_FORMATS } from '@/constants/plans'
import type { FileType } from '@/types/domain'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const body = await request.json()
  const { fileType, contentType, fileName, entityId } = body as {
    fileType: FileType
    contentType: string
    fileName: string
    entityId: string
  }

  if (!fileType || !contentType || !fileName || !entityId) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields' },
      { status: 400 }
    )
  }

  // Validate file type
  const allowedFormats = UPLOAD_ALLOWED_FORMATS[fileType]
  if (!allowedFormats || !allowedFormats.includes(contentType)) {
    return NextResponse.json(
      { success: false, error: `File type ${contentType} is not allowed for ${fileType}` },
      { status: 400 }
    )
  }

  // Get max size for this file type
  const maxSizeBytes = (UPLOAD_LIMITS[fileType] || 5) * 1024 * 1024

  // Build R2 key based on file type
  const ext = fileName.split('.').pop() || 'bin'
  let key: string
  switch (fileType) {
    case 'profile':
      key = `profiles/${entityId}.${ext}`
      break
    case 'thumbnail':
      key = `thumbnails/${entityId}/${Date.now()}.${ext}`
      break
    case 'qrcode':
      key = `qrcodes/${entityId}.${ext}`
      break
    case 'assignment':
      key = `assignments/${entityId}/${Date.now()}.${ext}`
      break
    case 'announcement':
      key = `announcements/${entityId}/${Date.now()}.${ext}`
      break
    case 'submission':
      key = `submissions/${entityId}/${Date.now()}.${ext}`
      break
    case 'screenshot':
      key = `screenshots/${entityId}/${Date.now()}.${ext}`
      break
    default:
      return NextResponse.json(
        { success: false, error: 'Invalid file type' },
        { status: 400 }
      )
  }

  try {
    const result = await getPresignedUploadUrl({
      key,
      contentType,
      maxSizeBytes,
    })

    return NextResponse.json({
      success: true,
      data: { uploadUrl: result.uploadUrl, publicUrl: result.publicUrl, key },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Create Cloudflare subdomain API route**

```typescript
// app/api/cloudflare/subdomain/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { createAdminClient } from '@/supabase/server'
import { createSubdomainRecord } from '@/lib/cloudflare/dns'
import { RESERVED_SUBDOMAINS } from '@/constants/plans'

const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { subdomain } = await request.json()

  if (!subdomain || typeof subdomain !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Subdomain is required' },
      { status: 400 }
    )
  }

  const normalized = subdomain.toLowerCase().trim()

  // Validate format
  if (!SUBDOMAIN_REGEX.test(normalized)) {
    return NextResponse.json(
      { success: false, error: 'Subdomain must be 3-30 characters, lowercase letters, numbers, and hyphens only. Must start and end with a letter or number.' },
      { status: 400 }
    )
  }

  // Check reserved
  if (RESERVED_SUBDOMAINS.includes(normalized)) {
    return NextResponse.json(
      { success: false, error: 'This subdomain is reserved. Please choose another.' },
      { status: 400 }
    )
  }

  // Check uniqueness in DB
  const supabaseAdmin = createAdminClient()
  const { data: existing } = await supabaseAdmin
    .from('teachers')
    .select('id')
    .eq('subdomain', normalized)
    .neq('supabase_auth_id', user.id)
    .single()

  if (existing) {
    return NextResponse.json(
      { success: false, error: 'This subdomain is already taken.' },
      { status: 409 }
    )
  }

  // Create DNS record
  const dnsResult = await createSubdomainRecord(normalized)
  if (!dnsResult.success) {
    return NextResponse.json(
      { success: false, error: dnsResult.error || 'Failed to create subdomain' },
      { status: 500 }
    )
  }

  // Update teacher record
  const { error: updateError } = await supabaseAdmin
    .from('teachers')
    .update({ subdomain: normalized, subdomain_changed_at: new Date().toISOString() })
    .eq('supabase_auth_id', user.id)

  if (updateError) {
    return NextResponse.json(
      { success: false, error: 'Failed to save subdomain' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, data: { subdomain: normalized } })
}
```

- [ ] **Step 3: Verify both routes compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add app/api/r2/presign/route.ts app/api/cloudflare/subdomain/route.ts
git commit -m "feat: add R2 presign and Cloudflare subdomain API routes"
```

---

## Task 2: Database Service Layer

All database queries go in `lib/db/`. Never raw Supabase calls in components or pages.

**Files:**
- Create: `lib/db/teachers.ts`
- Create: `lib/db/courses.ts`

- [ ] **Step 1: Create teacher DB service**

```typescript
// lib/db/teachers.ts
import { createAdminClient } from '@/supabase/server'

export async function getTeacherByAuthId(authId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('supabase_auth_id', authId)
    .single()

  if (error) return null
  return data
}

export async function getTeacherById(id: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data
}

export async function getTeacherBySubdomain(subdomain: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('subdomain', subdomain)
    .eq('is_suspended', false)
    .single()

  if (error) return null
  return data
}

export async function updateTeacher(
  teacherId: string,
  updates: Record<string, unknown>
) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('teachers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', teacherId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function getTeacherPlan(teacherId: string) {
  const supabase = createAdminClient()
  const { data: teacher } = await supabase
    .from('teachers')
    .select('plan')
    .eq('id', teacherId)
    .single()

  if (!teacher) return null

  const { data: plan } = await supabase
    .from('plans')
    .select('*')
    .eq('slug', teacher.plan)
    .single()

  return plan
}

export async function getTeacherPlanDetails(teacherId: string) {
  const supabase = createAdminClient()

  const { data: teacher } = await supabase
    .from('teachers')
    .select('plan')
    .eq('id', teacherId)
    .single()

  if (!teacher) return null

  const { data: plan } = await supabase
    .from('plans')
    .select('*')
    .eq('slug', teacher.plan)
    .single()

  if (!plan) return null

  const { data: features } = await supabase
    .from('plan_features')
    .select('feature_key, is_enabled')
    .eq('plan_id', plan.id)

  const featureMap: Record<string, boolean> = {}
  for (const f of features || []) {
    featureMap[f.feature_key] = f.is_enabled
  }

  return {
    name: plan.name,
    slug: plan.slug,
    pricePerMonth: plan.price_pkr,
    limits: {
      max_courses: plan.max_courses,
      max_students: plan.max_students,
      max_cohorts_active: plan.max_cohorts_active,
      max_storage_mb: plan.max_storage_mb,
      max_teachers: plan.max_teachers,
    },
    features: featureMap,
  }
}

export async function getTeacherUsage(teacherId: string) {
  const supabase = createAdminClient()

  const { count: courses } = await supabase
    .from('courses')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
    .eq('status', 'published')
    .is('deleted_at', null)

  const { count: students } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .in('cohort_id',
      supabase
        .from('cohorts')
        .select('id')
        .eq('teacher_id', teacherId)
    )
    .eq('status', 'active')

  const { count: cohortsActive } = await supabase
    .from('cohorts')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
    .eq('status', 'active')
    .is('deleted_at', null)

  return {
    courses: courses || 0,
    students: students || 0,
    cohortsActive: cohortsActive || 0,
    storageMb: 0, // TODO: calculate from R2 in Phase 2
  }
}

export async function hasPaymentSettings(teacherId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('teacher_payment_settings')
    .select('id, payout_bank_name, payout_iban, jazzcash_number, easypaisa_number')
    .eq('teacher_id', teacherId)
    .single()

  if (!data) return false
  return !!(data.payout_bank_name || data.payout_iban || data.jazzcash_number || data.easypaisa_number)
}

export async function isSubdomainAvailable(subdomain: string, excludeTeacherId?: string): Promise<boolean> {
  const supabase = createAdminClient()
  let query = supabase
    .from('teachers')
    .select('id')
    .eq('subdomain', subdomain)

  if (excludeTeacherId) {
    query = query.neq('id', excludeTeacherId)
  }

  const { data } = await query.single()
  return !data
}
```

- [ ] **Step 2: Create course DB service**

```typescript
// lib/db/courses.ts
import { createAdminClient } from '@/supabase/server'

export async function getTeacherCourses(teacherId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('teacher_id', teacherId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

export async function getCourseById(courseId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .is('deleted_at', null)
    .single()

  if (error) return null
  return data
}

export async function getPublishedCoursesByTeacher(teacherId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) return []
  return data || []
}

export async function createCourse(teacherId: string, title: string, description: string | null) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('courses')
    .insert({
      teacher_id: teacherId,
      title,
      description,
      status: 'draft',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateCourse(
  courseId: string,
  updates: Record<string, unknown>
) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('courses')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', courseId)
    .is('deleted_at', null)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function softDeleteCourse(courseId: string) {
  const supabase = createAdminClient()

  // Check for active cohorts
  const { count } = await supabase
    .from('cohorts')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId)
    .in('status', ['upcoming', 'active'])
    .is('deleted_at', null)

  if (count && count > 0) {
    throw new Error('Cannot delete a course with active cohorts. Archive them first.')
  }

  const { error } = await supabase
    .from('courses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', courseId)

  if (error) throw new Error(error.message)
}

export async function countPublishedCourses(teacherId: string): Promise<number> {
  const supabase = createAdminClient()
  const { count } = await supabase
    .from('courses')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
    .eq('status', 'published')
    .is('deleted_at', null)

  return count || 0
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add lib/db/teachers.ts lib/db/courses.ts
git commit -m "feat: add teacher and course database service layers"
```

---

## Task 3: Textarea Component + TipTap Rich Text Editor

**Files:**
- Create: `components/ui/Textarea.tsx`
- Create: `components/ui/RichTextEditor.tsx`

**Dependencies to install:** `@tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-link`

- [ ] **Step 1: Install TipTap**

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-link @tiptap/pm
```

- [ ] **Step 2: Create Textarea component**

```typescript
// components/ui/Textarea.tsx
import { forwardRef, type TextareaHTMLAttributes } from 'react'

type TextareaProps = {
  label?: string
  error?: string
} & TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, error, className = '', id, ...rest }, ref) {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={`
            w-full rounded-md border border-border bg-surface px-3 py-2
            text-ink placeholder:text-muted
            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
            disabled:opacity-50 disabled:cursor-not-allowed
            min-h-[80px] resize-y
            ${error ? 'border-danger focus:ring-danger' : ''}
            ${className}
          `}
          {...rest}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    )
  }
)
```

- [ ] **Step 3: Create TipTap RichTextEditor**

```typescript
// components/ui/RichTextEditor.tsx
'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'

type RichTextEditorProps = {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  label?: string
  error?: string
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start writing...',
  label,
  error,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-[200px] px-3 py-2 focus:outline-none',
      },
    },
  })

  if (!editor) return null

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-ink">{label}</label>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 border border-border rounded-t-md bg-paper p-1.5">
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Subheading"
        >
          H3
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          &bull;
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered List"
        >
          1.
        </ToolbarButton>
      </div>

      {/* Editor */}
      <div
        className={`border border-t-0 border-border rounded-b-md bg-surface ${
          error ? 'border-danger' : ''
        }`}
      >
        <EditorContent editor={editor} />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  )
}

function ToolbarButton({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`
        px-2 py-1 rounded text-sm font-medium transition-colors
        ${active ? 'bg-brand-100 text-brand-600' : 'text-muted hover:bg-paper hover:text-ink'}
      `}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add components/ui/Textarea.tsx components/ui/RichTextEditor.tsx
git commit -m "feat: add Textarea and TipTap RichTextEditor components"
```

---

## Task 4: PlanLimitGuard + UpgradeNudge Components

**Files:**
- Create: `components/teacher/PlanLimitGuard.tsx`
- Create: `components/teacher/UpgradeNudge.tsx`

- [ ] **Step 1: Create UpgradeNudge component**

```typescript
// components/teacher/UpgradeNudge.tsx
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'

type UpgradeNudgeProps = {
  label: string
  current: number
  max: number
  severity: 'warning' | 'danger'
}

export function UpgradeNudge({ label, current, max, severity }: UpgradeNudgeProps) {
  const bgColor = severity === 'danger' ? 'bg-danger/10 border-danger/20' : 'bg-warning/10 border-warning/20'
  const textColor = severity === 'danger' ? 'text-danger' : 'text-warning'

  return (
    <div className={`rounded-md border px-4 py-3 ${bgColor}`}>
      <div className="flex items-center justify-between gap-4">
        <p className={`text-sm font-medium ${textColor}`}>
          You&apos;re using {current} of {max} {label}.{' '}
          {severity === 'danger' ? 'Upgrade to continue.' : 'Upgrade to add more.'}
        </p>
        <Link
          href={ROUTES.TEACHER.settings.plan}
          className="shrink-0 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500 transition-colors"
        >
          Upgrade
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create PlanLimitGuard component**

```typescript
// components/teacher/PlanLimitGuard.tsx
'use client'

import { useTeacherContext } from '@/providers/TeacherProvider'
import { UpgradeNudge } from '@/components/teacher/UpgradeNudge'
import { USAGE_THRESHOLDS } from '@/constants/plans'

type PlanLimitGuardProps = {
  limitKey: string
  current: number
  label: string
  children: React.ReactNode
}

export function PlanLimitGuard({
  limitKey,
  current,
  label,
  children,
}: PlanLimitGuardProps) {
  const { plan } = useTeacherContext()
  const max = plan.limits[limitKey]

  // Unlimited — no guard needed
  if (max === null || max === undefined || max >= 9999) {
    return <>{children}</>
  }

  const percent = max > 0 ? (current / max) * 100 : 0
  const isAtLimit = current >= max
  const isDanger = percent >= USAGE_THRESHOLDS.DANGER_PERCENT
  const isWarning = percent >= USAGE_THRESHOLDS.WARNING_PERCENT

  // Hard block at 100%
  if (isAtLimit) {
    return (
      <UpgradeNudge
        label={label}
        current={current}
        max={max}
        severity="danger"
      />
    )
  }

  return (
    <>
      {(isDanger || isWarning) && (
        <UpgradeNudge
          label={label}
          current={current}
          max={max}
          severity={isDanger ? 'danger' : 'warning'}
        />
      )}
      {children}
    </>
  )
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add components/teacher/PlanLimitGuard.tsx components/teacher/UpgradeNudge.tsx
git commit -m "feat: add PlanLimitGuard and UpgradeNudge components"
```

---

## Task 5: Teacher Dashboard Layout + Sidebar

**Files:**
- Create: `components/teacher/Sidebar.tsx`
- Create: `app/(teacher)/layout.tsx`
- Create: `app/(teacher)/dashboard/layout.tsx`
- Create: `app/(teacher)/dashboard/page.tsx`
- Create: `components/teacher/OnboardingChecklist.tsx`

- [ ] **Step 1: Create Sidebar component**

```typescript
// components/teacher/Sidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ROUTES } from '@/constants/routes'

const NAV_ITEMS = [
  { label: 'Dashboard', href: ROUTES.TEACHER.dashboard, icon: 'grid' },
  { label: 'Courses', href: ROUTES.TEACHER.courses, icon: 'book' },
  { label: 'Students', href: ROUTES.TEACHER.students, icon: 'users' },
  { label: 'Payments', href: ROUTES.TEACHER.payments, icon: 'credit-card' },
  { label: 'Earnings', href: ROUTES.TEACHER.earnings, icon: 'wallet' },
  { label: 'Analytics', href: ROUTES.TEACHER.analytics, icon: 'chart' },
  { label: 'Settings', href: ROUTES.TEACHER.settings.profile, icon: 'settings' },
] as const

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-64 flex-col border-r border-border bg-surface">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-border">
        <Link href={ROUTES.TEACHER.dashboard} className="text-xl font-bold text-brand-600">
          Skool Rooms
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === ROUTES.TEACHER.dashboard
                ? pathname === item.href
                : pathname.startsWith(item.href)

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`
                    flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
                    ${isActive
                      ? 'bg-brand-50 text-brand-600'
                      : 'text-muted hover:bg-paper hover:text-ink'
                    }
                  `}
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    book: 'M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20',
    users: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2M9 7a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
    'credit-card': 'M1 10h22M1 6a2 2 0 012-2h18a2 2 0 012 2v12a2 2 0 01-2 2H3a2 2 0 01-2-2V6z',
    wallet: 'M21 12V7H5a2 2 0 010-4h14v4M3 5v14a2 2 0 002 2h16v-5M18 12a1 1 0 100 2 1 1 0 000-2z',
    chart: 'M18 20V10M12 20V4M6 20v-6',
    settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  }
  const d = icons[name] || icons.grid
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}
```

- [ ] **Step 2: Create teacher route group layout**

This layout wraps ALL teacher routes. It enforces auth and provides TeacherProvider context.

```typescript
// app/(teacher)/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { getTeacherByAuthId, getTeacherPlanDetails, getTeacherUsage } from '@/lib/db/teachers'
import { TeacherProvider } from '@/providers/TeacherProvider'
import { UIProvider } from '@/providers/UIProvider'
import type { TeacherData, PlanDetails, UsageData } from '@/providers/TeacherProvider'

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const teacher = await getTeacherByAuthId(user.id)
  if (!teacher) redirect('/login')
  if (teacher.is_suspended) redirect('/suspended')

  const planDetails = await getTeacherPlanDetails(teacher.id)
  const usage = await getTeacherUsage(teacher.id)

  const teacherData: TeacherData = {
    id: teacher.id,
    name: teacher.name,
    email: teacher.email,
    subdomain: teacher.subdomain,
    plan: teacher.plan,
    planExpiresAt: teacher.plan_expires_at,
    graceUntil: teacher.grace_until,
    trialEndsAt: teacher.trial_ends_at,
    onboardingCompleted: teacher.onboarding_completed,
    onboardingStepsJson: teacher.onboarding_steps_json as Record<string, boolean>,
    isSuspended: teacher.is_suspended,
    profilePhotoUrl: teacher.profile_photo_url,
    bio: teacher.bio,
    subjectTags: teacher.subject_tags || [],
    teachingLevels: teacher.teaching_levels || [],
    city: teacher.city,
    isPubliclyListed: teacher.is_publicly_listed,
  }

  const plan: PlanDetails = planDetails || {
    name: 'Free',
    slug: 'free',
    pricePerMonth: 0,
    limits: { max_courses: 1, max_students: 15, max_cohorts_active: 1, max_storage_mb: 500, max_teachers: 1 },
    features: {},
  }

  const usageData: UsageData = usage || {
    courses: 0,
    students: 0,
    cohortsActive: 0,
    storageMb: 0,
  }

  return (
    <UIProvider>
      <TeacherProvider teacher={teacherData} plan={plan} usage={usageData}>
        {children}
      </TeacherProvider>
    </UIProvider>
  )
}
```

- [ ] **Step 3: Create dashboard layout with sidebar**

```typescript
// app/(teacher)/dashboard/layout.tsx
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/teacher/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 bg-paper">
        <div className="p-6 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Create OnboardingChecklist component**

```typescript
// components/teacher/OnboardingChecklist.tsx
'use client'

import { useTeacherContext } from '@/providers/TeacherProvider'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'

const STEPS = [
  { key: 'profile_complete', label: 'Complete your profile', href: ROUTES.TEACHER.settings.profile, description: 'Add your photo and bio' },
  { key: 'payment_details_set', label: 'Set up payout details', href: ROUTES.TEACHER.settings.payment, description: 'Add bank or mobile wallet details' },
  { key: 'course_created', label: 'Create your first course', href: ROUTES.TEACHER.courseNew, description: 'Publish a course for students' },
  { key: 'cohort_created', label: 'Create your first cohort', href: ROUTES.TEACHER.courses, description: 'Add a batch to your course' },
  { key: 'link_shared', label: 'Share your invite link', href: ROUTES.TEACHER.courses, description: 'Copy and share with students' },
] as const

export function OnboardingChecklist() {
  const { teacher } = useTeacherContext()

  if (teacher.onboardingCompleted) return null

  const steps = teacher.onboardingStepsJson
  const completedCount = Object.values(steps).filter(Boolean).length
  const progress = Math.round((completedCount / STEPS.length) * 100)

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-ink">Get Started</h3>
        <span className="text-sm text-muted">{completedCount}/{STEPS.length} completed</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-border mb-6">
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ul className="flex flex-col gap-3">
        {STEPS.map((step) => {
          const done = steps[step.key]
          return (
            <li key={step.key}>
              <Link
                href={step.href}
                className={`flex items-start gap-3 rounded-md p-3 transition-colors ${
                  done ? 'bg-success/5' : 'hover:bg-paper'
                }`}
              >
                <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  done ? 'border-success bg-success' : 'border-border'
                }`}>
                  {done && (
                    <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 6l3 3 5-5" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className={`text-sm font-medium ${done ? 'text-muted line-through' : 'text-ink'}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-muted">{step.description}</p>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
```

- [ ] **Step 5: Create dashboard home page**

```typescript
// app/(teacher)/dashboard/page.tsx
import { requireTeacher } from '@/lib/auth/guards'
import { PageHeader } from '@/components/ui/PageHeader'
import { UsageBars } from '@/components/ui/UsageBars'
import { OnboardingChecklist } from '@/components/teacher/OnboardingChecklist'
import { getTeacherUsage, getTeacherPlanDetails } from '@/lib/db/teachers'

export default async function DashboardPage() {
  const teacher = await requireTeacher()
  const usage = await getTeacherUsage(teacher.id)
  const plan = await getTeacherPlanDetails(teacher.id)

  const usageItems = [
    { label: 'Courses', current: usage.courses, max: plan?.limits.max_courses ?? null, unit: 'courses' },
    { label: 'Students', current: usage.students, max: plan?.limits.max_students ?? null, unit: 'students' },
    { label: 'Active Cohorts', current: usage.cohortsActive, max: plan?.limits.max_cohorts_active ?? null, unit: 'cohorts' },
    { label: 'Storage', current: usage.storageMb, max: plan?.limits.max_storage_mb ?? null, unit: 'MB' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Welcome, ${teacher.name}`}
        description="Here's an overview of your teaching activity."
      />

      <OnboardingChecklist />

      <div>
        <h3 className="text-sm font-medium text-muted mb-3">Plan Usage</h3>
        <UsageBars items={usageItems} />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Verify compilation and test dev server**

Run: `npx tsc --noEmit && npm run dev`
Expected: No TS errors. Dashboard page renders at `http://localhost:3000/dashboard` (will redirect to login since no session).

- [ ] **Step 7: Commit**

```bash
git add components/teacher/Sidebar.tsx components/teacher/OnboardingChecklist.tsx \
  app/\(teacher\)/layout.tsx app/\(teacher\)/dashboard/layout.tsx app/\(teacher\)/dashboard/page.tsx
git commit -m "feat: add teacher dashboard layout, sidebar, and onboarding checklist"
```

---

## Task 6: Onboarding Wizard (3 Steps)

**Files:**
- Create: `lib/actions/onboarding.ts`
- Create: `app/(teacher)/onboarding/layout.tsx`
- Create: `app/(teacher)/onboarding/step-1/page.tsx`
- Create: `app/(teacher)/onboarding/step-2/page.tsx`
- Create: `app/(teacher)/onboarding/step-3/page.tsx`
- Create: `components/teacher/SubdomainPicker.tsx`
- Create: `components/teacher/OnboardingStepForm.tsx`

This task creates the 3-step onboarding wizard. Server Actions handle mutations. Pages are Server Components, forms are Client Components.

- [ ] **Step 1: Create onboarding server actions**

```typescript
// lib/actions/onboarding.ts
'use server'

import { createClient } from '@/supabase/server'
import { createAdminClient } from '@/supabase/server'
import { getTeacherByAuthId, updateTeacher } from '@/lib/db/teachers'
import type { ApiResponse } from '@/types/api'

export async function saveOnboardingStep1(
  formData: FormData
): Promise<ApiResponse<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const subjectTags = formData.getAll('subject_tags') as string[]
  const teachingLevels = formData.getAll('teaching_levels') as string[]

  if (subjectTags.length === 0) {
    return { success: false, error: 'Select at least one subject' }
  }
  if (teachingLevels.length === 0) {
    return { success: false, error: 'Select at least one teaching level' }
  }

  const teacher = await getTeacherByAuthId(user.id)
  if (!teacher) return { success: false, error: 'Teacher not found' }

  await updateTeacher(teacher.id, {
    subject_tags: subjectTags,
    teaching_levels: teachingLevels,
  })

  return { success: true, data: null }
}

export async function saveOnboardingStep3(
  formData: FormData
): Promise<ApiResponse<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const bio = formData.get('bio') as string
  const profilePhotoUrl = formData.get('profile_photo_url') as string | null

  if (!bio || bio.trim().length < 10) {
    return { success: false, error: 'Bio must be at least 10 characters' }
  }

  const teacher = await getTeacherByAuthId(user.id)
  if (!teacher) return { success: false, error: 'Teacher not found' }

  const steps = (teacher.onboarding_steps_json as Record<string, boolean>) || {}
  steps.profile_complete = true

  const updates: Record<string, unknown> = {
    bio: bio.trim(),
    onboarding_steps_json: steps,
  }

  if (profilePhotoUrl) {
    updates.profile_photo_url = profilePhotoUrl
  }

  // Check if all steps complete
  const allDone = Object.values(steps).every(Boolean)
  if (allDone) {
    updates.onboarding_completed = true
  }

  await updateTeacher(teacher.id, updates)

  return { success: true, data: null }
}

export async function completeOnboardingStep(
  step: string
): Promise<ApiResponse<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const teacher = await getTeacherByAuthId(user.id)
  if (!teacher) return { success: false, error: 'Teacher not found' }

  const steps = (teacher.onboarding_steps_json as Record<string, boolean>) || {}
  steps[step] = true

  const allDone = Object.values(steps).every(Boolean)
  const updates: Record<string, unknown> = {
    onboarding_steps_json: steps,
  }
  if (allDone) {
    updates.onboarding_completed = true
  }

  await updateTeacher(teacher.id, updates)

  return { success: true, data: null }
}
```

- [ ] **Step 2: Create onboarding layout**

```typescript
// app/(teacher)/onboarding/layout.tsx
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-xl px-4 py-12">
        {/* Progress indicator */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-brand-600">Skool Rooms</h1>
          <p className="mt-2 text-muted">Set up your teaching profile</p>
        </div>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create SubdomainPicker component**

```typescript
// components/teacher/SubdomainPicker.tsx
'use client'

import { useState, useCallback } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { RESERVED_SUBDOMAINS } from '@/constants/plans'
import { platformDomain } from '@/lib/platform/domain'

const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/

type SubdomainPickerProps = {
  currentSubdomain: string
  onConfirm: (subdomain: string) => Promise<void>
}

export function SubdomainPicker({ currentSubdomain, onConfirm }: SubdomainPickerProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const domain = platformDomain()

  const checkAvailability = useCallback(async (subdomain: string) => {
    const normalized = subdomain.toLowerCase().trim()

    if (!normalized || normalized.length < 3) {
      setError('Subdomain must be at least 3 characters')
      setAvailable(null)
      return
    }

    if (!SUBDOMAIN_REGEX.test(normalized)) {
      setError('Only lowercase letters, numbers, and hyphens. Must start and end with a letter or number.')
      setAvailable(null)
      return
    }

    if (RESERVED_SUBDOMAINS.includes(normalized)) {
      setError('This subdomain is reserved')
      setAvailable(false)
      return
    }

    setChecking(true)
    setError(null)

    try {
      const res = await fetch(`/api/cloudflare/subdomain?check=${normalized}`)
      const data = await res.json()
      setAvailable(data.available !== false)
      if (!data.available) {
        setError('This subdomain is already taken')
      }
    } catch {
      setError('Failed to check availability')
    } finally {
      setChecking(false)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setValue(v)
    setAvailable(null)
    setError(null)
  }

  const handleSubmit = async () => {
    if (!available) return
    setSubmitting(true)
    try {
      await onConfirm(value)
    } catch {
      setError('Failed to save subdomain')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Input
          label="Choose your subdomain"
          value={value}
          onChange={handleChange}
          placeholder="your-name"
          error={error || undefined}
        />
        <p className="mt-1.5 text-sm text-muted">
          Your page will be at <span className="font-medium text-ink">{value || 'your-name'}.{domain}</span>
        </p>
      </div>

      <div className="flex gap-3">
        <Button
          variant="secondary"
          onClick={() => checkAvailability(value)}
          loading={checking}
          disabled={!value || value.length < 3}
        >
          Check Availability
        </Button>

        {available && (
          <Button onClick={handleSubmit} loading={submitting}>
            Confirm & Continue
          </Button>
        )}
      </div>

      {available === true && !error && (
        <p className="text-sm text-success font-medium">
          {value}.{domain} is available!
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create onboarding Step 1 page (Subject + Level)**

```typescript
// app/(teacher)/onboarding/step-1/page.tsx
import { requireTeacher } from '@/lib/auth/guards'
import { Card } from '@/components/ui/Card'
import { OnboardingStep1Form } from './form'

const SUBJECTS = [
  'Mathematics', 'Physics', 'Chemistry', 'Biology', 'English',
  'Urdu', 'Computer Science', 'Islamiat', 'Pakistan Studies',
  'Economics', 'Business Studies', 'Accounting', 'Art & Design',
  'Music', 'Other',
]

const LEVELS = [
  'Primary (1-5)', 'Middle (6-8)', 'Matric (9-10)',
  'Intermediate (11-12)', 'O-Level', 'A-Level',
  'University', 'Test Prep', 'Professional',
]

export default async function OnboardingStep1() {
  const teacher = await requireTeacher()

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-ink mb-1">What do you teach?</h2>
      <p className="text-sm text-muted mb-6">Select your subjects and teaching levels. You can change these later.</p>

      <OnboardingStep1Form
        subjects={SUBJECTS}
        levels={LEVELS}
        defaultSubjects={teacher.subject_tags || []}
        defaultLevels={teacher.teaching_levels || []}
      />
    </Card>
  )
}
```

```typescript
// app/(teacher)/onboarding/step-1/form.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { saveOnboardingStep1 } from '@/lib/actions/onboarding'

type Props = {
  subjects: string[]
  levels: string[]
  defaultSubjects: string[]
  defaultLevels: string[]
}

export function OnboardingStep1Form({ subjects, levels, defaultSubjects, defaultLevels }: Props) {
  const router = useRouter()
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(defaultSubjects)
  const [selectedLevels, setSelectedLevels] = useState<string[]>(defaultLevels)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const toggle = (list: string[], item: string, setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter(i => i !== item) : [...list, item])
  }

  async function handleSubmit() {
    setError(null)
    setLoading(true)

    const formData = new FormData()
    selectedSubjects.forEach(s => formData.append('subject_tags', s))
    selectedLevels.forEach(l => formData.append('teaching_levels', l))

    const result = await saveOnboardingStep1(formData)
    if (!result.success) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push('/onboarding/step-2')
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <div>
        <p className="text-sm font-medium text-ink mb-3">Subjects</p>
        <div className="flex flex-wrap gap-2">
          {subjects.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => toggle(selectedSubjects, s, setSelectedSubjects)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                selectedSubjects.includes(s)
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-surface text-muted border-border hover:border-brand-500'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-ink mb-3">Teaching Levels</p>
        <div className="flex flex-wrap gap-2">
          {levels.map(l => (
            <button
              key={l}
              type="button"
              onClick={() => toggle(selectedLevels, l, setSelectedLevels)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                selectedLevels.includes(l)
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-surface text-muted border-border hover:border-brand-500'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={handleSubmit} loading={loading} className="w-full">
        Continue
      </Button>
    </div>
  )
}
```

- [ ] **Step 5: Create onboarding Step 2 page (Subdomain Picker)**

```typescript
// app/(teacher)/onboarding/step-2/page.tsx
import { requireTeacher } from '@/lib/auth/guards'
import { Card } from '@/components/ui/Card'
import { SubdomainStep } from './form'

export default async function OnboardingStep2() {
  const teacher = await requireTeacher()

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-ink mb-1">Pick your subdomain</h2>
      <p className="text-sm text-muted mb-6">
        This is your unique URL where students will find you. Choose something memorable.
      </p>
      <SubdomainStep currentSubdomain={teacher.subdomain} />
    </Card>
  )
}
```

```typescript
// app/(teacher)/onboarding/step-2/form.tsx
'use client'

import { useRouter } from 'next/navigation'
import { SubdomainPicker } from '@/components/teacher/SubdomainPicker'

export function SubdomainStep({ currentSubdomain }: { currentSubdomain: string }) {
  const router = useRouter()

  async function handleConfirm(subdomain: string) {
    const res = await fetch('/api/cloudflare/subdomain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subdomain }),
    })

    const data = await res.json()
    if (!data.success) throw new Error(data.error)

    router.push('/onboarding/step-3')
  }

  return <SubdomainPicker currentSubdomain={currentSubdomain} onConfirm={handleConfirm} />
}
```

- [ ] **Step 6: Create onboarding Step 3 page (Profile Photo + Bio)**

```typescript
// app/(teacher)/onboarding/step-3/page.tsx
import { requireTeacher } from '@/lib/auth/guards'
import { Card } from '@/components/ui/Card'
import { ProfileStep } from './form'

export default async function OnboardingStep3() {
  const teacher = await requireTeacher()

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-ink mb-1">Complete your profile</h2>
      <p className="text-sm text-muted mb-6">
        Add a photo and bio so students know who you are.
      </p>
      <ProfileStep
        teacherId={teacher.id}
        currentPhotoUrl={teacher.profile_photo_url}
        currentBio={teacher.bio || ''}
      />
    </Card>
  )
}
```

```typescript
// app/(teacher)/onboarding/step-3/form.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { FileUpload } from '@/components/ui/FileUpload'
import { saveOnboardingStep3 } from '@/lib/actions/onboarding'

type Props = {
  teacherId: string
  currentPhotoUrl: string | null
  currentBio: string
}

export function ProfileStep({ teacherId, currentPhotoUrl, currentBio }: Props) {
  const router = useRouter()
  const [photoUrl, setPhotoUrl] = useState(currentPhotoUrl || '')
  const [bio, setBio] = useState(currentBio)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError(null)
    setLoading(true)

    const formData = new FormData()
    formData.set('bio', bio)
    if (photoUrl) formData.set('profile_photo_url', photoUrl)

    const result = await saveOnboardingStep3(formData)
    if (!result.success) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <div>
        <p className="text-sm font-medium text-ink mb-3">Profile Photo</p>
        <FileUpload
          fileType="profile"
          entityId={teacherId}
          onUploadComplete={setPhotoUrl}
          accept="image/jpeg,image/png,image/webp"
          currentUrl={photoUrl || undefined}
        />
      </div>

      <Textarea
        label="Bio"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="Tell students about yourself, your teaching experience, and your approach..."
        rows={5}
      />

      <Button onClick={handleSubmit} loading={loading} className="w-full">
        Complete Setup
      </Button>
    </div>
  )
}
```

- [ ] **Step 7: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add lib/actions/onboarding.ts components/teacher/SubdomainPicker.tsx \
  components/ui/Textarea.tsx \
  app/\(teacher\)/onboarding/
git commit -m "feat: add 3-step onboarding wizard with subdomain picker"
```

---

## Task 7: Course Server Actions + Pages

**Files:**
- Create: `lib/actions/courses.ts`
- Create: `app/(teacher)/dashboard/courses/page.tsx`
- Create: `app/(teacher)/dashboard/courses/new/page.tsx`
- Create: `app/(teacher)/dashboard/courses/new/form.tsx`
- Create: `app/(teacher)/dashboard/courses/[courseId]/page.tsx`
- Create: `app/(teacher)/dashboard/courses/[courseId]/edit/page.tsx`
- Create: `app/(teacher)/dashboard/courses/[courseId]/edit/form.tsx`

- [ ] **Step 1: Create course server actions**

```typescript
// lib/actions/courses.ts
'use server'

import { createClient } from '@/supabase/server'
import { getTeacherByAuthId, hasPaymentSettings } from '@/lib/db/teachers'
import { createCourse, updateCourse, softDeleteCourse, countPublishedCourses } from '@/lib/db/courses'
import { getLimit } from '@/lib/plans/limits'
import { completeOnboardingStep } from '@/lib/actions/onboarding'
import { redirect } from 'next/navigation'
import type { ApiResponse } from '@/types/api'

export async function createCourseAction(
  formData: FormData
): Promise<ApiResponse<{ courseId: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const teacher = await getTeacherByAuthId(user.id)
  if (!teacher) return { success: false, error: 'Teacher not found' }

  const title = formData.get('title') as string
  const description = formData.get('description') as string | null

  if (!title || title.trim().length < 3) {
    return { success: false, error: 'Title must be at least 3 characters' }
  }

  // Plan limit check (published courses only)
  const currentCount = await countPublishedCourses(teacher.id)
  const limit = await getLimit(teacher.id, 'max_courses')
  if (currentCount >= limit) {
    return { success: false, error: 'You have reached your plan limit for courses. Upgrade to create more.', code: 'LIMIT_REACHED' }
  }

  const course = await createCourse(teacher.id, title.trim(), description?.trim() || null)

  return { success: true, data: { courseId: course.id } }
}

export async function updateCourseAction(
  courseId: string,
  formData: FormData
): Promise<ApiResponse<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const teacher = await getTeacherByAuthId(user.id)
  if (!teacher) return { success: false, error: 'Teacher not found' }

  const title = formData.get('title') as string
  const description = formData.get('description') as string | null
  const status = formData.get('status') as string | null
  const thumbnailUrl = formData.get('thumbnail_url') as string | null

  if (!title || title.trim().length < 3) {
    return { success: false, error: 'Title must be at least 3 characters' }
  }

  // Publish guard: require payment settings
  if (status === 'published') {
    const hasPayment = await hasPaymentSettings(teacher.id)
    if (!hasPayment) {
      return {
        success: false,
        error: 'Set up your payment details before publishing. Students need to know how to pay you.',
        code: 'PAYMENT_SETUP_REQUIRED',
      }
    }

    // Check plan limit when publishing
    const currentCount = await countPublishedCourses(teacher.id)
    const limit = await getLimit(teacher.id, 'max_courses')
    if (currentCount >= limit) {
      return { success: false, error: 'Plan limit reached. Upgrade to publish more courses.', code: 'LIMIT_REACHED' }
    }

    // Mark onboarding step complete
    await completeOnboardingStep('course_created')
  }

  const updates: Record<string, unknown> = {
    title: title.trim(),
    description: description?.trim() || null,
  }

  if (status) updates.status = status
  if (thumbnailUrl !== null) updates.thumbnail_url = thumbnailUrl

  await updateCourse(courseId, updates)

  return { success: true, data: null }
}

export async function deleteCourseAction(
  courseId: string
): Promise<ApiResponse<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  try {
    await softDeleteCourse(courseId)
    return { success: true, data: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Delete failed'
    return { success: false, error: message }
  }
}
```

- [ ] **Step 2: Create course list page**

```typescript
// app/(teacher)/dashboard/courses/page.tsx
import { requireTeacher } from '@/lib/auth/guards'
import { getTeacherCourses } from '@/lib/db/courses'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'

export default async function CoursesPage() {
  const teacher = await requireTeacher()
  const courses = await getTeacherCourses(teacher.id)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Courses"
        description="Create and manage your courses."
        action={
          <Link href={ROUTES.TEACHER.courseNew}>
            <Button>Create Course</Button>
          </Link>
        }
      />

      {courses.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description="Create your first course to start enrolling students."
          action={
            <Link href={ROUTES.TEACHER.courseNew}>
              <Button>Create Course</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4">
          {courses.map((course) => (
            <Link key={course.id} href={ROUTES.TEACHER.courseDetail(course.id)}>
              <Card hover className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {course.thumbnail_url && (
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        className="h-16 w-24 rounded-md object-cover"
                      />
                    )}
                    <div>
                      <h3 className="font-medium text-ink">{course.title}</h3>
                      <p className="text-sm text-muted mt-0.5">
                        {course.description
                          ? course.description.replace(/<[^>]*>/g, '').slice(0, 100) + '...'
                          : 'No description'}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={course.status} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create course creation page + form**

```typescript
// app/(teacher)/dashboard/courses/new/page.tsx
import { requireTeacher } from '@/lib/auth/guards'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { ROUTES } from '@/constants/routes'
import { CourseForm } from './form'

export default async function NewCoursePage() {
  const teacher = await requireTeacher()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Create Course"
        description="Add a new course to your profile."
        backHref={ROUTES.TEACHER.courses}
      />
      <Card className="p-6">
        <CourseForm teacherId={teacher.id} />
      </Card>
    </div>
  )
}
```

```typescript
// app/(teacher)/dashboard/courses/new/form.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { FileUpload } from '@/components/ui/FileUpload'
import { createCourseAction } from '@/lib/actions/courses'
import { ROUTES } from '@/constants/routes'

export function CourseForm({ teacherId }: { teacherId: string }) {
  const router = useRouter()
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    formData.set('description', description)

    const result = await createCourseAction(formData)
    if (!result.success) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push(ROUTES.TEACHER.courseDetail(result.data.courseId))
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <Input
        label="Course Title"
        name="title"
        placeholder="e.g., O-Level Mathematics"
        required
      />

      <RichTextEditor
        label="Description"
        content={description}
        onChange={setDescription}
        placeholder="Describe your course — what students will learn, prerequisites, etc."
      />

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          Create Course
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Create course detail page**

```typescript
// app/(teacher)/dashboard/courses/[courseId]/page.tsx
import { requireTeacher } from '@/lib/auth/guards'
import { getCourseById } from '@/lib/db/courses'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const teacher = await requireTeacher()
  const course = await getCourseById(courseId)

  if (!course || course.teacher_id !== teacher.id) notFound()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={course.title}
        backHref={ROUTES.TEACHER.courses}
        action={
          <div className="flex gap-3 items-center">
            <StatusBadge status={course.status} />
            <Link href={ROUTES.TEACHER.courseEdit(courseId)}>
              <Button variant="secondary">Edit</Button>
            </Link>
          </div>
        }
      />

      <Card className="p-6">
        {course.thumbnail_url && (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="w-full max-w-md rounded-lg mb-6"
          />
        )}

        {course.description ? (
          <div
            className="prose prose-sm max-w-none text-ink"
            dangerouslySetInnerHTML={{ __html: course.description }}
          />
        ) : (
          <p className="text-muted">No description yet. Add one by editing the course.</p>
        )}
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Create course edit page + form**

```typescript
// app/(teacher)/dashboard/courses/[courseId]/edit/page.tsx
import { requireTeacher } from '@/lib/auth/guards'
import { getCourseById } from '@/lib/db/courses'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { ROUTES } from '@/constants/routes'
import { CourseEditForm } from './form'

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const teacher = await requireTeacher()
  const course = await getCourseById(courseId)

  if (!course || course.teacher_id !== teacher.id) notFound()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Edit Course"
        backHref={ROUTES.TEACHER.courseDetail(courseId)}
      />
      <Card className="p-6">
        <CourseEditForm
          courseId={courseId}
          teacherId={teacher.id}
          defaultTitle={course.title}
          defaultDescription={course.description || ''}
          defaultThumbnailUrl={course.thumbnail_url || ''}
          defaultStatus={course.status}
        />
      </Card>
    </div>
  )
}
```

```typescript
// app/(teacher)/dashboard/courses/[courseId]/edit/form.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { FileUpload } from '@/components/ui/FileUpload'
import { updateCourseAction, deleteCourseAction } from '@/lib/actions/courses'
import { useUIContext } from '@/providers/UIProvider'
import { ROUTES } from '@/constants/routes'

type Props = {
  courseId: string
  teacherId: string
  defaultTitle: string
  defaultDescription: string
  defaultThumbnailUrl: string
  defaultStatus: string
}

export function CourseEditForm({
  courseId,
  teacherId,
  defaultTitle,
  defaultDescription,
  defaultThumbnailUrl,
  defaultStatus,
}: Props) {
  const router = useRouter()
  const { addToast, confirm } = useUIContext()
  const [description, setDescription] = useState(defaultDescription)
  const [thumbnailUrl, setThumbnailUrl] = useState(defaultThumbnailUrl)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>, publish = false) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    formData.set('description', description)
    if (thumbnailUrl) formData.set('thumbnail_url', thumbnailUrl)
    if (publish) formData.set('status', 'published')

    const result = await updateCourseAction(courseId, formData)
    if (!result.success) {
      setError(result.error)
      setLoading(false)
      return
    }

    addToast({ type: 'success', message: publish ? 'Course published!' : 'Course updated!' })
    router.push(ROUTES.TEACHER.courseDetail(courseId))
  }

  function handleDelete() {
    confirm({
      title: 'Delete Course',
      message: 'Are you sure? This cannot be undone. Courses with active cohorts cannot be deleted.',
      confirmText: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        const result = await deleteCourseAction(courseId)
        if (!result.success) {
          addToast({ type: 'error', message: result.error })
          return
        }
        addToast({ type: 'success', message: 'Course deleted' })
        router.push(ROUTES.TEACHER.courses)
      },
    })
  }

  return (
    <form onSubmit={(e) => handleSubmit(e)} className="flex flex-col gap-6">
      {error && (
        <div className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <Input
        label="Course Title"
        name="title"
        defaultValue={defaultTitle}
        required
      />

      <RichTextEditor
        label="Description"
        content={description}
        onChange={setDescription}
        placeholder="Describe your course..."
      />

      <div>
        <p className="text-sm font-medium text-ink mb-3">Thumbnail</p>
        <FileUpload
          fileType="thumbnail"
          entityId={`${teacherId}/${courseId}`}
          onUploadComplete={setThumbnailUrl}
          accept="image/jpeg,image/png,image/webp"
          currentUrl={thumbnailUrl || undefined}
        />
      </div>

      <div className="flex items-center justify-between border-t border-border pt-6">
        <Button type="button" variant="danger" onClick={handleDelete}>
          Delete Course
        </Button>

        <div className="flex gap-3">
          <Button type="submit" variant="secondary" loading={loading}>
            Save Draft
          </Button>
          {defaultStatus === 'draft' && (
            <Button
              type="button"
              loading={loading}
              onClick={(e) => {
                const form = (e.target as HTMLElement).closest('form')
                if (form) handleSubmit(new Event('submit') as unknown as React.FormEvent<HTMLFormElement>, true)
              }}
            >
              Publish
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
```

- [ ] **Step 6: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add lib/actions/courses.ts \
  app/\(teacher\)/dashboard/courses/
git commit -m "feat: add course CRUD with plan limits, publish guard, and TipTap editor"
```

---

## Task 8: Teacher Public Page (Subdomain)

**Files:**
- Create: `components/public/CourseCard.tsx`
- Create: `components/public/TeacherBio.tsx`
- Create: `app/(teacher-public)/[subdomain]/layout.tsx`
- Create: `app/(teacher-public)/[subdomain]/page.tsx`

- [ ] **Step 1: Create public components**

```typescript
// components/public/TeacherBio.tsx
type TeacherBioProps = {
  name: string
  bio: string | null
  photoUrl: string | null
  subjectTags: string[]
  teachingLevels: string[]
}

export function TeacherBio({ name, bio, photoUrl, subjectTags, teachingLevels }: TeacherBioProps) {
  return (
    <div className="flex flex-col items-center text-center gap-4 mb-8">
      {photoUrl ? (
        <img src={photoUrl} alt={name} className="h-24 w-24 rounded-full object-cover border-2 border-border" />
      ) : (
        <div className="h-24 w-24 rounded-full bg-brand-100 flex items-center justify-center text-2xl font-bold text-brand-600">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold text-ink">{name}</h1>
        {bio && <p className="mt-2 text-muted max-w-lg">{bio}</p>}
      </div>
      {(subjectTags.length > 0 || teachingLevels.length > 0) && (
        <div className="flex flex-wrap justify-center gap-2">
          {subjectTags.map(tag => (
            <span key={tag} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600">
              {tag}
            </span>
          ))}
          {teachingLevels.map(level => (
            <span key={level} className="rounded-full bg-paper px-3 py-1 text-xs font-medium text-muted border border-border">
              {level}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
```

```typescript
// components/public/CourseCard.tsx
import { Card } from '@/components/ui/Card'

type CourseCardProps = {
  title: string
  description: string | null
  thumbnailUrl: string | null
  status: string
}

export function CourseCard({ title, description, thumbnailUrl }: CourseCardProps) {
  const plainText = description?.replace(/<[^>]*>/g, '').slice(0, 150)

  return (
    <Card hover className="overflow-hidden">
      {thumbnailUrl && (
        <img src={thumbnailUrl} alt={title} className="h-40 w-full object-cover" />
      )}
      <div className="p-4">
        <h3 className="font-semibold text-ink">{title}</h3>
        {plainText && (
          <p className="mt-1 text-sm text-muted line-clamp-2">{plainText}...</p>
        )}
      </div>
    </Card>
  )
}
```

- [ ] **Step 2: Create teacher public page**

```typescript
// app/(teacher-public)/[subdomain]/layout.tsx
export default function TeacherPublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-paper">
      {children}
      <footer className="border-t border-border py-6 text-center text-sm text-muted">
        Powered by Skool Rooms
      </footer>
    </div>
  )
}
```

```typescript
// app/(teacher-public)/[subdomain]/page.tsx
import { notFound } from 'next/navigation'
import { getTeacherBySubdomain } from '@/lib/db/teachers'
import { getPublishedCoursesByTeacher } from '@/lib/db/courses'
import { TeacherBio } from '@/components/public/TeacherBio'
import { CourseCard } from '@/components/public/CourseCard'
import { EmptyState } from '@/components/ui/EmptyState'

export default async function TeacherPublicPage({
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params
  const teacher = await getTeacherBySubdomain(subdomain)

  if (!teacher) notFound()

  const courses = await getPublishedCoursesByTeacher(teacher.id)

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <TeacherBio
        name={teacher.name}
        bio={teacher.bio}
        photoUrl={teacher.profile_photo_url}
        subjectTags={teacher.subject_tags || []}
        teachingLevels={teacher.teaching_levels || []}
      />

      <h2 className="text-lg font-semibold text-ink mb-4">Courses</h2>

      {courses.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description="This teacher hasn't published any courses yet."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {courses.map(course => (
            <CourseCard
              key={course.id}
              title={course.title}
              description={course.description}
              thumbnailUrl={course.thumbnail_url}
              status={course.status}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add components/public/TeacherBio.tsx components/public/CourseCard.tsx \
  app/\(teacher-public\)/\[subdomain\]/
git commit -m "feat: add teacher public page with bio and course listing"
```

---

## Task 9: Marketing Homepage + Pricing Page

**Files:**
- Modify: `app/(platform)/page.tsx` (replace placeholder)
- Create: `app/(platform)/pricing/page.tsx`

- [ ] **Step 1: Replace marketing homepage**

```typescript
// app/(platform)/page.tsx
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/constants/routes'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-paper">
      {/* Nav */}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold text-brand-600">Skool Rooms</Link>
          <nav className="flex items-center gap-4">
            <Link href={ROUTES.PLATFORM.explore} className="text-sm text-muted hover:text-ink">Find a Teacher</Link>
            <Link href={ROUTES.PLATFORM.pricing} className="text-sm text-muted hover:text-ink">Pricing</Link>
            <Link href={ROUTES.PLATFORM.login} className="text-sm text-muted hover:text-ink">Log In</Link>
            <Link href={ROUTES.PLATFORM.signup}>
              <Button size="sm">Start Free</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-24 text-center">
        <h1 className="text-4xl font-bold text-ink sm:text-5xl">
          Your teaching,<br />
          <span className="text-brand-600">your platform.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
          Skool Rooms gives independent tutors and coaching centers a branded subdomain,
          course management, student enrollment, and payment tracking — all from one dashboard.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href={ROUTES.PLATFORM.signup}>
            <Button size="lg">Start Free</Button>
          </Link>
          <Link href={ROUTES.PLATFORM.explore}>
            <Button size="lg" variant="outline">Find a Teacher</Button>
          </Link>
        </div>
      </section>

      {/* Features grid */}
      <section className="mx-auto max-w-5xl px-4 pb-24">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { title: 'Branded Subdomain', desc: 'Get your own yourname.skoolrooms.com page instantly.' },
            { title: 'Course Management', desc: 'Create courses, schedule classes, track attendance.' },
            { title: 'Simple Payments', desc: 'Students pay via bank transfer or JazzCash. You verify.' },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border border-border bg-surface p-6 shadow-card">
              <h3 className="font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm text-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-sm text-muted">
        Skool Rooms — LMS for Tutors
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Create pricing page**

```typescript
// app/(platform)/pricing/page.tsx
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ROUTES } from '@/constants/routes'

const PLANS = [
  {
    name: 'Free',
    price: 0,
    features: ['1 course', '15 students', '1 active cohort', '500 MB storage'],
    cta: 'Get Started',
    featured: false,
  },
  {
    name: 'Solo',
    price: 1999,
    features: ['5 courses', '50 students', 'Unlimited cohorts', '2 GB storage', 'Analytics', 'Fee reminders', '14-day free trial'],
    cta: 'Start Free Trial',
    featured: true,
  },
  {
    name: 'Academy',
    price: 3999,
    features: ['Unlimited courses', '200 students', 'Unlimited cohorts', '10 GB storage', 'Multi-teacher', 'WhatsApp alerts', '14-day free trial'],
    cta: 'Start Free Trial',
    featured: false,
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold text-brand-600">Skool Rooms</Link>
          <Link href={ROUTES.PLATFORM.login} className="text-sm text-muted hover:text-ink">Log In</Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <h1 className="text-3xl font-bold text-ink text-center mb-2">Simple, transparent pricing</h1>
        <p className="text-center text-muted mb-12">Start free. Upgrade when you need more.</p>

        <div className="grid gap-6 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={`p-6 flex flex-col ${plan.featured ? 'border-brand-600 ring-2 ring-brand-600' : ''}`}
            >
              {plan.featured && (
                <span className="mb-4 inline-block self-start rounded-full bg-brand-600 px-3 py-0.5 text-xs font-medium text-white">
                  Most Popular
                </span>
              )}
              <h3 className="text-lg font-semibold text-ink">{plan.name}</h3>
              <div className="mt-2 mb-6">
                <span className="text-3xl font-bold text-ink">
                  {plan.price === 0 ? 'Free' : `Rs. ${plan.price.toLocaleString()}`}
                </span>
                {plan.price > 0 && <span className="text-sm text-muted">/month</span>}
              </div>
              <ul className="flex-1 flex flex-col gap-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-ink">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-success" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href={ROUTES.PLATFORM.signup}>
                <Button variant={plan.featured ? 'primary' : 'outline'} className="w-full">
                  {plan.cta}
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add app/\(platform\)/page.tsx app/\(platform\)/pricing/page.tsx
git commit -m "feat: add marketing homepage and pricing page"
```

---

## Task 10: Login Redirect to Onboarding + Final Integration

Add the onboarding redirect logic to the login flow and verify the full onboarding → dashboard → course creation flow works.

**Files:**
- Modify: `components/auth/LoginForm.tsx`

- [ ] **Step 1: Update LoginForm to redirect based on onboarding status**

The teacher layout (`app/(teacher)/layout.tsx`) already checks `onboarding_completed`. But the login form redirects to `/dashboard` directly. We need the teacher layout to handle the redirect:

```typescript
// Add to app/(teacher)/layout.tsx, after the suspension check:
// If onboarding not complete and not already on onboarding pages, redirect
```

Actually, the teacher layout already wraps both `/dashboard/*` and `/onboarding/*` routes. The redirect should happen in the dashboard layout only. Update `app/(teacher)/dashboard/layout.tsx`:

In `app/(teacher)/dashboard/layout.tsx`, add a redirect check. Read the teacher from context isn't possible in a Server Component layout easily, so read it from the parent layout's data. The simplest approach: check in the teacher route group layout.

Add to `app/(teacher)/layout.tsx` after the teacher data fetch:

```typescript
// After: if (teacher.is_suspended) redirect('/suspended')
// Add:
import { headers } from 'next/headers'

// Check if teacher needs onboarding and isn't already on onboarding pages
const headersList = await headers()
const pathname = headersList.get('x-pathname') || headersList.get('x-invoke-path') || ''
const isOnboardingPage = pathname.startsWith('/onboarding')

if (!teacher.onboarding_completed && !isOnboardingPage) {
  redirect('/onboarding/step-1')
}
```

Note: Next.js doesn't expose pathname in headers by default. A simpler approach is to check in the dashboard layout:

```typescript
// app/(teacher)/dashboard/layout.tsx - update
import { redirect } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { Sidebar } from '@/components/teacher/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const teacher = await requireTeacher()

  // Redirect to onboarding if not completed
  if (!teacher.onboarding_completed) {
    redirect('/onboarding/step-1')
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 bg-paper">
        <div className="p-6 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Verify full TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Test dev server**

Run: `npm run dev`
Expected: Server starts clean. Pages render:
- `/` → Marketing homepage
- `/pricing` → Pricing page
- `/login` → Teacher login
- `/dashboard` → Redirects to login (no session)
- After login → Redirects to onboarding if not complete, dashboard if complete

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Week 2 — onboarding, courses, public page, homepage

Week 2 implementation:
- 3-step onboarding wizard (subjects, subdomain, profile)
- Teacher dashboard with sidebar navigation
- Course CRUD with TipTap rich text editor
- Plan limit enforcement (PlanLimitGuard + server-side)
- Teacher public page on subdomain
- Marketing homepage + pricing page
- R2 presign API route
- Cloudflare subdomain API route"
```

---

## Post-Implementation Verification

After all tasks are complete, verify:

1. `npx tsc --noEmit` — zero errors
2. `npm run dev` — server starts clean
3. Marketing homepage renders at `/`
4. Pricing page renders at `/pricing`
5. Login → signup → onboarding flow works
6. Dashboard redirects to onboarding if incomplete
7. Onboarding step 1 saves subjects/levels
8. Onboarding step 2 validates subdomain (format + reserved list)
9. Onboarding step 3 uploads photo + saves bio
10. Dashboard shows usage bars and onboarding checklist
11. Course creation enforces plan limits server-side
12. Course publish checks payment settings (PAYMENT_SETUP_REQUIRED)
13. Course edit with TipTap editor works
14. Teacher public page shows bio + published courses
