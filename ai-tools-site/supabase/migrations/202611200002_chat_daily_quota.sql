begin;

-- Additive: the previous trial ledger is preserved but no longer used by the app.
create table public.chat_daily_buckets (
  identity text not null,
  day date not null,
  used integer not null default 0 check (used between 0 and 20),
  primary key (identity, day)
);
create table public.chat_daily_reservations (
  id uuid primary key default gen_random_uuid(),
  identity text not null,
  day date not null,
  state text not null default 'pending' check (state in ('pending', 'succeeded', 'refunded')),
  expires_at timestamptz not null default now() + interval '3 minutes',
  foreign key (identity, day) references public.chat_daily_buckets(identity, day)
);
create index chat_daily_pending on public.chat_daily_reservations(identity, day, expires_at) where state = 'pending';
create table public.chat_network_limits (
  network text primary key,
  window_start timestamptz not null,
  used integer not null
);
alter table public.chat_daily_buckets enable row level security;
alter table public.chat_daily_reservations enable row level security;
alter table public.chat_network_limits enable row level security;
revoke all on public.chat_daily_buckets, public.chat_daily_reservations, public.chat_network_limits from public, anon, authenticated;

create function public.chat_daily_status(p_identity text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d date := (now() at time zone 'UTC')::date;
  expired integer;
  n integer;
begin
  if p_identity is null or p_identity !~ '^(guest|user):[a-f0-9-]{36}$' then
    raise exception 'Invalid identity';
  end if;
  insert into public.chat_daily_buckets(identity, day) values(p_identity, d) on conflict do nothing;
  perform 1 from public.chat_daily_buckets where identity = p_identity and day = d for update;
  update public.chat_daily_reservations set state = 'refunded'
    where identity = p_identity and day = d and state = 'pending' and expires_at <= now();
  get diagnostics expired = row_count;
  update public.chat_daily_buckets set used = greatest(0, used - expired)
    where identity = p_identity and day = d returning used into n;
  return jsonb_build_object('remaining', 20 - n, 'limit', 20,
    'resetsAt', (d + 1)::timestamp at time zone 'UTC',
    'busy', exists(select 1 from public.chat_daily_reservations where identity = p_identity and day = d and state = 'pending'));
end;
$$;

create function public.chat_daily_reserve(p_identity text, p_network text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s jsonb; r uuid; network_used integer; d date := (now() at time zone 'UTC')::date;
begin
  s := public.chat_daily_status(p_identity);
  if (s->>'busy')::boolean then return jsonb_build_object('reason', 'busy'); end if;
  if (s->>'remaining')::integer <= 0 then return jsonb_build_object('reason', 'exhausted'); end if;
  if p_network is null or p_network !~ '^[a-f0-9]{64}$' then raise exception 'Invalid network'; end if;
  -- Shared between all instances and visitor cookies. Store only an HMAC of the address.
  insert into public.chat_network_limits(network, window_start, used)
    values(p_network, date_trunc('minute', now()), 1)
    on conflict(network) do update set
      used = case when chat_network_limits.window_start = date_trunc('minute', now()) then chat_network_limits.used + 1 else 1 end,
      window_start = date_trunc('minute', now())
    returning used into network_used;
  if network_used > 15 then return jsonb_build_object('reason', 'rate_limited'); end if;
  update public.chat_daily_buckets set used = used + 1 where identity = p_identity and day = d;
  insert into public.chat_daily_reservations(identity, day) values(p_identity, d) returning id into r;
  return jsonb_build_object('reservation', r);
end;
$$;

create function public.chat_daily_settle(p_reservation uuid, p_success boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.chat_daily_reservations;
begin
  if p_success is null then raise exception 'Missing outcome'; end if;
  select * into r from public.chat_daily_reservations where id = p_reservation;
  if not found then raise exception 'Unknown reservation'; end if;
  -- Same lock ordering as reserve/status; never use a global lock.
  perform 1 from public.chat_daily_buckets where identity = r.identity and day = r.day for update;
  select * into r from public.chat_daily_reservations where id = p_reservation for update;
  if r.state <> 'pending' then return jsonb_build_object('settled', true); end if;
  if not p_success then
    update public.chat_daily_buckets set used = greatest(0, used - 1) where identity = r.identity and day = r.day;
  end if;
  update public.chat_daily_reservations set state = case when p_success then 'succeeded' else 'refunded' end where id = r.id;
  return jsonb_build_object('settled', true);
end;
$$;

revoke all on function public.chat_daily_status(text) from public, anon, authenticated;
revoke all on function public.chat_daily_reserve(text, text) from public, anon, authenticated;
revoke all on function public.chat_daily_settle(uuid, boolean) from public, anon, authenticated;
grant execute on function public.chat_daily_status(text) to service_role;
grant execute on function public.chat_daily_reserve(text, text) to service_role;
grant execute on function public.chat_daily_settle(uuid, boolean) to service_role;
commit;
