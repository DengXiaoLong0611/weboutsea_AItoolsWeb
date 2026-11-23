-- Supabase Cron avoids the Vercel Hobby daily schedule restriction.
-- Secrets are provisioned separately in Vault; no credentials in migrations.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net;
create schema if not exists portrait_private;
revoke all on schema portrait_private from public, anon, authenticated;

create function portrait_private.dispatch(p_task text)
returns bigint language plpgsql set search_path = '' as $$
declare v_origin text; v_secret text; v_bypass text; v_enabled text; v_headers jsonb;
begin
  if p_task not in ('worker','cleanup') then raise exception 'invalid task'; end if;
  select decrypted_secret into v_enabled from vault.decrypted_secrets where name='portrait_scheduler_enabled';
  if v_enabled is distinct from 'true' then return null; end if;
  -- Do not spend a Vercel invocation when no accepted job needs processing.
  if p_task='worker' and not exists(select 1 from public.pet_portrait_jobs where status='queued' and expires_at>now()) then return null; end if;
  select decrypted_secret into v_origin from vault.decrypted_secrets where name='portrait_scheduler_origin';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='portrait_scheduler_secret';
  select decrypted_secret into v_bypass from vault.decrypted_secrets where name='portrait_scheduler_bypass';
  if v_origin is null or v_origin !~ '^https://[a-z0-9.-]+$' or length(v_secret)<32 or v_secret is null then raise exception 'scheduler configuration missing'; end if;
  v_headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_secret);
  if v_bypass is not null then v_headers:=v_headers||jsonb_build_object('x-vercel-protection-bypass',v_bypass); end if;
  return net.http_post(url:=v_origin||'/api/pet-portrait/'||p_task,body:='{}'::jsonb,headers:=v_headers,timeout_milliseconds:=250000);
end; $$;
revoke all on function portrait_private.dispatch(text) from public,anon,authenticated,service_role;
-- Invoker privileges: cron runs as the installing database administrator.
select cron.schedule('portrait-worker','* * * * *',$job$select portrait_private.dispatch('worker');$job$);
select cron.schedule('portrait-cleanup','17 * * * *',$job$select portrait_private.dispatch('cleanup');$job$);
-- Keep inactive until credentials and production deployment have been verified.
select cron.alter_job(jobid,active:=false) from cron.job where jobname in ('portrait-worker','portrait-cleanup');
commit;
