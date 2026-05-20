-- supabase/migrations/032_students_profile_photo.sql
--
-- Add optional profile photo URL to students.
-- Mirrors the existing teachers.profile_photo_url column; stored as the public
-- R2 URL produced by lib/r2/upload.ts (key pattern: profiles/{studentId}.{ext}).
--
-- RLS impact: none. Student self-update is covered by the existing
-- students_update_own_row policy. Teacher reads use createAdminClient() in
-- lib/db/enrollments.ts, which bypasses RLS — authorization is upstream via
-- requireTeacher() + the cohort teacher_id filter.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS profile_photo_url text;
