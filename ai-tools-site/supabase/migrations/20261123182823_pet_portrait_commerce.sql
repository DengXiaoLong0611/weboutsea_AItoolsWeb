alter table public.pet_portrait_attempts drop constraint if exists pet_portrait_attempts_scene_check;
alter table public.pet_portrait_attempts add constraint pet_portrait_attempts_scene_check
  check (length(scene) between 1 and 64);

alter table public.pet_portrait_attempts
  add column if not exists deleted_at timestamptz;

create table if not exists public.pet_portrait_jobs (
  id uuid primary key default gen_random_uuid(),
  visitor uuid not null,
  scene text not null,
  idempotency_key text not null,
  reference_key text not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  provider_request_id text,
  retry_count integer not null default 0 check (retry_count >= 0),
  error_code text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  unique (visitor, idempotency_key)
);

create index if not exists pet_portrait_jobs_visitor_created_idx
  on public.pet_portrait_jobs (visitor, created_at desc);
create index if not exists pet_portrait_jobs_status_idx
  on public.pet_portrait_jobs (status, created_at);

alter table public.pet_portrait_jobs enable row level security;
alter table public.pet_portrait_jobs drop constraint if exists pet_portrait_jobs_scene_check;
alter table public.pet_portrait_jobs add constraint pet_portrait_jobs_scene_check
  check (length(scene) between 1 and 64);
revoke all on public.pet_portrait_jobs from anon, authenticated;
grant select, insert, update, delete on public.pet_portrait_jobs to service_role;

create table if not exists public.pet_portrait_order_items (
  checkout_id text not null,
  visitor uuid not null,
  scene text not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'refunded')),
  amount_cents integer not null default 0 check (amount_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (checkout_id, scene)
);

create index if not exists pet_portrait_order_items_visitor_idx
  on public.pet_portrait_order_items (visitor, created_at desc);
alter table public.pet_portrait_order_items enable row level security;
alter table public.pet_portrait_order_items drop constraint if exists pet_portrait_order_items_scene_check;
alter table public.pet_portrait_order_items add constraint pet_portrait_order_items_scene_check
  check (length(scene) between 1 and 64);
revoke all on public.pet_portrait_order_items from anon, authenticated;
grant select, insert, update, delete on public.pet_portrait_order_items to service_role;

create table if not exists public.pet_portrait_delete_requests (
  id uuid primary key default gen_random_uuid(),
  visitor uuid not null,
  reason text,
  status text not null default 'requested'
    check (status in ('requested', 'processing', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.pet_portrait_delete_requests enable row level security;
revoke all on public.pet_portrait_delete_requests from anon, authenticated;
grant select, insert, update, delete on public.pet_portrait_delete_requests to service_role;
