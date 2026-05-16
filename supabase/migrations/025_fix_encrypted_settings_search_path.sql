-- Fix: 024's set_encrypted_setting / get_decrypted_setting had search_path = public,
-- but Supabase installs pgcrypto into the `extensions` schema, so pgp_sym_encrypt /
-- pgp_sym_decrypt weren't resolvable. Re-create both with extensions on the path.

create or replace function public.set_encrypted_setting(
  p_key text,
  p_value text,
  p_encryption_key text
) returns void
language plpgsql
security definer
set search_path = public, extensions
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
set search_path = public, extensions
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
    return null;
  end;
end;
$$;
