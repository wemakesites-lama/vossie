-- Stock photos for the seed (2026-10-29): free Unsplash photos in /public/stock replace the labelled placeholder art
-- for the seed shops, the seed listings' covers and the Hub posts. Credits: docs/reference/stock-photos.md.
-- - A placeholder path may now also be /stock/<folder>/<file>.jpg. Like /placeholders, it names a file the site ships,
--   so a forged one shows at most another stock photo.
-- - The seed rows move to their stock photo where one exists. Campus art and the extra listing photos stay placeholders.
--   Rows a seller or the Hub has since changed to a stored photo have no placeholder path, so they don't match.

alter table public.shops drop constraint shops_image_placeholder_check;
alter table public.shops add constraint shops_image_placeholder_check
  check (image_placeholder ~ '^/(placeholders/[a-z0-9/-]+\.svg|stock/[a-z0-9/-]+\.jpg)$');

alter table public.listing_photos drop constraint listing_photos_placeholder_src_check;
alter table public.listing_photos add constraint listing_photos_placeholder_src_check
  check (placeholder_src ~ '^/(placeholders/[a-z0-9/-]+\.svg|stock/[a-z0-9/-]+\.jpg)$');

alter table public.hub_posts drop constraint hub_posts_image_src_check;
alter table public.hub_posts add constraint hub_posts_image_src_check
  check (image_src ~ '^/(placeholders/[a-z0-9/-]+\.svg|stock/[a-z0-9/-]+\.jpg)$');

update public.shops
set image_placeholder = regexp_replace(image_placeholder, '^/placeholders/seller/([a-z0-9-]+)\.svg$', '/stock/seller/\1.jpg')
where image_placeholder ~ '^/placeholders/seller/(hair-studio|maths-tutor|home-bakery|design-studio|thrift-rack|code-coach|phone-fix|nail-bar|study-notes|res-kitchen|tech-corner|book-swap|res-deals|closet-clear-out|ticket-desk|res-essentials|lash-lounge|stationery-stop|bookshelf|moving-out-sale|kitchen-kit|weekend-market|accounting-tutor|study-desk|room-refresh|sports-kit|drawing-office|cv-clinic|logo-lab)\.svg$';

update public.listing_photos
set placeholder_src = regexp_replace(placeholder_src, '^/placeholders/listing/([a-z-]+)\.svg$', '/stock/listing/\1.jpg')
where placeholder_src ~ '^/placeholders/listing/(textbooks-notes|tech|res-living|fashion-thrift|food|hair-beauty|tutoring|services|tickets-events|stationery)\.svg$';

update public.hub_posts
set image_src = regexp_replace(image_src, '^/placeholders/hub/(h-0[0-9][0-9]|banner)\.svg$', '/stock/hub/\1.jpg')
where image_src ~ '^/placeholders/hub/(h-0(0[1-9]|1[0-9]|2[0-2])|banner)\.svg$';
