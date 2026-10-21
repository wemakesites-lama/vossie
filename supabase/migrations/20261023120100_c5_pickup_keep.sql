-- Phase C5, Task 17 (C4/C5 plan; the controller's ruling after C2): Edit shop keeps a pickup listing on a point the Hub
-- has since retired, as the sample store does (updateShop, lib/data/shops.ts: "A retired point isn't the seller's to
-- remove: a listing on one keeps it", selling amendment 13.6). update_shop moved such a listing to the shop's first
-- point (C2/C3 amendment 13.6, found in C2's Task 8); the sample's behaviour is the rule.
--
-- update_shop is copied from its latest definition (20261020120000_widen.sql) with only that line changed, marked "C5".
-- Its signature and grants are unchanged (create or replace keeps them).

-- Edit shop (updateShop and changeShopSlug; selling spec 2.11, plan decisions 16 and 17), all or nothing, as before:
-- - the details, campus and pickup points; while the shop waits for approval its link follows its name;
-- - its listings follow its campus, and a pickup whose point it no longer uses moves to its first point (in the order
--   given), or online when it has none, unless that point has been retired: then the listing keeps it (C5);
-- - the image: p_photo_id is the new photo (or the current one, kept); p_remove_photo leaves the category's picture;
--   neither keeps the image as it is (a sample shop's placeholder too). A replaced or removed photo is deleted;
-- - p_slug, for an approved or paused shop that hasn't changed its link yet, changes it (the one change of link), and
--   reports about the shop follow. A pending shop, a shop that has used its change, or the same link ignores it.
-- Returns jsonb:
--   {"result": "saved", "slug", "removed_paths"}
--   {"result": "no-shop"}  updateShop's null (requireShopOwner sends the seller to /sell)
--   {"result": "name-taken" | "slug-taken" | "points-invalid" | "photo-invalid"}  nothing is saved
-- A user action (advisor 0029 lists it on purpose).
create or replace function public.update_shop(
  p_name text, p_tagline text, p_category_slug text, p_about text, p_campus_slug text, p_pickup_point_ids uuid[],
  p_photo_id uuid default null, p_remove_photo boolean default false, p_slug text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  owner uuid := private.signed_in();
  shop public.shops;
  status text;
  link text;
  link_changed boolean := false;
  points uuid[] := private.campus_points(p_campus_slug, p_pickup_point_ids);
  failed text;
  removed text[] := '{}'::text[];
begin
  select s.* into shop from public.shops s where s.id = private.shop_of(owner) for update;
  if not found then
    return '{"result": "no-shop"}'::jsonb;
  end if;
  status := private.shop_status(shop.id);
  if private.name_key(coalesce(p_name, '')) = '' then
    raise exception 'a shop name has a letter or a digit' using errcode = 'check_violation';
  end if;
  if not private.points_fit(p_campus_slug, p_pickup_point_ids) then
    return '{"result": "points-invalid"}'::jsonb;
  end if;
  if p_photo_id is not null and p_photo_id is distinct from shop.image_photo_id
    and not private.photo_usable(owner, p_photo_id, '{}')
  then
    return '{"result": "photo-invalid"}'::jsonb;
  end if;

  perform private.lock_shop_links();
  link := shop.slug;
  if status = 'pending' then
    link := private.free_shop_slug(private.slugify(p_name), shop.id);
  elsif p_slug is not null and p_slug <> shop.slug and not shop.slug_changed then
    if private.shop_slug_in_use(p_slug, shop.id) then
      return '{"result": "slug-taken"}'::jsonb;
    end if;
    link := p_slug;
    link_changed := true;
  end if;

  begin
    update public.shops set
      slug = link,
      slug_changed = slug_changed or link_changed,
      name = p_name,
      tagline = coalesce(p_tagline, ''),
      category_slug = p_category_slug,
      about = coalesce(p_about, ''),
      campus_slug = p_campus_slug,
      image_photo_id = case when p_photo_id is not null then p_photo_id when p_remove_photo then null else image_photo_id end,
      image_placeholder = case when p_photo_id is not null or p_remove_photo then null else image_placeholder end,
      image_alt = case
        when p_photo_id is not null and p_photo_id is distinct from image_photo_id then ''
        when p_remove_photo then ''
        else image_alt
      end,
      updated_at = now()
    where id = shop.id;
  exception when unique_violation then
    get stacked diagnostics failed = constraint_name;
    if failed = 'shops_campus_slug_name_key_key' then
      return '{"result": "name-taken"}'::jsonb;
    elsif failed = 'shops_slug_key' then
      return '{"result": "slug-taken"}'::jsonb;
    end if;
    raise;
  end;

  if link <> shop.slug then
    perform private.shop_link_moved(shop.id, shop.slug, link, link_changed);
  end if;
  delete from public.shop_pickup_points where shop_id = shop.id;
  insert into public.shop_pickup_points (shop_id, pickup_point_id) select shop.id, unnest(points);
  update public.listings set campus_slug = p_campus_slug where shop_id = shop.id and campus_slug <> p_campus_slug;
  -- C5: a listing on a point the Hub has retired keeps it (updateShop's amendment 13.6): it isn't the seller's to remove.
  update public.listings l
  set pickup_point_id = points[1], handover = case when points[1] is null then 'online' else 'pickup' end
  where l.shop_id = shop.id and l.handover = 'pickup' and not (l.pickup_point_id = any (points))
    and not exists (select 1 from public.pickup_points p where p.id = l.pickup_point_id and p.retired_at is not null);

  if p_photo_id is not null then
    update public.photos set use = 'shop' where id = p_photo_id;
    removed := private.delete_photos_used_by(owner, 'shop', array[p_photo_id]);
  elsif p_remove_photo then
    removed := private.delete_photos_used_by(owner, 'shop', '{}');
  end if;
  return jsonb_build_object('result', 'saved', 'slug', link, 'removed_paths', to_jsonb(removed));
end;
$$;
