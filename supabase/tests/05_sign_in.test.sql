-- Task 8: sign-in state, form states and the email-domain hook (supabase foundation plan; backend spec section 5).
begin;
select plan(77);

-- Signed in as an account, in one Auth session (the JWT's session_id), as PostgREST sets it.
create function pg_temp.sign_in(account uuid, session uuid default '5e550000-0000-4000-8000-000000000001') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', account, 'role', 'authenticated', 'session_id', session)::text, true);
  set local role authenticated;
end;
$f$;
create function pg_temp.sign_out() returns void language plpgsql as $f$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$f$;
-- What the hook answers for an address, as Auth would ask.
create function pg_temp.hook(email text) returns jsonb language sql as $f$
  select private.before_user_created(jsonb_build_object(
    'metadata', jsonb_build_object('uuid', gen_random_uuid(), 'time', now(), 'name', 'before-user-created', 'ip_address', '127.0.0.1'),
    'user', jsonb_build_object('id', gen_random_uuid(), 'aud', 'authenticated', 'role', '', 'email', email, 'phone', '', 'app_metadata', '{}'::jsonb, 'user_metadata', '{}'::jsonb, 'identities', '[]'::jsonb, 'is_anonymous', false)
  ));
$f$;

-- What the access token hook answers, as Auth asks: the method, the session's amr methods and the address.
create function pg_temp.token(method text, amr text[], email text) returns jsonb language sql as $f$
  select private.custom_access_token(jsonb_build_object(
    'user_id', '00000000-0000-4000-8000-0000000000a1',
    'authentication_method', method,
    'claims', jsonb_build_object(
      'iss', 'http://127.0.0.1:55321/auth/v1', 'aud', 'authenticated', 'exp', 1792032900, 'iat', 1792029300,
      'sub', '00000000-0000-4000-8000-0000000000a1', 'email', email, 'phone', '', 'app_metadata', jsonb_build_object('provider', 'email'),
      'user_metadata', '{}'::jsonb, 'role', 'authenticated', 'aal', 'aal1',
      'amr', (select coalesce(jsonb_agg(jsonb_build_object('method', m, 'timestamp', 1792029279)), '[]'::jsonb) from unnest(amr) m),
      'session_id', '5e550000-0000-4000-8000-0000000000a1', 'is_anonymous', false
    )
  ));
$f$;

-- The private tables exist, and the API roles have nothing on them.
select has_table('private', 'sign_in_attempts', 'private.sign_in_attempts exists');
select has_table('private', 'code_sends', 'private.code_sends exists');
select has_table('private', 'allowed_email_domains', 'private.allowed_email_domains exists');
select ok(
  not exists (
    select 1 from unnest(array['private.sign_in_attempts', 'private.code_sends', 'private.allowed_email_domains']) t,
      unnest(array['anon', 'authenticated']) r,
      unnest(array['select', 'insert', 'update', 'delete']) p
    where has_table_privilege(r, t, p)
  ),
  'anon and authenticated have no privilege on the private tables'
);

-- The domain hook: refuses by default, allows exactly the listed domains, never a subdomain (step 2b amendment 2).
delete from private.allowed_email_domains;
select is(
  pg_temp.hook('a@eduvos.com'),
  '{"error": {"http_code": 403, "message": "Use your Eduvos email address."}}'::jsonb,
  'with no domains listed, everyone is refused'
);
insert into private.allowed_email_domains (domain) values ('eduvos.com');
select is(pg_temp.hook('a@eduvos.com'), '{}'::jsonb, 'a@eduvos.com is allowed');
select is(pg_temp.hook('a@students.eduvos.com') ? 'error', true, 'a subdomain is refused (exact domains only)');
select is(pg_temp.hook('  Thandi.M+test@EDUVOS.com '), '{}'::jsonb, 'case and outer spaces don''t matter');
select is(pg_temp.hook('a@eduvos.com.evil.io')->'error'->>'message', 'Use your Eduvos email address.', 'a@eduvos.com.evil.io is refused');
select is(pg_temp.hook('a@gmail.com')->'error'->>'http_code', '403', 'a@gmail.com is refused with a 403');
select is(pg_temp.hook('a@noteduvos.com') ? 'error', true, 'a domain that only ends in the same letters is refused');
select is(pg_temp.hook('a@eduvоs.com') ? 'error', true, 'a look-alike letter (Cyrillic о) is refused');
select is(pg_temp.hook('a@.eduvos.com') ? 'error', true, 'an empty label is refused');
select is(pg_temp.hook('a@eduvos.com.') ? 'error', true, 'a trailing dot is refused');
select is(pg_temp.hook('a@@eduvos.com') ? 'error', true, 'two @ are refused');
select is(pg_temp.hook('@eduvos.com') ? 'error', true, 'nothing before the @ is refused');
select is(pg_temp.hook('a b@eduvos.com') ? 'error', true, 'a space in the address is refused');
select is(pg_temp.hook(repeat('a', 250) || '@eduvos.com') ? 'error', true, 'an address over 254 characters is refused');
select is(pg_temp.hook('') ? 'error', true, 'an empty address is refused');
select is(pg_temp.hook(null) ? 'error', true, 'no address (a phone sign-up) is refused');
select is(private.before_user_created('{}'::jsonb) ? 'error', true, 'an event without a user is refused');
select ok(has_function_privilege('supabase_auth_admin', 'private.before_user_created(jsonb)', 'execute'), 'Auth can run the hook');
select ok(not has_function_privilege('anon', 'private.before_user_created(jsonb)', 'execute'), 'anon cannot');
select ok(not has_function_privilege('authenticated', 'private.before_user_created(jsonb)', 'execute'), 'authenticated cannot');
select ok(not has_function_privilege('service_role', 'private.before_user_created(jsonb)', 'execute'), 'nor the service role');
select ok(has_schema_privilege('supabase_auth_admin', 'private', 'usage'), 'Auth can reach the private schema');
select ok(has_table_privilege('supabase_auth_admin', 'private.allowed_email_domains', 'select'), 'Auth reads the allowed domains');
select ok(not has_table_privilege('supabase_auth_admin', 'private.sign_in_attempts', 'select'), 'and nothing else in private');

-- The access token hook (C1 of the phase A review): a token only for an email-code session on an allowed address.
select is(
  pg_temp.token('otp', array['otp'], 'a@eduvos.com'),
  jsonb_build_object('claims', (pg_temp.token('otp', array['otp'], 'a@eduvos.com') -> 'claims')),
  'an email code''s sign-in gets its token'
);
select is(
  pg_temp.token('otp', array['otp'], 'a@eduvos.com') -> 'claims',
  (select jsonb_build_object(
      'iss', 'http://127.0.0.1:55321/auth/v1', 'aud', 'authenticated', 'exp', 1792032900, 'iat', 1792029300,
      'sub', '00000000-0000-4000-8000-0000000000a1', 'email', 'a@eduvos.com', 'phone', '', 'app_metadata', jsonb_build_object('provider', 'email'),
      'user_metadata', '{}'::jsonb, 'role', 'authenticated', 'aal', 'aal1',
      'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', 1792029279)),
      'session_id', '5e550000-0000-4000-8000-0000000000a1', 'is_anonymous', false)),
  'with its claims unchanged, the required ones included'
);
select is(pg_temp.token('token_refresh', array['otp'], 'a@eduvos.com') ? 'claims', true, 'and so does its refresh');
select is(pg_temp.token('token_refresh', array['otp'], 'a@students.eduvos.com') ? 'error', true, 'but not on a subdomain, which is refused as at sign-up');
select is(
  pg_temp.token('password', array['password'], 'a@eduvos.com'),
  '{"error": {"http_code": 403, "message": "Sign in with the code we email you."}}'::jsonb,
  'a password sign-in gets none'
);
select is(pg_temp.token('token_refresh', array['password'], 'a@eduvos.com') ? 'error', true, 'nor does a password session''s refresh');
select is(pg_temp.token('token_refresh', array['otp', 'password'], 'a@eduvos.com') ? 'error', true, 'nor a session that also used a password');
select is(pg_temp.token('magiclink', array['otp'], 'a@eduvos.com') ? 'error', true, 'nor any other method (a magic link)');
select is(pg_temp.token('anonymous', array['anonymous'], '') ? 'error', true, '(an anonymous sign-in)');
select is(pg_temp.token('otp', '{}', 'a@eduvos.com') ? 'error', true, '(a session with no amr)');
select is(private.custom_access_token('{"authentication_method": "otp", "claims": {"amr": "otp", "email": "a@eduvos.com"}}') ? 'error', true, '(an amr that is not a list)');
select is(private.custom_access_token('{}'::jsonb) ? 'error', true, '(an empty event)');
select is(
  pg_temp.token('otp', array['otp'], 'a@gmail.com'),
  '{"error": {"http_code": 403, "message": "Use your Eduvos email address."}}'::jsonb,
  'an address changed to another domain gets no token'
);
select is(pg_temp.token('token_refresh', array['otp'], 'a@gmail.com') ? 'error', true, 'nor a refresh');
select is(pg_temp.token('otp', array['otp'], 'a@eduvos.com.evil.io') ? 'error', true, 'the domain rule is the same as at sign-up');
select is(
  (select array_agg(private.email_allowed(a) order by n)
   from unnest(array['a@eduvos.com', 'a@x.eduvos.com', ' A@EDUVOS.COM ', 'a@gmail.com', E'a@eduv\u043es.com', null]) with ordinality u(a, n)),
  array[true, false, true, false, false, false],
  'both hooks use one rule (private.email_allowed): exact domains only'
);
select ok(has_function_privilege('supabase_auth_admin', 'private.custom_access_token(jsonb)', 'execute'), 'Auth can run the token hook');
select ok(
  not has_function_privilege('anon', 'private.custom_access_token(jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'private.custom_access_token(jsonb)', 'execute')
  and not has_function_privilege('service_role', 'private.custom_access_token(jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'private.email_allowed(text)', 'execute'),
  'nobody else can'
);

-- Five codes an hour (spec 5): one upsert that only counts up while under the limit.
select is(
  (select array_agg(private.reserve_code_send('rate@eduvos.com', '2026-10-15T08:10:00Z', 5) order by g) from generate_series(1, 6) g),
  array[true, true, true, true, true, false],
  '6 sends in one hour, in one statement: 5 yes, then no'
);
select is((select n from private.code_sends where email = 'rate@eduvos.com'), 5, 'and the count stops at the limit');
select is(private.reserve_code_send('rate@eduvos.com', '2026-10-15T08:59:59Z', 5), false, 'still no later in the same hour');
select is(private.reserve_code_send('rate@eduvos.com', '2026-10-15T09:00:00Z', 5), true, 'yes again in the next hour');
select is(private.reserve_code_send('other@eduvos.com', '2026-10-15T08:30:00Z', 5), true, 'another address has its own count');
set local timezone = 'Asia/Kolkata';
select is(private.reserve_code_send('rate@eduvos.com', '2026-10-15T08:20:00Z', 5), false, 'hours are UTC hours, whatever the session''s time zone');
reset timezone;
select is(private.reserve_code_send('zero@eduvos.com', '2026-10-15T08:00:00Z', 0), false, 'a limit of 0 allows nothing');
select ok(has_function_privilege('service_role', 'private.reserve_code_send(text, timestamptz, integer)', 'execute'), 'the server can reserve a send');
select ok(not has_function_privilege('authenticated', 'private.reserve_code_send(text, timestamptz, integer)', 'execute'), 'a signed-in user cannot');
select ok(not has_function_privilege('anon', 'private.reserve_code_send(text, timestamptz, integer)', 'execute'), 'nor anon');

-- Wrong tries are counted before anything is compared.
insert into private.sign_in_attempts (key, step, email, expires_at) values ('attempt-1', 'code', 'a@eduvos.com', now() + interval '30 minutes');
select is(private.record_wrong_try('attempt-1'), 1, 'the first wrong try counts 1');
select is(private.record_wrong_try('attempt-1'), 2, 'the second counts 2');
select is(private.record_wrong_try('no-such-attempt'), null, 'an unknown attempt counts nothing');
select ok(not has_function_privilege('authenticated', 'private.record_wrong_try(text)', 'execute'), 'a signed-in user cannot count tries');
select throws_ok(
  $$insert into private.sign_in_attempts (key, step, expires_at) values ('attempt-2', 'password', now())$$,
  '23514', null, 'a step is email, code or profile'
);
select throws_ok(
  $$insert into private.sign_in_attempts (key, step, errors, expires_at) values ('attempt-2', 'email', '{made-up}', now())$$,
  '23514', null, 'errors are the sign-in errors'
);
select throws_ok(
  $$insert into private.allowed_email_domains (domain) values ('Eduvos.com')$$,
  '23514', null, 'an allowed domain is written in lower case, as a domain'
);

-- Form states: each account's own.
insert into public.campuses (slug, name, region, sort) values ('test-campus', 'Test campus', 'Gauteng', 99);
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000031', 'f1@eduvos.com'), ('00000000-0000-4000-8000-000000000032', 'f2@eduvos.com');
insert into public.profiles (id, first_name, campus_slug) values
  ('00000000-0000-4000-8000-000000000031', 'Fay', 'test-campus'), ('00000000-0000-4000-8000-000000000032', 'Fred', 'test-campus');
insert into public.form_states (session_id, form, account_id, errors, values, expires_at) values
  ('50000000-0000-4000-8000-000000000002', 'details', '00000000-0000-4000-8000-000000000032', '{first-name-missing}', '{}', now() + interval '10 minutes');

set local role anon;
select throws_ok($$select * from public.form_states$$, '42501', null, 'anon cannot read form states');
reset role;

select pg_temp.sign_in('00000000-0000-4000-8000-000000000031', '50000000-0000-4000-8000-000000000001');
select lives_ok(
  $$insert into public.form_states (session_id, form, account_id, errors, values, expires_at)
    values ('50000000-0000-4000-8000-000000000001', 'details', '00000000-0000-4000-8000-000000000031', '{first-name-length}', '{"firstName": "F"}', now() + interval '10 minutes')$$,
  'a user writes their own form state'
);
select is((select array_agg(form) from public.form_states), array['details'], 'and reads only their own');
select lives_ok(
  $$update public.form_states set notice = 'saved', errors = '{}' where form = 'details'$$,
  'and changes it'
);
select throws_ok(
  $$insert into public.form_states (session_id, form, account_id, expires_at) values ('50000000-0000-4000-8000-000000000003', 'details', '00000000-0000-4000-8000-000000000032', now() + interval '10 minutes')$$,
  '42501', null, 'a user cannot write someone else''s form state'
);
select throws_ok(
  $$insert into public.form_states (session_id, form, account_id, expires_at) values ('50000000-0000-4000-8000-000000000001', 'listing', '00000000-0000-4000-8000-000000000031', now() + interval '30 days')$$,
  '42501', null, 'a form state cannot be made to last for days'
);
select throws_ok(
  $$insert into public.form_states (session_id, form, account_id, expires_at) values ('50000000-0000-4000-8000-000000000009', 'listing', '00000000-0000-4000-8000-000000000031', now() + interval '10 minutes')$$,
  '42501', null, 'nor written for another session of the same account (M3)'
);
select pg_temp.sign_out();
-- The same account in a second browser: another Auth session.
select pg_temp.sign_in('00000000-0000-4000-8000-000000000031', '50000000-0000-4000-8000-000000000009');
select is((select count(*) from public.form_states), 0::bigint, 'another session of the same account sees none of the first''s');
update public.form_states set notice = 'hijacked';
delete from public.form_states;
select lives_ok(
  $$insert into public.form_states (session_id, form, account_id, expires_at) values ('50000000-0000-4000-8000-000000000009', 'details', '00000000-0000-4000-8000-000000000031', now() + interval '10 minutes')$$,
  'and keeps its own'
);
select pg_temp.sign_out();
select is(
  (select array_agg(row(session_id, notice)::text order by session_id) from public.form_states where account_id = '00000000-0000-4000-8000-000000000031'),
  array[row('50000000-0000-4000-8000-000000000001'::uuid, 'saved')::text, row('50000000-0000-4000-8000-000000000009'::uuid, null::text)::text],
  'neither touches the other''s'
);
delete from public.form_states where session_id = '50000000-0000-4000-8000-000000000009';
select pg_temp.sign_in('00000000-0000-4000-8000-000000000031', '50000000-0000-4000-8000-000000000001');
delete from public.form_states where account_id = '00000000-0000-4000-8000-000000000032';
select lives_ok($$delete from public.form_states where form = 'details'$$, 'a user clears their own form state');
select pg_temp.sign_out();
select is(
  (select count(*) from public.form_states where account_id = '00000000-0000-4000-8000-000000000032'),
  1::bigint,
  'someone else''s form state is untouched'
);
select throws_ok(
  format($$insert into public.form_states (session_id, form, account_id, values, expires_at) values ('50000000-0000-4000-8000-000000000005', 'big', '00000000-0000-4000-8000-000000000031', %L, now())$$,
    jsonb_build_object('text', repeat('a', 70000))),
  '23514', null, 'a form state''s values are bounded'
);
delete from auth.users where id = '00000000-0000-4000-8000-000000000032';
select is((select count(*) from public.form_states), 0::bigint, 'an account''s form states go with it');

select * from finish();
rollback;
