-- Snap to search's daily count (AI features spec 5.4; stage D plan Task 4).
-- public.reserve_photo_search counts one search and says yes while under the limit in the last 24 hours, else counts
-- nothing; only the service role runs it. private.photo_searches is closed to the API roles and goes with the profile.
-- lib/data/photo-searches.ts is the sample's.
begin;
select plan(13);

create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
grant execute on all functions in schema pg_temp to public;

insert into public.campuses (slug, name, region, sort) values ('ps-campus', 'PS campus', 'Gauteng', 96);

-- 81 searches up to the limit; 82 is another account; 83 is deleted.
insert into auth.users (id, email) values
  (pg_temp.a('81'), 'ps-81@eduvos.com'), (pg_temp.a('82'), 'ps-82@eduvos.com'), (pg_temp.a('83'), 'ps-83@eduvos.com');
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('81'), 'Searcher', 'ps-campus', '{}'), (pg_temp.a('82'), 'Other', 'ps-campus', '{}'),
  (pg_temp.a('83'), 'Leaving', 'ps-campus', '{}');

-- The table is closed to the API roles.
select ok(
  (select relrowsecurity from pg_class where oid = 'private.photo_searches'::regclass),
  'private.photo_searches has row level security on'
);
select ok(
  not exists (
    select 1 from unnest(array['anon', 'authenticated']) r, unnest(array['select', 'insert', 'update', 'delete']) p
    where has_table_privilege(r, 'private.photo_searches', p)
  ),
  'anon and authenticated have no privilege on it'
);

-- Only the service role runs the reservation.
set local role anon;
select throws_ok(
  format($$select public.reserve_photo_search(%L, 3)$$, pg_temp.a('81')), '42501', null, 'anon can''t reserve a search'
);
reset role;
set local role authenticated;
select throws_ok(
  format($$select public.reserve_photo_search(%L, 3)$$, pg_temp.a('81')), '42501', null, 'nor can a signed-in user'
);
reset role;

-- Up to the limit, then no, and nothing more counted. Another account is untouched.
set local role service_role;
select is(public.reserve_photo_search(pg_temp.a('81'), 3), true, 'the service role reserves the first search');
select is(public.reserve_photo_search(pg_temp.a('81'), 3), true, 'the second');
select is(public.reserve_photo_search(pg_temp.a('81'), 3), true, 'and the third');
select is(public.reserve_photo_search(pg_temp.a('81'), 3), false, 'the fourth in 24 hours is refused');
select is(public.reserve_photo_search(pg_temp.a('82'), 3), true, 'another account still has its own');
reset role;
select is(
  (select sum(n)::int from private.photo_searches where account_id = pg_temp.a('81')), 3, 'a refusal counts nothing'
);

-- A search older than 24 hours no longer counts, and is tidied away by the next.
update private.photo_searches set hour = hour - interval '25 hours' where account_id = pg_temp.a('81');
set local role service_role;
select is(public.reserve_photo_search(pg_temp.a('81'), 3), true, 'searches from more than 24 hours ago are forgotten');
reset role;
select is(
  (select sum(n)::int from private.photo_searches where account_id = pg_temp.a('81')), 1, 'and their rows deleted'
);

-- The count goes with the profile.
set local role service_role;
select public.reserve_photo_search(pg_temp.a('83'), 3);
reset role;
delete from public.profiles where id = pg_temp.a('83');
select is(
  (select count(*)::int from private.photo_searches where account_id = pg_temp.a('83')), 0, 'deleting the profile deletes its count'
);

select * from finish();
rollback;
