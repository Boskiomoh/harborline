-- Harborline core schema: profiles, tickets, threads, attachments, canned responses, SLA policies.
-- Applied to the remote project via the Supabase MCP (version 20260915192308).
-- Note: the translation/locale columns created here are removed in 20260915192719_english_only_content.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create type public.user_role as enum ('customer', 'agent', 'admin');
create type public.app_locale as enum ('en', 'fr');
create type public.ticket_status as enum ('new', 'in_progress', 'waiting_on_customer', 'resolved');
create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.ticket_category as enum ('order_delivery', 'returns_refunds', 'payments', 'account', 'product_question');

-- Tables ------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  role public.user_role not null default 'customer',
  preferred_locale public.app_locale not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sla_policies (
  id smallint generated always as identity primary key,
  priority public.ticket_priority not null unique,
  first_response_minutes integer not null check (first_response_minutes > 0)
);

create table public.tickets (
  id bigint generated always as identity (start with 1001) primary key,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 160),
  subject_translations jsonb not null default '{}'::jsonb check (jsonb_typeof(subject_translations) = 'object'),
  category public.ticket_category not null,
  priority public.ticket_priority not null default 'normal',
  status public.ticket_status not null default 'new',
  assigned_agent_id uuid references public.profiles (id) on delete set null,
  locale public.app_locale not null,
  order_reference text check (char_length(order_reference) <= 40),
  first_response_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ticket_messages (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references public.tickets (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 10000),
  locale public.app_locale not null,
  translations jsonb not null default '{}'::jsonb check (jsonb_typeof(translations) = 'object'),
  is_internal_note boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.ticket_attachments (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references public.tickets (id) on delete cascade,
  message_id bigint references public.ticket_messages (id) on delete set null,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text,
  size_bytes integer check (size_bytes >= 0),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ticket_attachments_path_in_ticket_folder check (split_part(storage_path, '/', 1) = ticket_id::text)
);

create table public.canned_responses (
  id bigint generated always as identity primary key,
  agent_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 4000),
  locale public.app_locale not null,
  created_at timestamptz not null default now()
);

create table public.ticket_status_events (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references public.tickets (id) on delete cascade,
  from_status public.ticket_status,
  to_status public.ticket_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Indexes (FKs + RLS predicates + inbox sort) ------------------------------

create index tickets_customer_id_idx on public.tickets (customer_id);
create index tickets_assigned_agent_id_idx on public.tickets (assigned_agent_id);
create index tickets_status_updated_at_idx on public.tickets (status, updated_at desc);
create index tickets_created_at_idx on public.tickets (created_at);
create index ticket_messages_ticket_id_created_at_idx on public.ticket_messages (ticket_id, created_at);
create index ticket_messages_author_id_idx on public.ticket_messages (author_id);
create index ticket_attachments_ticket_id_idx on public.ticket_attachments (ticket_id);
create index ticket_attachments_message_id_idx on public.ticket_attachments (message_id);
create index ticket_attachments_uploaded_by_idx on public.ticket_attachments (uploaded_by);
create index canned_responses_agent_id_idx on public.canned_responses (agent_id);
create index ticket_status_events_ticket_id_created_at_idx on public.ticket_status_events (ticket_id, created_at);
create index ticket_status_events_changed_by_idx on public.ticket_status_events (changed_by);

-- Role helpers (private schema, not exposed via the Data API) ---------------

create function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role in ('agent', 'admin') from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'admin' from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create function private.is_customer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'customer' from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

-- Triggers -------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, preferred_locale)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    case when new.raw_user_meta_data ->> 'preferred_locale' = 'fr' then 'fr'::public.app_locale else 'en'::public.app_locale end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create function private.tickets_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    if new.status = 'resolved' then
      new.resolved_at := now();
    else
      new.resolved_at := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger tickets_before_update
  before update on public.tickets
  for each row execute function private.tickets_before_update();

create function private.log_ticket_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.ticket_status_events (ticket_id, from_status, to_status, changed_by, created_at)
    values (new.id, null, new.status, (select auth.uid()), new.created_at);
  elsif new.status is distinct from old.status then
    insert into public.ticket_status_events (ticket_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, (select auth.uid()));
  end if;
  return null;
end;
$$;

create trigger tickets_log_status
  after insert or update of status on public.tickets
  for each row execute function private.log_ticket_status();

-- A public reply moves the ticket along: first staff reply stamps first_response_at
-- and opens a new ticket; a customer reply re-opens a waiting/resolved ticket.
create function private.on_ticket_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  if new.is_internal_note then
    return null;
  end if;

  select p.role into v_role from public.profiles p where p.id = new.author_id;

  if v_role in ('agent', 'admin') then
    update public.tickets
    set first_response_at = coalesce(first_response_at, new.created_at),
        status = case when status = 'new' then 'in_progress'::public.ticket_status else status end
    where id = new.ticket_id;
  elsif v_role = 'customer' then
    update public.tickets
    set status = case when status in ('waiting_on_customer', 'resolved') then 'in_progress'::public.ticket_status else status end
    where id = new.ticket_id;
  end if;

  return null;
end;
$$;

create trigger ticket_messages_after_insert
  after insert on public.ticket_messages
  for each row execute function private.on_ticket_message_insert();

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_staff(), private.is_admin(), private.is_customer() to authenticated;

-- Privileges: nothing for anon; minimal, column-scoped writes for authenticated --

revoke all on public.profiles, public.sla_policies, public.tickets, public.ticket_messages,
  public.ticket_attachments, public.canned_responses, public.ticket_status_events
  from anon, authenticated;

grant select on public.profiles, public.sla_policies, public.tickets, public.ticket_messages,
  public.ticket_attachments, public.canned_responses, public.ticket_status_events
  to authenticated;

grant update (full_name, preferred_locale) on public.profiles to authenticated;
grant insert (customer_id, subject, subject_translations, category, locale, order_reference) on public.tickets to authenticated;
grant update (status, priority, category, assigned_agent_id) on public.tickets to authenticated;
grant insert (ticket_id, author_id, body, locale, translations, is_internal_note) on public.ticket_messages to authenticated;
grant insert (ticket_id, message_id, storage_path, file_name, mime_type, size_bytes, uploaded_by) on public.ticket_attachments to authenticated;
grant insert (agent_id, title, body, locale), update (title, body, locale), delete on public.canned_responses to authenticated;
grant update (first_response_minutes) on public.sla_policies to authenticated;

-- RLS ------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.sla_policies enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.ticket_attachments enable row level security;
alter table public.canned_responses enable row level security;
alter table public.ticket_status_events enable row level security;

create policy "profiles_select" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or role in ('agent', 'admin')
    or (select private.is_staff())
  );

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "sla_policies_select" on public.sla_policies
  for select to authenticated
  using (true);

create policy "sla_policies_update_admin" on public.sla_policies
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "tickets_select" on public.tickets
  for select to authenticated
  using (
    customer_id = (select auth.uid())
    or (select private.is_staff())
  );

create policy "tickets_insert_customer" on public.tickets
  for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and (select private.is_customer())
  );

create policy "tickets_update_staff" on public.tickets
  for update to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create policy "ticket_messages_select" on public.ticket_messages
  for select to authenticated
  using (
    (select private.is_staff())
    or (
      is_internal_note = false
      and exists (
        select 1 from public.tickets t
        where t.id = ticket_id and t.customer_id = (select auth.uid())
      )
    )
  );

create policy "ticket_messages_insert" on public.ticket_messages
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (
      (select private.is_staff())
      or (
        is_internal_note = false
        and exists (
          select 1 from public.tickets t
          where t.id = ticket_id and t.customer_id = (select auth.uid())
        )
      )
    )
  );

create policy "ticket_attachments_select" on public.ticket_attachments
  for select to authenticated
  using (
    (select private.is_staff())
    or (
      exists (
        select 1 from public.tickets t
        where t.id = ticket_id and t.customer_id = (select auth.uid())
      )
      and (
        message_id is null
        or exists (
          select 1 from public.ticket_messages m
          where m.id = message_id and m.is_internal_note = false
        )
      )
    )
  );

create policy "ticket_attachments_insert" on public.ticket_attachments
  for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and (
      (select private.is_staff())
      or exists (
        select 1 from public.tickets t
        where t.id = ticket_id and t.customer_id = (select auth.uid())
      )
    )
  );

create policy "canned_responses_select_staff" on public.canned_responses
  for select to authenticated
  using ((select private.is_staff()));

create policy "canned_responses_insert_own" on public.canned_responses
  for insert to authenticated
  with check (agent_id = (select auth.uid()) and (select private.is_staff()));

create policy "canned_responses_update_own" on public.canned_responses
  for update to authenticated
  using (agent_id = (select auth.uid()) and (select private.is_staff()))
  with check (agent_id = (select auth.uid()) and (select private.is_staff()));

create policy "canned_responses_delete_own" on public.canned_responses
  for delete to authenticated
  using (agent_id = (select auth.uid()) and (select private.is_staff()));

create policy "ticket_status_events_select" on public.ticket_status_events
  for select to authenticated
  using (
    (select private.is_staff())
    or exists (
      select 1 from public.tickets t
      where t.id = ticket_id and t.customer_id = (select auth.uid())
    )
  );

-- Storage ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-attachments',
  'ticket-attachments',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain']
);

create policy "ticket_attachments_objects_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ticket-attachments'
    and (
      (select private.is_staff())
      or exists (
        select 1 from public.tickets t
        where t.id::text = (storage.foldername(name))[1]
          and t.customer_id = (select auth.uid())
      )
    )
  );

create policy "ticket_attachments_objects_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and (
      (select private.is_staff())
      or owner_id = (select auth.uid())::text
      or exists (
        select 1 from public.ticket_attachments a
        where a.storage_path = name
      )
    )
  );

-- Realtime --------------------------------------------------------------------

alter publication supabase_realtime add table public.tickets, public.ticket_messages, public.ticket_status_events;
