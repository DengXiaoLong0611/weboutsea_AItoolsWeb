begin;

create table if not exists public.chat_visitors (
  id uuid primary key,
  used integer not null default 0 check (used between 0 and 20),
  busy_until timestamptz not null default '-infinity'
);

create table if not exists public.chat_reservations (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.chat_visitors(id),
  state text not null default 'pending' check (state in ('pending', 'succeeded', 'refunded')),
  created_at timestamptz not null default now()
);

create index if not exists chat_reservations_visitor_created
  on public.chat_reservations(visitor_id, created_at);

alter table public.chat_visitors enable row level security;
alter table public.chat_reservations enable row level security;

revoke all on public.chat_visitors, public.chat_reservations from anon, authenticated;

create or replace function public.chat_status(p_visitor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.chat_visitors;
begin
  insert into public.chat_visitors(id) values (p_visitor) on conflict do nothing;
  select * into v from public.chat_visitors where id = p_visitor;
  return jsonb_build_object(
    'remaining', greatest(0, 20 - v.used),
    'busy', v.busy_until > now()
  );
end;
$$;

create or replace function public.chat_reserve(p_visitor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.chat_visitors; reservation uuid;
begin
  perform pg_advisory_xact_lock(73003002);
  insert into public.chat_visitors(id) values (p_visitor) on conflict do nothing;
  select * into v from public.chat_visitors where id = p_visitor;
  if v.busy_until > now() then
    return jsonb_build_object('reason', 'busy');
  end if;
  if v.used >= 20 then
    return jsonb_build_object('reason', 'exhausted');
  end if;
  update public.chat_visitors
    set used = used + 1, busy_until = now() + interval '5 minutes'
    where id = p_visitor;
  insert into public.chat_reservations(visitor_id)
    values (p_visitor) returning id into reservation;
  return jsonb_build_object('reservation', reservation);
end;
$$;

create or replace function public.chat_settle(p_reservation uuid, p_success boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.chat_reservations;
begin
  if p_success is null then raise exception 'Missing settlement outcome'; end if;
  perform pg_advisory_xact_lock(73003002);
  select * into r from public.chat_reservations where id = p_reservation;
  if not found then raise exception 'Unknown reservation'; end if;
  if r.state <> 'pending' then return jsonb_build_object('settled', true); end if;
  if not p_success then
    update public.chat_visitors
      set used = greatest(0, used - 1)
      where id = r.visitor_id;
  end if;
  update public.chat_visitors set busy_until = '-infinity' where id = r.visitor_id;
  update public.chat_reservations
    set state = case when p_success then 'succeeded' else 'refunded' end
    where id = p_reservation;
  return jsonb_build_object('settled', true);
end;
$$;

revoke all on function public.chat_status(uuid) from public, anon, authenticated;
revoke all on function public.chat_reserve(uuid) from public, anon, authenticated;
revoke all on function public.chat_settle(uuid, boolean) from public, anon, authenticated;

grant execute on function public.chat_status(uuid) to service_role;
grant execute on function public.chat_reserve(uuid) to service_role;
grant execute on function public.chat_settle(uuid, boolean) to service_role;

commit;
