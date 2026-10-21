-- Supabase phase B, review fixes 1 and 2 (docs/superpowers/plans/2026-10-21-supabase-phase-b-sign-in.md, "Review fixes"):
-- Auth's audit log loses a deleted account's entries and anything older than 30 days; one network gets 15 codes an
-- hour.
begin;
select plan(26);

-- --- 1. Auth's audit log (review fix 1) -----------------------------------------------------------------------------

select has_function('private', 'sweep_auth_audit_log', array[]::text[], 'sweep_auth_audit_log exists');
select ok(
  not has_function_privilege('service_role', 'private.sweep_auth_audit_log()', 'execute')
    and not has_function_privilege('authenticated', 'private.sweep_auth_audit_log()', 'execute')
    and not has_function_privilege('anon', 'private.sweep_auth_audit_log()', 'execute'),
  'only the database''s owner runs it: no API role'
);
select is(
  (select proconfig from pg_proc where oid = 'private.sweep_auth_audit_log()'::regprocedure),
  array['search_path=""'],
  'with an empty search_path'
);
select is(
  (select array_agg(row(schedule, command, active)::text) from cron.job where jobname = 'sweep-auth-audit-log'),
  array[row('10 1 * * *', 'select private.sweep_auth_audit_log()', true)::text],
  'nightly at 01:10 UTC, once, after sweep-unfinished-users (01:00) has removed its Auth users'
);

-- A student who stays, one who is deleted, and the entries Auth writes about each (their shapes as local Auth writes
-- them: a user's own action names them as the actor; the service role's names them in traits).
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000e1', 'stays@vossie.test'),
  ('00000000-0000-4000-8000-0000000000e2', 'gone@vossie.test');
insert into auth.audit_log_entries (id, payload, created_at, ip_address) values
  -- The one who stays: a sign-in yesterday stays; one 31 days ago goes.
  ('a0d10000-0000-4000-8000-000000000001',
   '{"action":"login","actor_id":"00000000-0000-4000-8000-0000000000e1","actor_username":"stays@vossie.test","log_type":"account"}',
   now() - interval '1 day', '196.25.1.1'),
  ('a0d10000-0000-4000-8000-000000000002',
   '{"action":"login","actor_id":"00000000-0000-4000-8000-0000000000e1","actor_username":"stays@vossie.test","log_type":"account"}',
   now() - interval '31 days', '196.25.1.1'),
  -- The service role made them both yesterday.
  ('a0d10000-0000-4000-8000-000000000003',
   '{"action":"user_signedup","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","log_type":"team","traits":{"user_email":"stays@vossie.test","user_id":"00000000-0000-4000-8000-0000000000e1"}}',
   now() - interval '1 day', ''),
  ('a0d10000-0000-4000-8000-000000000004',
   '{"action":"user_signedup","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","log_type":"team","traits":{"user_email":"gone@vossie.test","user_id":"00000000-0000-4000-8000-0000000000e2"}}',
   now() - interval '1 day', ''),
  -- The deleted one's own sign-in and code request, an hour ago.
  ('a0d10000-0000-4000-8000-000000000005',
   '{"action":"login","actor_id":"00000000-0000-4000-8000-0000000000e2","actor_username":"gone@vossie.test","log_type":"account"}',
   now() - interval '1 hour', '196.25.2.2'),
  ('a0d10000-0000-4000-8000-000000000006',
   '{"action":"user_recovery_requested","actor_id":"00000000-0000-4000-8000-0000000000e2","actor_username":"gone@vossie.test","log_type":"user"}',
   now() - interval '1 hour', '196.25.2.2'),
  -- An entry that names nobody, from today: it stays its 30 days.
  ('a0d10000-0000-4000-8000-000000000007',
   '{"action":"token_revoked","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","log_type":"token"}',
   now() - interval '1 hour', '');
-- Deleting the account's Auth user (account deletion's last step) makes Auth write one more entry about it.
delete from auth.users where id = '00000000-0000-4000-8000-0000000000e2';
insert into auth.audit_log_entries (id, payload, created_at, ip_address) values
  ('a0d10000-0000-4000-8000-000000000008',
   '{"action":"user_deleted","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","log_type":"team","traits":{"user_email":"gone@vossie.test","user_id":"00000000-0000-4000-8000-0000000000e2"}}',
   now(), '');

select cmp_ok(private.sweep_auth_audit_log(), '>=', 5, 'the sweep deletes at least the five entries it should');
select is(
  (select count(*) from auth.audit_log_entries where payload::text like '%gone@vossie.test%'
     or payload::text like '%00000000-0000-4000-8000-0000000000e2%' or ip_address = '196.25.2.2'),
  0::bigint,
  'no entry names the deleted account: its address, its id or its IP address'
);
select is(
  array(select id::text from auth.audit_log_entries where id::text like 'a0d10000-%' order by id),
  array['a0d10000-0000-4000-8000-000000000001', 'a0d10000-0000-4000-8000-000000000003', 'a0d10000-0000-4000-8000-000000000007'],
  'a live account''s entries from the last 30 days stay, as does one that names nobody; one 31 days old goes'
);
select is(
  (select count(*) from auth.audit_log_entries where created_at < now() - interval '30 days'),
  0::bigint,
  'nothing older than 30 days is left'
);
select is(private.sweep_auth_audit_log(), 0, 'a second run finds nothing more');

-- --- 2. Sends per network (review fix 2) ----------------------------------------------------------------------------

select has_table('private', 'ip_code_sends', 'private.ip_code_sends exists');
select ok((select relrowsecurity from pg_class where oid = 'private.ip_code_sends'::regclass), 'with row level security on');
select ok(
  not has_table_privilege('anon', 'private.ip_code_sends', 'select')
    and not has_table_privilege('authenticated', 'private.ip_code_sends', 'select')
    and not has_table_privilege('authenticated', 'private.ip_code_sends', 'insert'),
  'and nothing for anon or signed-in users'
);
select throws_ok(
  $$insert into private.ip_code_sends (ip_key, hour, n) values ('', date_trunc('hour', now()), 1)$$,
  '23514', null, 'a key is never empty'
);

select is(
  (select array_agg(private.reserve_ip_code_send('ip-a', '2026-10-21T08:10:00Z', 15) order by g) from generate_series(1, 16) g),
  array_fill(true, array[15]) || false,
  'one network gets 15 sends in an hour, and the 16th is refused'
);
select is(
  (select n from private.ip_code_sends where ip_key = 'ip-a'),
  15,
  'a refusal isn''t counted'
);
select is(private.reserve_ip_code_send('ip-b', '2026-10-21T08:30:00Z', 15), true, 'another network has its own count');
select is(private.reserve_ip_code_send('ip-a', '2026-10-21T09:00:00Z', 15), true, 'and the first gets more in the next UTC hour');
select is(private.reserve_ip_code_send('ip-a', '2026-10-21T08:10:00Z', 0), false, 'a limit of 0 allows nothing');
select is(private.reserve_ip_code_send('', '2026-10-21T08:10:00Z', 15), false, 'nor does an empty key');

select ok(
  not has_function_privilege('service_role', 'private.reserve_ip_code_send(text, timestamptz, integer)', 'execute')
    and not has_function_privilege('authenticated', 'private.reserve_ip_code_send(text, timestamptz, integer)', 'execute')
    and not has_function_privilege('anon', 'private.reserve_ip_code_send(text, timestamptz, integer)', 'execute'),
  'the private count is reached only through the public wrapper'
);
select ok(
  has_function_privilege('service_role', 'public.reserve_ip_code_send(text, integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.reserve_ip_code_send(text, integer)', 'execute')
    and not has_function_privilege('anon', 'public.reserve_ip_code_send(text, integer)', 'execute'),
  'which runs for the service role only'
);
set local role anon;
select throws_ok($$select public.reserve_ip_code_send('ip-c', 15)$$, '42501', null, 'anon cannot count a send');
reset role;
set local role service_role;
select is(public.reserve_ip_code_send('ip-c', 15), true, 'the service role counts one in the current hour');
select is(public.reserve_ip_code_send('ip-c'), true, 'the limit is 15 when not given');
reset role;
select is(
  (select row(n, hour = date_trunc('hour', now(), 'UTC'))::text from private.ip_code_sends where ip_key = 'ip-c'),
  row(2, true)::text,
  'two counted, in this UTC hour'
);

-- The hourly sweep (sweep-sign-in) tidies past hours' counts, as it does the per-email ones.
select private.sweep_sign_in();
select is(
  array(select ip_key from private.ip_code_sends order by ip_key),
  array['ip-c'],
  'the hourly sweep keeps only this hour''s counts'
);

select * from finish();
rollback;
