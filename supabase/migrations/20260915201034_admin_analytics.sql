-- Admin analytics in one round trip. SECURITY INVOKER keeps RLS in force;
-- the explicit role check turns a non-admin call into a clear permission error.
create function public.admin_analytics(p_days integer default 30)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_today timestamptz := date_trunc('day', now());
  v_from timestamptz := date_trunc('day', now()) - make_interval(days => greatest(p_days, 1) - 1);
  v_result jsonb;
begin
  if not (select private.is_admin()) then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  with window_tickets as (
    select
      t.id, t.status, t.priority, t.category, t.created_at, t.first_response_at,
      t.created_at + make_interval(mins => s.first_response_minutes) as due_at
    from public.tickets t
    join public.sla_policies s on s.priority = t.priority
    where t.created_at >= v_from
  )
  select jsonb_build_object(
    'from', v_from,
    'to', now(),
    'totalTickets', (select count(*) from window_tickets),
    'respondedCount', (select count(*) from window_tickets where first_response_at is not null),
    'avgFirstResponseMinutes', (
      select round(avg(extract(epoch from first_response_at - created_at) / 60))
      from window_tickets where first_response_at is not null
    ),
    'lateResponses', (select count(*) from window_tickets where first_response_at > due_at),
    'overdueOpen', (
      select count(*) from window_tickets
      where first_response_at is null and status <> 'resolved' and now() > due_at
    ),
    'byPriority', (
      select jsonb_agg(row_to_json(p) order by p.rank desc)
      from (
        select
          s.priority,
          s.first_response_minutes as target_minutes,
          array_position(enum_range(null::public.ticket_priority), s.priority) as rank,
          count(w.id) as tickets,
          round(avg(extract(epoch from w.first_response_at - w.created_at) / 60) filter (where w.first_response_at is not null)) as avg_minutes,
          count(w.id) filter (
            where w.first_response_at > w.due_at
               or (w.first_response_at is null and w.status <> 'resolved' and now() > w.due_at)
          ) as breaches
        from public.sla_policies s
        left join window_tickets w on w.priority = s.priority
        group by s.priority, s.first_response_minutes
      ) p
    ),
    'byCategory', (
      select jsonb_agg(row_to_json(c) order by c.ord)
      from (
        select
          e.category,
          e.ord,
          count(w.id) filter (where w.status <> 'resolved') as open_count,
          count(w.id) filter (where w.status = 'resolved') as resolved_count
        from unnest(enum_range(null::public.ticket_category)) with ordinality as e(category, ord)
        left join window_tickets w on w.category = e.category
        group by e.category, e.ord
      ) c
    ),
    'statusDaily', (
      select jsonb_agg(row_to_json(d) order by d.day)
      from (
        select
          g.day::date as day,
          count(latest.status) filter (where latest.status = 'new') as new_count,
          count(latest.status) filter (where latest.status = 'in_progress') as in_progress_count,
          count(latest.status) filter (where latest.status = 'waiting_on_customer') as waiting_count,
          count(latest.status) filter (where latest.status = 'resolved') as resolved_count
        from generate_series(v_from, v_today, interval '1 day') as g(day)
        left join lateral (
          select distinct on (e.ticket_id) e.to_status as status
          from public.ticket_status_events e
          where e.created_at < g.day + interval '1 day'
          order by e.ticket_id, e.created_at desc
        ) latest on true
        group by g.day
      ) d
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_analytics(integer) from public, anon;
grant execute on function public.admin_analytics(integer) to authenticated;
