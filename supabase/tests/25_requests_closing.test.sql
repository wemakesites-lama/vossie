-- Step 2b, Task 2: Looking For requests close themselves (stage L): the closing day as a stored column, who closed it,
-- the reminder's mark, their grants and Your requests (supabase step 2b plan, decisions 1 and 5; amendments 3 to 5).
-- The rule is closingDay (lib/looking-for/rules.ts): needed-by + NEEDED_BY_GRACE_DAYS (3) + 1, else the SAST day of the
-- last change + IDLE_CLOSE_DAYS (30); a sample never closes itself.
begin;
select plan(45);

create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.sign_in(n text) returns void language plpgsql as $f$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', pg_temp.a(n), 'role', 'authenticated', 'session_id', gen_random_uuid())::text,
    true
  );
  set local role authenticated;
end;
$f$;
create function pg_temp.sign_out() returns void language plpgsql as $f$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$f$;
create function pg_temp.closes(req text) returns date language sql as $f$
  select closes_on from public.requests where id = req;
$f$;
grant execute on all functions in schema pg_temp to public;

insert into public.campuses (slug, name, region, sort) values ('rc-campus', 'Closing campus', 'Gauteng', 98);
insert into public.categories (slug, name, sort) values ('rc-category', 'Closing category', 99);
-- e1 Zola asks; e2 Thandi asks too, and sees none of Zola's.
insert into auth.users (id, email)
select pg_temp.a(n), 'rc-' || n || '@eduvos.com' from unnest(array['e1', 'e2']) n;
insert into public.profiles (id, first_name, campus_slug) values
  (pg_temp.a('e1'), 'Zola', 'rc-campus'), (pg_temp.a('e2'), 'Thandi', 'rc-campus');

-- A request with only what the closing day reads: who asked, the needed-by date and the last change.
create function pg_temp.ask(req text, asker uuid, needed date, updated timestamptz, status text default 'open')
returns void language sql as $f$
  insert into public.requests (id, asker_id, title, category_slug, campus_slug, details, needed_by, status, created_at,
    updated_at, closed_at)
  values (req, asker, 'Need a desk lamp', 'rc-category', 'rc-campus', 'A lamp for late study nights.', needed, status,
    updated, updated, case when status = 'closed' and asker is not null then updated end);
$f$;

-- --- The closing day --------------------------------------------------------------------------------------------------

select has_column('public', 'requests', 'closes_on', 'requests has closes_on');
select is(
  (select attgenerated from pg_attribute where attrelid = 'public.requests'::regclass and attname = 'closes_on'),
  's'::"char",
  'closes_on is a stored generated column'
);
select is(
  (select provolatile from pg_proc where oid = 'private.request_closing_day(uuid, date, timestamptz)'::regprocedure),
  'i'::"char",
  'its rule is immutable'
);

select pg_temp.ask('rc-needed', pg_temp.a('e1'), '2026-10-16', '2026-10-13T09:30:00Z');
select is(pg_temp.closes('rc-needed'), '2026-10-20'::date, 'needed by 16 Oct: counts as closed from 20 Oct (stage L''s example)');
select pg_temp.ask('rc-idle', pg_temp.a('e1'), null, '2026-10-13T09:30:00Z');
select is(pg_temp.closes('rc-idle'), '2026-11-12'::date, 'no date, last changed 13 Oct: 12 Nov, 30 days on');
select pg_temp.ask('rc-late', pg_temp.a('e1'), null, '2026-10-13T22:30:00Z');
select is(pg_temp.closes('rc-late'), '2026-11-13'::date, 'last changed at 00:30 on 14 Oct in SAST: 13 Nov');
select pg_temp.ask('rc-sample', null, '2026-10-16', '2026-10-13T09:30:00Z');
select is(pg_temp.closes('rc-sample'), null, 'a sample never closes itself, even with a date');
select pg_temp.ask('rc-year', pg_temp.a('e1'), '2026-12-29', '2026-10-13T09:30:00Z');
select is(pg_temp.closes('rc-year'), '2027-01-02'::date, 'needed by 29 Dec: 2 Jan, over the year''s end');
select pg_temp.ask('rc-eve-1', pg_temp.a('e1'), null, '2026-12-31T21:59:59Z');
select is(pg_temp.closes('rc-eve-1'), '2027-01-30'::date, 'changed at 23:59:59 SAST on 31 Dec: 30 Jan');
select pg_temp.ask('rc-eve-2', pg_temp.a('e1'), null, '2026-12-31T22:00:00Z');
select is(pg_temp.closes('rc-eve-2'), '2027-01-31'::date, 'changed at midnight SAST, 1 Jan: 31 Jan');

update public.requests set needed_by = '2026-11-02' where id = 'rc-idle';
select is(pg_temp.closes('rc-idle'), '2026-11-06'::date, 'giving it a date moves the closing day');
update public.requests set needed_by = null, updated_at = '2026-10-20T10:00:00Z' where id = 'rc-idle';
select is(pg_temp.closes('rc-idle'), '2026-11-19'::date, 'clearing it and changing it moves it again, by the new change');
update public.requests set updated_at = '2026-10-21T10:00:00Z' where id = 'rc-needed';
select is(pg_temp.closes('rc-needed'), '2026-10-20'::date, 'a change doesn''t move a dated request''s closing day');
select throws_ok(
  $$update public.requests set closes_on = '2030-01-01' where id = 'rc-needed'$$,
  '428C9', null,
  'nobody writes the closing day'
);
select is(
  private.request_closing_day(pg_temp.a('e1'), null, '2026-10-13T09:30:00Z'),
  '2026-11-12'::date,
  'the column is private.request_closing_day'
);

-- The service role writes requests directly (the contract tests' world): the column's rule runs with its rights.
set local role service_role;
insert into public.requests (id, asker_id, title, category_slug, campus_slug, details, needed_by, updated_at)
values ('rc-service', pg_temp.a('e1'), 'Need a desk lamp', 'rc-category', 'rc-campus', 'A lamp for late study nights.',
  '2026-11-30', now());
reset role;
select is(pg_temp.closes('rc-service'), '2026-12-04'::date, 'the service role can write a request, and its closing day follows');

-- --- Who closed it, and the reminder's mark -----------------------------------------------------------------------------

select has_column('public', 'requests', 'closed_by', 'requests has closed_by');
select has_column('public', 'requests', 'reminded_for', 'requests has reminded_for');
select pg_temp.ask('rc-closed', pg_temp.a('e1'), null, now() - interval '2 days', 'closed');
select lives_ok(
  $$update public.requests set closed_by = 'asker' where id = 'rc-closed'$$, 'an asker''s closed request may say the asker closed it'
);
select lives_ok($$update public.requests set closed_by = 'auto' where id = 'rc-closed'$$, '… or that it closed automatically');
select lives_ok(
  $$update public.requests set closed_by = null where id = 'rc-closed'$$,
  'or neither (the check is one-way: closed requests made before the column have none)'
);
select throws_ok(
  $$update public.requests set closed_by = 'hub' where id = 'rc-closed'$$, '23514', null, 'closed_by is asker or auto, nothing else'
);
select throws_ok(
  $$update public.requests set closed_by = 'asker' where id = 'rc-late'$$, '23514', null, 'an open request has no closed_by'
);
select lives_ok(
  $$select pg_temp.ask('rc-sample-closed', null, null, now() - interval '2 days', 'closed')$$,
  'a sample may be closed with neither closed_at nor closed_by (the two closed fixtures)'
);
select throws_ok(
  $$update public.requests set closed_by = 'auto' where id = 'rc-sample-closed'$$, '23514', null, 'but not with a closed_by'
);
select lives_ok(
  $$update public.requests set reminded_for = '2026-11-12' where id = 'rc-late'$$, 'an asker''s request may be marked as reminded'
);
select throws_ok(
  $$update public.requests set reminded_for = '2026-11-12' where id = 'rc-sample'$$, '23514', null, 'a sample may not'
);
select is(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'requests_settle_idx'),
  'CREATE INDEX requests_settle_idx ON public.requests USING btree (closes_on) WHERE ((status = ''open''::text) AND (hidden_at IS NULL) AND (asker_id IS NOT NULL))',
  'the settle''s rows are indexed by closing day'
);

-- --- Grants -----------------------------------------------------------------------------------------------------------

select ok(has_column_privilege('anon', 'public.requests', 'closes_on', 'select'), 'anon reads the closing day');
select ok(has_column_privilege('authenticated', 'public.requests', 'closes_on', 'select'), 'so does a signed-in student');
select ok(has_column_privilege('authenticated', 'public.requests', 'closed_by', 'select'), 'a signed-in student reads closed_by');
select ok(not has_column_privilege('anon', 'public.requests', 'closed_by', 'select'), 'anon doesn''t');
select ok(
  not has_column_privilege('anon', 'public.requests', 'reminded_for', 'select')
  and not has_column_privilege('authenticated', 'public.requests', 'reminded_for', 'select'),
  'nobody reads reminded_for through the API'
);
select ok(
  not has_column_privilege('anon', 'public.requests', 'asker_id', 'select')
  and not has_column_privilege('authenticated', 'public.requests', 'asker_id', 'select'),
  'nor who asked (unchanged)'
);
select ok(
  not has_function_privilege('anon', 'private.request_closing_day(uuid, date, timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'private.request_closing_day(uuid, date, timestamptz)', 'execute'),
  'the API roles can''t run the rule'
);
select ok(
  has_function_privilege('service_role', 'private.request_closing_day(uuid, date, timestamptz)', 'execute'),
  'the service role can'
);

set local role anon;
select is(
  (select array_agg(closes_on order by id) from public.requests where id in ('rc-needed', 'rc-sample')),
  array['2026-10-20', null]::date[],
  'anon reads an asker''s closing day, and a sample''s null'
);
select throws_ok($$select closed_by from public.requests limit 1$$, '42501', null, 'and can''t select closed_by');
reset role;

-- --- Your requests ----------------------------------------------------------------------------------------------------

select is(
  (select reloptions from pg_class where oid = 'public.my_requests'::regclass),
  array['security_invoker=true'],
  'my_requests still runs as the reader, so the requests policies apply (amendment 5)'
);
select is(
  (select array_agg(attname::text order by attnum) from pg_attribute
   where attrelid = 'public.my_requests'::regclass and attnum > 0 and not attisdropped),
  array['id', 'title', 'category_slug', 'campus_slug', 'details', 'budget_zar', 'swap_welcome', 'needed_by', 'status',
    'created_at', 'updated_at', 'closed_at', 'hidden_at', 'hidden_reason', 'state', 'offers', 'closed_by', 'closes_on'],
  'my_requests gains closed_by and closes_on at the end'
);
update public.requests set closed_by = 'auto' where id = 'rc-closed';
select pg_temp.sign_in('e1');
select is(
  (select row(closed_by, closes_on)::text from public.my_requests where id = 'rc-closed'),
  row('auto', ((now() - interval '2 days') at time zone 'Africa/Johannesburg')::date + 30)::text,
  'the asker sees that a closed request closed automatically, and its closing day'
);
select is(
  (select row(closed_by, closes_on)::text from public.my_requests where id = 'rc-needed'),
  row(null::text, '2026-10-20'::date)::text,
  'an open one has no closed_by'
);
select is(
  (select count(*) from public.my_requests where id in ('rc-sample', 'rc-sample-closed')),
  0::bigint,
  'a sample, which nobody asked, isn''t anyone''s'
);
select is((select count(*) from public.my_requests), 8::bigint, 'Zola sees her eight');
select pg_temp.sign_out();
select pg_temp.sign_in('e2');
select is((select count(*) from public.my_requests), 0::bigint, 'Thandi sees none of them');
select pg_temp.sign_out();

select * from finish();
rollback;
