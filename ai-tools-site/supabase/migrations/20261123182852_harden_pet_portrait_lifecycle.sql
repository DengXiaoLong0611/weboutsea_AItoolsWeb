-- Apply after 20261123182840. All RPCs are service-role only.
begin;
create table public.pet_portrait_deleted_visitors (
  visitor uuid primary key, created_at timestamptz not null default now()
);
create table public.pet_portrait_provider_calls (
  id bigint generated always as identity primary key,
  visitor uuid not null, job_id uuid not null,
  created_at timestamptz not null default now()
);
create index on public.pet_portrait_provider_calls (created_at);
create table public.pet_portrait_refunds (
  payment_intent text primary key, amount_refunded integer not null check (amount_refunded > 0),
  updated_at timestamptz not null default now()
);
-- Refund records remain independent of delivery webhook order.
alter table public.pet_portrait_receipts add column payment_intent text;
alter table public.pet_portrait_order_items add column payment_intent text;
alter table public.pet_portrait_jobs
  add column prompt text,
  add column prompt_version integer,
  add column model text,
  add column parameters jsonb,
  add column usage jsonb,
  add column provider_image_url text;
alter table public.pet_portrait_jobs drop constraint pet_portrait_jobs_status_check;
alter table public.pet_portrait_jobs add constraint pet_portrait_jobs_status_check
  check (status in ('uploading','queued','processing','completed','failed'));
create index on public.pet_portrait_jobs (status, expires_at);

create function public.create_pet_portrait_job(
  p_id uuid, p_visitor uuid, p_scene text, p_key text, p_reference text,
  p_prompt text, p_version integer, p_model text, p_parameters jsonb, p_expires timestamptz, p_daily_limit integer
) returns setof public.pet_portrait_jobs language plpgsql set search_path = '' as $$
declare v_job public.pet_portrait_jobs;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_visitor::text, 42));
  if exists(select 1 from public.pet_portrait_deleted_visitors where visitor=p_visitor) then return; end if;
  select * into v_job from public.pet_portrait_jobs where visitor=p_visitor and idempotency_key=p_key;
  if found then
    if v_job.scene <> p_scene or v_job.reference_key <> p_reference then return; end if;
    return next v_job; return;
  end if;
  if not public.reserve_pet_portrait(p_visitor,p_scene,p_daily_limit,p_reference) then return; end if;
  insert into public.pet_portrait_jobs(id,visitor,scene,idempotency_key,reference_key,status,prompt,prompt_version,model,parameters,expires_at)
  values(p_id,p_visitor,p_scene,p_key,p_reference,'uploading',p_prompt,p_version,p_model,p_parameters,p_expires)
  returning * into v_job;
  return next v_job;
end; $$;

create function public.claim_pet_portrait_job(p_id uuid,p_visitor uuid,p_daily_limit integer)
returns setof public.pet_portrait_jobs language plpgsql set search_path = '' as $$
declare v_job public.pet_portrait_jobs;
begin
  -- Shared lock also covers retries, so retries cannot bypass the global generation budget.
  perform pg_catalog.pg_advisory_xact_lock(208104524);
  if exists(select 1 from public.pet_portrait_deleted_visitors where visitor=p_visitor) then return; end if;
  select * into v_job from public.pet_portrait_jobs where id=p_id and visitor=p_visitor
    and status='queued' and expires_at>now() for update;
  if not found then return; end if;
  if v_job.provider_image_url is null then
    if (select count(*) from public.pet_portrait_provider_calls where created_at >=
      (pg_catalog.date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')) >= p_daily_limit then return; end if;
    insert into public.pet_portrait_provider_calls(visitor,job_id) values(p_visitor,p_id);
  end if;
  update public.pet_portrait_jobs set status='processing',started_at=now(),error_code=null
    where id=p_id returning * into v_job;
  return next v_job;
end; $$;

create function public.retry_pet_portrait_job(p_id uuid,p_visitor uuid)
returns setof public.pet_portrait_jobs language sql set search_path = '' as $$
  update public.pet_portrait_jobs set status='queued',retry_count=retry_count+1,error_code=null,started_at=null,completed_at=null
  where id=p_id and visitor=p_visitor and status='failed' and retry_count<3 and expires_at>now()
    and error_code in ('provider_rejected','delivery')
    and not exists(select 1 from public.pet_portrait_deleted_visitors where visitor=p_visitor)
  returning *;
$$;

create function public.paid_pet_portrait_scenes(p_visitor uuid)
returns table(scene text) language sql stable set search_path = '' as $$
  select distinct i.scene from public.pet_portrait_order_items i
  where i.visitor=p_visitor and i.status='paid'
    and not exists(select 1 from public.pet_portrait_deleted_visitors where visitor=p_visitor)
    and not exists(select 1 from public.pet_portrait_refunds r where r.payment_intent=i.payment_intent);
$$;

create function public.settle_pet_portrait_payment(p_checkout text,p_visitor uuid,p_scenes text[],p_amount integer,p_intent text)
returns void language plpgsql set search_path = '' as $$
declare n integer; i integer; v_status text; v_unit integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_checkout, 91));
  if exists(select 1 from public.pet_portrait_deleted_visitors where visitor=p_visitor) then return; end if;
  n:=cardinality(p_scenes);
  if n not between 1 and 3 or p_amount <> (array[1300,2000,2300])[n] then raise exception 'invalid amount'; end if;
  if (select count(distinct x) from unnest(p_scenes) x)<>n then raise exception 'duplicate scenes'; end if;
  insert into public.pet_portrait_receipts(checkout_id,visitor,scenes,payment_intent)
  values(p_checkout,p_visitor,p_scenes,p_intent) on conflict(checkout_id) do nothing;
  if exists(select 1 from public.pet_portrait_receipts where checkout_id=p_checkout and
    (visitor<>p_visitor or scenes<>p_scenes)) then raise exception 'receipt mismatch'; end if;
  v_status:=case when exists(select 1 from public.pet_portrait_refunds where payment_intent=p_intent) then 'refunded' else 'paid' end;
  for i in 1..n loop
    v_unit:=case i when 1 then 1300 when 2 then 700 else 300 end;
    insert into public.pet_portrait_order_items(checkout_id,visitor,scene,status,amount_cents,payment_intent)
    values(p_checkout,p_visitor,p_scenes[i],v_status,v_unit,p_intent)
    on conflict(checkout_id,scene) do update set
      status=case when pet_portrait_order_items.status='refunded' then 'refunded' else excluded.status end,
      payment_intent=excluded.payment_intent,updated_at=now();
  end loop;
end; $$;

alter table public.pet_portrait_deleted_visitors enable row level security;
revoke all on public.pet_portrait_deleted_visitors from public,anon,authenticated;
grant select,insert,update,delete on public.pet_portrait_deleted_visitors to service_role;

alter table public.pet_portrait_provider_calls enable row level security;
revoke all on public.pet_portrait_provider_calls from public,anon,authenticated;
grant select,insert,update,delete on public.pet_portrait_provider_calls to service_role;

alter table public.pet_portrait_refunds enable row level security;
revoke all on public.pet_portrait_refunds from public,anon,authenticated;
grant select,insert,update,delete on public.pet_portrait_refunds to service_role;
grant usage, select on sequence public.pet_portrait_provider_calls_id_seq to service_role;

revoke all on function public.create_pet_portrait_job(uuid,uuid,text,text,text,text,integer,text,jsonb,timestamptz,integer) from public,anon,authenticated;
grant execute on function public.create_pet_portrait_job(uuid,uuid,text,text,text,text,integer,text,jsonb,timestamptz,integer) to service_role;

revoke all on function public.claim_pet_portrait_job(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_pet_portrait_job(uuid,uuid,integer) to service_role;

revoke all on function public.retry_pet_portrait_job(uuid,uuid) from public,anon,authenticated;
grant execute on function public.retry_pet_portrait_job(uuid,uuid) to service_role;

revoke all on function public.paid_pet_portrait_scenes(uuid) from public,anon,authenticated;
grant execute on function public.paid_pet_portrait_scenes(uuid) to service_role;

revoke all on function public.settle_pet_portrait_payment(text,uuid,text[],integer,text) from public,anon,authenticated;
grant execute on function public.settle_pet_portrait_payment(text,uuid,text[],integer,text) to service_role;

create table public.pet_portrait_recovery_links (
  token_hash text primary key, visitor uuid not null unique,
  expires_at timestamptz not null, created_at timestamptz not null default now()
);
alter table public.pet_portrait_recovery_links enable row level security;
revoke all on public.pet_portrait_recovery_links from public,anon,authenticated;
grant select,insert,update,delete on public.pet_portrait_recovery_links to service_role;
create function public.restore_pet_portrait_gallery(p_hash text)
returns table(visitor uuid) language sql stable set search_path = '' as $$
  select l.visitor from public.pet_portrait_recovery_links l
  where token_hash=p_hash and expires_at>now()
    and exists(select 1 from public.paid_pet_portrait_scenes(l.visitor));
$$;
revoke all on function public.restore_pet_portrait_gallery(text) from public,anon,authenticated;
grant execute on function public.restore_pet_portrait_gallery(text) to service_role;

commit;
