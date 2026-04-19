# Lane B — Messaging + Notifications Plan

> Phase 2 feature. Migration 010. Lane B owns all layout changes (teacher + student sidebars).
> Do not touch: lib/actions/payouts.ts, earnings/*, admin/*, lib/db/teacher-balances.ts, lib/db/payouts.ts.

---

## Schema (migration 010)

```sql
-- ============================================================================
-- 010_messaging_and_notifications.sql
-- Two new tables: direct_messages + notifications
-- ============================================================================

-- ============================================================================
-- direct_messages
-- Async teacher ↔ student messaging. thread_id groups a conversation pair.
-- One thread per (teacher_id, student_id) pair — enforced by the index below.
-- ============================================================================
CREATE TABLE IF NOT EXISTS direct_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id       uuid NOT NULL,            -- shared UUID for a teacher↔student pair
  sender_type     text NOT NULL             -- 'teacher' | 'student'
    CHECK (sender_type IN ('teacher', 'student')),
  sender_id       uuid NOT NULL,            -- teachers.id or students.id
  recipient_type  text NOT NULL             -- 'teacher' | 'student'
    CHECK (recipient_type IN ('teacher', 'student')),
  recipient_id    uuid NOT NULL,            -- teachers.id or students.id
  body            text NOT NULL,
  attachment_url  text,                     -- optional R2 URL (announcement file type)
  read_at         timestamptz,              -- NULL = unread by recipient
  created_at      timestamptz DEFAULT now()
);

-- Index to efficiently list all threads for a teacher (across all students)
CREATE INDEX ON direct_messages (sender_id, sender_type, created_at);
CREATE INDEX ON direct_messages (recipient_id, recipient_type, created_at);
-- Compound index: fetch full thread between a specific pair, ordered by time
CREATE INDEX ON direct_messages (thread_id, created_at);

-- ============================================================================
-- notifications
-- In-app notification bell. One row per notification event per user.
-- kind matches EmailType values (same vocabulary). link_url optional deep-link.
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type   text NOT NULL               -- 'teacher' | 'student'
    CHECK (user_type IN ('teacher', 'student')),
  user_id     uuid NOT NULL,              -- teachers.id or students.id
  kind        text NOT NULL,              -- EmailType string value
  title       text NOT NULL,              -- Short display title
  body        text NOT NULL,              -- Detail text (1-2 sentences)
  link_url    text,                       -- Optional deep-link (e.g. /dashboard/messages/thread-id)
  read_at     timestamptz,               -- NULL = unread
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX ON notifications (user_id, user_type, read_at, created_at);

-- ============================================================================
-- RLS: direct_messages
-- Sender or recipient can read. Only sender can insert. No updates from client.
-- ============================================================================
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Teacher reads messages where they are sender or recipient
CREATE POLICY "teacher_read_own_messages"
  ON direct_messages FOR SELECT
  USING (
    (sender_type = 'teacher' AND sender_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid()))
    OR
    (recipient_type = 'teacher' AND recipient_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid()))
  );

-- Student reads messages where they are sender or recipient
CREATE POLICY "student_read_own_messages"
  ON direct_messages FOR SELECT
  USING (
    (sender_type = 'student' AND sender_id = (SELECT id FROM students WHERE supabase_auth_id = auth.uid()))
    OR
    (recipient_type = 'student' AND recipient_id = (SELECT id FROM students WHERE supabase_auth_id = auth.uid()))
  );

-- Only sender can insert (service role bypasses — used by server actions)
-- Client-side insert is disallowed; all writes go through server actions using service role.
-- No INSERT policy needed for client — server actions use createAdminClient().

-- ============================================================================
-- RLS: notifications
-- Users see only their own notifications.
-- ============================================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_own_notifications"
  ON notifications FOR ALL
  USING (
    user_type = 'teacher'
    AND user_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid())
  );

CREATE POLICY "student_own_notifications"
  ON notifications FOR ALL
  USING (
    user_type = 'student'
    AND user_id = (SELECT id FROM students WHERE supabase_auth_id = auth.uid())
  );
```

**thread_id derivation (no extra table):** Deterministically generate thread_id from sorted UUIDs:

```typescript
// lib/db/messages.ts
function makeThreadId(teacherId: string, studentId: string): string {
  // Sort so the same pair always produces the same thread_id
  const sorted = [teacherId, studentId].sort()
  // Use a stable v5-style UUID by hashing the pair — or simply derive from concat + hash
  // Simplest approach: store thread_id on first message, look it up via (teacher_id, student_id) pair
  // See getOrCreateThreadId() below
}
```

The first message in a thread calls `getOrCreateThreadId()` which checks if any prior message exists between this pair; if yes, returns that message's `thread_id`; if no, generates a fresh UUID.

---

## Files to create

### Database layer

- **`lib/db/messages.ts`** — All queries for `direct_messages`:
  - `getOrCreateThreadId(teacherId, studentId): Promise<string>`
  - `sendMessage(input: SendMessageInput): Promise<MessageRow>`
  - `getThreadMessages(threadId: string, limit?: number): Promise<MessageRow[]>`
  - `getThreadsForTeacher(teacherId: string): Promise<ThreadSummary[]>` — latest message per thread
  - `getThreadsForStudent(studentId: string): Promise<ThreadSummary[]>`
  - `markMessageRead(messageId: string): Promise<void>`
  - `markThreadRead(threadId: string, recipientId: string, recipientType: string): Promise<void>`
  - `getUnreadCountForTeacher(teacherId: string): Promise<number>`
  - `getUnreadCountForStudent(studentId: string): Promise<number>`

- **`lib/db/notifications.ts`** — All queries for `notifications`:
  - `createNotification(input: CreateNotificationInput): Promise<NotificationRow>`
  - `getNotificationsForUser(userId: string, userType: 'teacher' | 'student', limit?: number): Promise<NotificationRow[]>`
  - `markNotificationRead(notificationId: string): Promise<void>`
  - `markAllNotificationsRead(userId: string, userType: 'teacher' | 'student'): Promise<void>`
  - `getUnreadCountForUser(userId: string, userType: 'teacher' | 'student'): Promise<number>`

### Server actions

- **`lib/actions/messages.ts`**:
  - `sendMessageAction(formData: FormData): Promise<ApiResponse<{ messageId: string }>>`
    - Auth: teacher or student
    - Validate body not empty, recipient relationship valid (student must have active enrollment with this teacher)
    - Insert message via `createAdminClient()`
    - Call `createNotification()` for recipient
    - Call `sendEmail()` with type `'new_message'` (already in EmailType)
    - Return `{ messageId }`
  - `markMessageReadAction(messageId: string): Promise<ApiResponse<void>>`
  - `markThreadReadAction(threadId: string): Promise<ApiResponse<void>>`

- **`lib/actions/notifications.ts`**:
  - `markNotificationReadAction(notificationId: string): Promise<ApiResponse<void>>`
  - `markAllReadAction(): Promise<ApiResponse<void>>`

### UI components

- **`components/messaging/ThreadList.tsx`** — Client Component (`'use client'`)
  - Displays list of threads with avatar, name, last message preview, timestamp, unread badge
  - Props: `threads: ThreadSummary[], activeThreadId?: string`
  - Reuses `Badge`, `Avatar` (install shadcn avatar if not present), `formatPKT`

- **`components/messaging/Thread.tsx`** — Client Component
  - Displays ordered messages in a thread; realtime-subscribed via `useRealtime` on `direct_messages` filtered by `thread_id`
  - Props: `initialMessages: MessageRow[], threadId: string, currentUserId: string, currentUserType: 'teacher'|'student'`
  - Calls `markThreadReadAction` on mount

- **`components/messaging/MessageComposer.tsx`** — Client Component
  - Textarea + Send button; calls `sendMessageAction` via form action
  - Props: `threadId: string, recipientId: string, recipientType: 'teacher'|'student'`

- **`components/ui/NotificationBell.tsx`** — Client Component (`'use client'`)
  - Bell icon (Lucide `Bell`) + red badge with unread count
  - Popover (reuse shadcn `Popover`) showing last 10 notifications, each with title + body + relative time
  - "Mark all read" button → `markAllReadAction()`
  - Click on item → navigate to `link_url` + `markNotificationReadAction(id)`
  - Props: `initialCount: number, initialNotifications: NotificationRow[]`
  - Realtime-subscribed via `useRealtime` on `notifications` filtered by `user_id=eq.{userId}`
  - Uses `formatPKT(n.created_at, 'relative')` for timestamp display

### Pages

- **`app/(teacher)/dashboard/messages/page.tsx`** — Server Component
  - `requireTeacher()` → fetch threads via `getThreadsForTeacher(teacherId)`
  - Render `ThreadList` + redirect to first thread if one exists
  - If `searchParams.thread` → render `Thread` + `MessageComposer` in main panel

- **`app/(teacher)/dashboard/messages/[threadId]/page.tsx`** — Server Component
  - `requireTeacher()` → fetch thread messages via `getThreadMessages(threadId)`
  - Validate teacher is participant; redirect if not
  - Render two-panel layout: `ThreadList` (left) + `Thread` + `MessageComposer` (right)

- **`app/(student)/student/messages/page.tsx`** — Server Component
  - Student auth → `getThreadsForStudent(studentId)`
  - Same two-panel layout pattern

- **`app/(student)/student/messages/[threadId]/page.tsx`** — Server Component
  - Student auth → `getThreadMessages(threadId)`
  - Validate student is participant

---

## Files to edit

### Layouts — sidebar nav + notification bell

- **`app/(teacher)/dashboard/layout.tsx`**
  - Fetch `unreadMessageCount` and `unreadNotificationCount` and latest notifications via parallel `Promise.all`
  - Pass `notificationCount={unreadMessageCount + unreadNotificationCount}` to `SidebarShell`
  - Wrap `<SidebarShell>` with `<NotificationBell initialCount={unreadNotificationCount} initialNotifications={notifications} />` in the header slot (SidebarShell already accepts `notificationCount` and `notificationHref` — update to pass the full bell component or add a `notificationSlot` prop)
  - `notificationHref` already set to `ROUTES.TEACHER.messages` — keep as-is for the sidebar badge

- **`app/(student)/student/layout.tsx`**
  - Same pattern: fetch `unreadCount` + notifications in Server Component
  - Pass to `NotificationBell` rendered in header slot

- **`constants/nav-items.ts`**
  - Add `{ label: 'Messages', href: ROUTES.TEACHER.messages, icon: MessageSquare, group: 'Management' }` to `TEACHER_NAV_ITEMS`
  - Add `{ label: 'Messages', href: ROUTES.STUDENT.messages, icon: MessageSquare }` to `STUDENT_NAV_ITEMS`

- **`constants/routes.ts`**
  - Teacher messages routes already defined (`ROUTES.TEACHER.messages = '/dashboard/messages'`)
  - Student messages routes already defined (`ROUTES.STUDENT.messages = '/student/messages'`)
  - Add: `TEACHER.messageThread: (threadId: string) => \`/dashboard/messages/${threadId}\`` 
  - Add: `STUDENT.messageThread: (threadId: string) => \`/student/messages/${threadId}\``

### Email + notification integration

- **`lib/db/notifications.ts`** (new file — see above)
  - `createNotification()` is the helper called from server actions and `sendEmail()` call-sites

- **Key call-sites that need `createNotification()` added** (call alongside existing `sendEmail()` — do NOT modify sendEmail itself):
  - `lib/actions/enrollment-management.ts` → `enrollment_confirmed`, `enrollment_rejected`
  - `lib/actions/announcements.ts` → `new_announcement`
  - `lib/actions/messages.ts` → `new_message` (new)
  - Any cron that calls `sendEmail` for student/teacher events can similarly call `createNotification` if the event warrants an in-app record — scope this to just the above for Phase 2 launch

### Migration file

- **`supabase/migrations/010_messaging_and_notifications.sql`** — full SQL from Schema section above

### SidebarShell (if needed)

- **`components/ui/SidebarShell.tsx`** — add optional `notificationSlot?: React.ReactNode` prop so layouts can inject `<NotificationBell>` into the header without changing SidebarShell's internal badge logic. The existing `notificationCount`/`notificationHref` sidebar badge stays as-is (for messages unread count). The notification bell is a separate header element.

---

## Implementation order (ordered steps)

### Step 1 — Schema + DB layer (no UI yet)
1. Write `supabase/migrations/010_messaging_and_notifications.sql`
2. Run `npx supabase db push` (or apply via dashboard)
3. Run `npx supabase gen types typescript --local > types/database.ts`
4. Write `lib/db/messages.ts` — all query functions with `createAdminClient()`
5. Write `lib/db/notifications.ts` — all query functions

**Test criteria:**
- Migration applies cleanly on a clean DB
- `getThreadsForTeacher` returns empty array before any messages exist
- `getUnreadCountForUser` returns 0 on fresh DB

---

### Step 2 — Server actions
1. Write `lib/actions/messages.ts` — `sendMessageAction`, `markThreadReadAction`
2. Write `lib/actions/notifications.ts` — `markNotificationReadAction`, `markAllReadAction`
3. Add `createNotification()` calls in `lib/actions/enrollment-management.ts` alongside existing `sendEmail()` calls for `enrollment_confirmed` and `enrollment_rejected`
4. Add `createNotification()` calls in `lib/actions/announcements.ts` for `new_announcement`

**Test criteria:**
- `sendMessageAction` inserts a row in `direct_messages` and a row in `notifications`
- `markThreadReadAction` sets `read_at` on all unread messages for that recipient in the thread
- `createNotification` after announcement creates notification rows for all enrolled students

---

### Step 3 — Notification bell component
1. Write `components/ui/NotificationBell.tsx`
2. Update `components/ui/SidebarShell.tsx` to accept `notificationSlot?: React.ReactNode` prop
3. Update `app/(teacher)/dashboard/layout.tsx`:
   - Add `getUnreadCountForUser` + `getNotificationsForUser` to the `Promise.all` fetch
   - Render `<NotificationBell>` and pass into `SidebarShell`'s `notificationSlot`
4. Update `app/(student)/student/layout.tsx` — same pattern

**Test criteria:**
- Bell shows in teacher dashboard header with correct unread count
- Bell popover opens and shows notification list
- "Mark all read" clears count
- Realtime: sending a message updates bell count without page reload

---

### Step 4 — Messaging pages (teacher)
1. Write `components/messaging/ThreadList.tsx`
2. Write `components/messaging/Thread.tsx` (with `useRealtime` subscription on `direct_messages` filtered by `thread_id`)
3. Write `components/messaging/MessageComposer.tsx`
4. Write `app/(teacher)/dashboard/messages/page.tsx`
5. Write `app/(teacher)/dashboard/messages/[threadId]/page.tsx`
6. Update `constants/nav-items.ts` — add Messages nav item for teacher

**Test criteria:**
- Teacher can see list of students they've messaged
- Teacher can send a message and it appears in thread immediately (realtime)
- Unread count in sidebar badge decrements when thread is opened
- Thread validates teacher is a participant — redirects if not

---

### Step 5 — Messaging pages (student)
1. Write `app/(student)/student/messages/page.tsx`
2. Write `app/(student)/student/messages/[threadId]/page.tsx`
3. Update `constants/nav-items.ts` — add Messages nav item for student

**Test criteria:**
- Student sees threads with their teachers
- Student can send message; teacher sees it in realtime
- Student cannot access a thread where they are not a participant (403 redirect)

---

### Step 6 — Wire unread counts into layouts + final polish
1. Update `app/(teacher)/dashboard/layout.tsx` — `notificationCount` to include unread messages
2. Update `app/(student)/student/layout.tsx` — same
3. Manual end-to-end test: teacher sends → student notified (bell + email) → student replies → teacher notified

**Test criteria (end-to-end):**
- Teacher sends message → student's bell updates (realtime)
- Student's email inbox receives `new_message` email (via existing Brevo + `sendEmail`)
- Student replies → teacher's bell updates
- Both parties see read receipts (timestamp appears when recipient opens thread)

---

## Testable criteria per step

| Step | What to verify |
|------|----------------|
| 1 | Migration applies; RLS blocks cross-user reads in Supabase SQL editor |
| 2 | Server actions insert correct rows; `notifications` row created alongside email send |
| 3 | Bell renders in both layouts; popover shows real data; realtime subscription fires |
| 4 | Teacher messaging pages load; thread realtime works; unread badge clears on open |
| 5 | Student messaging pages load; cross-participant access blocked |
| 6 | Full round-trip: send → notify → reply → notify; email + in-app both fire |

---

## Open questions — RESOLVED (team-lead 2026-04-19)

1. **`EmailType` for `'new_message'`** — Use same `'new_message'` type both directions. Vary salutation by `recipient_type` in the template (e.g. "Hi [teacher name]" vs "Hi [student name]").

2. **Attachment support** — Text-only for launch. Keep `attachment_url` column (future-proof) but ship no upload UI. Do not add `'message_attachment'` to `PresignInput.fileType` yet.

3. **Opposite-type CHECK constraint** — Add explicit `CHECK (sender_type != recipient_type)` to `direct_messages` table. No student↔student threads.

4. **Recipient validation scope** — Messaging allowed if ANY enrollment row exists between this teacher+student pair, regardless of status (active, withdrawn, revoked, etc.). Simple existence check in `sendMessageAction`.

5. **`SidebarShell` `notificationSlot`** — Additive/optional prop; Lane A and D confirmed not touching SidebarShell. No conflict.

6. **Notification bell scope** — Popover shows last 20 notifications. No `/notifications` full-history page for Phase 2.

7. **`createNotification()` call-sites** — 3 external call-sites (enrollment confirmed, enrollment rejected, new announcement) + 1 internal (`new_message` in `sendMessageAction`) = 4 total. No broader audit for Phase 2.

### Extra implementation guidance from team-lead

- **`thread_id` strategy:** On first message, generate a new UUID. Store it on the row. On subsequent messages, look up an existing row with matching `(teacher_id, student_id)` pair (either as sender or recipient) and reuse its `thread_id`. No separate threads table needed.
- **Realtime channel naming:** Use `realtime-direct_messages-thread_id=eq.{threadId}` for the thread subscription channel name (matches `useRealtime` hook's filter format).
- **No email dedup:** Send `new_message` email on every message. No batching or cooldown for Phase 2.

---

## Answers from team-lead

1. **`'new_message'` EmailType** — confirmed. Same template file/branch, but templating logic should read `recipient_type` and render appropriate salutation/subject. Sender name + preview of first 120 chars of body in the email body. CTA button links to `link_url` (the thread).

2. **Attachments: text-only for launch.** Keep `attachment_url` column in schema (future-proof) but do NOT expose upload UI in MessageComposer. Do not touch R2 presign's `fileType` enum. Flag as Phase 2.5 follow-up.

3. **No student↔student messaging.** CHECK constraint in schema is correct: `sender_type != recipient_type` (one teacher, one student). Add this CHECK explicitly: `CHECK ((sender_type = 'teacher' AND recipient_type = 'student') OR (sender_type = 'student' AND recipient_type = 'teacher'))`.

4. **Recipient validation rule:** allow messaging if ANY enrollment row exists between the teacher and student, regardless of status (active, pending, withdrawn, revoked, rejected). Rationale: preserves alumni follow-up + refund-dispute use case; hard to abuse (requires prior enrollment). Implement as: `sendMessageAction` pre-check via `SELECT 1 FROM enrollments WHERE teacher_id = ? AND student_id = ? LIMIT 1` — reject with `NOT_CONNECTED` if no row. Both teacher- and student-initiated messages use the same check.

5. **`SidebarShell` `notificationSlot` prop** — confirmed Lane A and Lane D do NOT edit SidebarShell. The prop is purely additive (optional, defaults to null). You own this edit. Reviewer should verify the change doesn't break existing callers.

6. **Popover-only for notification bell.** No `/notifications` page. Show last 20 (bump from 10 — gives more context without being heavy). Mark all read, per-item click navigates to link_url.

7. **Scope confirmed:** 3 call-sites for Phase 2 launch (enrollment_confirmed, enrollment_rejected, new_announcement) + 1 inside your own `sendMessageAction` (new_message). Don't audit the rest — that's a follow-up.

## Additional guidance

- **thread_id strategy:** For a fresh pair, generate a new UUID (gen_random_uuid()) for thread_id on first insert. `getOrCreateThreadId(teacherId, studentId)` looks up: `SELECT thread_id FROM direct_messages WHERE (sender_id=t AND recipient_id=s) OR (sender_id=s AND recipient_id=t) LIMIT 1`. If no row, generate UUID client-side and pass it in. Same function usable by `sendMessageAction`.

- **Realtime channel naming:** Use `supabase.channel('notifications:' + userId)` and `supabase.channel('thread:' + threadId)` consistently. Filter realtime subscriptions on the server-side filter params (`user_id=eq.{userId}`), not client-side JS filter, to keep payload small.

- **Migration file name confirmed:** `supabase/migrations/010_messaging_and_notifications.sql`.

- **Email deduplication:** When a student opens a thread and reads a message within 5 minutes of it being sent, consider suppressing the `new_message` email. Simpler alternative: always send the email (rely on Brevo throttling). Go with the simpler option for launch; revisit if users complain.

- **NO notification page yet. Do not create `app/(teacher)/dashboard/notifications/` or similar. Popover only.**

---

## Cross-lane coordination with Lane D (ViewAsBar injection)

Lane D is building admin "View as teacher" impersonation (signed cookie). Lane B owns all teacher/student layout edits, so the layout-level ViewAsBar injection falls on Lane B. Split:

- **Lane D creates** (no layout edits from D):
  - `lib/admin/view-as-session.ts` exports `getViewAsSession()` — reads `admin_view_as` cookie, returns `{ teacherId, teacherEmail, expiresAt } | null`
  - `components/admin/ViewAsBar.tsx` — pure presentational component, accepts `{ teacherEmail, expiresAt }` props

- **Lane B must** (add to the `SidebarShell` extension):
  - In `components/ui/SidebarShell.tsx`: add a second optional prop `adminBannerSlot?: React.ReactNode` alongside `notificationSlot`. Renders at the top of the shell, ABOVE the header.
  - In `app/(teacher)/dashboard/layout.tsx`:
    - Import `getViewAsSession` from `lib/admin/view-as-session`
    - Call it server-side. If it returns a session, import `ViewAsBar` from `components/admin/ViewAsBar` and pass `<ViewAsBar teacherEmail={...} expiresAt={...} />` into `SidebarShell`'s `adminBannerSlot` prop.
    - When in view-as mode, suppress the notification bell (pass `notificationSlot={null}`) — admin shouldn't see the impersonated teacher's notifications.

- **Implementer-b: do the ViewAsBar integration LAST (Step 6)** — by then Implementer-d will have committed `getViewAsSession` and `ViewAsBar`. Use SendMessage to ping implementer-d before Step 6 to confirm both files exist. If they don't yet, proceed with the layout edit WITHOUT the ViewAsBar injection, and leave a TODO comment referencing the Lane D component paths. Implementer-d can finish the injection in their lane.
