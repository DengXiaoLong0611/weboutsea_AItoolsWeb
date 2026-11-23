insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pet-portraits', 'pet-portraits', false, 10485760, array['image/jpeg'])
on conflict (id) do nothing;

create table public.pet_portrait_attempts (
  visitor uuid not null,
  scene text not null check (scene in ('studio', 'coast', 'home')),
  reference_key text not null,
  created_at timestamptz not null default now(),
  primary key (visitor, scene)
);
create index pet_portrait_attempts_created_at_idx on public.pet_portrait_attempts (created_at);
alter table public.pet_portrait_attempts enable row level security;
revoke all on public.pet_portrait_attempts from anon, authenticated;

create function public.reserve_pet_portrait(p_visitor uuid, p_scene text, p_daily_limit integer, p_reference_key text)
returns boolean language plpgsql set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(208104524);
  if (select count(*) from public.pet_portrait_attempts where created_at >=
      (pg_catalog.date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')) >= p_daily_limit then
    return false;
  end if;
  if exists (select 1 from public.pet_portrait_attempts where visitor = p_visitor and reference_key <> p_reference_key) then
    return false;
  end if;
  insert into public.pet_portrait_attempts (visitor, scene, reference_key) values (p_visitor, p_scene, p_reference_key)
  on conflict do nothing;
  return found;
end;
$$;
revoke all on function public.reserve_pet_portrait(uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.reserve_pet_portrait(uuid, text, integer, text) to service_role;
grant select, insert, delete on public.pet_portrait_attempts to service_role;

create table public.pet_portrait_receipts (
  checkout_id text primary key,
  visitor uuid not null,
  scenes text[] not null,
  created_at timestamptz not null default now()
);
create index pet_portrait_receipts_visitor_idx on public.pet_portrait_receipts (visitor);
alter table public.pet_portrait_receipts enable row level security;
revoke all on public.pet_portrait_receipts from anon, authenticated;
grant select, insert on public.pet_portrait_receipts to service_role;
