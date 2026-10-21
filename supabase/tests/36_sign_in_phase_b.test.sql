-- Supabase phase B, Task 2: sign-in on Supabase Auth (plan decisions 2, 3, 6, 12; amendments 2 and 18).
begin;
select plan(48);

create function pg_temp.sign_in(account uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', account, 'role', 'authenticated', 'session_id', gen_random_uuid())::text, true);
  set local role authenticated;
end;
$f$;

-- An attempt as the app's SignInAttemptRow, in camel case, with what a test changes.
create function pg_temp.attempt(changes jsonb default '{}') returns jsonb language sql as $f$
  select jsonb_build_object(
    'key', 'phase-b-attempt',
    'step', 'code',
    'email', 'thandi@vossie.net',
    'errors', jsonb_build_array('code-wrong'),
    'resent', true,
    'codeHash', 'never-stored',
    'codeExpiresAt', '2026-10-21T10:10:00.000Z',
    'wrongTries', 2,
    'consentedAt', '2026-10-21T09:59:00.000Z',
    'firstName', 'Thandi',
    'campusSlug', 'pretoria',
    'postedAt', '2026-10-21T10:01:00.000Z',
    'expiresAt', (now() + interval '30 minutes')
  ) || changes;
$f$;

-- 1. The three new error codes (decision 6) and amendment 18's.
select lives_ok(
  $$insert into private.sign_in_attempts (key, email, errors, expires_at)
    values ('new-errors', 'a@vossie.net', array['code-soon', 'send-failed', 'ip-rate', 'code-check-failed'], now() + interval '30 minutes')$$,
  'an attempt may hold code-soon, send-failed, ip-rate and code-check-failed'
);
select throws_ok(
  $$insert into private.sign_in_attempts (key, email, errors, expires_at) values ('bad-error', 'a@vossie.net', array['nonsense'], now() + interval '30 minutes')$$,
  '23514', null, 'but nothing else'
);

-- 2. The attempt functions, for the admin client only.
select has_function('public', 'get_sign_in_attempt', array['text'], 'get_sign_in_attempt exists');
select has_function('public', 'save_sign_in_attempt', array['jsonb'], 'save_sign_in_attempt exists');
select has_function('public', 'delete_sign_in_attempt', array['text'], 'delete_sign_in_attempt exists');
set local role anon;
select throws_ok($$select public.get_sign_in_attempt('x')$$, '42501', null, 'anon cannot read an attempt');
select throws_ok($$select public.save_sign_in_attempt(pg_temp.attempt())$$, '42501', null, 'nor save one');
select throws_ok($$select public.delete_sign_in_attempt('x')$$, '42501', null, 'nor delete one');
select throws_ok($$select * from public.account_sessions(gen_random_uuid())$$, '42501', null, 'nor list sessions');
reset role;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000b6');
select throws_ok($$select public.get_sign_in_attempt('x')$$, '42501', null, 'a signed-in user cannot read an attempt');
select throws_ok($$select public.save_sign_in_attempt(pg_temp.attempt())$$, '42501', null, 'nor save one');
select throws_ok($$select public.delete_sign_in_attempt('x')$$, '42501', null, 'nor delete one');
select throws_ok($$select * from public.account_sessions(gen_random_uuid())$$, '42501', null, 'nor list sessions');
reset role;

set local role service_role;
select lives_ok($$select public.save_sign_in_attempt(pg_temp.attempt())$$, 'the service role saves an attempt');
select is(
  public.get_sign_in_attempt('phase-b-attempt'),
  jsonb_build_object(
    'key', 'phase-b-attempt', 'step', 'code', 'email', 'thandi@vossie.net', 'errors', jsonb_build_array('code-wrong'),
    'resent', true, 'codeHash', null, 'codeExpiresAt', to_jsonb('2026-10-21T10:10:00Z'::timestamptz), 'wrongTries', 2,
    'consentedAt', to_jsonb('2026-10-21T09:59:00Z'::timestamptz), 'firstName', 'Thandi', 'campusSlug', 'pretoria',
    'postedAt', to_jsonb('2026-10-21T10:01:00Z'::timestamptz), 'expiresAt', to_jsonb(now() + interval '30 minutes')
  ),
  'and reads every field back, with no code hash (Supabase holds the code)'
);
select is(public.get_sign_in_attempt('no-such-attempt'), null, 'an unknown attempt reads null');
select throws_ok(
  $$select public.save_sign_in_attempt(pg_temp.attempt(jsonb_build_object('key', 'too-long', 'expiresAt', now() + interval '32 minutes')))$$,
  '22023', null, 'an attempt meant to last more than 31 minutes is refused'
);
select throws_ok(
  $$select public.save_sign_in_attempt(pg_temp.attempt(jsonb_build_object('key', 'bad-step', 'step', 'done')))$$,
  '23514', null, 'the table''s own checks are the backstop'
);
select throws_ok($$select public.save_sign_in_attempt(null)$$, '22023', null, 'and an attempt with no key is refused');
reset role;
insert into private.sign_in_attempts (key, email, expires_at) values ('ran-out', 'a@vossie.net', now() - interval '1 second');
set local role service_role;
select is(public.get_sign_in_attempt('ran-out'), null, 'an attempt that has run out reads null');

-- record_wrong_try counts every try, before verifyOtp (decision 2).
select is(public.record_wrong_try('phase-b-attempt'), 3, 'a try is counted on the saved count');
select is(public.record_wrong_try('phase-b-attempt'), 4, 'and the next one after it');
select is(public.record_wrong_try('phase-b-attempt'), 5, 'up to five');

-- Amendment 2: a save never lowers the count, unless it brings a new code.
select public.save_sign_in_attempt(pg_temp.attempt(jsonb_build_object('wrongTries', 1)));
select is((public.get_sign_in_attempt('phase-b-attempt') ->> 'wrongTries')::int, 5, 'a save with 1 after a count of 5 keeps 5');
select public.save_sign_in_attempt(pg_temp.attempt(jsonb_build_object('wrongTries', 0, 'codeExpiresAt', '2026-10-21T10:20:00.000Z')));
select is((public.get_sign_in_attempt('phase-b-attempt') ->> 'wrongTries')::int, 0, 'a save with a new code and 0 resets it');
select public.record_wrong_try('phase-b-attempt');
select public.save_sign_in_attempt(pg_temp.attempt(jsonb_build_object('wrongTries', 0, 'codeExpiresAt', '2026-10-21T10:10:00.000Z')));
select is(
  public.get_sign_in_attempt('phase-b-attempt') ->> 'codeExpiresAt',
  to_jsonb('2026-10-21T10:20:00Z'::timestamptz) #>> '{}',
  'a late save about the older code keeps the newer code'
);
select is((public.get_sign_in_attempt('phase-b-attempt') ->> 'wrongTries')::int, 1, 'and its count');
-- The lockout sticks: a stale "wrong" save landing after it changes nothing.
select public.save_sign_in_attempt(pg_temp.attempt(jsonb_build_object(
  'step', 'email', 'errors', jsonb_build_array('locked'), 'codeExpiresAt', null, 'wrongTries', 5
)));
select public.save_sign_in_attempt(pg_temp.attempt(jsonb_build_object('wrongTries', 3, 'codeExpiresAt', '2026-10-21T10:20:00.000Z')));
reset role;
select is(
  (select row(step, errors, code_expires_at, wrong_tries)::text from private.sign_in_attempts where key = 'phase-b-attempt'),
  row('email', array['locked'], null::timestamptz, 5)::text,
  'a save after the lockout can''t put the code step back'
);
set local role service_role;
select lives_ok($$select public.delete_sign_in_attempt('phase-b-attempt')$$, 'the service role ends an attempt');
select is(public.get_sign_in_attempt('phase-b-attempt'), null, 'and it is gone');
reset role;

-- 3. The data download's sessions (decision 3): when each started and when it ends, oldest first, never an id.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000b1', 'sessions@vossie.net'),
  ('00000000-0000-4000-8000-0000000000b2', 'someone-else@vossie.net');
insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at) values
  ('5e550000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b1', '2026-10-10T08:00Z', '2026-10-12T08:00Z', null),
  ('5e550000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000b1', '2026-10-01T08:00Z', '2026-10-01T08:00Z', '2026-10-20 06:30:00'),
  ('5e550000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000b2', '2026-10-02T08:00Z', null, null);
set local role service_role;
select is(
  array(select row(signed_in_at, expires_at)::text from public.account_sessions('00000000-0000-4000-8000-0000000000b1')),
  array[
    row('2026-10-01T08:00Z'::timestamptz, '2026-11-19T06:30Z'::timestamptz)::text,
    row('2026-10-10T08:00Z'::timestamptz, '2026-11-11T08:00Z'::timestamptz)::text
  ],
  'an account''s sessions, oldest first, each ending 30 days after its last refresh (refreshed_at is UTC)'
);
select is(
  (select array_agg(p.parameter_name::text order by p.ordinal_position) from information_schema.parameters p
   join information_schema.routines r on r.specific_name = p.specific_name
   where r.routine_schema = 'public' and r.routine_name = 'account_sessions' and p.parameter_mode = 'OUT'),
  array['signed_in_at', 'expires_at'],
  'with two columns and no session id'
);
reset role;

-- 4. The idle-session job (decision 3).
insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at) values
  ('5e550000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b2', now() - interval '60 days', now() - interval '60 days',
   (now() - interval '31 days') at time zone 'UTC'),
  ('5e550000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000b2', now() - interval '60 days', now() - interval '60 days',
   (now() - interval '29 days') at time zone 'UTC'),
  ('5e550000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000b2', now() - interval '31 days', null, null);
delete from auth.sessions where id in ('5e550000-0000-4000-8000-0000000000b1', '5e550000-0000-4000-8000-0000000000b2', '5e550000-0000-4000-8000-0000000000b3');
select is(private.sweep_idle_sessions(), 2, 'the sweep ends two idle sessions');
select is(
  array(select id::text from auth.sessions where user_id = '00000000-0000-4000-8000-0000000000b2' order by id),
  array['5e550000-0000-4000-8000-0000000000c2'],
  'one refreshed 31 days ago and one never refreshed but made 31 days ago go; one refreshed 29 days ago stays'
);
select is(
  (select array_agg(row(schedule, command, active)::text) from cron.job where jobname = 'sweep-idle-sessions'),
  array[row('20 * * * *', 'select private.sweep_idle_sessions()', true)::text],
  'it runs hourly, once'
);
select ok(
  not has_function_privilege('service_role', 'private.sweep_idle_sessions()', 'execute')
    and not has_function_privilege('authenticated', 'private.sweep_idle_sessions()', 'execute')
    and not has_function_privilege('anon', 'private.sweep_idle_sessions()', 'execute'),
  'only the database''s owner runs it'
);

-- 5. The first admin (decision 12).
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000d1', 'First.Admin@vossie.net');
insert into public.profiles (id, first_name, campus_slug) values ('00000000-0000-4000-8000-0000000000d1', 'Lama', 'pretoria');
update public.profiles set roles = array_remove(roles, 'admin') where 'admin' = any (roles);
select is(private.make_first_admin('nobody@vossie.net'), 'no-account', 'an address with no finished profile is no-account');
select is(private.make_first_admin(null), 'no-account', 'and so is no address');
select is(private.make_first_admin('  first.admin@VOSSIE.net '), 'made', 'with no admin, the address (any case, trimmed) is made admin');
select is((select roles from public.profiles where id = '00000000-0000-4000-8000-0000000000d1'), array['admin'], 'with the Admin role');
select is(
  (select array_agg(row(staff_id, staff_name, action, target_kind, target_id, target_name, detail, subject_id)::text)
   from public.audit_log where subject_id = '00000000-0000-4000-8000-0000000000d1'),
  array[row(null::uuid, 'Set up outside Vossie', 'role-given', 'account', '00000000-0000-4000-8000-0000000000d1', 'Lama', 'Admin',
            '00000000-0000-4000-8000-0000000000d1'::uuid)::text],
  'and one audit entry'
);
select is(private.make_first_admin('first.admin@vossie.net'), 'admin-exists', 'a second call finds an admin and does nothing');
select ok(
  not has_function_privilege('anon', 'private.make_first_admin(text)', 'execute')
    and not has_function_privilege('authenticated', 'private.make_first_admin(text)', 'execute')
    and not has_function_privilege('service_role', 'private.make_first_admin(text)', 'execute'),
  'no API role can run it'
);

-- 6. Deleting an account clears the sign-in rows for its address, and only those.
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000e1', 'leaving@vossie.net');
insert into public.profiles (id, first_name, campus_slug) values ('00000000-0000-4000-8000-0000000000e1', 'Leaving', 'pretoria');
insert into private.sign_in_attempts (key, email, expires_at) values
  ('leaving-attempt', 'leaving@vossie.net', now() + interval '30 minutes'),
  ('staying-attempt', 'staying@vossie.net', now() + interval '30 minutes');
insert into private.code_sends (email, hour, n) values
  ('leaving@vossie.net', date_trunc('hour', now(), 'UTC'), 1),
  ('staying@vossie.net', date_trunc('hour', now(), 'UTC'), 1);
select public.forget_account('00000000-0000-4000-8000-0000000000e1');
select is(
  (select array_agg(key order by key) from private.sign_in_attempts where key in ('leaving-attempt', 'staying-attempt')),
  array['staying-attempt'],
  'forget_account ends the deleted address''s attempt and keeps another''s'
);
select is(
  (select array_agg(email order by email) from private.code_sends where email in ('leaving@vossie.net', 'staying@vossie.net')),
  array['staying@vossie.net'],
  'and its code count'
);

-- 7. No HMAC in Postgres (stage K amendment 7): the token:/code: prefixes live only in lib/auth/secrets.ts.
select is(
  array(select p.oid::regprocedure::text from pg_proc p
        where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace) and p.prosrc ~* '\mhmac\s*\('),
  '{}'::text[],
  'no function in public or private calls hmac( (if one ever does, it must use the token: and code: prefixes)'
);

-- 8. The new functions are the service role's alone.
select is(
  array(
    select p.oid::regprocedure::text from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('get_sign_in_attempt', 'save_sign_in_attempt', 'delete_sign_in_attempt', 'account_sessions')
      and has_function_privilege('service_role', p.oid, 'execute')
      and not has_function_privilege('authenticated', p.oid, 'execute')
      and not has_function_privilege('anon', p.oid, 'execute')
    order by 1
  ),
  array['account_sessions(uuid)', 'delete_sign_in_attempt(text)', 'get_sign_in_attempt(text)', 'save_sign_in_attempt(jsonb)'],
  'the four run for the service role only'
);
select ok(
  (select prosecdef from pg_proc where oid = 'public.save_sign_in_attempt(jsonb)'::regprocedure)
    and (select prosecdef from pg_proc where oid = 'public.account_sessions(uuid)'::regprocedure),
  'as security definers'
);

select * from finish();
rollback;
