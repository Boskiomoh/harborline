-- Security hardening (secure-build review, 2026-09-24).
--
-- 1. Public demo accounts can't change their password, email, phone or enrol MFA.
--    The logins are published, so without this one visitor could lock every hirer out.
-- 2. An attachment row can only point at a file inside its own ticket's folder, and each
--    file can be claimed once. Before, a customer could register any storage path on their
--    own ticket and the storage select policy would then let them read that file.
-- 3. The `embed` Edge Function (verify_jwt = false) now requires a shared secret from the
--    database triggers; the secret lives in Vault and never leaves the database.
-- 4. The nightly job restores the full demo fixture (tickets, replies, canned responses,
--    SLA targets, display names) instead of only shifting timestamps, so vandalism lasts a
--    day at most.

-- 1. Demo identity lock --------------------------------------------------------------------

create table if not exists private.demo_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade
);
revoke all on private.demo_accounts from public, anon, authenticated;

insert into private.demo_accounts (user_id)
select u.id from auth.users u
where u.email in (
  'customer@harborline.app', 'agent@harborline.app', 'admin@harborline.app',
  'jonah.whitfield@harborline.app', 'ines.carvalho@example.com', 'marcus.bell@example.com',
  'hana.sato@example.com', 'grace.adeyemi@example.com', 'oliver.brandt@example.com',
  'leah.morrison@example.com'
)
on conflict do nothing;

-- Silently keep the old values rather than raising: Auth's own housekeeping (a password hash
-- upgrade at sign-in, for example) must never be able to break a demo sign-in.
-- To change a demo password on purpose: delete its row from private.demo_accounts, change it,
-- then re-insert the row.
create or replace function private.lock_demo_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from private.demo_accounts d where d.user_id = old.id) then
    new.encrypted_password         := old.encrypted_password;
    new.email                      := old.email;
    new.email_change               := old.email_change;
    new.email_change_token_new     := old.email_change_token_new;
    new.email_change_token_current := old.email_change_token_current;
    new.phone                      := old.phone;
    new.phone_change               := old.phone_change;
    new.phone_change_token         := old.phone_change_token;
    new.recovery_token             := old.recovery_token;
  end if;
  return new;
end;
$$;

create trigger lock_demo_identity
  before update on auth.users
  for each row execute function private.lock_demo_identity();

create or replace function private.block_demo_mfa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from private.demo_accounts d where d.user_id = new.user_id) then
    raise exception 'Demo accounts cannot enrol MFA.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger block_demo_mfa
  before insert on auth.mfa_factors
  for each row execute function private.block_demo_mfa();

revoke all on function private.lock_demo_identity() from public, anon, authenticated;
revoke all on function private.block_demo_mfa() from public, anon, authenticated;

-- 2. Attachments are bound to their ticket's folder ----------------------------------------
-- (storage_path is already unique via ticket_attachments_storage_path_key.)

alter table public.ticket_attachments
  add constraint ticket_attachments_path_in_ticket
    check (split_part(storage_path, '/', 1) = ticket_id::text and storage_path !~ '(^|/)\.\.(/|$)');

-- 3. Shared secret for the embed function --------------------------------------------------

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'harborline_embed_secret',
  'Sent by private.request_embedding; checked by the embed Edge Function via public.embed_secret_matches.')
where not exists (select 1 from vault.secrets where name = 'harborline_embed_secret');

create or replace function private.request_embedding(p_index jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'harborline_embed_secret';
  perform net.http_post(
    url := 'https://qgrkrrlccxtniuyflode.supabase.co/functions/v1/embed',
    body := jsonb_build_object('index', p_index),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-embed-secret', coalesce(v_secret, '')),
    timeout_milliseconds := 10000
  );
end;
$$;

revoke all on function private.request_embedding(jsonb) from public, anon, authenticated;

-- Only the service role (the Edge Function) may ask; nobody can read the secret through it.
create or replace function public.embed_secret_matches(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(length(candidate) = 64, false) and exists (
    select 1 from vault.decrypted_secrets s
    where s.name = 'harborline_embed_secret' and s.decrypted_secret = candidate
  );
$$;

revoke all on function public.embed_secret_matches(text) from public, anon, authenticated;
grant execute on function public.embed_secret_matches(text) to service_role;

-- 4. Nightly full reset ----------------------------------------------------------------------

create or replace function private.reset_demo()
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.profiles p
  set full_name = s.full_name
  from (values
    ('customer@harborline.app', 'Maya Okafor'),
    ('agent@harborline.app', 'Tomás Reyes'),
    ('admin@harborline.app', 'Priya Raman'),
    ('jonah.whitfield@harborline.app', 'Jonah Whitfield'),
    ('ines.carvalho@example.com', 'Inês Carvalho'),
    ('marcus.bell@example.com', 'Marcus Bell'),
    ('hana.sato@example.com', 'Hana Sato'),
    ('grace.adeyemi@example.com', 'Grace Adeyemi'),
    ('oliver.brandt@example.com', 'Oliver Brandt'),
    ('leah.morrison@example.com', 'Leah Morrison')
  ) as s(email, full_name)
  join auth.users u on u.email = s.email
  where p.id = u.id and p.full_name is distinct from s.full_name;

  perform private.reseed_demo();
end;
$$;

revoke all on function private.reset_demo() from public, anon, authenticated;

select cron.unschedule('harborline-demo-rebase')
where exists (select 1 from cron.job where jobname = 'harborline-demo-rebase');

select cron.schedule('harborline-demo-reset', '0 4 * * *', $$select private.reset_demo()$$);
