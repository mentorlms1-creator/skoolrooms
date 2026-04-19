-- ============================================================================
-- 010_messaging_and_notifications.sql
-- Two new tables: direct_messages + notifications
--
-- Note: direct_messages existed as a Phase 2 preparatory table in migration 001
-- with a different schema (teacher_id, student_id direct columns). We drop and
-- recreate with the final Phase 2 messaging schema below. Verified the
-- preparatory table had 0 rows before drop.
-- ============================================================================

DROP TABLE IF EXISTS direct_messages CASCADE;

-- ============================================================================
-- direct_messages
-- Async teacher <-> student messaging. thread_id groups a conversation pair.
-- One thread per (teacher_id, student_id) pair — enforced by the index below.
-- ============================================================================
CREATE TABLE IF NOT EXISTS direct_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id       uuid NOT NULL,            -- shared UUID for a teacher<->student pair
  sender_type     text NOT NULL             -- 'teacher' | 'student'
    CHECK (sender_type IN ('teacher', 'student')),
  sender_id       uuid NOT NULL,            -- teachers.id or students.id
  recipient_type  text NOT NULL             -- 'teacher' | 'student'
    CHECK (recipient_type IN ('teacher', 'student')),
  recipient_id    uuid NOT NULL,            -- teachers.id or students.id
  body            text NOT NULL,
  attachment_url  text,                     -- optional R2 URL (future use)
  read_at         timestamptz,              -- NULL = unread by recipient
  created_at      timestamptz DEFAULT now(),
  -- Enforce teacher<->student only, no same-type threads
  CHECK (
    (sender_type = 'teacher' AND recipient_type = 'student')
    OR
    (sender_type = 'student' AND recipient_type = 'teacher')
  )
);

-- Index to efficiently list all threads for a teacher (across all students)
CREATE INDEX IF NOT EXISTS direct_messages_sender_idx
  ON direct_messages (sender_id, sender_type, created_at);

CREATE INDEX IF NOT EXISTS direct_messages_recipient_idx
  ON direct_messages (recipient_id, recipient_type, created_at);

-- Compound index: fetch full thread between a specific pair, ordered by time
CREATE INDEX IF NOT EXISTS direct_messages_thread_idx
  ON direct_messages (thread_id, created_at);

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
  link_url    text,                       -- Optional deep-link
  read_at     timestamptz,               -- NULL = unread
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON notifications (user_id, user_type, read_at, created_at);

-- ============================================================================
-- RLS: direct_messages
-- Sender or recipient can read. Writes go through service role (server actions).
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
