create table public.public_notes (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  image_url text check (char_length(image_url) <= 1500 and image_url like 'https://%')
);

alter table public.public_notes enable row level security;
revoke all on table public.public_notes from public, anon, authenticated;
grant select on table public.public_notes to anon, authenticated;
grant insert on table public.public_notes to service_role;

create policy "Anyone can read published notes"
  on public.public_notes for select to anon, authenticated using (true);
