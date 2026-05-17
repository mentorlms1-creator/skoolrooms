-- AI lesson planner schema.
-- Two tables: plans + usage events. RLS in 024.

create table public.lesson_plans (
  id              uuid primary key default gen_random_uuid(),
  teacher_id      uuid not null references auth.users(id) on delete cascade,
  course_id       uuid not null references public.courses(id) on delete cascade,
  scope           text not null check (scope in ('session','unit')),
  title           text not null check (length(title) between 1 and 200),
  body_markdown   text not null check (length(body_markdown) between 1 and 65536),
  inputs          jsonb not null,
  chat_history    jsonb not null default '[]'::jsonb,
  model           text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index lesson_plans_teacher_course_updated_idx
  on public.lesson_plans (teacher_id, course_id, updated_at desc);
create index lesson_plans_course_idx
  on public.lesson_plans (course_id);

-- Maintain updated_at on revision
create or replace function public.touch_lesson_plan_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger lesson_plans_touch_updated_at
  before update on public.lesson_plans
  for each row execute function public.touch_lesson_plan_updated_at();

create table public.lesson_plan_usage (
  id              uuid primary key default gen_random_uuid(),
  teacher_id      uuid not null references auth.users(id) on delete cascade,
  lesson_plan_id  uuid references public.lesson_plans(id) on delete set null,
  event           text not null check (event in ('generate','revise')),
  model           text not null,
  input_tokens    int,
  output_tokens   int,
  created_at      timestamptz not null default now()
);

create index lesson_plan_usage_teacher_event_created_idx
  on public.lesson_plan_usage (teacher_id, event, created_at desc);
