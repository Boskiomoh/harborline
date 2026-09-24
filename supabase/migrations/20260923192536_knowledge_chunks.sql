-- AI Assist (docs/AI-ASSIST.md §4): the retrieval store for RAG drafts, plus triage bookkeeping.
-- Applied to the remote project via the Supabase MCP (version 20260923192536).
-- Deviations from §4, both deliberate: `vector` lives in the `extensions` schema (keeps the
-- extension-in-public advisor quiet), and a unique (source_type, source_id) key makes re-embedding
-- an upsert and lets the backfill skip what's already there.

create extension if not exists vector with schema extensions;

create table public.knowledge_chunks (
  id bigint generated always as identity primary key,
  source_type text not null check (source_type in ('canned_response', 'resolved_ticket')),
  source_id bigint not null,
  category public.ticket_category,
  content text not null check (char_length(content) between 1 and 4000),
  embedding extensions.vector(384) not null,
  created_at timestamptz not null default now(),
  -- One chunk per source row: the embed function upserts on this, the backfill skips on it.
  constraint knowledge_chunks_source_key unique (source_type, source_id)
);

create index knowledge_chunks_embedding_idx
  on public.knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);

alter table public.knowledge_chunks enable row level security;

-- Read-only for staff. No insert/update/delete policy: chunks are written only by the embed
-- Edge Function running as the service role (which bypasses RLS by design).
revoke all on public.knowledge_chunks from anon, authenticated;
grant select on public.knowledge_chunks to authenticated;

create policy "staff can read knowledge chunks"
  on public.knowledge_chunks for select
  to authenticated
  using ((select private.is_staff()));

-- Nearest-neighbour search. SECURITY INVOKER, so the RLS policy above still decides who gets rows:
-- a customer calling this gets an empty set, not an error that confirms the table exists.
-- `match_category` scopes to that category plus uncategorised chunks (canned responses);
-- pass null to search everything.
create function public.match_knowledge_chunks(
  query_embedding extensions.vector(384),
  match_category public.ticket_category default null,
  match_count integer default 4,
  min_similarity double precision default 0
)
returns table (
  id bigint,
  source_type text,
  source_id bigint,
  category public.ticket_category,
  content text,
  similarity double precision,
  canned_title text,
  ticket_id bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    kc.id,
    kc.source_type,
    kc.source_id,
    kc.category,
    kc.content,
    1 - (kc.embedding operator(extensions.<=>) query_embedding) as similarity,
    cr.title as canned_title,
    tm.ticket_id
  from public.knowledge_chunks kc
  left join public.canned_responses cr on kc.source_type = 'canned_response' and cr.id = kc.source_id
  left join public.ticket_messages tm on kc.source_type = 'resolved_ticket' and tm.id = kc.source_id
  where (match_category is null or kc.category is null or kc.category = match_category)
    and 1 - (kc.embedding operator(extensions.<=>) query_embedding) >= min_similarity
  order by kc.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

revoke all on function public.match_knowledge_chunks(extensions.vector, public.ticket_category, integer, double precision) from public, anon;
grant execute on function public.match_knowledge_chunks(extensions.vector, public.ticket_category, integer, double precision) to authenticated;

-- Triage bookkeeping: stamped the first time a signed-in user changes a ticket's category or
-- priority (by hand, or by accepting an AI suggestion). The triage chip never shows once set.
-- Seeding and the nightly clock rebase run with no auth.uid(), so they never stamp it.
alter table public.tickets add column triaged_at timestamptz;

create function private.tickets_mark_triaged()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and (new.category is distinct from old.category or new.priority is distinct from old.priority) then
    new.triaged_at := coalesce(old.triaged_at, now());
  end if;
  return new;
end;
$$;

create trigger tickets_mark_triaged
  before update of category, priority on public.tickets
  for each row execute function private.tickets_mark_triaged();

revoke all on function private.tickets_mark_triaged() from public, anon, authenticated;
