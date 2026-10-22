-- Adds the five demo accounts to the live project, for the demo sign-in (VOSSIE_DEMO_SIGN_IN=1, Lama 2026-10-22):
-- Thandi (student), Sipho (seller), Lerato (seller waiting for approval), Naledi (mentor) and Pieter (admin), at
-- @vossie.test, with their email identities, profiles and consents. The rows are the seed's own (supabase/seed.sql),
-- so their ids and fields are what the app expects. Nothing else is added: no shops, listings or messages, so the two
-- sellers have no shop on the live site unless one is given to them.
--
-- Run once in the dashboard's SQL editor, as postgres. Safe to run again: a row that's already there is left as it is.
-- The guard stops it, changing nothing, if one of the five ids or addresses already belongs to something else. The last
-- statement lists the five as they are afterwards: each should show its name, and Naledi and Pieter their roles.
--
-- The clear-out (clear-sample-data.sql) removes these accounts with the rest of the sample data, and the demo sign-in
-- must be off (unset VOSSIE_DEMO_SIGN_IN) before the first real student signs in (GO-LIVE gate).
begin;

-- The guard.
do $$
declare
  clashes bigint;
begin
  select count(*) into clashes
  from auth.users u
  join (values
    ('deb3fd08-f1e7-51ea-9103-0fb2451d94bf'::uuid, 'student@vossie.test'),
    ('11c18c13-a088-55c2-bacc-a95b612da2ea'::uuid, 'seller@vossie.test'),
    ('15eea3f4-7e8b-5176-ab1d-91a512bb16ae'::uuid, 'pending@vossie.test'),
    ('bfad90c4-30ec-5ca2-bf9c-ec7af7909917'::uuid, 'mentor@vossie.test'),
    ('a4a401d5-3cef-507f-9fc2-9940ca64cb87'::uuid, 'admin@vossie.test')
  ) as demo (id, email) on u.id = demo.id or lower(u.email) = demo.email
  where u.id <> demo.id or lower(u.email) <> demo.email;
  if clashes > 0 then
    raise exception 'refused: % of the five demo ids or addresses already belongs to another account. Nothing was added.', clashes;
  end if;
end
$$;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, email_change_token_new, email_change, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'deb3fd08-f1e7-51ea-9103-0fb2451d94bf', 'authenticated', 'authenticated', 'student@vossie.test', '', '2026-09-01T07:30:00.000Z', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '2026-09-01T07:30:00.000Z', '2026-09-01T07:30:00.000Z'),
  ('00000000-0000-0000-0000-000000000000', '11c18c13-a088-55c2-bacc-a95b612da2ea', 'authenticated', 'authenticated', 'seller@vossie.test', '', '2026-03-02T09:15:00.000Z', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '2026-03-02T09:15:00.000Z', '2026-03-02T09:15:00.000Z'),
  ('00000000-0000-0000-0000-000000000000', '15eea3f4-7e8b-5176-ab1d-91a512bb16ae', 'authenticated', 'authenticated', 'pending@vossie.test', '', '2026-10-10T12:05:00.000Z', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '2026-10-10T12:05:00.000Z', '2026-10-10T12:05:00.000Z'),
  ('00000000-0000-0000-0000-000000000000', 'bfad90c4-30ec-5ca2-bf9c-ec7af7909917', 'authenticated', 'authenticated', 'mentor@vossie.test', '', '2026-02-16T08:00:00.000Z', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '2026-02-16T08:00:00.000Z', '2026-02-16T08:00:00.000Z'),
  ('00000000-0000-0000-0000-000000000000', 'a4a401d5-3cef-507f-9fc2-9940ca64cb87', 'authenticated', 'authenticated', 'admin@vossie.test', '', '2026-02-02T08:00:00.000Z', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '2026-02-02T08:00:00.000Z', '2026-02-02T08:00:00.000Z')
on conflict do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at) values
  ('b8ec11df-415e-537b-8008-45e7e0a3c08b', 'deb3fd08-f1e7-51ea-9103-0fb2451d94bf', 'deb3fd08-f1e7-51ea-9103-0fb2451d94bf', '{"sub":"deb3fd08-f1e7-51ea-9103-0fb2451d94bf","email":"student@vossie.test","email_verified":true,"phone_verified":false}'::jsonb, 'email', '2026-09-01T07:30:00.000Z', '2026-09-01T07:30:00.000Z'),
  ('6c70a0e0-6f02-5bb7-a744-824584817eac', '11c18c13-a088-55c2-bacc-a95b612da2ea', '11c18c13-a088-55c2-bacc-a95b612da2ea', '{"sub":"11c18c13-a088-55c2-bacc-a95b612da2ea","email":"seller@vossie.test","email_verified":true,"phone_verified":false}'::jsonb, 'email', '2026-03-02T09:15:00.000Z', '2026-03-02T09:15:00.000Z'),
  ('6e098565-735c-5bc7-864a-47d8cc3b73f3', '15eea3f4-7e8b-5176-ab1d-91a512bb16ae', '15eea3f4-7e8b-5176-ab1d-91a512bb16ae', '{"sub":"15eea3f4-7e8b-5176-ab1d-91a512bb16ae","email":"pending@vossie.test","email_verified":true,"phone_verified":false}'::jsonb, 'email', '2026-10-10T12:05:00.000Z', '2026-10-10T12:05:00.000Z'),
  ('73747452-28c8-5a84-8359-9d59a2c0a1e6', 'bfad90c4-30ec-5ca2-bf9c-ec7af7909917', 'bfad90c4-30ec-5ca2-bf9c-ec7af7909917', '{"sub":"bfad90c4-30ec-5ca2-bf9c-ec7af7909917","email":"mentor@vossie.test","email_verified":true,"phone_verified":false}'::jsonb, 'email', '2026-02-16T08:00:00.000Z', '2026-02-16T08:00:00.000Z'),
  ('88c8f846-427e-5531-976a-6195b6361b59', 'a4a401d5-3cef-507f-9fc2-9940ca64cb87', 'a4a401d5-3cef-507f-9fc2-9940ca64cb87', '{"sub":"a4a401d5-3cef-507f-9fc2-9940ca64cb87","email":"admin@vossie.test","email_verified":true,"phone_verified":false}'::jsonb, 'email', '2026-02-02T08:00:00.000Z', '2026-02-02T08:00:00.000Z')
on conflict do nothing;

insert into public.profiles (id, first_name, campus_slug, roles, created_at) values
  ('deb3fd08-f1e7-51ea-9103-0fb2451d94bf', 'Thandi', 'midrand', '{}'::text[], '2026-09-01T07:30:00.000Z'),
  ('11c18c13-a088-55c2-bacc-a95b612da2ea', 'Sipho', 'midrand', '{}'::text[], '2026-03-02T09:15:00.000Z'),
  ('15eea3f4-7e8b-5176-ab1d-91a512bb16ae', 'Lerato', 'pretoria', '{}'::text[], '2026-10-10T12:05:00.000Z'),
  ('bfad90c4-30ec-5ca2-bf9c-ec7af7909917', 'Naledi', 'midrand', array['mentor']::text[], '2026-02-16T08:00:00.000Z'),
  ('a4a401d5-3cef-507f-9fc2-9940ca64cb87', 'Pieter', 'pretoria', array['admin']::text[], '2026-02-02T08:00:00.000Z')
on conflict do nothing;

insert into public.consents (id, account_id, version, agreed_at) values
  ('370d6542-7c04-5846-8851-419f1ccb4286', 'deb3fd08-f1e7-51ea-9103-0fb2451d94bf', '2026-10-draft', '2026-10-14T08:00:00.000Z'),
  ('6e530454-44a2-5840-93b7-626b8a3be2c9', '11c18c13-a088-55c2-bacc-a95b612da2ea', '2026-10-draft', '2026-10-14T08:00:00.000Z'),
  ('4b976ce9-df34-5a87-b94a-246f384e3bf0', '15eea3f4-7e8b-5176-ab1d-91a512bb16ae', '2026-10-draft', '2026-10-14T08:00:00.000Z'),
  ('77897d2f-c8e3-55e9-bf88-ad1dcca794d2', 'bfad90c4-30ec-5ca2-bf9c-ec7af7909917', '2026-10-draft', '2026-10-14T08:00:00.000Z'),
  ('2163702a-68d9-5643-973a-663906b61f4f', 'a4a401d5-3cef-507f-9fc2-9940ca64cb87', '2026-10-draft', '2026-10-14T08:00:00.000Z')
on conflict do nothing;

commit;

-- The five, as they are now.
select u.email, p.first_name, p.roles, c.version as consent
from auth.users u
left join public.profiles p on p.id = u.id
left join public.consents c on c.account_id = u.id
where lower(u.email) like '%@vossie.test'
order by u.email;
