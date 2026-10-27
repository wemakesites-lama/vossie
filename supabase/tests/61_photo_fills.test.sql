-- Photo-to-listing's daily count (photo-to-listing spec decision 12; plan Task 6, change 5).
-- public.reserve_photo_fill counts one press and says yes while under the limit in the last 24 hours, else counts
-- nothing; only the service role runs it. private.photo_fills is closed to the API roles and goes with the profile.
-- lib/data/photo-fills.ts is the sample's.
begin;
select plan(13);

create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
grant execute on all functions in schema pg_temp to public;

insert into public.campuses (slug, name, region, sort) values ('pf-campus', 'PF campus', 'Gauteng', 95);

-- 71 presses up to the limit; 72 is another account; 73 is deleted.
insert into auth.users (id, email) values
  (pg_temp.a('71'), 'pf-71@eduvos.com'), (pg_temp.a('72'), 'pf-72@eduvos.com'), (pg_temp.a('73'), 'pf-73@eduvos.com');
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('71'), 'Presser', 'pf-campus', '{}'), (pg_temp.a('72'), 'Other', 'pf-campus', '{}'),
  (pg_temp.a('73'), 'Leaving', 'pf-campus', '{}');

-- The table is closed to the API roles.
select ok(
  (select relrowsecurity from pg_class where oid = 'private.photo_fills'::regclass),
  'private.photo_fills has row level security on'
);
select ok(
  not exists (
    select 1 from unnest(array['anon', 'authenticated']) r, unnest(array['select', 'insert', 'update', 'delete']) p
    where has_table_privilege(r, 'private.photo_fills', p)
  ),
  'anon and authenticated have no privilege on it'
);

-- Only the service role runs the reservation.
set local role anon;
select throws_ok(
  format($$select public.reserve_photo_fill(%L, 3)$$, pg_temp.a('71')), '42501', null, 'anon can''t reserve a fill'
);
reset role;
set local role authenticated;
select throws_ok(
  format($$select public.reserve_photo_fill(%L, 3)$$, pg_temp.a('71')), '42501', null, 'nor can a signed-in user'
);
reset role;

-- Up to the limit, then no, and nothing more counted. Another account is untouched.
set local role service_role;
select is(public.reserve_photo_fill(pg_temp.a('71'), 3), true, 'the service role reserves the first fill');
select is(public.reserve_photo_fill(pg_temp.a('71'), 3), true, 'the second');
select is(public.reserve_photo_fill(pg_temp.a('71'), 3), true, 'and the third');
select is(public.reserve_photo_fill(pg_temp.a('71'), 3), false, 'the fourth in 24 hours is refused');
select is(public.reserve_photo_fill(pg_temp.a('72'), 3), true, 'another account still has its own');
reset role;
select is(
  (select sum(n)::int from private.photo_fills where account_id = pg_temp.a('71')), 3, 'a refusal counts nothing'
);

-- A press older than 24 hours no longer counts, and is tidied away by the next.
update private.photo_fills set hour = hour - interval '25 hours' where account_id = pg_temp.a('71');
set local role service_role;
select is(public.reserve_photo_fill(pg_temp.a('71'), 3), true, 'presses from more than 24 hours ago are forgotten');
reset role;
select is(
  (select sum(n)::int from private.photo_fills where account_id = pg_temp.a('71')), 1, 'and their rows deleted'
);

-- The count goes with the profile.
set local role service_role;
select public.reserve_photo_fill(pg_temp.a('73'), 3);
reset role;
delete from public.profiles where id = pg_temp.a('73');
select is(
  (select count(*)::int from private.photo_fills where account_id = pg_temp.a('73')), 0, 'deleting the profile deletes its count'
);

select * from finish();
rollback;
