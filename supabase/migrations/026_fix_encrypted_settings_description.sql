-- Fix: platform_settings.description is NOT NULL with no default, so
-- set_encrypted_setting's INSERT was failing. Supply a default description
-- on insert; preserve any existing description on update.

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
  insert into public.platform_settings (key, value, description, is_encrypted, updated_at)
  values (
    p_key,
    encode(pgp_sym_encrypt(p_value, p_encryption_key), 'base64'),
    'Encrypted secret managed via set_encrypted_setting()',
    true,
    now()
  )
  on conflict (key) do update
    set value = excluded.value,
        is_encrypted = true,
        updated_at = now();
end;
$$;
