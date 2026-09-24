-- AI Assist step D: keep knowledge_chunks in sync with its sources, automatically.
-- Applied to the remote project via the Supabase MCP (version 20260923192732).
-- Every trigger hands work to the `embed` Edge Function (supabase/functions/embed) through pg_net
-- (async, fire-and-forget, only sent if the transaction commits), so an embedding failure can
-- never block a reply or a status change. Deletes need no embedding and happen inline.

create extension if not exists pg_net with schema extensions;

create function private.request_embedding(p_index jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://qgrkrrlccxtniuyflode.supabase.co/functions/v1/embed',
    body := jsonb_build_object('index', p_index),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;

-- A public message landing on an already-resolved ticket (the function re-checks eligibility:
-- staff author, non-internal, ticket resolved).
create function private.knowledge_on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.is_internal_note
     and exists (select 1 from public.tickets t where t.id = new.ticket_id and t.status = 'resolved') then
    perform private.request_embedding(jsonb_build_object('source_type', 'resolved_ticket', 'source_id', new.id));
  end if;
  return null;
end;
$$;

create trigger ticket_messages_knowledge_insert
  after insert on public.ticket_messages
  for each row execute function private.knowledge_on_message_insert();

-- The usual path: an agent replies, then sets the ticket to resolved. The reply was inserted
-- while the ticket was still open, so it's the status change that queues the whole thread.
create function private.knowledge_on_ticket_resolved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    perform private.request_embedding(jsonb_build_object('ticket_id', new.id));
  end if;
  return null;
end;
$$;

create trigger tickets_knowledge_resolved
  after update of status on public.tickets
  for each row execute function private.knowledge_on_ticket_resolved();

create function private.knowledge_on_canned_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.knowledge_chunks where source_type = 'canned_response' and source_id = old.id;
  elsif tg_op = 'INSERT' or new.title is distinct from old.title or new.body is distinct from old.body then
    perform private.request_embedding(jsonb_build_object('source_type', 'canned_response', 'source_id', new.id));
  end if;
  return null;
end;
$$;

create trigger canned_responses_knowledge
  after insert or update or delete on public.canned_responses
  for each row execute function private.knowledge_on_canned_change();

create function private.knowledge_on_message_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.knowledge_chunks where source_type = 'resolved_ticket' and source_id = old.id;
  return null;
end;
$$;

create trigger ticket_messages_knowledge_delete
  after delete on public.ticket_messages
  for each row execute function private.knowledge_on_message_delete();

-- private.reseed_demo() truncates with `restart identity`, so old source ids get reused by
-- different rows. Drop the matching chunks; the reseed's own inserts re-queue fresh ones.
create function private.knowledge_on_truncate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'canned_responses' then
    delete from public.knowledge_chunks where source_type = 'canned_response';
  else
    delete from public.knowledge_chunks where source_type = 'resolved_ticket';
  end if;
  return null;
end;
$$;

create trigger ticket_messages_knowledge_truncate
  after truncate on public.ticket_messages
  for each statement execute function private.knowledge_on_truncate();

create trigger canned_responses_knowledge_truncate
  after truncate on public.canned_responses
  for each statement execute function private.knowledge_on_truncate();

revoke all on function private.request_embedding(jsonb) from public, anon, authenticated;
revoke all on function private.knowledge_on_message_insert() from public, anon, authenticated;
revoke all on function private.knowledge_on_ticket_resolved() from public, anon, authenticated;
revoke all on function private.knowledge_on_canned_change() from public, anon, authenticated;
revoke all on function private.knowledge_on_message_delete() from public, anon, authenticated;
revoke all on function private.knowledge_on_truncate() from public, anon, authenticated;
