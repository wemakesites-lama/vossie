-- Step 2b, Task 4: the request functions follow the closing rule (supabase step 2b plan, decisions 3 and 4; amendment
-- 18). A request on or past its closing day counts as closed before the settle stores it (requestOpenOn,
-- lib/looking-for/rules.ts): save_request won't edit it and leaves it out of the 5 open; set_request_open won't close
-- it by hand and leaves it out of the reopen count; start_offer answers closed. Close records 'asker'; Reopen clears a
-- needed-by date that has passed (reopened-date-cleared) and starts a fresh 30 days (setRequestOpen, requests.ts).
begin;
select plan(38);

create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.s(n text) returns uuid language sql immutable as $f$
  select ('10000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.t(n text) returns text language sql immutable as $f$
  select '70000000-0000-4000-8000-0000000000' || n;
$f$;
create function pg_temp.session(n text) returns uuid language sql immutable as $f$
  select ('50000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.sign_in(n text) returns void language plpgsql as $f$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', pg_temp.a(n), 'role', 'authenticated', 'session_id', pg_temp.session(n))::text,
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
-- A form's one-time token for account n's session (issueOnceToken, lib/staff/once.ts).
create function pg_temp.issue(n text, token text) returns text language sql as $f$
  insert into public.form_states (session_id, form, account_id, expires_at)
  values (pg_temp.session(n), 'staff-once:' || pg_temp.t(token), pg_temp.a(n), now() + interval '1 hour')
  returning pg_temp.t(token);
$f$;
create function pg_temp.today() returns date language sql as $f$
  select (now() at time zone 'Africa/Johannesburg')::date;
$f$;
create temp table rows_before (id text primary key, v text);
grant all on rows_before to public;
grant execute on all functions in schema pg_temp to public;

insert into public.campuses (slug, name, region, sort) values ('ra-campus', 'Actions campus', 'Gauteng', 98);
insert into public.categories (slug, name, sort) values ('ra-category', 'Actions category', 99);
-- b1 Zola asks; b2 Thandi asks, near the limit of 5 open; b3 Lerato has an open shop that offers.
insert into auth.users (id, email)
select pg_temp.a(n), 'ra-' || n || '@eduvos.com' from unnest(array['b1', 'b2', 'b3']) n;
insert into public.profiles (id, first_name, campus_slug) values
  (pg_temp.a('b1'), 'Zola', 'ra-campus'), (pg_temp.a('b2'), 'Thandi', 'ra-campus'), (pg_temp.a('b3'), 'Lerato', 'ra-campus');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since)
values (pg_temp.s('b3'), 'ra-lerato', pg_temp.a('b3'), 'Lerato crafts', 'ra-category', 'ra-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id, applied_at, approved_at)
values (pg_temp.a('b3'), 'approved', pg_temp.s('b3'), now() - interval '9 days', now() - interval '8 days');

-- A request by its asker, state, needed-by date and last change, made 3 days ago or earlier.
create function pg_temp.ask(req text, n text, status text, needed date, updated timestamptz) returns void
language sql as $f$
  insert into public.requests (id, asker_id, title, category_slug, campus_slug, details, needed_by, status, created_at,
    updated_at, closed_at, closed_by)
  values (req, pg_temp.a(n), 'Need a desk lamp', 'ra-category', 'ra-campus', 'A lamp for late study nights.', needed,
    status, least(updated, now() - interval '3 days'), updated,
    case when status = 'closed' then updated end, case when status = 'closed' then 'asker' end);
$f$;
select pg_temp.ask('ra-due', 'b1', 'open', pg_temp.today() - 4, now() - interval '10 days');
select pg_temp.ask('ra-tomorrow', 'b1', 'open', pg_temp.today() - 3, now() - interval '10 days');
select pg_temp.ask('ra-idle-tomorrow', 'b1', 'open', null, now() - interval '29 days');
select pg_temp.ask('ra-open', 'b1', 'open', null, now() - interval '5 days');
update public.requests set reminded_for = '2026-01-01' where id = 'ra-open';
select pg_temp.ask('ra-closed-past', 'b1', 'closed', pg_temp.today() - 1, now() - interval '5 days');
select pg_temp.ask('ra-closed-today', 'b1', 'closed', pg_temp.today(), now() - interval '5 days');
select pg_temp.ask('ra-closed-later', 'b1', 'closed', pg_temp.today() + 5, now() - interval '5 days');
select pg_temp.ask('ra-closed-nodate', 'b1', 'closed', null, now() - interval '50 days');
update public.requests set reminded_for = closes_on where id = 'ra-closed-nodate';
select pg_temp.ask('ra-hidden', 'b1', 'open', null, now() - interval '5 days');
update public.requests set hidden_at = now() - interval '1 day', hidden_reason = 'Rude.' where id = 'ra-hidden';
select pg_temp.ask('rb-1', 'b2', 'open', null, now() - interval '5 days');
select pg_temp.ask('rb-2', 'b2', 'open', null, now() - interval '5 days');
select pg_temp.ask('rb-3', 'b2', 'open', null, now() - interval '5 days');
select pg_temp.ask('rb-4', 'b2', 'open', null, now() - interval '5 days');
select pg_temp.ask('rb-due', 'b2', 'open', pg_temp.today() - 5, now() - interval '10 days');
insert into rows_before select r.id, row(r.*)::text from public.requests r where r.id like 'r_-%';

-- --- save_request -----------------------------------------------------------------------------------------------------

select pg_temp.sign_in('b2');
select is(
  (public.save_request(null, 'Need a stapler', 'ra-category', 'ra-campus', 'A stapler for my project, please.', null, false,
    null, pg_temp.issue('b2', 'a1')) ->> 'result'),
  'posted',
  'with 4 open and a fifth past its closing day (not yet settled), Thandi posts a new request'
);
select is(
  (public.save_request(null, 'Need a ruler', 'ra-category', 'ra-campus', 'A ruler for my project, please.', null, false,
    null, pg_temp.issue('b2', 'a2')) ->> 'result'),
  'open-limit',
  'a sixth, with 5 truly open, is over the limit'
);
select pg_temp.sign_out();

select pg_temp.sign_in('b1');
select is(
  public.save_request('ra-due', 'Need a brighter lamp', 'ra-category', 'ra-campus', 'A lamp for late study nights.', null,
    false, null, null),
  '{"result": "not-open"}'::jsonb,
  'editing a request past its closing day answers not-open'
);
select pg_temp.sign_out();
select is(
  (select row(r.*)::text from public.requests r where r.id = 'ra-due'),
  (select v from rows_before where id = 'ra-due'),
  'and changes nothing'
);
select pg_temp.sign_in('b1');
select is(
  public.save_request('ra-idle-tomorrow', 'Need a brighter lamp', 'ra-category', 'ra-campus', 'A lamp for late study nights.',
    null, false, null, null),
  '{"result": "saved", "id": "ra-idle-tomorrow"}'::jsonb,
  'editing one that closes tomorrow saves it'
);
select pg_temp.sign_out();
select is(
  (select row(r.title, r.closes_on)::text from public.requests r where r.id = 'ra-idle-tomorrow'),
  row('Need a brighter lamp', pg_temp.today() + 30)::text,
  'and its closing day moves to 30 days from today'
);

-- --- set_request_open: Close ------------------------------------------------------------------------------------------

select pg_temp.sign_in('b1');
select is(public.set_request_open('ra-open', false), 'closed', 'Zola closes an open request');
select pg_temp.sign_out();
select is(
  (select row(r.status, r.closed_by, r.closed_at, r.updated_at, r.reminded_for)::text from public.requests r where r.id = 'ra-open'),
  row('closed', 'asker', now(), now(), '2026-01-01'::date)::text,
  'closed by the asker, now, with its reminder mark kept'
);
select pg_temp.sign_in('b1');
select is(public.set_request_open('ra-due', false), 'nothing', 'a request past its closing day can''t be closed by hand');
select is(public.set_request_open('ra-due', true), 'nothing', 'nor reopened before the settle stores its close (amendment 18)');
select is(public.set_request_open('ra-hidden', false), 'nothing', 'a hidden request can''t be closed');
select is(public.set_request_open('ra-hidden', true), 'nothing', 'nor reopened');
select pg_temp.sign_out();
select is(
  (select array_agg(row(r.*)::text order by r.id) from public.requests r where r.id in ('ra-due', 'ra-hidden')),
  (select array_agg(v order by id) from rows_before where id in ('ra-due', 'ra-hidden')),
  'neither changes'
);

-- --- set_request_open: Reopen -----------------------------------------------------------------------------------------

select pg_temp.sign_in('b1');
select is(public.set_request_open('ra-closed-nodate', true), 'reopened', 'Zola reopens a closed request with no date');
select pg_temp.sign_out();
select is(
  (select row(r.status, r.closed_by, r.closed_at, r.updated_at, r.needed_by, r.closes_on)::text from public.requests r where r.id = 'ra-closed-nodate'),
  row('open', null::text, null::timestamptz, now(), null::date, pg_temp.today() + 30)::text,
  'open again, closed_by and closed_at cleared, a fresh 30 days from now'
);
select is(
  (select r.reminded_for from public.requests r where r.id = 'ra-closed-nodate'),
  ((now() - interval '50 days') at time zone 'Africa/Johannesburg')::date + 30,
  'its reminder mark is kept: the closing day it was reminded of before (nothing clears reminded_for)'
);
select pg_temp.sign_in('b1');
select is(
  public.set_request_open('ra-closed-past', true),
  'reopened-date-cleared',
  'reopening one whose needed-by date has passed answers reopened-date-cleared'
);
select pg_temp.sign_out();
select is(
  (select row(r.status, r.needed_by, r.closes_on)::text from public.requests r where r.id = 'ra-closed-past'),
  row('open', null::date, pg_temp.today() + 30)::text,
  'and clears the date, so it doesn''t close again at once'
);
select pg_temp.sign_in('b1');
select is(public.set_request_open('ra-closed-today', true), 'reopened', 'a needed-by date of today stays: reopened');
select is(public.set_request_open('ra-closed-later', true), 'reopen-limit', 'with 5 open, Zola can''t reopen another');
select is(public.set_request_open('ra-tomorrow', false), 'closed', 'she closes one that closes tomorrow by itself');
select is(public.set_request_open('ra-closed-later', true), 'reopened', 'and reopens one needed in 5 days, which keeps its date');
select pg_temp.sign_out();
select is(
  (select array_agg(row(r.id, r.status, r.needed_by, r.closes_on)::text order by r.id) from public.requests r
   where r.id in ('ra-closed-later', 'ra-closed-today')),
  array[
    row('ra-closed-later', 'open', pg_temp.today() + 5, pg_temp.today() + 9)::text,
    row('ra-closed-today', 'open', pg_temp.today(), pg_temp.today() + 4)::text
  ],
  'both keep their dates and close 3 days after them'
);

-- Settled first, as the app does (lib/looking-for/actions.ts settles before it reopens): then it reopens.
select is(public.settle_requests(now()), 2, 'the settle stores Zola''s and Thandi''s due requests as closed');
select pg_temp.sign_in('b1');
select is(public.set_request_open('ra-closed-today', false), 'closed', 'Zola makes room again');
select is(
  public.set_request_open('ra-due', true),
  'reopened-date-cleared',
  'once settled, Zola reopens hers, and its passed date goes'
);
select pg_temp.sign_out();
select is(
  (select row(r.status, r.closed_by, r.needed_by, r.closes_on)::text from public.requests r where r.id = 'ra-due'),
  row('open', null::text, null::date, pg_temp.today() + 30)::text,
  'open for 30 days more'
);

-- The reopen count leaves due requests out. Thandi has 5 open (4 and her new one); her due one is settled now, so she
-- gets a new due one, closes one of the 5 and reopens it: 4 open and 1 due is under the limit.
select pg_temp.ask('rb-due-2', 'b2', 'open', pg_temp.today() - 4, now() - interval '10 days');
select pg_temp.sign_in('b2');
select is(public.set_request_open('rb-1', false), 'closed', 'Thandi closes one of her 5 open');
select is(public.set_request_open('rb-1', true), 'reopened', 'and reopens it: the one past its closing day doesn''t count');
select is(public.set_request_open('rb-2', false), 'closed', 'she closes another');
select is(
  (public.save_request(null, 'Need a ruler', 'ra-category', 'ra-campus', 'A ruler for my project, please.', null, false,
    null, pg_temp.issue('b2', 'a3')) ->> 'result'),
  'posted',
  'and posts in its place'
);
select is(public.set_request_open('rb-2', true), 'reopen-limit', 'with 5 open again, she can''t reopen it');
select pg_temp.sign_out();

-- --- start_offer ------------------------------------------------------------------------------------------------------

select pg_temp.ask('ra-offer-due', 'b1', 'open', pg_temp.today() - 4, now() - interval '10 days');
select pg_temp.ask('ra-offer-tomorrow', 'b1', 'open', pg_temp.today() - 3, now() - interval '10 days');
select pg_temp.sign_in('b3');
select is(
  public.start_offer('ra-offer-due', null, 'I have one, R120.'),
  '{"result": "closed"}'::jsonb,
  'Lerato can''t offer on a request past its closing day: closed'
);
select is(
  public.start_offer('ra-offer-tomorrow', null, 'I have one, R120.') ->> 'result',
  'offered',
  'one that closes tomorrow takes her offer'
);
select pg_temp.sign_out();
select is(
  (select array_agg(c.request_id order by c.request_id) from public.conversations c where c.shop_id = pg_temp.s('b3')),
  array['ra-offer-tomorrow'],
  'only that one has a conversation'
);

-- --- Signatures and grants are unchanged ------------------------------------------------------------------------------

select ok(
  has_function_privilege('authenticated', 'public.save_request(text, text, text, text, text, integer, boolean, date, text)', 'execute')
  and has_function_privilege('authenticated', 'public.set_request_open(text, boolean)', 'execute')
  and has_function_privilege('authenticated', 'public.start_offer(text, text, text)', 'execute'),
  'signed-in students still run the three'
);
select ok(
  not has_function_privilege('anon', 'public.save_request(text, text, text, text, text, integer, boolean, date, text)', 'execute')
  and not has_function_privilege('anon', 'public.set_request_open(text, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.start_offer(text, text, text)', 'execute'),
  'anon still runs none'
);
select ok(
  pg_get_functiondef('public.set_request_open(text, boolean)'::regprocedure) ~ 'pg_advisory_xact_lock\(hashtext\(''vossie:requests:'' \|\| asker::text\), 0\)'
  and pg_get_functiondef('public.save_request(text, text, text, text, text, integer, boolean, date, text)'::regprocedure) ~ 'pg_advisory_xact_lock\(hashtext\(''vossie:requests:'' \|\| asker::text\), 0\)',
  'both take the asker''s lock, as before'
);

select * from finish();
rollback;
