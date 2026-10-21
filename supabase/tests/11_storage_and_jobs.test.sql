-- Task 10: the photos bucket and the scheduled jobs (supabase foundation plan; backend spec sections 6 and 7).
begin;
select plan(32);

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

-- The bucket (spec 6): private, 5 MiB, JPEG, PNG and WebP.
select is(
  (select row(public, file_size_limit, allowed_mime_types)::text from storage.buckets where id = 'photos'),
  row(false, 5242880::bigint, array['image/jpeg', 'image/png', 'image/webp'])::text,
  'the photos bucket is private, 5 MiB, JPEG, PNG and WebP only'
);
select is(
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
     and roles && array['anon', 'authenticated', 'public']::name[]),
  0::bigint,
  'no policy on storage.objects lets anon or signed-in users in'
);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000b1', 'store@eduvos.com');
insert into storage.objects (bucket_id, name, owner_id) values
  ('photos', '00000000-0000-4000-8000-0000000000b1/30000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000b1');
set local role anon;
select is((select count(*) from storage.objects where bucket_id = 'photos'), 0::bigint, 'anon sees no photo files');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('photos', 'anon/upload')$$,
  '42501', null, 'anon cannot upload one'
);
select is((select count(*) from storage.buckets where id = 'photos'), 0::bigint, 'nor see the bucket');
reset role;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000b1');
select is((select count(*) from storage.objects where bucket_id = 'photos'), 0::bigint, 'a signed-in user sees no photo files, not even their own');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('photos', '00000000-0000-4000-8000-0000000000b1/x', '00000000-0000-4000-8000-0000000000b1')$$,
  '42501', null, 'nor uploads one: only the admin client does (spec 6)'
);
update storage.objects set name = 'moved' where bucket_id = 'photos';
select throws_ok($$delete from storage.objects where bucket_id = 'photos'$$, '42501', null, 'Storage refuses a direct delete');
-- With Storage's own guard lifted, row level security still hides the file.
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = 'photos';
select pg_temp.sign_out();
select is(
  (select name from storage.objects where bucket_id = 'photos' and owner_id = '00000000-0000-4000-8000-0000000000b1'),
  '00000000-0000-4000-8000-0000000000b1/30000000-0000-4000-8000-0000000000b1',
  'nor moves or deletes one'
);

-- The jobs (spec 7), in UTC.
select is(
  (select array_agg(row(jobname, schedule, command, active)::text order by jobname) from cron.job
   where jobname in ('settle-sales', 'sweep-sign-in', 'sweep-unfinished-users', 'sweep-cron-history')),
  array[
    row('settle-sales', '0 * * * *', 'select public.settle_auto_confirm()', true)::text,
    row('sweep-cron-history', '30 2 * * *', 'select private.sweep_cron_history()', true)::text,
    row('sweep-sign-in', '15 * * * *', 'select private.sweep_sign_in()', true)::text,
    row('sweep-unfinished-users', '0 1 * * *', 'select private.sweep_unfinished_users()', true)::text
  ],
  'the four jobs exist with their schedules: hourly, hourly, 01:00 UTC (03:00 SAST) and daily'
);
-- Each once. Step 2b's settle-requests (test 26) is a fifth job, so the count names these four.
select is(
  (select count(*) from cron.job where jobname in ('settle-sales', 'sweep-sign-in', 'sweep-unfinished-users', 'sweep-cron-history')),
  4::bigint,
  'each once'
);

-- settle_auto_confirm: a sale done 7 days ago confirms itself (spec 2.5).
insert into public.campuses (slug, name, region, sort) values ('test-campus', 'Test campus', 'Gauteng', 99);
insert into public.categories (slug, name, sort) values ('test-category', 'Test category', 99);
insert into auth.users (id, email)
select ('00000000-0000-4000-8000-0000000000' || n)::uuid, 'user' || n || '@eduvos.com' from unnest(array['b2', 'b3']) n;
insert into public.profiles (id, first_name, campus_slug)
select ('00000000-0000-4000-8000-0000000000' || n)::uuid, 'User ' || n, 'test-campus' from unnest(array['b1', 'b2', 'b3']) n;
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  ('10000000-0000-4000-8000-0000000000b1', 'test-job-shop', '00000000-0000-4000-8000-0000000000b2', 'Job shop', 'test-category', 'test-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id) values
  ('00000000-0000-4000-8000-0000000000b2', 'approved', '10000000-0000-4000-8000-0000000000b1');
insert into public.conversations (id, shop_id, buyer_id, status, completed_at) values
  ('40000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000b1', 'done', '2026-10-01T10:00:00Z'),
  ('40000000-0000-4000-8000-0000000000b2', '10000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000b3', 'done', '2026-10-02T10:00:00Z');
insert into public.notifications (account_id, kind, subject_id, text, href) values
  ('00000000-0000-4000-8000-0000000000b1', 'sale-to-confirm', '40000000-0000-4000-8000-0000000000b1', 'Job shop marked your enquiry as done. Did the sale happen?', '/messages/40000000-0000-4000-8000-0000000000b1'),
  ('00000000-0000-4000-8000-0000000000b1', 'message', '40000000-0000-4000-8000-0000000000b1', 'Job shop replied', '/messages/40000000-0000-4000-8000-0000000000b1');

set local role service_role;
select is(public.settle_auto_confirm('2026-10-08T09:59:59Z'), 0, 'a second before the 7 days, nothing is settled');
select is(public.settle_auto_confirm('2026-10-08T10:01:00Z'), 1, '7 days and a minute after it was done, the sale is settled');
reset role;
select is(
  (select row(status, confirmed_at, confirmed_by)::text from public.conversations where id = '40000000-0000-4000-8000-0000000000b1'),
  row('confirmed', '2026-10-08T10:00:00Z'::timestamptz, 'auto')::text,
  'confirmed by the 7 days, as of the moment it was due'
);
select is(
  (select status from public.conversations where id = '40000000-0000-4000-8000-0000000000b2'),
  'done',
  'one done 6 days earlier is left alone'
);
select is(
  (select read_at from public.notifications where account_id = '00000000-0000-4000-8000-0000000000b1' and kind = 'sale-to-confirm'),
  '2026-10-08T10:01:00Z'::timestamptz,
  'the buyer''s sale to confirm is read, when the job ran'
);
select is(
  (select read_at from public.notifications where account_id = '00000000-0000-4000-8000-0000000000b1' and kind = 'message'),
  null,
  'and the message notification is not'
);
set local role service_role;
select is(public.settle_auto_confirm('2026-10-09T10:00:00Z'), 1, 'the next sale is settled when its 7 days have passed');
select is(public.settle_auto_confirm('2026-10-09T11:00:00Z'), 0, 'and nothing is settled twice');
reset role;
select ok(public.settle_auto_confirm() >= 0, 'with no argument it uses now()');

-- sweep-sign-in: expired attempts, past hours' code counts and expired form states.
insert into private.sign_in_attempts (key, step, email, expires_at) values
  ('sweep-old', 'code', 'a@eduvos.com', now() - interval '1 second'),
  ('sweep-live', 'code', 'b@eduvos.com', now() + interval '10 minutes');
insert into private.code_sends (email, hour, n) values
  ('sweep-old@eduvos.com', date_trunc('hour', now(), 'UTC') - interval '1 hour', 5),
  ('sweep-live@eduvos.com', date_trunc('hour', now(), 'UTC'), 2);
insert into public.form_states (session_id, form, account_id, expires_at) values
  ('50000000-0000-4000-8000-0000000000b1', 'old', '00000000-0000-4000-8000-0000000000b1', now() - interval '1 second'),
  ('50000000-0000-4000-8000-0000000000b1', 'live', '00000000-0000-4000-8000-0000000000b1', now() + interval '10 minutes');
select is(private.sweep_sign_in(), 3, 'the sweep deletes the three expired rows');
select is((select array_agg(key) from private.sign_in_attempts where key like 'sweep-%'), array['sweep-live'], 'a live attempt stays');
select is((select array_agg(email) from private.code_sends where email like 'sweep-%'), array['sweep-live@eduvos.com'], 'this hour''s count stays');
select is((select array_agg(form) from public.form_states where account_id = '00000000-0000-4000-8000-0000000000b1'), array['live'], 'a live form state stays');

-- sweep-unfinished-users: Auth users with no profile, once a day has passed since they were made, last signed in or
-- were last sent a code (M5 of the phase A review).
insert into auth.users (id, email, created_at, last_sign_in_at, confirmation_sent_at, recovery_sent_at) values
  ('00000000-0000-4000-8000-0000000000c1', 'unfinished-old@eduvos.com', now() - interval '25 hours', null, now() - interval '25 hours', null),
  ('00000000-0000-4000-8000-0000000000c2', 'unfinished-new@eduvos.com', now() - interval '23 hours', null, null, null),
  ('00000000-0000-4000-8000-0000000000c3', 'finished-old@eduvos.com', now() - interval '30 days', null, null, null),
  ('00000000-0000-4000-8000-0000000000c4', 'code-just-sent@eduvos.com', now() - interval '3 days', null, now() - interval '1 hour', null),
  ('00000000-0000-4000-8000-0000000000c5', 'signed-in-today@eduvos.com', now() - interval '3 days', now() - interval '2 hours', now() - interval '3 days', null),
  ('00000000-0000-4000-8000-0000000000c6', 'new-code-today@eduvos.com', now() - interval '3 days', now() - interval '3 days', now() - interval '3 days', now() - interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000c7', 'quiet-for-days@eduvos.com', now() - interval '5 days', now() - interval '2 days', now() - interval '2 days', now() - interval '2 days');
insert into public.profiles (id, first_name, campus_slug) values ('00000000-0000-4000-8000-0000000000c3', 'Finished', 'test-campus');
select ok(private.sweep_unfinished_users() >= 2, 'the sweep deletes unfinished users');
select is(
  (select array_agg(email::text order by email) from auth.users where id::text like '00000000-0000-4000-8000-0000000000c_'),
  array['code-just-sent@eduvos.com', 'finished-old@eduvos.com', 'new-code-today@eduvos.com', 'signed-in-today@eduvos.com', 'unfinished-new@eduvos.com'],
  'quiet for more than a day with no profile goes; one made, signed in or sent a code within the day, and anyone with a profile, stay'
);
select is((select count(*) from auth.users where id = '00000000-0000-4000-8000-0000000000b1'), 1::bigint, 'a user made today stays');

-- sweep-cron-history: run details older than a week.
insert into cron.job_run_details (jobid, runid, database, username, command, status, start_time, end_time) values
  (999999, 999998, 'postgres', 'postgres', 'select 1', 'succeeded', now() - interval '8 days', now() - interval '8 days'),
  (999999, 999999, 'postgres', 'postgres', 'select 1', 'succeeded', now() - interval '6 days', now() - interval '6 days');
select ok(private.sweep_cron_history() >= 1, 'the sweep deletes old run details');
select is((select array_agg(runid) from cron.job_run_details where jobid = 999999), array[999999::bigint], 'and keeps the last week''s');

-- The sweeps and the job's function are closed to the API roles.
select ok(not has_function_privilege('service_role', 'private.sweep_unfinished_users()', 'execute'), 'the service role cannot run a sweep');
select ok(not has_function_privilege('authenticated', 'public.settle_auto_confirm(timestamptz)', 'execute'), 'nor can a signed-in user settle everyone''s sales');
select ok(has_function_privilege('service_role', 'public.settle_auto_confirm(timestamptz)', 'execute'), 'the service role can');

select * from finish();
rollback;
