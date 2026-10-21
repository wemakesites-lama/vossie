-- Production's reference data (supabase step 2b plan, Task 1; decisions 10 to 12): who may sign in, the campuses,
-- the categories and the pickup points. Every environment runs it; supabase/seed.sql adds only sample content.
-- Generated once by scripts/make-reference.ts from data/fixtures/ and lib/auth/config.ts. Never edit it: when a
-- fixture changes, scripts/reference-sql.test.ts fails, and the change goes into a new migration.
--
-- Each insert skips rows that are already there, so a stack that has them from an older seed is unchanged.
-- Exact domains only: students sign in as eduv and 7 digits @vossie.net, staff @eduvos.com (Lama, 2026-10-21).
-- The pickup points keep the seed's fixed ids. They are sample places ("Library entrance" and "Main reception" on
-- each campus) until Eduvos replaces them through the Hub (rename, retire, add): a go-live item.

-- Who may sign in.
insert into private.allowed_email_domains (domain) values
  ('eduvos.com'),
  ('vossie.net')
on conflict do nothing;

-- Campuses and categories, in the fixtures' order.
insert into public.campuses (slug, name, region, sort, is_online) values
  ('bedfordview', 'Bedfordview', 'Gauteng', 1, false),
  ('bloemfontein', 'Bloemfontein', 'Free State', 2, false),
  ('cape-town-mowbray', 'Cape Town Mowbray', 'Western Cape', 3, false),
  ('cape-town-tyger-valley', 'Cape Town Tyger Valley', 'Western Cape', 4, false),
  ('durban-umhlanga', 'Durban Umhlanga', 'KwaZulu-Natal', 5, false),
  ('east-london', 'East London', 'Eastern Cape', 6, false),
  ('mbombela', 'Mbombela', 'Mpumalanga', 7, false),
  ('midrand', 'Midrand', 'Gauteng', 8, false),
  ('nelson-mandela-bay', 'Nelson Mandela Bay', 'Eastern Cape', 9, false),
  ('potchefstroom', 'Potchefstroom', 'North West', 10, false),
  ('pretoria', 'Pretoria', 'Gauteng', 11, false),
  ('vanderbijlpark', 'Vanderbijlpark', 'Gauteng', 12, false),
  ('online', 'Eduvos Online', 'Online, anywhere in SA', 13, true)
on conflict do nothing;

insert into public.categories (slug, name, sort) values
  ('textbooks-notes', 'Textbooks & notes', 1),
  ('tech', 'Tech', 2),
  ('res-living', 'Res & living', 3),
  ('fashion-thrift', 'Fashion & thrift', 4),
  ('food', 'Food', 5),
  ('hair-beauty', 'Hair & beauty', 6),
  ('tutoring', 'Tutoring', 7),
  ('services', 'Services', 8),
  ('tickets-events', 'Tickets & events', 9),
  ('stationery', 'Stationery', 10)
on conflict do nothing;

-- Pickup points, with the seed's fixed ids.
insert into public.pickup_points (id, campus_slug, name, retired_at, created_at) values
  ('75fb177e-8a75-5e37-ab87-b587a190fcc3', 'bedfordview', 'Library entrance', null, '2025-01-15T08:00:00.000Z'),
  ('22633612-9779-5d00-9dc2-be2a9a27e0bc', 'bedfordview', 'Main reception', null, '2025-01-15T08:00:00.000Z'),
  ('4feb4fb7-293d-5a15-9e89-318fe77cf61f', 'bloemfontein', 'Library entrance', null, '2025-01-15T08:00:00.000Z'),
  ('c9b96319-bc6b-5cff-9d93-14b06f8bbecc', 'bloemfontein', 'Main reception', null, '2025-01-15T08:00:00.000Z'),
  ('2dcb9b5b-e5a7-5184-9a88-deca28f16fa3', 'cape-town-mowbray', 'Library entrance', null, '2025-01-15T08:00:00.000Z'),
  ('13a9668c-aee5-57ca-a500-374e6934b9a0', 'cape-town-mowbray', 'Main reception', null, '2025-01-15T08:00:00.000Z'),
  ('64a8f84c-ed6b-550d-b733-0f08a35857b2', 'cape-town-tyger-valley', 'Library entrance', null, '2025-01-15T08:00:00.000Z'),
  ('d5503e3b-a6dc-5f45-9bdb-fde592b107d9', 'cape-town-tyger-valley', 'Main reception', null, '2025-01-15T08:00:00.000Z'),
  ('7dcd98dc-12c6-5d15-8fdc-ba179fc18fb2', 'durban-umhlanga', 'Library entrance', null, '2025-01-15T08:00:00.000Z'),
  ('0555792a-ca93-53a3-bbe7-55eaaa0e4644', 'durban-umhlanga', 'Main reception', null, '2025-01-15T08:00:00.000Z'),
  ('a09b8ca6-cb68-5fc5-ba41-164663495aad', 'east-london', 'Library entrance', null, '2025-01-15T08:00:00.000Z'),
  ('c6249c71-271e-59fb-963d-262930196727', 'east-london', 'Main reception', null, '2025-01-15T08:00:00.000Z'),
  ('a9a0ad74-5106-512b-8f00-15363aab9cd2', 'mbombela', 'Library entrance', null, '2025-01-15T08:00:00.000Z'),
  ('9d32343d-2777-5f83-9ad9-87e844445f92', 'mbombela', 'Main reception', null, '2025-01-15T08:00:00.000Z'),
  ('b941bfe8-f74b-5c7a-aa51-f782133d8057', 'midrand', 'Library entrance', null, '2025-01-15T08:00:00.000Z'),
  ('4d8a004f-b3b3-5a18-8b94-d21ae1e51f73', 'midrand', 'Main reception', null, '2025-01-15T08:00:00.000Z'),
  ('7840ed1a-f09e-543a-97b8-057370194616', 'nelson-mandela-bay', 'Library entrance', null, '2025-01-15T08:00:00.000Z'),
  ('9cfa70c3-d7e2-544f-b67d-2c394e86bb85', 'nelson-mandela-bay', 'Main reception', null, '2025-01-15T08:00:00.000Z'),
  ('c315c627-9083-5d12-92ca-fc4c414fd4f8', 'potchefstroom', 'Library entrance', null, '2025-01-15T08:00:00.000Z'),
  ('319fcc6c-25c5-5703-abd0-4c569c1d0b4f', 'potchefstroom', 'Main reception', null, '2025-01-15T08:00:00.000Z'),
  ('8eab15c8-ea5e-5563-a1aa-eaddb0afcbe9', 'pretoria', 'Library entrance', null, '2025-01-15T08:00:00.000Z'),
  ('fe628154-986d-5293-b94a-8a39dcf0d5be', 'pretoria', 'Main reception', null, '2025-01-15T08:00:00.000Z'),
  ('9803b57e-874a-5997-975a-fa6ce457bfaa', 'vanderbijlpark', 'Library entrance', null, '2025-01-15T08:00:00.000Z'),
  ('4858ca28-8109-54f4-aeb5-28b7219947da', 'vanderbijlpark', 'Main reception', null, '2025-01-15T08:00:00.000Z')
on conflict do nothing;
