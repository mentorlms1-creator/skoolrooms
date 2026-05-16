-- RLS for lesson_plans tables, plus encrypted-settings infrastructure
-- for the AI provider API key.

-- ============= RLS =============

alter table public.lesson_plans enable row level security;
alter table public.lesson_plan_usage enable row level security;

create policy lesson_plans_owner_all
  on public.lesson_plans
  for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy lesson_plan_usage_owner_select
  on public.lesson_plan_usage
  for select
  using (teacher_id = auth.uid());

create policy lesson_plan_usage_owner_insert
  on public.lesson_plan_usage
  for insert
  with check (teacher_id = auth.uid());

-- ============= Encrypted platform_settings =============

create extension if not exists pgcrypto;

alter table public.platform_settings
  add column if not exists is_encrypted boolean not null default false;

create or replace function public.set_encrypted_setting(
  p_key text,
  p_value text,
  p_encryption_key text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.platform_settings (key, value, is_encrypted, updated_at)
  values (p_key, encode(pgp_sym_encrypt(p_value, p_encryption_key), 'base64'), true, now())
  on conflict (key) do update
    set value = excluded.value,
        is_encrypted = true,
        updated_at = now();
end;
$$;

create or replace function public.get_decrypted_setting(
  p_key text,
  p_encryption_key text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v text;
begin
  select value into v
  from public.platform_settings
  where key = p_key and is_encrypted = true;

  if v is null then return null; end if;

  begin
    return pgp_sym_decrypt(decode(v, 'base64'), p_encryption_key);
  exception when others then
    -- Wrong key or corrupt data — return null rather than throw,
    -- so the feature degrades gracefully.
    return null;
  end;
end;
$$;

-- Restrict RPC execution to service role only
revoke all on function public.set_encrypted_setting(text, text, text) from public;
revoke all on function public.get_decrypted_setting(text, text) from public;
grant execute on function public.set_encrypted_setting(text, text, text) to service_role;
grant execute on function public.get_decrypted_setting(text, text) to service_role;
