-- Gives the live project's sample photos one use each (Lama, 2026-11-05): 47 sample listings their own cover (the 32
-- seed listings in data/fixtures/listings.ts's OWN_PHOTO and the demo's dm-001 to dm-015, add-demo-activity.sql), five
-- second and third photos in place of the shared grey placeholders, and Crochet corner a shop photo. The files are in
-- public/stock (docs/reference/stock-photos.md), so run this only once a deployment that carries them is live, or those
-- photos show broken.
--
-- Run in the dashboard's SQL editor, as postgres. Safe to run again. It changes only photos that are still sample
-- placeholders (a seller's own uploaded photo is left alone), and nothing else. The clear-out removes these rows with
-- the rest of the sample data.
begin;

update public.listing_photos
set placeholder_src = '/stock/listing/' || listing_id || '.jpg'
where position = 0
  and photo_id is null
  and placeholder_src like '/stock/%'
  and listing_id in (
    'l-003', 'l-006', 'l-007', 'l-008', 'l-010', 'l-011', 'l-013', 'l-014', 'l-015', 'l-016', 'l-017', 'l-018',
    'l-019', 'l-020', 'l-021', 'l-022', 'l-023', 'l-024', 'l-025', 'l-026', 'l-027', 'l-028', 'l-029', 'l-030',
    'l-031', 'fs-001', 'fs-002', 'fs-003', 'fs-004', 'fs-005', 'fs-006', 'fs-007',
    'dm-001', 'dm-002', 'dm-003', 'dm-004', 'dm-005', 'dm-006', 'dm-007', 'dm-008', 'dm-009', 'dm-010', 'dm-011',
    'dm-012', 'dm-013', 'dm-014', 'dm-015'
  );

-- The second and third photos that were the shared grey placeholders (/placeholders/photo/2.svg and 3.svg): photos of
-- their own, named for what they show, with descriptions that match them (data/fixtures/listings.ts).
update public.listing_photos lp
set placeholder_src = v.src, alt = v.alt
from (values
  ('l-001', 1, '/stock/listing/casio-notes.jpg', 'The calculator beside a page of exam notes'),
  ('l-001', 2, '/stock/listing/casio-keys.jpg', 'The keys and the screen'),
  ('l-003', 1, '/stock/listing/fridge-inside.jpg', 'Inside the fridge'),
  ('l-021', 1, '/stock/listing/bike-gears.jpg', 'The gears and the back wheel'),
  ('l-021', 2, '/stock/listing/bike-lock.jpg', 'The lock that comes with it')
) as v (listing_id, position, src, alt)
where lp.listing_id = v.listing_id
  and lp.position = v.position
  and lp.photo_id is null
  and lp.placeholder_src like '/placeholders/photo/%';

-- Crochet corner (Lerato's sample shop, waiting for approval) had no photo. The fixture keeps it without one, for the
-- tests of a new shop's checklist; on the live demo it gets a stock photo of its own.
update public.shops
set image_placeholder = '/stock/seller/crochet-corner.jpg', image_alt = 'Crochet squares with yarn and a hook'
where slug = 'crochet-corner' and image_placeholder is null and image_photo_id is null;

commit;

-- Every stock photo, and how many places use it (every row should say 1).
select src, count(*) as places
from (
  select placeholder_src as src from public.listing_photos where placeholder_src is not null
  union all
  select image_placeholder from public.shops where image_placeholder is not null
  union all
  select image_src from public.hub_posts where image_src is not null
) as used
group by src
order by places desc, src
limit 10;
