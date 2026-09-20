-- Product decision: interface is English-only (i18n-ready UI plumbing), ticket content is not translated.
-- Remove translate-on-write and per-row locale columns.

alter table public.tickets
  drop column subject_translations,
  drop column locale;

alter table public.ticket_messages
  drop column translations,
  drop column locale;

alter table public.canned_responses
  drop column locale;

alter table public.profiles
  drop column preferred_locale;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop type public.app_locale;

-- Column grants for dropped columns disappear with the columns; restate the canned_responses grant.
revoke insert, update on public.canned_responses from authenticated;
grant insert (agent_id, title, body), update (title, body) on public.canned_responses to authenticated;
