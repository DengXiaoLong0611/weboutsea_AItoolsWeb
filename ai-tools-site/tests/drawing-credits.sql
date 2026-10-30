-- Run only against a disposable database with the migration applied.
-- All fixture rows are rolled back. Never run against a live production ledger.
begin;
do $$
declare
  guest uuid := gen_random_uuid();
  other_guest uuid := gen_random_uuid();
  account uuid := gen_random_uuid();
  other_account uuid := gen_random_uuid();
  pending_guest uuid := gen_random_uuid();
  info jsonb;
  reservation uuid;
  second_reservation uuid;
  i integer;
begin
  insert into auth.users(id, email) values (account, 'quota-test@example.test'), (other_account, 'quota-test2@example.test');
  info := public.drawing_status(guest, null);
  assert (info->>'freeRemaining')::integer = 1, 'guest starts with one';
  info := public.drawing_reserve(guest, null);
  reservation := (info->>'reservation')::uuid;
  assert reservation is not null, 'guest can reserve';
  assert public.drawing_reserve(guest, null)->>'reason' = 'busy', 'concurrent guest rejected';
  perform public.drawing_settle(reservation, false);
  perform public.drawing_settle(reservation, false);
  assert (public.drawing_status(guest, null)->>'freeRemaining')::integer = 1, 'refund is idempotent';
  reservation := (public.drawing_reserve(guest, null)->>'reservation')::uuid;
  perform public.drawing_settle(reservation, true);
  assert public.drawing_reserve(guest, null)->>'reason' = 'login', 'second anonymous attempt requires login';
  assert (public.drawing_status(guest, account)->>'freeRemaining')::integer = 1, 'guest usage transfers';
  assert (public.drawing_status(guest, account)->>'freeRemaining')::integer = 1, 'binding transfers once';
  reservation := (public.drawing_reserve(guest, account)->>'reservation')::uuid;
  assert public.drawing_reserve(other_guest, account)->>'reason' = 'busy', 'cross-device concurrent use rejected';
  perform public.drawing_settle(reservation, true);
  assert public.drawing_reserve(other_guest, account)->>'reason' = 'payment', 'third generation requires payment';
  assert public.drawing_reserve(other_guest, null)->>'reason' = 'login', 'logout cannot claim guest credit';
  assert (public.drawing_status(other_guest, other_account)->>'freeRemaining')::integer = 2, 'separate account starts with two';
  reservation := (public.drawing_reserve(other_guest, other_account)->>'reservation')::uuid;
  perform public.drawing_settle(reservation, false);
  assert (public.drawing_status(other_guest, other_account)->>'freeRemaining')::integer = 2, 'account failure refunds';
  reservation := (public.drawing_reserve(pending_guest, null)->>'reservation')::uuid;
  perform public.drawing_status(pending_guest, other_account);
  assert public.drawing_reserve(other_guest, other_account)->>'reason' = 'busy', 'guest pending work follows linked account';
  perform public.drawing_settle(reservation, false);
  assert (public.drawing_status(pending_guest, other_account)->>'freeRemaining')::integer = 2, 'refund after binding restores account';
  reservation := (public.drawing_reserve(other_guest, other_account)->>'reservation')::uuid;
  perform public.drawing_settle(reservation, true);
  second_reservation := (public.drawing_reserve(other_guest, other_account)->>'reservation')::uuid;
  perform public.drawing_settle(second_reservation, true);
  assert public.drawing_reserve(other_guest, other_account)->>'reason' = 'payment', 'direct login gets exactly two';
  update public.drawing_accounts set paid_credits = 1 where user_id = other_account;
  reservation := (public.drawing_reserve(other_guest, other_account)->>'reservation')::uuid;
  perform public.drawing_settle(reservation, false);
  perform public.drawing_settle(reservation, false);
  assert (public.drawing_status(other_guest, other_account)->>'paidRemaining')::integer = 1, 'paid refund is idempotent';
  assert not has_function_privilege('anon', 'public.drawing_reserve(uuid,uuid)', 'execute'), 'anon cannot mint credits';
  assert not has_function_privilege('authenticated', 'public.drawing_settle(uuid,boolean)', 'execute'), 'user cannot refund credits';
  assert has_function_privilege('service_role', 'public.drawing_reserve(uuid,uuid)', 'execute'), 'server can reserve';
  -- Three guest attempts above (two original + pending). Fill the daily ceiling.
  for i in 1..17 loop
    reservation := (public.drawing_reserve(gen_random_uuid(), null)->>'reservation')::uuid;
    assert reservation is not null, 'within daily ceiling';
    perform public.drawing_settle(reservation, true);
  end loop;
  assert public.drawing_reserve(gen_random_uuid(), null)->>'reason' = 'unavailable', 'anonymous daily cap';
  raise notice 'All drawing credit SQL assertions passed';
end;
$$;
rollback;
