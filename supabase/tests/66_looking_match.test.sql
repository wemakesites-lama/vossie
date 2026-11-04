-- AI stage G: the search a Looking For request's words were read into (AI round two spec 5; plan
-- 2026-11-04-ai-stage-g-looking-match.md, Task 3). requests.match_query and match_read_at are the service role's: no
-- API role reads them, neither view shows them, only save_request_match writes them (never on a sample, never moving
-- updated_at or closes_on), and the query's shape is checked.
begin;
select plan(31);

create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.sign_in(n text) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.a(n), 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$f$;
create function pg_temp.sign_out() returns void language plpgsql as $f$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$f$;
create function pg_temp.as_service() returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
end;
$f$;
grant execute on all functions in schema pg_temp to public;

insert into public.campuses (slug, name, region, sort) values ('lm-campus', 'Match campus', 'Gauteng', 97);
insert into public.categories (slug, name, sort) values ('lm-category', 'Match category', 98);
-- f1 Thandi asks; f2 Sipho is another student.
insert into auth.users (id, email)
select pg_temp.a(n), 'lm-' || n || '@eduvos.com' from unnest(array['f1', 'f2']) n;
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('f1'), 'Thandi', 'lm-campus', '{}'),
  (pg_temp.a('f2'), 'Sipho', 'lm-campus', '{}');
-- lm-r1 Thandi's request, last changed 3 days ago; lm-r0 a sample (no asker).
insert into public.requests (id, asker_id, title, category_slug, campus_slug, details, created_at, updated_at) values
  ('lm-r1', pg_temp.a('f1'), 'A desk lamp', 'lm-category', 'lm-campus', 'Looking for a desk lamp for my room.',
    now() - interval '3 days', now() - interval '3 days'),
  ('lm-r0', null, 'A sample lamp', 'lm-category', 'lm-campus', 'A sample request that is never read.',
    now() - interval '3 days', now() - interval '3 days');
create temp table before_match as select updated_at, closes_on from public.requests where id = 'lm-r1';

select has_column('public', 'requests', 'match_query', 'requests has match_query');
select has_column('public', 'requests', 'match_read_at', 'requests has match_read_at');
select ok(not has_column_privilege('authenticated', 'public.requests', 'match_query', 'select'), 'no signed-in reader selects match_query');
select ok(not has_column_privilege('anon', 'public.requests', 'match_query', 'select'), 'nor a visitor');
select ok(not has_column_privilege('authenticated', 'public.requests', 'match_read_at', 'select'), 'no signed-in reader selects match_read_at');
select ok(not has_column_privilege('anon', 'public.requests', 'match_read_at', 'select'), 'nor a visitor');
select hasnt_column('public', 'request_cards', 'match_query', 'request_cards leaves the search out');
select hasnt_column('public', 'my_requests', 'match_query', 'so does my_requests');
select ok(
  not has_function_privilege('authenticated', 'public.save_request_match(text, jsonb, boolean)', 'execute'),
  'nobody signed in saves a search'
);
select ok(
  not has_function_privilege('anon', 'public.save_request_match(text, jsonb, boolean)', 'execute'),
  'nor a visitor'
);
select ok(
  has_function_privilege('service_role', 'public.save_request_match(text, jsonb, boolean)', 'execute'),
  'the service role does'
);

select pg_temp.as_service();
select is(
  public.save_request_match('lm-r1',
    '{"q": "desk lamp", "category": "lm-category", "campus": "lm-campus", "price": null, "pay": null, "deals": null}', true),
  true, 'a search is saved on an asker''s request'
);
select is(
  public.save_request_match('lm-r0',
    '{"q": "desk lamp", "category": "lm-category", "campus": "lm-campus", "price": null, "pay": null, "deals": null}', true),
  false, 'never on a sample'
);
select pg_temp.sign_out();

select is(
  (select match_query from public.requests where id = 'lm-r1'),
  '{"q": "desk lamp", "category": "lm-category", "campus": "lm-campus", "price": null, "pay": null, "deals": null}'::jsonb,
  'the request keeps the search'
);
select ok((select match_read_at is not null from public.requests where id = 'lm-r1'), 'and when it was read');
select is(
  (select updated_at from public.requests where id = 'lm-r1'), (select updated_at from before_match),
  'updated_at doesn''t move'
);
select is(
  (select closes_on from public.requests where id = 'lm-r1'), (select closes_on from before_match),
  'so closes_on doesn''t either'
);
select ok(
  (select match_query is null and match_read_at is null from public.requests where id = 'lm-r0'),
  'the sample still has neither'
);

select pg_temp.as_service();
select is(public.save_request_match('lm-r1', null, false), true, 'a read of false clears it');
select pg_temp.sign_out();
select ok(
  (select match_query is null and match_read_at is null from public.requests where id = 'lm-r1'),
  'both are null again'
);

select pg_temp.as_service();
select is(public.save_request_match('lm-r1', null, true), true, 'a read with no search is saved');
select pg_temp.sign_out();
select ok(
  (select match_query is null and match_read_at is not null from public.requests where id = 'lm-r1'),
  'read, with no search'
);

select throws_ok(
  $$ select public.save_request_match('lm-r1',
    '{"q": "desk lamp", "category": "lm-category", "campus": "lm-campus", "price": null, "pay": null, "deals": null}', false) $$,
  '22023', null, 'a search needs a read'
);
select throws_ok(
  $$ select public.save_request_match('lm-r1', null, null) $$,
  '22023', null, 'and a read is true or false'
);

select throws_ok(
  $$ update public.requests set match_read_at = now(), match_query = '["desk lamp"]' where id = 'lm-r1' $$,
  '23514', null, 'an array is refused'
);
select throws_ok(
  $$ update public.requests set match_read_at = now(),
    match_query = '{"q": "desk lamp", "category": null, "campus": "lm-campus", "price": null, "pay": null}' where id = 'lm-r1' $$,
  '23514', null, 'so is a query missing a key'
);
select throws_ok(
  $$ update public.requests set match_read_at = now(),
    match_query = '{"q": "desk lamp", "category": null, "campus": "lm-campus", "price": null, "pay": null, "deals": null, "owner": "f1"}'
    where id = 'lm-r1' $$,
  '23514', null, 'and one with an extra key'
);
select throws_ok(
  $$ update public.requests set match_read_at = now(),
    match_query = '{"q": "", "category": null, "campus": "lm-campus", "price": null, "pay": null, "deals": null}' where id = 'lm-r1' $$,
  '23514', null, 'an empty q is refused'
);
select throws_ok(
  $$ update public.requests set match_read_at = now(),
    match_query = '{"q": 5, "category": null, "campus": "lm-campus", "price": null, "pay": null, "deals": null}' where id = 'lm-r1' $$,
  '23514', null, 'so is a q that isn''t text'
);
select throws_ok(
  $$ update public.requests set match_read_at = now(),
    match_query = '{"q": "desk lamp", "category": null, "campus": null, "price": null, "pay": null, "deals": null}' where id = 'lm-r1' $$,
  '23514', null, 'and a query with no campus'
);

select pg_temp.sign_in('f1');
select throws_ok(
  $$ select match_query from public.requests where id = 'lm-r1' $$,
  '42501', null, 'the asker can''t read the search of their own request'
);
select pg_temp.sign_out();

select * from finish();
rollback;
