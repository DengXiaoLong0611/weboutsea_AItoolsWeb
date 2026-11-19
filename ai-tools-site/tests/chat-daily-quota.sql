-- Disposable PostgreSQL only. Apply 202611200002_chat_daily_quota.sql first.
begin;
do $$
declare
  guest text := 'guest:' || gen_random_uuid();
  account text := 'user:' || gen_random_uuid();
  net text := repeat('a', 64);
  r uuid; old_r uuid; info jsonb; i integer;
  d date := (now() at time zone 'UTC')::date;
begin
  assert (public.chat_daily_status(guest)->>'remaining')::integer = 20;
  r := (public.chat_daily_reserve(guest, net)->>'reservation')::uuid;
  assert r is not null;
  assert public.chat_daily_reserve(guest, net)->>'reason' = 'busy';
  perform public.chat_daily_settle(r, false);
  perform public.chat_daily_settle(r, false);
  assert (public.chat_daily_status(guest)->>'remaining')::integer = 20, 'idempotent refund';

  r := (public.chat_daily_reserve(guest, net)->>'reservation')::uuid;
  perform public.chat_daily_settle(r, true);
  perform public.chat_daily_settle(r, false);
  assert (public.chat_daily_status(guest)->>'remaining')::integer = 19, 'cannot reverse success';

  old_r := (public.chat_daily_reserve(guest, net)->>'reservation')::uuid;
  update public.chat_daily_reservations set expires_at = now() - interval '1 second' where id = old_r;
  assert (public.chat_daily_status(guest)->>'remaining')::integer = 19, 'stale lease refunded';
  r := (public.chat_daily_reserve(guest, net)->>'reservation')::uuid;
  perform public.chat_daily_settle(old_r, false);
  assert (public.chat_daily_status(guest)->>'busy')::boolean, 'old settlement cannot unlock new request';
  perform public.chat_daily_settle(r, true);

  insert into public.chat_daily_buckets(identity, day, used) values(guest, d - 1, 20);
  insert into public.chat_daily_reservations(identity, day) values(guest, d - 1) returning id into old_r;
  perform public.chat_daily_settle(old_r, false);
  assert (public.chat_daily_status(guest)->>'remaining')::integer = 18, 'yesterday refund never changes today';
  assert (select used = 19 from public.chat_daily_buckets where identity = guest and day = d - 1);

  assert (public.chat_daily_status(account)->>'remaining')::integer = 20, 'separate account allowance';
  for i in 1..20 loop
    r := (public.chat_daily_reserve(account, md5(i::text) || md5(i::text))->>'reservation')::uuid;
    assert r is not null;
    perform public.chat_daily_settle(r, true);
  end loop;
  assert public.chat_daily_reserve(account, net)->>'reason' = 'exhausted';
  assert (public.chat_daily_status(account)->>'resetsAt')::timestamptz = (d + 1)::timestamp at time zone 'UTC';

  for i in 1..16 loop
    info := public.chat_daily_reserve('guest:' || gen_random_uuid(), repeat('b', 64));
    if i <= 15 then assert info->>'reservation' is not null;
    else assert info->>'reason' = 'rate_limited', 'cookie rotation shares network limit'; end if;
  end loop;
  assert not has_function_privilege('anon', 'public.chat_daily_reserve(text,text)', 'execute');
  assert not has_table_privilege('authenticated', 'public.chat_daily_buckets', 'select');
end;
$$;
rollback;
