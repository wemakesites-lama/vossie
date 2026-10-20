-- Task 9: finishing a first sign-in (complete_profile), the server's sign-in counters, and who may call each function
-- the app calls (supabase foundation plan; lib/data/accounts.ts createAccount and recordConsent; lib/auth/profile.ts).
begin;
select plan(58);

create function pg_temp.sign_in(account uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', account, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$f$;
create function pg_temp.sign_out() returns void language plpgsql as $f$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$f$;

insert into public.campuses (slug, name, region, sort) values ('test-campus', 'Test campus', 'Gauteng', 98), ('other-campus', 'Other campus', 'Gauteng', 99);
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000051', 'new@eduvos.com'),
  ('00000000-0000-4000-8000-000000000052', 'other@eduvos.com'),
  ('00000000-0000-4000-8000-000000000053', 'unfinished@eduvos.com');
-- A later version of the policy, as a migration would add it.
insert into private.policy_versions (version) values ('2026-11');

-- Every public function is either a user action (authenticated) or the server's (service role), and anon runs only the
-- named read-only counts (schema catch-up Task 2: hub_going; Task 3: request_offer_count).
select is(
  array(
    select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
    order by 1
  ),
  array['hub_going(text)', 'request_offer_count(text)'],
  'anon can run no function in public but the named counts'
);
select is(
  array(
    select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and not p.prosecdef
    order by 1
  ),
  '{}'::text[],
  'every function in public is security definer'
);
select is(
  array(
    select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and not coalesce(p.proconfig @> array['search_path=""'], false)
    order by 1
  ),
  '{}'::text[],
  'and runs with an empty search path'
);
select is(
  array(
    select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')
    order by 1
  ),
  array[
    'add_photos(text[])',
    'approve_shop(uuid)',
    'change_shop_slug(text)',
    'complete_profile(text,text,text)',
    'confirm_sale(uuid)',
    'create_report(text,text,text,text,text)',
    'create_shop(text,text,text,text,uuid,text,uuid[])',
    'decline_shop(uuid,text)',
    'delete_listing(text)',
    'dismiss_report(uuid,text)',
    'follower_count(uuid)',
    'hide_listing(text,text)',
    'hide_request(text,text)',
    'hub_going(text)',
    'mark_completed(uuid)',
    'mark_notifications_read()',
    'mark_thread_read(uuid)',
    'mentor_shop_numbers(uuid,timestamp with time zone)',
    'record_consent(text)',
    'reject_sale(uuid)',
    'request_offer_count(text)',
    'resend_for_approval()',
    'save_listing(text,text,text,text,text,integer,boolean,text,text,text,text,uuid,jsonb,boolean)',
    'save_onboarding_draft(text,text,text,text,uuid,text,uuid[])',
    'send_message(uuid,text)',
    'set_listing_state(text,text)',
    'set_shop_mentor(uuid,uuid)',
    'set_shop_paused(boolean)',
    'set_shop_verified(uuid,boolean)',
    'settle_sales()',
    'show_listing(text)',
    'show_request(text)',
    'staff_pause_shop(uuid,text)',
    'staff_resume_shop(uuid)',
    'start_conversation(text,text,text,text)',
    'update_profile(text,text)',
    'update_shop(text,text,text,text,text,uuid[],uuid,boolean,text)'
  ],
  'the user actions, and nothing else, run for signed-in users'
);
select is(
  array(
    select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('service_role', p.oid, 'execute')
      and not has_function_privilege('authenticated', p.oid, 'execute')
    order by 1
  ),
  array[
    'forget_account(uuid)',
    'record_wrong_try(text)',
    'reserve_code_send(text,integer)',
    'settle_auto_confirm(timestamp with time zone)'
  ],
  'the server''s functions run for the service role only'
);

-- complete_profile: step 3 of a first sign-in (accounts spec 2.6 and 2.7).
select pg_temp.sign_in('00000000-0000-4000-8000-000000000051');
select is(public.complete_profile('Thandi', 'test-campus', '2026-10-draft'), true, 'a first sign-in makes the profile');
select pg_temp.sign_out();
select is(
  (select row(first_name, campus_slug, roles, created_at = now())::text from public.profiles where id = '00000000-0000-4000-8000-000000000051'),
  row('Thandi', 'test-campus', '{}'::text[], true)::text,
  'with the first name and campus, and no roles'
);
select is(
  (select array_agg(row(version, agreed_at = now())::text) from public.consents where account_id = '00000000-0000-4000-8000-000000000051'),
  array[row('2026-10-draft', true)::text],
  'and records consent to the policy'
);
select pg_temp.sign_in('00000000-0000-4000-8000-000000000051');
select is(public.complete_profile('Someone', 'other-campus', '2026-10-draft'), false, 'a second post makes nothing');
select is(public.complete_profile('Someone', 'other-campus', '2026-11'), false, 'nor does a later one with a new policy');
select pg_temp.sign_out();
select is(
  (select row(first_name, campus_slug)::text from public.profiles where id = '00000000-0000-4000-8000-000000000051'),
  row('Thandi', 'test-campus')::text,
  'and never overwrites the name or campus (an email has one account, ever)'
);
select is(
  (select array_agg(version order by version) from public.consents where account_id = '00000000-0000-4000-8000-000000000051'),
  array['2026-10-draft', '2026-11'],
  'each policy version is recorded once'
);

select pg_temp.sign_in('00000000-0000-4000-8000-000000000052');
select throws_ok($$select public.complete_profile('T', 'test-campus', '2026-10-draft')$$, '22023', null, 'a first name has at least 2 characters');
select throws_ok(format($$select public.complete_profile(%L, 'test-campus', '2026-10-draft')$$, repeat('a', 41)), '22023', null, 'and at most 40');
select throws_ok($$select public.complete_profile('12', 'test-campus', '2026-10-draft')$$, '22023', null, 'and a letter');
select throws_ok($$select public.complete_profile(' Thandi', 'test-campus', '2026-10-draft')$$, '22023', null, 'and is tidied first (no outer spaces)');
select throws_ok($$select public.complete_profile('Thandi  Mary', 'test-campus', '2026-10-draft')$$, '22023', null, '(no double spaces)');
select throws_ok(format($$select public.complete_profile(%L, 'test-campus', '2026-10-draft')$$, E'Thandi\u200bMary'), '22023', null, '(no invisible characters)');
select throws_ok(format($$select public.complete_profile(%L, 'test-campus', '2026-10-draft')$$, E'Zé'), '22023', null, '(composed: NFC)');
select throws_ok($$select public.complete_profile('Thandi', 'atlantis', 'v1')$$, '22023', null, 'the campus is one of the campuses');
select throws_ok($$select public.complete_profile('Thandi', 'test-campus', '')$$, '22023', null, 'and a policy version is given');
select throws_ok($$select public.complete_profile('Thandi', 'test-campus', '2099-01')$$, '22023', null, 'one the policy has had');
select throws_ok($$select public.complete_profile(E'Thandi\u202eMary', 'test-campus', '2026-10-draft')$$, '22023', null, '(no direction overrides)');
select throws_ok($$select public.complete_profile(E'Thandi\u00a0Mary', 'test-campus', '2026-10-draft')$$, '22023', null, '(no other spaces)');
select is(public.complete_profile('Zé Ngubane-Smith', 'other-campus', '2026-10-draft'), true, 'a name with accents, a space and a hyphen is fine');
select pg_temp.sign_out();

-- update_profile: "Edit details" (accounts spec 3.2), checked as step 3 checks (I3 of the phase A review).
select pg_temp.sign_in('00000000-0000-4000-8000-000000000052');
select is(public.update_profile('Zola', 'test-campus'), true, 'a student changes their first name and campus');
select throws_ok($$select public.update_profile('Z', 'test-campus')$$, '22023', null, 'with the same rules as step 3');
select throws_ok($$select public.update_profile(E'Zola\u200b', 'test-campus')$$, '22023', null, '(no invisible characters)');
select throws_ok($$select public.update_profile('Zola', 'atlantis')$$, '22023', null, '(a known campus)');
select pg_temp.sign_out();
select is(
  (select row(first_name, campus_slug, roles)::text from public.profiles where id = '00000000-0000-4000-8000-000000000052'),
  row('Zola', 'test-campus', '{}'::text[])::text,
  'only their own name and campus change, never the roles'
);
select pg_temp.sign_in('00000000-0000-4000-8000-000000000053');
select is(public.update_profile('Unfinished', 'test-campus'), false, 'an account with no profile has nothing to edit (updateAccountDetails'' null)');
select pg_temp.sign_out();

-- record_consent: a returning sign-in records consent to the current version (finishSignIn), agreed now.
select pg_temp.sign_in('00000000-0000-4000-8000-000000000052');
select is(public.record_consent('2026-11'), true, 'a returning student''s consent to a new version is recorded');
select is(public.record_consent('2026-11'), false, 'once');
select throws_ok($$select public.record_consent('2099-01')$$, '22023', null, 'only to a version the policy has had');
select throws_ok($$select public.record_consent(null)$$, '22023', null, '(not none)');
select pg_temp.sign_out();
select is(
  (select array_agg(row(version, agreed_at = now())::text order by version) from public.consents where account_id = '00000000-0000-4000-8000-000000000052'),
  array[row('2026-10-draft', true)::text, row('2026-11', true)::text],
  'each version once, agreed when it was recorded'
);
select pg_temp.sign_in('00000000-0000-4000-8000-000000000053');
select throws_ok($$select public.record_consent('2026-11')$$, '42501', null, 'an account that hasn''t finished signing in records nothing here');
select pg_temp.sign_out();
set local role anon;
select throws_ok($$select public.update_profile('Thandi', 'test-campus')$$, '42501', null, 'anon cannot edit a profile');
select throws_ok($$select public.record_consent('2026-11')$$, '42501', null, 'nor record consent');
reset role;

set local role anon;
select throws_ok($$select public.complete_profile('Thandi', 'test-campus', '2026-10-draft')$$, '42501', null, 'anon cannot make a profile');
reset role;
select throws_ok(
  $$select public.complete_profile('Thandi', 'test-campus', '2026-10-draft')$$,
  '42501', null, 'nor can a call with no one signed in'
);

-- The server's sign-in counters (spec 5), through the public wrappers the admin client calls.
set local role service_role;
select is(
  (select array_agg(public.reserve_code_send('wrapper@eduvos.com', 5) order by g) from generate_series(1, 6) g),
  array[true, true, true, true, true, false],
  'the service role reserves 5 codes an hour, now'
);
select is(public.reserve_code_send('wrapper2@eduvos.com', 1), true, 'with the limit it is given');
select is(public.reserve_code_send('wrapper2@eduvos.com', 1), false, 'and no more');
reset role;
select is(
  (select hour from private.code_sends where email = 'wrapper@eduvos.com'),
  date_trunc('hour', now(), 'UTC'),
  'counted in the current UTC hour'
);
insert into private.sign_in_attempts (key, step, email, expires_at) values ('wrapper-attempt', 'code', 'a@eduvos.com', now() + interval '30 minutes');
set local role service_role;
select is(public.record_wrong_try('wrapper-attempt'), 1, 'the service role counts a wrong try');
select is(public.record_wrong_try('no-such'), null, 'and nothing for an unknown attempt');
reset role;
select pg_temp.sign_in('00000000-0000-4000-8000-000000000051');
select throws_ok($$select public.reserve_code_send('x@eduvos.com', 5)$$, '42501', null, 'a signed-in user cannot reserve codes');
select throws_ok($$select public.record_wrong_try('wrapper-attempt')$$, '42501', null, 'nor count tries');
select throws_ok($$select public.forget_account('00000000-0000-4000-8000-000000000052')$$, '42501', null, 'nor forget an account');
select throws_ok($$select public.settle_auto_confirm(now())$$, '42501', null, 'nor settle everyone''s sales');
select pg_temp.sign_out();
set local role anon;
select throws_ok($$select public.reserve_code_send('x@eduvos.com', 5)$$, '42501', null, 'anon cannot reserve codes');
select throws_ok($$select public.forget_account('00000000-0000-4000-8000-000000000052')$$, '42501', null, 'nor forget an account');
reset role;

-- The helpers in private stay closed.
select is(
  array(
    select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and has_function_privilege('anon', p.oid, 'execute')
    order by 1
  ),
  array['private.shop_is_public(uuid)'],
  'anon runs only the helper its policies need'
);
select is(
  array(
    select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and has_function_privilege('authenticated', p.oid, 'execute')
    order by 1
  ),
  array[
    'private.can_mentor(uuid)', 'private.conversation_buyer_name(uuid)', 'private.conversation_request_state(uuid)',
    'private.conversation_side(uuid)', 'private.is_my_request(text)', 'private.is_staff(text)', 'private.mentors_shop(uuid)',
    'private.owns_shop(uuid)', 'private.shop_is_public(uuid)', 'private.staff_hub_posts()', 'private.staff_reports()',
    'private.staff_seller_profiles()'
  ],
  'and authenticated only the ones theirs need'
);
select ok(not has_schema_privilege('authenticated', 'private', 'usage'), 'the private schema stays closed');
select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname in ('sweep_sign_in', 'sweep_unfinished_users', 'sweep_cron_history')
     and (has_function_privilege('service_role', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
  0::bigint,
  'the jobs'' sweeps run only as the database''s owner'
);
select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname in ('sweep_sign_in', 'sweep_unfinished_users', 'sweep_cron_history')),
  3::bigint,
  'all three exist'
);

select * from finish();
rollback;
