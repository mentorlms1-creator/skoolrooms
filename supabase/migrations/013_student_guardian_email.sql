-- =============================================================================
-- 013_student_guardian_email.sql — Lane E2 (1)
-- Adds optional parent_email column to students for guardian/emergency contact.
-- =============================================================================

ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_email text;
-- No NOT NULL, no default. Optional.
-- No index needed (low-cardinality lookup, never filtered on).
