-- Run in the Supabase SQL editor. Private tables and service-role-only RPC.
begin;
create table if not exists public.drawing_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  free_used integer not null default 0 check (free_used >= 0),
  paid_credits integer not null default 0 check (paid_credits >= 0)
);
create table if not exists public.drawing_visitors (
  id uuid primary key,
  account_id uuid references public.drawing_accounts(user_id) on delete set null,
  free_used integer not null default 0 check (free_used between 0 and 1)
);
create table if not exists public.drawing_reservations (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.drawing_visitors(id),
  user_id uuid references public.drawing_accounts(user_id) on delete set null,
  kind text not null check (kind in ('guest', 'free', 'paid')),
  state text not null default 'pending' check (state in ('pending', 'succeeded', 'refunded')),
  created_at timestamptz not null default now()
);
create index if not exists drawing_reservations_visitor on public.drawing_reservations(visitor_id, created_at);
create index if not exists drawing_reservations_user on public.drawing_reservations(user_id, created_at);
create index if not exists drawing_reservations_guest_day on public.drawing_reservations(created_at) where kind = 'guest';
alter table public.drawing_accounts enable row level security;
alter table public.drawing_visitors enable row level security;
alter table public.drawing_reservations enable row level security;
revoke all on public.drawing_accounts, public.drawing_visitors, public.drawing_reservations from anon, authenticated;

create or replace function public.drawing_status(p_visitor uuid, p_user uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v public.drawing_visitors;
  a public.drawing_accounts;
  is_busy boolean;
begin
  -- One short global transaction lock orders binding, reservation and settlement.
  -- This lock is released before the external image request starts.
  perform pg_advisory_xact_lock(73003001);
  insert into public.drawing_visitors(id) values (p_visitor) on conflict do nothing;
  select * into v from public.drawing_visitors where id = p_visitor;
  if p_user is not null then
    insert into public.drawing_accounts(user_id) values (p_user) on conflict do nothing;
    if v.account_id is null then
      update public.drawing_accounts set free_used = free_used + v.free_used where user_id = p_user;
      update public.drawing_visitors set account_id = p_user where id = p_visitor;
    end if;
    select * into a from public.drawing_accounts where user_id = p_user;
  end if;
  select exists (
    select 1 from public.drawing_reservations r
    join public.drawing_visitors rv on rv.id = r.visitor_id
    where r.state = 'pending' and r.created_at > now() - interval '5 minutes'
    and (r.visitor_id = p_visitor or (p_user is not null and (r.user_id = p_user or (r.kind = 'guest' and rv.account_id = p_user))))
  ) into is_busy;
  return jsonb_build_object(
    'signedIn', p_user is not null,
    'freeRemaining', case when p_user is not null then greatest(0, 2 - a.free_used)
      when v.account_id is not null then 0 else greatest(0, 1 - v.free_used) end,
    'paidRemaining', coalesce(a.paid_credits, 0), 'busy', is_busy
  );
end;
$$;

create or replace function public.drawing_reserve(p_visitor uuid, p_user uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  info jsonb;
  reservation uuid;
  credit_kind text;
begin
  info := public.drawing_status(p_visitor, p_user);
  if (info->>'busy')::boolean then return jsonb_build_object('reason', 'busy'); end if;
  if p_user is null then
    if (info->>'freeRemaining')::integer < 1 then return jsonb_build_object('reason', 'login'); end if;
    -- Count attempts, including failures, to cap anonymous upstream spending.
    if (select count(*) from public.drawing_reservations where kind = 'guest'
      and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') >= 20 then
      return jsonb_build_object('reason', 'unavailable');
    end if;
    update public.drawing_visitors set free_used = free_used + 1 where id = p_visitor;
    credit_kind := 'guest';
  elsif (info->>'freeRemaining')::integer > 0 then
    update public.drawing_accounts set free_used = free_used + 1 where user_id = p_user;
    credit_kind := 'free';
  elsif (info->>'paidRemaining')::integer > 0 then
    update public.drawing_accounts set paid_credits = paid_credits - 1 where user_id = p_user;
    credit_kind := 'paid';
  else
    return jsonb_build_object('reason', 'payment');
  end if;
  insert into public.drawing_reservations(visitor_id, user_id, kind)
    values (p_visitor, p_user, credit_kind) returning id into reservation;
  return jsonb_build_object('reservation', reservation);
end;
$$;

create or replace function public.drawing_settle(p_reservation uuid, p_success boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.drawing_reservations; linked_user uuid;
begin
  if p_success is null then raise exception 'Missing settlement outcome'; end if;
  perform pg_advisory_xact_lock(73003001);
  select * into r from public.drawing_reservations where id = p_reservation;
  if not found then raise exception 'Unknown reservation'; end if;
  if r.state <> 'pending' then return jsonb_build_object('settled', true); end if;
  if not p_success then
    if r.kind = 'guest' then
      update public.drawing_visitors set free_used = greatest(0, free_used - 1) where id = r.visitor_id
        returning account_id into linked_user;
      if linked_user is not null then
        update public.drawing_accounts set free_used = greatest(0, free_used - 1) where user_id = linked_user;
      end if;
    elsif r.kind = 'free' then
      update public.drawing_accounts set free_used = greatest(0, free_used - 1) where user_id = r.user_id;
    else
      update public.drawing_accounts set paid_credits = paid_credits + 1 where user_id = r.user_id;
    end if;
  end if;
  update public.drawing_reservations set state = case when p_success then 'succeeded' else 'refunded' end where id = p_reservation;
  return jsonb_build_object('settled', true);
end;
$$;
revoke all on function public.drawing_status(uuid, uuid) from public, anon, authenticated;
revoke all on function public.drawing_reserve(uuid, uuid) from public, anon, authenticated;
revoke all on function public.drawing_settle(uuid, boolean) from public, anon, authenticated;
grant execute on function public.drawing_status(uuid, uuid) to service_role;
grant execute on function public.drawing_reserve(uuid, uuid) to service_role;
grant execute on function public.drawing_settle(uuid, boolean) to service_role;
commit;
