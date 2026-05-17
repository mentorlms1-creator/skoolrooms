-- Add lesson_plans_per_month limit to plans table.
-- Unlimited convention in this codebase is 9999 (matches max_courses on academy).

alter table public.plans
  add column if not exists lesson_plans_per_month int not null default 0;

update public.plans set lesson_plans_per_month = 2    where slug = 'free';
update public.plans set lesson_plans_per_month = 25   where slug = 'solo';
update public.plans set lesson_plans_per_month = 9999 where slug = 'academy';
