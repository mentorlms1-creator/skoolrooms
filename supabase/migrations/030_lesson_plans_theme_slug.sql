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
