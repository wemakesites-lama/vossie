-- Search in your own words' site-wide daily cap (AI features spec 6.4; AI stage E plan decision 5).
-- public.reserve_words_search takes one of today's (SAST) parses while under the cap, else takes nothing; only the
-- service role runs it. private.words_search_parses is closed to the API roles. lib/data/words-search.ts is the sample's.
begin;
select plan(20);

-- The table is closed to the API roles.
select ok(
  (select relrowsecurity from pg_class where oid = 'private.words_search_parses'::regclass),
  'private.words_search_parses has row level security on'
);
select ok(
  not exists (
    select 1 from unnest(array['anon', 'authenticated']) r, unnest(array['select', 'insert', 'update', 'delete']) p
    where has_table_privilege(r, 'private.words_search_parses', p)
  ),
  'anon and authenticated have no privilege on it'
);

-- Only the service role runs the reservation, and no API role runs the private one.
set local role anon;
select throws_ok($$select public.reserve_words_search(3)$$, '42501', null, 'anon can''t reserve a parse');
reset role;
set local role authenticated;
select throws_ok($$select public.reserve_words_search(3)$$, '42501', null, 'nor can a signed-in user');
reset role;
select ok(
  has_function_privilege('service_role', 'public.reserve_words_search(integer)', 'execute'),
  'the server can reserve a parse'
);
select ok(
  not exists (
    select 1 from unnest(array['anon', 'authenticated', 'service_role']) r
    where has_function_privilege(r, 'private.reserve_words_search(timestamptz, integer)', 'execute')
  ),
  'no API role runs the private reservation'
);

-- Through the wrapper, on the database's clock.
delete from private.words_search_parses;
set local role service_role;
select is(public.reserve_words_search(1), true, 'the service role takes today''s first parse');
select is(public.reserve_words_search(1), false, 'and none past the cap');
reset role;

-- Up to the cap, then no, and nothing more counted.
select is(private.reserve_words_search('2030-03-10T08:00:00Z', 2), true, 'the first parse of a day');
select is(private.reserve_words_search('2030-03-10T09:00:00Z', 2), true, 'the second');
select is(private.reserve_words_search('2030-03-10T10:00:00Z', 2), false, 'the third over a cap of 2 is refused');
select is(
  (select n from private.words_search_parses where day = '2030-03-10'), 2, 'a refusal counts nothing'
);

-- A new SAST day starts again, and days before yesterday are tidied away.
select is(private.reserve_words_search('2030-03-11T08:00:00Z', 2), true, 'the next day starts again');
select is(private.reserve_words_search('2030-03-12T08:00:00Z', 2), true, 'and the day after');
select is(
  array(select day::text from private.words_search_parses order by day),
  array['2030-03-11', '2030-03-12'],
  'the day before yesterday is deleted'
);

-- No cap allows nothing.
select is(private.reserve_words_search('2030-03-12T08:00:00Z', 0), false, 'a cap of 0 allows nothing');
select is(private.reserve_words_search('2030-03-12T08:00:00Z', null), false, 'nor does no cap');

-- The day is South Africa's: midnight is 22:00 UTC, whatever the session's time zone.
set local timezone = 'America/New_York';
select is(private.reserve_words_search('2030-04-01T21:59:00Z', 1), true, '21:59 UTC is still 1 April in SAST');
select is(private.reserve_words_search('2030-04-01T22:01:00Z', 1), true, 'and 22:01 UTC is 2 April, a new day');
select is(
  array(select day::text from private.words_search_parses order by day),
  array['2030-04-01', '2030-04-02'],
  'whatever the session''s time zone'
);

select * from finish();
rollback;
