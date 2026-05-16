-- Align lesson_plans + lesson_plan_usage with the rest of the codebase:
-- teacher_id references public.teachers(id), not auth.users(id).
-- RLS policies updated to use the standard `teachers.supabase_auth_id` lookup.

-- Drop existing FKs on teacher_id
alter table public.lesson_plans
  drop constraint if exists lesson_plans_teacher_id_fkey;

alter table public.lesson_plan_usage
  drop constraint if exists lesson_plan_usage_teacher_id_fkey;

-- Re-add FKs targeting teachers(id) with the same cascade behaviour
alter table public.lesson_plans
  add constraint lesson_plans_teacher_id_fkey
    foreign key (teacher_id) references public.teachers(id) on delete cascade;

alter table public.lesson_plan_usage
  add constraint lesson_plan_usage_teacher_id_fkey
    foreign key (teacher_id) references public.teachers(id) on delete cascade;

-- Replace RLS policies with the standard pattern
drop policy if exists lesson_plans_owner_all on public.lesson_plans;
drop policy if exists lesson_plan_usage_owner_select on public.lesson_plan_usage;
drop policy if exists lesson_plan_usage_owner_insert on public.lesson_plan_usage;

create policy lesson_plans_owner_all
  on public.lesson_plans
  for all
  using (
    teacher_id = (select id from public.teachers where supabase_auth_id = auth.uid())
  )
  with check (
    teacher_id = (select id from public.teachers where supabase_auth_id = auth.uid())
  );

create policy lesson_plan_usage_owner_select
  on public.lesson_plan_usage
  for select
  using (
    teacher_id = (select id from public.teachers where supabase_auth_id = auth.uid())
  );

create policy lesson_plan_usage_owner_insert
  on public.lesson_plan_usage
  for insert
  with check (
    teacher_id = (select id from public.teachers where supabase_auth_id = auth.uid())
  );
