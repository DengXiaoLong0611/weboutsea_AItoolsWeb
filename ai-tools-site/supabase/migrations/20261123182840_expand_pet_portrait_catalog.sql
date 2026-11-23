-- Expand styles while keeping existing rows, RLS, grants and global daily limits.
begin;
alter table public.pet_portrait_attempts drop constraint pet_portrait_attempts_scene_check;
alter table public.pet_portrait_attempts add constraint pet_portrait_attempts_scene_check
  check (scene in ('attic-window','autumn-bench','balcony-coffee','bay-window','bedside-sunrise','birthday-pair','blanket-hideout','blue-hour-studio','bookcase-corner','botanical-arch','breakfast-nook','cafe-table','camping-door','candle-glow','charcoal-close','cherry-lane','coast','countryside-gate','curtain-breeze','desert-evening','doorway-welcome','fern-path','festive-sofa','fireside-rug','floor-level','garden-boots','hallway-mirror','hands-under-chin','heather-hill','high-key-duo','home','island-garden','ivory-profile','kitchen-stool','kite-meadow','knitted-evening','lake-pier','laundry-day','lavender-path','linen-plinth','low-key-duo','matching-scarves','meadow-dawn','monochrome-bond','mountain-view','moving-day','museum-portrait','new-year-duo','olive-bench','olive-shade','orchard-walk','paint-break','pearl-curtain','pet-armchair','pet-autumn','pet-birthday','pet-blue','pet-books','pet-charcoal','pet-coast','pet-color','pet-forest','pet-garden','pet-holiday','pet-ivory','pet-meadow','pet-monochrome','pet-museum','pet-picnic','pet-profile','pet-pumpkin','pet-quilt','pet-rose','pet-sage','pet-sunroom','pet-terracotta','pet-white','pet-window','photo-booth-duo','picnic-partners','pillow-party','pine-trail','porch-rocker','pumpkin-step','quiet-sunday','quilted-morning','raincoat-pair','rainy-arcade','rainy-reading','record-listening','river-stones','roadtrip-stop','rose-courtyard','rose-shoulder','round-pool-light','rust-linen','sandstone-seat','seaside-boardwalk','seaside-stripes','snowy-cabin','soft-flash','stone-bridge','studio','studio-apartment','sunflower-lane','sunroom-siesta','tea-break','travel-postcard','urban-garden','vinyl-duo','weekend-market','wide-negative-space','wild-grass','window-silhouette','winter-window'));

alter table public.pet_portrait_jobs drop constraint pet_portrait_jobs_scene_check;
alter table public.pet_portrait_jobs add constraint pet_portrait_jobs_scene_check
  check (scene in ('attic-window','autumn-bench','balcony-coffee','bay-window','bedside-sunrise','birthday-pair','blanket-hideout','blue-hour-studio','bookcase-corner','botanical-arch','breakfast-nook','cafe-table','camping-door','candle-glow','charcoal-close','cherry-lane','coast','countryside-gate','curtain-breeze','desert-evening','doorway-welcome','fern-path','festive-sofa','fireside-rug','floor-level','garden-boots','hallway-mirror','hands-under-chin','heather-hill','high-key-duo','home','island-garden','ivory-profile','kitchen-stool','kite-meadow','knitted-evening','lake-pier','laundry-day','lavender-path','linen-plinth','low-key-duo','matching-scarves','meadow-dawn','monochrome-bond','mountain-view','moving-day','museum-portrait','new-year-duo','olive-bench','olive-shade','orchard-walk','paint-break','pearl-curtain','pet-armchair','pet-autumn','pet-birthday','pet-blue','pet-books','pet-charcoal','pet-coast','pet-color','pet-forest','pet-garden','pet-holiday','pet-ivory','pet-meadow','pet-monochrome','pet-museum','pet-picnic','pet-profile','pet-pumpkin','pet-quilt','pet-rose','pet-sage','pet-sunroom','pet-terracotta','pet-white','pet-window','photo-booth-duo','picnic-partners','pillow-party','pine-trail','porch-rocker','pumpkin-step','quiet-sunday','quilted-morning','raincoat-pair','rainy-arcade','rainy-reading','record-listening','river-stones','roadtrip-stop','rose-courtyard','rose-shoulder','round-pool-light','rust-linen','sandstone-seat','seaside-boardwalk','seaside-stripes','snowy-cabin','soft-flash','stone-bridge','studio','studio-apartment','sunflower-lane','sunroom-siesta','tea-break','travel-postcard','urban-garden','vinyl-duo','weekend-market','wide-negative-space','wild-grass','window-silhouette','winter-window'));

alter table public.pet_portrait_order_items drop constraint pet_portrait_order_items_scene_check;
alter table public.pet_portrait_order_items add constraint pet_portrait_order_items_scene_check
  check (scene in ('attic-window','autumn-bench','balcony-coffee','bay-window','bedside-sunrise','birthday-pair','blanket-hideout','blue-hour-studio','bookcase-corner','botanical-arch','breakfast-nook','cafe-table','camping-door','candle-glow','charcoal-close','cherry-lane','coast','countryside-gate','curtain-breeze','desert-evening','doorway-welcome','fern-path','festive-sofa','fireside-rug','floor-level','garden-boots','hallway-mirror','hands-under-chin','heather-hill','high-key-duo','home','island-garden','ivory-profile','kitchen-stool','kite-meadow','knitted-evening','lake-pier','laundry-day','lavender-path','linen-plinth','low-key-duo','matching-scarves','meadow-dawn','monochrome-bond','mountain-view','moving-day','museum-portrait','new-year-duo','olive-bench','olive-shade','orchard-walk','paint-break','pearl-curtain','pet-armchair','pet-autumn','pet-birthday','pet-blue','pet-books','pet-charcoal','pet-coast','pet-color','pet-forest','pet-garden','pet-holiday','pet-ivory','pet-meadow','pet-monochrome','pet-museum','pet-picnic','pet-profile','pet-pumpkin','pet-quilt','pet-rose','pet-sage','pet-sunroom','pet-terracotta','pet-white','pet-window','photo-booth-duo','picnic-partners','pillow-party','pine-trail','porch-rocker','pumpkin-step','quiet-sunday','quilted-morning','raincoat-pair','rainy-arcade','rainy-reading','record-listening','river-stones','roadtrip-stop','rose-courtyard','rose-shoulder','round-pool-light','rust-linen','sandstone-seat','seaside-boardwalk','seaside-stripes','snowy-cabin','soft-flash','stone-bridge','studio','studio-apartment','sunflower-lane','sunroom-siesta','tea-break','travel-postcard','urban-garden','vinyl-duo','weekend-market','wide-negative-space','wild-grass','window-silhouette','winter-window'));

create or replace function public.reserve_pet_portrait(p_visitor uuid, p_scene text, p_daily_limit integer, p_reference_key text)
returns boolean language plpgsql set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(208104524);
  if (select count(*) from public.pet_portrait_attempts where created_at >=
      (pg_catalog.date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')) >= p_daily_limit then
    return false;
  end if;
  -- The catalog can grow without increasing the per-visitor preview allocation.
  if (select count(*) from public.pet_portrait_attempts where visitor = p_visitor) >= 3 then
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


commit;
