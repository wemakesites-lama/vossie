-- Gives 47 sample listings their own cover photo on the live project (Lama, 2026-11-05), so no two listings share one:
-- the 32 seed listings in data/fixtures/listings.ts's OWN_PHOTO and the demo's dm-001 to dm-015
-- (add-demo-activity.sql). The photos are /stock/listing/<id>.jpg (docs/reference/stock-photos.md), so run this only
-- once a deployment that carries them is live, or those covers show broken.
--
-- Run in the dashboard's SQL editor, as postgres. Safe to run again. It changes only a cover that is still a stock
-- placeholder (a seller's own uploaded photo is left alone), and nothing else. The clear-out removes these rows with
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

commit;

-- Covers now: how many listings share each stock photo (every row should say 1).
select placeholder_src, count(*) as listings
from public.listing_photos
where position = 0 and placeholder_src like '/stock/%'
group by placeholder_src
order by listings desc, placeholder_src
limit 10;
