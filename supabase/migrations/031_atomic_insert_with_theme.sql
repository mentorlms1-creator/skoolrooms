-- Extend insert_lesson_plan_atomic to accept p_theme_slug.
-- Drop and recreate the function (signature change).

drop function if exists public.insert_lesson_plan_atomic(uuid, uuid, text, text, text, jsonb, text, int);

create or replace function public.insert_lesson_plan_atomic(
  p_teacher_id uuid,
  p_course_id uuid,
  p_scope text,
  p_title text,
  p_body_markdown text,
  p_inputs jsonb,
  p_model text,
  p_limit int,
  p_theme_slug text default 'classroom-classic'
) returns table (plan_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_plan_id uuid;
  v_month_start timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('lp:' || p_teacher_id::text));

  v_month_start := date_trunc('month', (now() at time zone 'Asia/Karachi'))
                   at time zone 'Asia/Karachi';

  if p_limit is not null then
    select count(*) into v_count
    from public.lesson_plan_usage
    where teacher_id = p_teacher_id
      and event = 'generate'
      and created_at >= v_month_start;

    if v_count >= p_limit then
      return query select null::uuid, 'quota_exceeded'::text;
      return;
    end if;
  end if;

  insert into public.lesson_plans
    (teacher_id, course_id, scope, title, body_markdown, inputs, chat_history, model, theme_slug)
  values
    (p_teacher_id, p_course_id, p_scope, p_title, p_body_markdown, p_inputs, '[]'::jsonb, p_model, p_theme_slug)
  returning id into v_plan_id;

  return query select v_plan_id, 'ok'::text;
end;
$$;

revoke all on function public.insert_lesson_plan_atomic(uuid, uuid, text, text, text, jsonb, text, int, text) from public;
grant execute on function public.insert_lesson_plan_atomic(uuid, uuid, text, text, text, jsonb, text, int, text) to service_role;
