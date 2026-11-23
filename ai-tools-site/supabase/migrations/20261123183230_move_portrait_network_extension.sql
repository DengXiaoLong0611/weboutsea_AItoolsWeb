-- pg_net is not relocatable. Reinstall only while its new queue is empty.
-- No CASCADE: unexpected dependencies must fail instead of being removed.
begin;
do $$ begin
  if exists(select 1 from net.http_request_queue) or exists(select 1 from net._http_response) then
    raise exception 'pg_net has requests; review before reinstalling';
  end if;
end $$;
drop extension pg_net;
create extension pg_net with schema extensions;
revoke usage on schema net from public,anon,authenticated;
revoke execute on all functions in schema net from public,anon,authenticated;
commit;
