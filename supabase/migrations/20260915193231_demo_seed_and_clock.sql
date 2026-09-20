-- Demo data: reseedable fixture + nightly clock re-base so SLA states stay realistic.
-- Run `select private.reseed_demo();` to reset all tickets to the fixture.
-- The pg_cron job re-bases timestamps nightly at 04:00 UTC (it does not delete data).

-- Triggers skip when the seeding/rebasing guard is on (set transaction-locally by the functions below).
create or replace function private.tickets_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('harborline.seeding', true) = 'on' then
    return new;
  end if;
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

create or replace function private.log_ticket_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('harborline.seeding', true) = 'on' then
    return null;
  end if;
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

create or replace function private.on_ticket_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  if new.is_internal_note or current_setting('harborline.seeding', true) = 'on' then
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

create table private.demo_clock (
  id boolean primary key default true check (id),
  anchored_at timestamptz not null
);

-- p_thread: [{ "a": "c" | staff code, "at": minutes after opening, "b": body, "n": internal? }]
create function private.seed_ticket(
  p_people jsonb,
  p_customer text,
  p_subject text,
  p_category public.ticket_category,
  p_priority public.ticket_priority,
  p_status public.ticket_status,
  p_agent text,
  p_opened_ago interval,
  p_order_ref text,
  p_thread jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_opened timestamptz := now() - p_opened_ago;
  v_customer uuid := (p_people ->> p_customer)::uuid;
  v_agent uuid := (p_people ->> p_agent)::uuid;
  v_ticket bigint;
  v_msg jsonb;
  v_at timestamptz;
  v_author uuid;
  v_internal boolean;
  v_first_response timestamptz;
  v_first_response_author uuid;
  v_first_staff timestamptz;
  v_last_staff_public timestamptz;
  v_last_msg timestamptz := v_opened;
  v_resolved timestamptz;
  v_updated timestamptz;
begin
  for v_msg in select value from jsonb_array_elements(p_thread) loop
    v_at := v_opened + make_interval(mins => (v_msg ->> 'at')::int);
    v_last_msg := greatest(v_last_msg, v_at);
    if v_msg ->> 'a' <> 'c' then
      v_first_staff := coalesce(v_first_staff, v_at);
      if not coalesce((v_msg ->> 'n')::boolean, false) then
        if v_first_response is null then
          v_first_response := v_at;
          v_first_response_author := (p_people ->> (v_msg ->> 'a'))::uuid;
        end if;
        v_last_staff_public := v_at;
      end if;
    end if;
  end loop;

  v_resolved := case when p_status = 'resolved' then v_last_msg + interval '20 minutes' end;
  v_updated := case p_status
    when 'resolved' then v_resolved
    when 'waiting_on_customer' then greatest(v_last_msg, v_last_staff_public + interval '1 minute')
    else v_last_msg
  end;

  insert into public.tickets (
    customer_id, subject, category, priority, status, assigned_agent_id, order_reference,
    first_response_at, resolved_at, created_at, updated_at
  ) values (
    v_customer, p_subject, p_category, p_priority, p_status, v_agent, p_order_ref,
    v_first_response, v_resolved, v_opened, v_updated
  )
  returning id into v_ticket;

  for v_msg in select value from jsonb_array_elements(p_thread) loop
    v_at := v_opened + make_interval(mins => (v_msg ->> 'at')::int);
    v_author := case when v_msg ->> 'a' = 'c' then v_customer else (p_people ->> (v_msg ->> 'a'))::uuid end;
    v_internal := coalesce((v_msg ->> 'n')::boolean, false);
    insert into public.ticket_messages (ticket_id, author_id, body, is_internal_note, created_at)
    values (v_ticket, v_author, v_msg ->> 'b', v_internal, v_at);
  end loop;

  insert into public.ticket_status_events (ticket_id, from_status, to_status, changed_by, created_at)
  values (v_ticket, null, 'new', v_customer, v_opened);

  if p_status <> 'new' then
    insert into public.ticket_status_events (ticket_id, from_status, to_status, changed_by, created_at)
    values (
      v_ticket, 'new', 'in_progress',
      coalesce(v_first_response_author, v_agent),
      coalesce(v_first_response, v_first_staff, v_opened + interval '30 minutes')
    );
  end if;

  if p_status = 'waiting_on_customer' then
    insert into public.ticket_status_events (ticket_id, from_status, to_status, changed_by, created_at)
    values (v_ticket, 'in_progress', 'waiting_on_customer', v_agent, v_last_staff_public + interval '1 minute');
  elsif p_status = 'resolved' then
    insert into public.ticket_status_events (ticket_id, from_status, to_status, changed_by, created_at)
    values (v_ticket, 'in_progress', 'resolved', v_agent, v_resolved);
  end if;
end;
$$;

create function private.reseed_demo()
returns void
language plpgsql
set search_path = ''
as $fn$
declare
  v_people jsonb;
begin
  perform set_config('harborline.seeding', 'on', true);

  truncate public.ticket_attachments, public.ticket_status_events, public.ticket_messages,
    public.tickets, public.canned_responses restart identity;

  select jsonb_object_agg(c.code, u.id) into v_people
  from (values
    ('M', 'customer@harborline.app'),
    ('T', 'agent@harborline.app'),
    ('P', 'admin@harborline.app'),
    ('J', 'jonah.whitfield@harborline.app'),
    ('I', 'ines.carvalho@example.com'),
    ('B', 'marcus.bell@example.com'),
    ('H', 'hana.sato@example.com'),
    ('G', 'grace.adeyemi@example.com'),
    ('O', 'oliver.brandt@example.com'),
    ('L', 'leah.morrison@example.com')
  ) as c(code, email)
  join auth.users u on u.email = c.email;

  insert into public.sla_policies (priority, first_response_minutes)
  values ('urgent', 60), ('high', 240), ('normal', 480), ('low', 1440)
  on conflict (priority) do update set first_response_minutes = excluded.first_response_minutes;

  -- Maya Okafor (demo customer) -------------------------------------------------
  perform private.seed_ticket(v_people, 'M', 'Parcel marked delivered but nothing arrived', 'order_delivery', 'high', 'in_progress', 'T', interval '5 hours', 'HB-40718', $j$[
    {"a":"c","at":0,"b":"Tracking for order HB-40718 says it was delivered yesterday at 2:14pm, but there's nothing at my door, in the mailroom, or with the neighbours. It's a birthday gift, so I'm a bit anxious about it."},
    {"a":"T","at":52,"b":"Hi Maya, I'm sorry, that's a stressful one. I've opened a trace with the courier and asked for the GPS scan from the delivery. They usually reply within one business day, and I'll update you here as soon as I hear back."},
    {"a":"T","at":55,"n":true,"b":"Courier trace CT-88213 opened. If there's no proof of delivery by tomorrow noon, reship at no cost. Order value is under the auto-reship threshold."},
    {"a":"c","at":70,"b":"Thank you. If it helps, our building has a parcel locker on the ground floor. Maybe they used that?"},
    {"a":"T","at":81,"b":"Good thinking. I've added the locker detail to the trace so the driver can confirm."}
  ]$j$::jsonb);

  perform private.seed_ticket(v_people, 'M', 'Wrong size sent for the Alder rain jacket', 'returns_refunds', 'normal', 'waiting_on_customer', 'J', interval '2 days 3 hours', 'HB-39982', $j$[
    {"a":"c","at":0,"b":"I ordered the Alder rain jacket in a medium, but the one that arrived is labelled large. Can I swap it?"},
    {"a":"J","at":140,"b":"Hi Maya, apologies for the mix-up. I can send a medium right away. Could you reply with a photo of the size label on the jacket you received? Once I have it, I'll ship the exchange and email you a prepaid return label."}
  ]$j$::jsonb);

  perform private.seed_ticket(v_people, 'M', 'Charged twice for one order', 'payments', 'urgent', 'resolved', 'T', interval '9 days 4 hours', 'HB-38310', $j$[
    {"a":"c","at":0,"b":"My card statement shows two charges of $86.40 for order HB-38310. I only placed one order."},
    {"a":"T","at":38,"b":"Hi Maya, I can see what happened. The first payment attempt timed out and was retried, so the second charge is a pending authorisation rather than a completed payment. I've voided it on our side, and it should drop off your statement within 3 to 5 business days."},
    {"a":"c","at":300,"b":"It's gone from my banking app now. Thanks for explaining!"},
    {"a":"T","at":330,"b":"Glad to hear it. I'll close this ticket, but reply here any time if anything else looks off."}
  ]$j$::jsonb);

  perform private.seed_ticket(v_people, 'M', 'Can I change the delivery address?', 'order_delivery', 'low', 'resolved', 'J', interval '21 days 6 hours', 'HB-37105', $j$[
    {"a":"c","at":0,"b":"I just realised order HB-37105 is going to my old flat. Is it too late to change the address to 18 Calloway Road?"},
    {"a":"J","at":95,"b":"Hi Maya, we caught it in time. The order hadn't been packed yet, so I've updated the address to 18 Calloway Road. You'll get a fresh tracking email once it ships."},
    {"a":"c","at":120,"b":"Perfect, thank you."}
  ]$j$::jsonb);

  perform private.seed_ticket(v_people, 'M', 'Steel or ceramic burrs on the hand grinder?', 'product_question', 'low', 'new', null, interval '40 minutes', null, $j$[
    {"a":"c","at":0,"b":"Does the hand coffee grinder use steel or ceramic burrs? The product page doesn't say, and I'm deciding between it and another model."}
  ]$j$::jsonb);

  -- Other customers --------------------------------------------------------------
  perform private.seed_ticket(v_people, 'I', 'Refund not received after return', 'returns_refunds', 'high', 'in_progress', 'T', interval '1 day 2 hours', 'HB-39120', $j$[
    {"a":"c","at":0,"b":"I sent back the linen duvet cover two weeks ago and tracking shows you received it on the 3rd. I still haven't seen the refund."},
    {"a":"T","at":290,"b":"Hi Inês, thanks for your patience. Your return was received and inspected, but the refund got held in a manual review queue. I've escalated it to our payments team today."},
    {"a":"T","at":295,"n":true,"b":"Refund held because the return weight was flagged. Weight matches the product spec, so it's a false positive. Asked Priya to approve manually."},
    {"a":"P","at":360,"n":true,"b":"Approved. Should post within 48 hours."}
  ]$j$::jsonb);

  perform private.seed_ticket(v_people, 'B', 'Order stuck in processing for a week', 'order_delivery', 'urgent', 'new', null, interval '35 minutes', 'HB-40602', $j$[
    {"a":"c","at":0,"b":"Order HB-40602 has said processing for seven days. I need these boots for a trip on Friday. Can someone tell me what's going on?"}
  ]$j$::jsonb);

  perform private.seed_ticket(v_people, 'H', 'Promo code WELCOME15 not applying at checkout', 'payments', 'normal', 'new', null, interval '3 hours', null, $j$[
    {"a":"c","at":0,"b":"The WELCOME15 code from your newsletter says it isn't valid for items in my basket. I only have a cast iron skillet in there, and it isn't on sale."}
  ]$j$::jsonb);

  perform private.seed_ticket(v_people, 'G', 'Locked out after changing my email', 'account', 'high', 'waiting_on_customer', 'J', interval '6 hours', null, $j$[
    {"a":"c","at":0,"b":"I updated my account email yesterday and now I can't log in with either address. The reset link never arrives."},
    {"a":"J","at":44,"b":"Hi Grace, the email change is still waiting on confirmation from your new address, which is why neither login works yet. I've resent the confirmation link. Could you check your spam folder and let me know if it arrives in the next 10 minutes?"}
  ]$j$::jsonb);

  perform private.seed_ticket(v_people, 'O', 'Kettle arrived dented', 'returns_refunds', 'normal', 'in_progress', 'T', interval '4 hours', 'HB-40455', $j$[
    {"a":"c","at":0,"b":"The stovetop kettle arrived with a dent in the side. The box looked fine, so I think it happened before it was packed."},
    {"a":"T","at":120,"b":"Hi Oliver, sorry about that, it definitely shouldn't arrive like that. I'm checking whether we have the same colour in stock for a replacement, or if you'd prefer a refund."},
    {"a":"T","at":124,"n":true,"b":"Charcoal is out of stock until the 28th. Offer a replacement in Sage or a full refund."}
  ]$j$::jsonb);

  perform private.seed_ticket(v_people, 'L', 'How do I delete my account?', 'account', 'low', 'resolved', 'P', interval '12 days 2 hours', null, $j$[
    {"a":"c","at":0,"b":"I'd like to delete my account and any saved payment details."},
    {"a":"P","at":200,"b":"Hi Leah, I've removed your saved card and submitted the account deletion. It completes within 30 days, and you'll get an email confirmation when it's done."},
    {"a":"c","at":260,"b":"Thanks, appreciate it."}
  ]$j$::jsonb);

  perform private.seed_ticket(v_people, 'B', 'Warranty claim for desk lamp', 'product_question', 'normal', 'resolved', 'J', interval '16 days 5 hours', 'HB-35521', $j$[
    {"a":"c","at":0,"b":"My desk lamp stopped turning on after seven months. Is that covered?"},
    {"a":"J","at":300,"b":"Hi Marcus, yes, the lamp has a two-year warranty. I've created a replacement order for you, HB-36014. There's no need to send the old one back."},
    {"a":"c","at":1600,"b":"Replacement arrived today. Great service."}
  ]$j$::jsonb);

  perform private.seed_ticket(v_people, 'I', 'Gift card balance shows $0', 'payments', 'high', 'resolved', 'T', interval '26 days 3 hours', null, $j$[
    {"a":"c","at":0,"b":"I redeemed a $50 gift card last month, but my balance shows $0 and I haven't used it."},
    {"a":"T","at":310,"b":"Hi Inês, the card was applied to your account twice by mistake, which reset it. I've restored the $50 balance, and you should see it under Account, Gift cards now."},
    {"a":"c","at":380,"b":"I can see it. Thank you!"}
  ]$j$::jsonb);

  perform private.seed_ticket(v_people, 'H', 'Parcel delivered to the wrong house', 'order_delivery', 'high', 'resolved', 'J', interval '7 days 8 hours', 'HB-38877', $j$[
    {"a":"c","at":0,"b":"The tracking photo shows my parcel at a door that isn't mine. It's a different house number."},
    {"a":"J","at":61,"b":"Hi Hana, I've looked at the photo and agree it's the wrong door. I've reshipped your order with priority delivery at no charge and filed a claim with the courier."},
    {"a":"J","at":63,"n":true,"b":"Reship HB-38877-R created. Courier claim filed."},
    {"a":"c","at":1500,"b":"The new one arrived this morning, thanks."}
  ]$j$::jsonb);

  perform private.seed_ticket(v_people, 'G', 'Do the trail runners run small?', 'product_question', 'low', 'resolved', 'T', interval '18 days 1 hour', null, $j$[
    {"a":"c","at":0,"b":"Reviews say the trail runners run small. Should I size up half a size?"},
    {"a":"T","at":400,"b":"Hi Grace, most customers go up half a size, especially with thicker socks. Exchanges are free within 60 days if the fit isn't right."},
    {"a":"c","at":500,"b":"Great, I'll order a 7.5 then."}
  ]$j$::jsonb);

  perform private.seed_ticket(v_people, 'O', 'Subscription renewed without a reminder', 'payments', 'normal', 'waiting_on_customer', 'P', interval '1 day 6 hours', null, $j$[
    {"a":"c","at":0,"b":"My coffee subscription renewed for another six months and I didn't get a reminder email first. I'd like to cancel and get a refund."},
    {"a":"P","at":180,"b":"Hi Oliver, I'm sorry the reminder didn't reach you. I can cancel and refund the renewal in full. Could you confirm the last four digits of the card it was charged to, so I can match the payment?"},
    {"a":"P","at":183,"n":true,"b":"Subscription reminder emails failed between the 4th and the 9th (known incident). Refund without friction."}
  ]$j$::jsonb);

  perform private.seed_ticket(v_people, 'L', 'Teapot missing from my order', 'order_delivery', 'normal', 'in_progress', 'J', interval '20 hours', 'HB-40211', $j$[
    {"a":"c","at":0,"b":"My order had three items, but only the mugs and the tea towels arrived. The teapot is missing and the packing slip lists it."},
    {"a":"J","at":230,"b":"Hi Leah, thanks for checking the slip. The teapot shipped separately from a different warehouse, and its tracking shows it's out for delivery today. If it hasn't arrived by tomorrow, reply here and I'll send a replacement."},
    {"a":"c","at":300,"b":"Ah, okay. I didn't get a second tracking email. I'll watch for it."}
  ]$j$::jsonb);

  perform private.seed_ticket(v_people, 'B', 'Save button does nothing on a second address', 'account', 'low', 'new', null, interval '9 hours', null, $j$[
    {"a":"c","at":0,"b":"When I try to save a second address in my account settings, the Save button does nothing. I've tried Chrome and Safari."}
  ]$j$::jsonb);

  perform private.seed_ticket(v_people, 'I', 'Are sale items returnable?', 'returns_refunds', 'low', 'resolved', 'P', interval '29 days 2 hours', null, $j$[
    {"a":"c","at":0,"b":"Are items bought in the summer sale returnable?"},
    {"a":"P","at":350,"b":"Hi Inês, yes. Sale items follow the same 60-day return window. The only exception is final clearance items, which are marked on the product page."}
  ]$j$::jsonb);

  perform private.seed_ticket(v_people, 'H', 'Payment declined but money left my account', 'payments', 'urgent', 'resolved', 'T', interval '14 days 7 hours', 'HB-36780', $j$[
    {"a":"c","at":0,"b":"Checkout said my payment was declined, but the money has left my account. Did the order go through?"},
    {"a":"T","at":27,"b":"Hi Hana, the order didn't complete, so what you're seeing is a temporary hold from your bank. It's released automatically, usually within 72 hours. If you'd like, I can place the order for you now with the same items and price."},
    {"a":"c","at":60,"b":"Yes please, same items."},
    {"a":"T","at":80,"b":"Done. Your new order is HB-36791, and a confirmation email is on its way."}
  ]$j$::jsonb);

  perform private.seed_ticket(v_people, 'G', 'Parcel left out in the rain', 'order_delivery', 'normal', 'resolved', 'J', interval '4 days 5 hours', 'HB-39460', $j$[
    {"a":"c","at":0,"b":"My parcel was left on the doorstep in heavy rain and the box was soaked. The contents seem okay, but the throw blanket is damp."},
    {"a":"J","at":530,"b":"Hi Grace, sorry about that. I've passed this to the courier with the delivery details. If the blanket shows any damage once it's dry, reply here and I'll replace it."},
    {"a":"c","at":2000,"b":"It dried out fine. Thanks for raising it with them."}
  ]$j$::jsonb);

  perform private.seed_ticket(v_people, 'O', 'Phone number field is greyed out', 'account', 'low', 'resolved', 'T', interval '24 days 4 hours', null, $j$[
    {"a":"c","at":0,"b":"How do I change the phone number on my account? The field is greyed out."},
    {"a":"T","at":500,"b":"Hi Oliver, phone numbers are locked while an order is in transit. Your last order was delivered today, so the field is editable again now."}
  ]$j$::jsonb);

  -- Canned responses ------------------------------------------------------------
  insert into public.canned_responses (agent_id, title, body, created_at)
  values
    ((v_people ->> 'T')::uuid, 'Courier trace opened', 'Hi {first_name}, I''ve opened a trace with the courier for this delivery. They usually reply within one business day, and I''ll update you here as soon as I hear back.', now() - interval '90 days'),
    ((v_people ->> 'T')::uuid, 'Refund confirmed', 'Hi {first_name}, your refund has been processed. It can take 3 to 5 business days to appear on your statement, depending on your bank.', now() - interval '84 days'),
    ((v_people ->> 'T')::uuid, 'Need the order number', 'Hi {first_name}, thanks for getting in touch. Could you reply with your order number? It starts with HB and is in your confirmation email.', now() - interval '80 days'),
    ((v_people ->> 'J')::uuid, 'Exchange label sent', 'Hi {first_name}, I''ve emailed you a prepaid return label. Once the courier scans your parcel, we''ll ship the replacement straight away.', now() - interval '70 days'),
    ((v_people ->> 'J')::uuid, 'Closing check-in', 'Hi {first_name}, I''m going to mark this as resolved. If anything else comes up, just reply here and the ticket will reopen.', now() - interval '65 days'),
    ((v_people ->> 'P')::uuid, 'Account deletion', 'Hi {first_name}, I''ve submitted your account deletion. It completes within 30 days, and you''ll receive an email confirmation when it''s done.', now() - interval '60 days');

  insert into private.demo_clock (id, anchored_at) values (true, now())
  on conflict (id) do update set anchored_at = excluded.anchored_at;
end;
$fn$;

-- Shift every demo timestamp forward by the time elapsed since the last anchor,
-- so the fixture always reads as recent activity with the same SLA mix.
create function private.rebase_demo_clock()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_shift interval;
begin
  select now() - anchored_at into v_shift from private.demo_clock where id;
  if v_shift is null or v_shift <= interval '0' then
    return;
  end if;

  perform set_config('harborline.seeding', 'on', true);

  update public.tickets
  set created_at = created_at + v_shift,
      updated_at = updated_at + v_shift,
      first_response_at = first_response_at + v_shift,
      resolved_at = resolved_at + v_shift;
  update public.ticket_messages set created_at = created_at + v_shift;
  update public.ticket_attachments set created_at = created_at + v_shift;
  update public.ticket_status_events set created_at = created_at + v_shift;
  update public.canned_responses set created_at = created_at + v_shift;

  update private.demo_clock set anchored_at = now() where id;
end;
$$;

revoke all on table private.demo_clock from public, anon, authenticated;
revoke all on function private.seed_ticket(jsonb, text, text, public.ticket_category, public.ticket_priority, public.ticket_status, text, interval, text, jsonb) from public, anon, authenticated;
revoke all on function private.reseed_demo() from public, anon, authenticated;
revoke all on function private.rebase_demo_clock() from public, anon, authenticated;
revoke all on function private.tickets_before_update() from public, anon, authenticated;
revoke all on function private.log_ticket_status() from public, anon, authenticated;
revoke all on function private.on_ticket_message_insert() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('harborline-demo-rebase', '0 4 * * *', $$select private.rebase_demo_clock()$$);
