-- Step 2b, Task 3: the settle and the nightly job (supabase step 2b plan, decision 2; stage L decisions 8 to 16, stage M
-- decisions 13 to 16): settleRequests (lib/data/requests.ts) as public.settle_requests, which closes every due request,
-- tells its asker once, and reminds the asker once from 2 days before the closing day. Dates are relative to today in
-- SAST (private.sast_day(now())), so p_now can stay now(). The words are pinned twice: here and in
-- lib/looking-for/words.test.ts ("the words the database's settle writes").
begin;
select plan(48);

create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
-- Whether this session holds the advisory lock on a key, as the functions take it (test 18's).
create function pg_temp.locked(key text) returns boolean language sql as $f$
  select exists (
    select 1 from pg_locks
    where locktype = 'advisory' and pid = pg_backend_pid() and granted and classid = hashtext(key)::oid and objid = 0
  );
$f$;
create function pg_temp.today() returns date language sql as $f$
  select private.sast_day(now());
$f$;
-- The two askers' notifications: subject | kind | sentence | link, by subject and sentence.
create function pg_temp.notes() returns text[] language sql as $f$
  select coalesce(array_agg(concat_ws(' | ', n.subject_id, n.kind, n.text, n.href) order by n.subject_id, n.text), '{}')
  from public.notifications n where n.account_id in (pg_temp.a('d1'), pg_temp.a('d2'));
$f$;
create function pg_temp.req(req text) returns public.requests language sql as $f$
  select * from public.requests where id = req;
$f$;

insert into public.campuses (slug, name, region, sort) values ('rs-campus', 'Settle campus', 'Gauteng', 98);
insert into public.categories (slug, name, sort) values ('rs-category', 'Settle category', 99);
-- d1 Zola and d2 Thandi ask.
insert into auth.users (id, email)
select pg_temp.a(n), 'rs-' || n || '@eduvos.com' from unnest(array['d1', 'd2']) n;
insert into public.profiles (id, first_name, campus_slug) values
  (pg_temp.a('d1'), 'Zola', 'rs-campus'), (pg_temp.a('d2'), 'Thandi', 'rs-campus');

-- A request by its asker (null for a sample), title, needed-by date and last change. With a date it closes on needed-by
-- + 4; without, on the SAST day of its last change + 30.
create function pg_temp.ask(req text, asker uuid, title text, needed date, updated timestamptz) returns void
language sql as $f$
  insert into public.requests (id, asker_id, title, category_slug, campus_slug, details, needed_by, created_at, updated_at)
  values (req, asker, title, 'rs-category', 'rs-campus', 'Something for my studies, please.', needed, updated, updated);
$f$;
select pg_temp.ask('rs-due', pg_temp.a('d1'), 'Calculator', pg_temp.today() - 4, now() - interval '20 days');
select pg_temp.ask('rs-idle-due', pg_temp.a('d1'), 'Desk lamp', null, now() - interval '30 days');
select pg_temp.ask('rs-past', pg_temp.a('d1'), 'Kettle for res', pg_temp.today() - 9, now() - interval '20 days');
select pg_temp.ask('rs-thandi', pg_temp.a('d2'), 'Stapler', pg_temp.today() - 4, now() - interval '20 days');
select pg_temp.ask('rs-plus2', pg_temp.a('d1'), 'Graph paper', pg_temp.today() - 2, now() - interval '20 days');
select pg_temp.ask('rs-plus1', pg_temp.a('d1'), 'Lab coat', pg_temp.today() - 3, now() - interval '20 days');
select pg_temp.ask('rs-plus3', pg_temp.a('d1'), 'Textbook', pg_temp.today() - 1, now() - interval '20 days');
select pg_temp.ask('rs-idle-remind', pg_temp.a('d1'), 'Monitor', null, now() - interval '28 days');
select pg_temp.ask('rs-reminded', pg_temp.a('d1'), 'Headphones', pg_temp.today() - 2, now() - interval '20 days');
update public.requests set reminded_for = closes_on where id = 'rs-reminded';
select pg_temp.ask('rs-old-reminder', pg_temp.a('d1'), 'Desk chair', pg_temp.today() - 3, now() - interval '20 days');
update public.requests set reminded_for = pg_temp.today() - 10 where id = 'rs-old-reminder';
select pg_temp.ask('rs-sample', null, 'Sample request', pg_temp.today() - 9, now() - interval '20 days');
select pg_temp.ask('rs-hidden', pg_temp.a('d1'), 'Hidden request', pg_temp.today() - 9, now() - interval '20 days');
update public.requests set hidden_at = now() - interval '1 day', hidden_reason = 'Rude.' where id = 'rs-hidden';
select pg_temp.ask('rs-closed', pg_temp.a('d1'), 'Closed request', pg_temp.today() - 9, now() - interval '20 days');
update public.requests set status = 'closed', closed_at = now() - interval '12 days', closed_by = 'asker' where id = 'rs-closed';
create temp table before_rows as select * from public.requests where id like 'rs-%';

-- --- The words (requestAutoClosedText and requestCloseReminderText, lib/looking-for/words.ts) -----------------------

select is(
  private.request_auto_closed_note_text('Calculator', '2026-10-16'),
  'Your request Calculator closed automatically 3 days after the date you needed it by. Reopen it in Your requests if you still need it.',
  'closed automatically, with a needed-by date'
);
select is(
  private.request_auto_closed_note_text('Calculator', null),
  'Your request Calculator closed automatically after 30 days with no changes. Reopen it in Your requests if you still need it.',
  'closed automatically, after 30 days with no changes'
);
select is(
  private.request_close_reminder_note_text('Calculator', '2026-10-20', '2026-10-16'),
  'Your request Calculator closes automatically on 20 Oct, 3 days after the date you needed it by. Still need it? Give it a new date in Your requests.',
  'the reminder, with a needed-by date'
);
select is(
  private.request_close_reminder_note_text('Calculator', '2026-11-05', null),
  'Your request Calculator closes automatically on 5 Nov, after 30 days with no changes. Still need it? Edit it in Your requests and it stays up for 30 days more.',
  'the reminder, with no date: a one-digit day unpadded'
);
select is(
  (select array_agg(provolatile order by proname) from pg_proc
   where oid in ('private.request_close_why(date)'::regprocedure, 'private.request_auto_closed_note_text(text, date)'::regprocedure,
     'private.request_close_reminder_note_text(text, date, date)'::regprocedure)),
  array['s', 's', 's']::"char"[],
  'the words are stable (to_char is), not immutable (amendment 8)'
);
select ok(
  not exists (
    select 1 from unnest(array['private.request_close_why(date)', 'private.request_auto_closed_note_text(text, date)',
      'private.request_close_reminder_note_text(text, date, date)']) f, unnest(array['anon', 'authenticated', 'service_role']) r
    where has_function_privilege(r, f, 'execute')
  ),
  'no API role runs the words'
);

-- --- Who may settle ---------------------------------------------------------------------------------------------------

select ok(not has_function_privilege('anon', 'public.settle_requests(timestamptz)', 'execute'), 'anon may not settle');
select ok(not has_function_privilege('authenticated', 'public.settle_requests(timestamptz)', 'execute'), 'nor a signed-in student');
select ok(has_function_privilege('service_role', 'public.settle_requests(timestamptz)', 'execute'), 'the server may');
select is(
  (select row(prosecdef, prorettype::regtype)::text from pg_proc where oid = 'public.settle_requests(timestamptz)'::regprocedure),
  row(true, 'integer'::regtype)::text,
  'it runs as its owner and returns how many it closed'
);

-- --- The first look of the day ------------------------------------------------------------------------------------------

select ok(not pg_temp.locked('vossie:settle-requests'), 'nobody holds the settle''s lock before');
select is(public.settle_requests(now()), 4, 'the four due requests close: due today, idle for 30 days, missed nights ago, and Thandi''s');
select ok(pg_temp.locked('vossie:settle-requests'), 'the settle took its transaction-level lock, held until the end');

select is(
  (select row(r.status, r.closed_by, r.closed_at, r.updated_at)::text from public.requests r where r.id = 'rs-due'),
  row('closed', 'auto', (pg_temp.today()::timestamp at time zone 'Africa/Johannesburg'),
    (select b.updated_at from before_rows b where b.id = 'rs-due'))::text,
  'a request due today: closed automatically at the start of its closing day (closedAtFor), its last change kept'
);
select is(
  (select r.closes_on from public.requests r where r.id = 'rs-due'),
  pg_temp.today(),
  'so its closing day doesn''t move'
);
select is(
  (select row(r.status, r.closed_by, r.closed_at)::text from public.requests r where r.id = 'rs-idle-due'),
  row('closed', 'auto', (pg_temp.today()::timestamp at time zone 'Africa/Johannesburg'))::text,
  'a request with no date, unchanged for 30 days: closed'
);
select is(
  (select row(r.status, r.closed_by, r.closed_at)::text from public.requests r where r.id = 'rs-past'),
  row('closed', 'auto', ((pg_temp.today() - 5)::timestamp at time zone 'Africa/Johannesburg'))::text,
  'a missed night catches up: closed as of its own closing day, 5 days ago'
);
select is(
  (select array_agg(n.text order by n.created_at) from public.notifications n where n.subject_id = 'rs-due'),
  array['Your request Calculator closed automatically 3 days after the date you needed it by. Reopen it in Your requests if you still need it.'],
  'its asker is told once, in the words of lib/looking-for/words.ts'
);
select is(
  (select array_agg(row(n.account_id, n.kind, n.href, n.read_at)::text) from public.notifications n where n.subject_id = 'rs-due'),
  array[row(pg_temp.a('d1'), 'request-update', '/account/requests', null::timestamptz)::text],
  'as a new request-update to Your requests'
);
select is(
  (select count(*) from public.notifications n where n.subject_id = 'rs-past'),
  1::bigint,
  'the missed one gets its close and no reminder'
);
select is(
  (select array_agg(n.account_id) from public.notifications n where n.subject_id = 'rs-thandi'),
  array[pg_temp.a('d2')],
  'each asker is told about their own'
);

select is(
  (select row(r.status, r.reminded_for, r.updated_at)::text from public.requests r where r.id = 'rs-plus2'),
  row('open', pg_temp.today() + 2, (select b.updated_at from before_rows b where b.id = 'rs-plus2'))::text,
  'closing the day after tomorrow: still open, reminded for that day, its last change kept'
);
select is(
  (select r.reminded_for from public.requests r where r.id = 'rs-plus1'),
  pg_temp.today() + 1,
  'closing tomorrow (a missed reminder day): reminded'
);
select is(
  (select r.reminded_for from public.requests r where r.id = 'rs-plus3'), null::date, 'closing in 3 days: not yet'
);
select is(
  (select r.reminded_for from public.requests r where r.id = 'rs-old-reminder'),
  pg_temp.today() + 1,
  'reminded for an older closing day: reminded again for the new one'
);
select is(
  pg_temp.notes(),
  array[
    'rs-due | request-update | ' || private.request_auto_closed_note_text('Calculator', pg_temp.today() - 4) || ' | /account/requests',
    'rs-idle-due | request-update | ' || private.request_auto_closed_note_text('Desk lamp', null) || ' | /account/requests',
    'rs-idle-remind | request-update | ' || private.request_close_reminder_note_text('Monitor', pg_temp.today() + 2, null) || ' | /account/requests',
    'rs-old-reminder | request-update | ' || private.request_close_reminder_note_text('Desk chair', pg_temp.today() + 1, pg_temp.today() - 3) || ' | /account/requests',
    'rs-past | request-update | ' || private.request_auto_closed_note_text('Kettle for res', pg_temp.today() - 9) || ' | /account/requests',
    'rs-plus1 | request-update | ' || private.request_close_reminder_note_text('Lab coat', pg_temp.today() + 1, pg_temp.today() - 3) || ' | /account/requests',
    'rs-plus2 | request-update | ' || private.request_close_reminder_note_text('Graph paper', pg_temp.today() + 2, pg_temp.today() - 2) || ' | /account/requests',
    'rs-thandi | request-update | ' || private.request_auto_closed_note_text('Stapler', pg_temp.today() - 4) || ' | /account/requests'
  ],
  'four closes and four reminders, and nothing else: no reminder already sent, none for 3 days out'
);
select is(
  (select count(*) from public.notifications n where n.text like '%Monitor closes automatically%after 30 days with no changes. Still need it? Edit it%'),
  1::bigint,
  'an idle request''s reminder says how to keep it up'
);

select is(
  (select array_agg(row(r.*)::text order by r.id) from public.requests r where r.id in ('rs-sample', 'rs-hidden', 'rs-closed', 'rs-reminded', 'rs-plus3')),
  (select array_agg(row(b.*)::text order by b.id) from before_rows b where b.id in ('rs-sample', 'rs-hidden', 'rs-closed', 'rs-reminded', 'rs-plus3')),
  'a sample, a hidden request, a closed one, one already reminded and one 3 days out are untouched'
);
select is(
  (select r.closed_by from public.requests r where r.id = 'rs-closed'), 'asker', 'a request its asker closed stays closed by them'
);

-- --- A second look --------------------------------------------------------------------------------------------------

create temp table notes_after_first as select pg_temp.notes() as v;
select is(public.settle_requests(now()), 0, 'a second look closes nothing');
select is(pg_temp.notes(), (select v from notes_after_first), 'and tells nobody again');
select is(public.settle_requests(), 0, 'with no time given it settles as of now');
select is(public.settle_requests(null), 0, 'and with null too');

-- --- The cap: no caller closes early --------------------------------------------------------------------------------

select pg_temp.ask('rs-cap', pg_temp.a('d1'), 'Scientific calculator', pg_temp.today() + 10, now());
select is(public.settle_requests(now() + interval '30 days'), 0, 'a time in the future settles as of now: nothing new is due');
select is(
  (select row(r.status, r.reminded_for)::text from public.requests r where r.id = 'rs-cap'),
  row('open', null::date)::text,
  'a request closing in 14 days stays open, unreminded'
);
select is(
  (select r.status from public.requests r where r.id = 'rs-plus3'), 'open', 'and so does the one 3 days out'
);
select is(pg_temp.notes(), (select v from notes_after_first), 'nobody is told anything');
select is(
  public.settle_requests(now() - interval '6 days'),
  0,
  'a time in the past settles as of then: what was due then is already closed'
);

-- --- An edit after the reminder moves the closing day, which allows a new reminder ------------------------------------

update public.requests set needed_by = pg_temp.today() - 2 where id = 'rs-plus1';
select is(public.settle_requests(now()), 0, 'a moved closing day closes nothing');
select is(
  (select r.reminded_for from public.requests r where r.id = 'rs-plus1'),
  pg_temp.today() + 2,
  'and reminds once for the new closing day'
);
select is(
  (select count(*) from public.notifications n where n.subject_id = 'rs-plus1'), 2::bigint, 'a second reminder, for the new day'
);

-- --- Hidden, then shown again after its day: the settle closes it on the next look --------------------------------------

update public.requests set hidden_at = null, hidden_reason = null where id = 'rs-hidden';
select is(public.settle_requests(now()), 1, 'a request shown again past its closing day closes on the next look');
select is(
  (select row(r.status, r.closed_by)::text from public.requests r where r.id = 'rs-hidden'),
  row('closed', 'auto')::text,
  'automatically'
);

-- --- The lock ---------------------------------------------------------------------------------------------------------

select is(
  (select count(*) from pg_locks where locktype = 'advisory' and pid = pg_backend_pid() and granted
     and classid = hashtext('vossie:settle-requests')::oid and objid = 0 and mode = 'ExclusiveLock'),
  1::bigint,
  'one exclusive advisory lock on hashtext(''vossie:settle-requests''), however many looks'
);
select ok(
  pg_get_functiondef('public.settle_requests(timestamptz)'::regprocedure) ~ 'pg_advisory_xact_lock\(hashtext\(''vossie:settle-requests''\), 0\)',
  'by that key, as the plan names it'
);

-- --- The nightly job ------------------------------------------------------------------------------------------------

select is(
  (select array_agg(row(jobname, schedule, command, active)::text) from cron.job where jobname = 'settle-requests'),
  array[row('settle-requests', '5 22 * * *', 'select public.settle_requests()', true)::text],
  'settle-requests runs nightly at 22:05 UTC (00:05 SAST)'
);
select ok(
  not exists (select 1 from pg_trigger where tgrelid = 'public.requests'::regclass and not tgisinternal),
  'requests has no trigger, so neither update touches updated_at'
);

-- The closing day the settle reads is the one the app's closingDay gives (test 25 pins the rule), and both updates
-- leave updated_at alone, so a reminder never moves the day it reminds of.
select is(
  (select array_agg(row(r.id, r.updated_at)::text order by r.id) from public.requests r where r.id in ('rs-plus2', 'rs-old-reminder', 'rs-idle-remind')),
  (select array_agg(row(b.id, b.updated_at)::text order by b.id) from before_rows b where b.id in ('rs-plus2', 'rs-old-reminder', 'rs-idle-remind')),
  'reminding changes no last-change time'
);

select * from finish();
rollback;
