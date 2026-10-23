-- Role views N4 (role views spec 6 and 7.3; N4 plan Task 4).
-- - public.last_check_ins gives the latest check-in day for each owner asked about, and nothing else: no text, no
--   author, no note. Only where private.can_mentor lets the signed-in account read notes about that owner: never to the
--   owner, an admin who sells included, nor to a mentor of another shop or one whose role has gone.
-- - public.set_shop_mentor tells the new mentor, with the "staff-role" kind, the shop's link as its subject and its
--   mentor page as the link; never on a removal, when nothing changed, or when it refuses.
-- - Deleting the shop (its owner's account) takes that notification away (POPIA).
begin;
select plan(25);

create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.s(n text) returns uuid language sql immutable as $f$
  select ('10000000-0000-4000-8000-0000000000' || n)::uuid;
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
-- What account n learns about the owners' last check-ins: "<owner's n> <day>", by owner.
create function pg_temp.seen(n text, owners text[]) returns text[] language plpgsql as $f$
declare
  got text[];
begin
  perform pg_temp.sign_in(n);
  select coalesce(array_agg(right(r.owner_id::text, 2) || ' ' || r.last_on::text order by r.owner_id), '{}')
  into got
  from public.last_check_ins(array(select pg_temp.a(o) from unnest(owners) o)) r;
  perform pg_temp.sign_out();
  return got;
end;
$f$;
-- Account n sets the mentor of shop s (null for none).
create function pg_temp.assign(n text, s text, mentor text) returns text language plpgsql as $f$
declare
  got text;
begin
  perform pg_temp.sign_in(n);
  got := public.set_shop_mentor(pg_temp.s(s), case when mentor is null then null else pg_temp.a(mentor) end);
  perform pg_temp.sign_out();
  return got;
end;
$f$;
-- Account n's notifications: "<kind> <subject> <link> <sentence>".
create function pg_temp.told(n text) returns text[] language sql as $f$
  select coalesce(array_agg(t.kind || ' ' || t.subject_id || ' ' || t.href || ' ' || t.text order by t.text), '{}')
  from public.notifications t where t.account_id = pg_temp.a(n);
$f$;
grant execute on all functions in schema pg_temp to public;

insert into public.campuses (slug, name, region, sort) values ('mc-campus', 'Caseload campus', 'Gauteng', 97);
insert into public.categories (slug, name, sort) values ('mc-category', 'Caseload category', 98);
-- d1 Ada, an admin whose shop Mpho mentors; d2 Mpho, a mentor; d3 Sizwe, a student whose shop Mpho mentors; d4 Lindi,
-- a mentor of Zola's shop only; d5 Bongi, an admin with no shop; d6 Thabo, a mentor the tests assign; d7 Zola, a
-- student whose shop Lindi mentors.
insert into auth.users (id, email)
select pg_temp.a(n), 'mc-' || n || '@eduvos.com' from unnest(array['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7']) n;
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('d1'), 'Ada', 'mc-campus', '{admin}'),
  (pg_temp.a('d2'), 'Mpho', 'mc-campus', '{mentor}'),
  (pg_temp.a('d3'), 'Sizwe', 'mc-campus', '{}'),
  (pg_temp.a('d4'), 'Lindi', 'mc-campus', '{mentor}'),
  (pg_temp.a('d5'), 'Bongi', 'mc-campus', '{admin}'),
  (pg_temp.a('d6'), 'Thabo', 'mc-campus', '{mentor}'),
  (pg_temp.a('d7'), 'Zola', 'mc-campus', '{}');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  (pg_temp.s('d1'), 'mc-ada', pg_temp.a('d1'), 'Ada prints', 'mc-category', 'mc-campus', '2026-01'),
  (pg_temp.s('d3'), 'mc-sizwe', pg_temp.a('d3'), 'Sizwe sells', 'mc-category', 'mc-campus', '2026-01'),
  (pg_temp.s('d7'), 'mc-zola', pg_temp.a('d7'), 'Zola bakes', 'mc-category', 'mc-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id, applied_at, approved_at, mentor_id) values
  (pg_temp.a('d1'), 'approved', pg_temp.s('d1'), now() - interval '9 days', now() - interval '8 days', pg_temp.a('d2')),
  (pg_temp.a('d3'), 'approved', pg_temp.s('d3'), now() - interval '9 days', now() - interval '8 days', pg_temp.a('d2')),
  (pg_temp.a('d7'), 'approved', pg_temp.s('d7'), now() - interval '9 days', now() - interval '8 days', pg_temp.a('d4'));
insert into public.mentor_notes (owner_id, kind, check_in_on, text, author_id, author_name) values
  (pg_temp.a('d3'), 'check-in', '2026-10-01', 'Talked about photos.', pg_temp.a('d2'), 'Mpho'),
  (pg_temp.a('d3'), 'check-in', '2026-10-09', 'Priced the calculators.', pg_temp.a('d2'), 'Mpho'),
  (pg_temp.a('d3'), 'note', null, 'A note, not a check-in.', pg_temp.a('d2'), 'Mpho'),
  (pg_temp.a('d1'), 'check-in', '2026-10-05', 'Met Ada at the Hub.', pg_temp.a('d2'), 'Mpho'),
  (pg_temp.a('d7'), 'check-in', '2026-10-07', 'Priced the cupcakes.', pg_temp.a('d4'), 'Lindi');

-- --- last_check_ins: its shape ---------------------------------------------------------------------------------------

select has_function('public', 'last_check_ins', array['uuid[]'], 'public.last_check_ins(uuid[]) exists');
select is(
  (select array_agg(c.name || ' ' || format_type(c.type, null) order by c.ord)
   from pg_proc p,
     unnest(p.proargnames, p.proallargtypes::oid[], p.proargmodes::text[]) with ordinality as c(name, type, mode, ord)
   where p.oid = 'public.last_check_ins(uuid[])'::regprocedure and c.mode = 't'),
  array['owner_id uuid', 'last_on date'],
  'it returns an owner and a day: no text column, no author'
);
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p
   where p.oid = 'public.last_check_ins(uuid[])'::regprocedure),
  'security definer with an empty search path, as every function in public'
);
select ok(not has_function_privilege('anon', 'public.last_check_ins(uuid[])', 'execute'), 'nobody signed out runs it');
set local role anon;
select throws_ok(
  $$select * from public.last_check_ins(array['00000000-0000-4000-8000-0000000000d3']::uuid[])$$,
  '42501', null, 'anon is refused'
);
reset role;

-- --- last_check_ins: who learns what ---------------------------------------------------------------------------------

select is(pg_temp.seen('d2', array['d1', 'd3', 'd7']), array['d1 2026-10-05', 'd3 2026-10-09'],
  'the mentor gets the latest check-in day of each shop they mentor, a note and another mentor''s shop left out');
select is(pg_temp.seen('d5', array['d1', 'd3']), array['d1 2026-10-05', 'd3 2026-10-09'],
  'an admin with no shop gets both');
select is(pg_temp.seen('d1', array['d1', 'd3']), array['d3 2026-10-09'],
  'an admin who sells gets nothing about their own shop');
select is(pg_temp.seen('d3', array['d3']), '{}'::text[], 'the seller gets nothing about their own shop');
select is(pg_temp.seen('d4', array['d1', 'd3', 'd7']), array['d7 2026-10-07'],
  'another mentor gets only the shop they mentor');
savepoint gone;
update public.profiles set roles = '{}' where id = pg_temp.a('d2');
select is(pg_temp.seen('d2', array['d1', 'd3']), '{}'::text[], 'nor does a mentor whose role has gone');
rollback to savepoint gone;

-- --- set_shop_mentor tells the new mentor -----------------------------------------------------------------------------

select is(private.mentor_assigned_note_text('Sizwe sells'), 'You''re now mentoring Sizwe sells.', 'mentorAssignedText');
select is(pg_temp.assign('d5', 'd3', 'd6'), 'changed', 'Bongi makes Thabo the mentor of Sizwe''s shop');
select is(pg_temp.told('d6'), array['staff-role mc-sizwe /mentor/mc-sizwe You''re now mentoring Sizwe sells.'],
  'Thabo is told once, with a link to the shop''s mentor page');
select is(
  (select a.detail from public.audit_log a where a.action = 'mentor-assigned' and a.target_id = 'mc-sizwe'),
  'Thabo',
  'and the log names him, as before'
);
select is(pg_temp.assign('d5', 'd3', 'd6'), 'nothing', 'the same mentor again changes nothing');
select is(array_length(pg_temp.told('d6'), 1), 1, 'and tells nobody');
select is(pg_temp.assign('d5', 'd3', null), 'changed', 'a removal changes the shop');
select is(
  (select count(*) from public.notifications t where t.kind = 'staff-role' and t.subject_id = 'mc-sizwe'),
  1::bigint,
  'but tells nobody'
);
select is(pg_temp.assign('d1', 'd1', 'd6'), 'own-shop', 'Ada can''t choose her own shop''s mentor');
select is(array_length(pg_temp.told('d6'), 1), 1, 'so Thabo hears nothing more');
select is(pg_temp.assign('d4', 'd3', 'd4'), 'forbidden', 'a mentor can''t assign anyone');
select is(pg_temp.told('d4'), '{}'::text[], 'and nobody is told');

-- --- Deleting the shop takes the word away (POPIA) -----------------------------------------------------------------------

-- Sizwe deletes his account: his shop goes, and with it Thabo's "You're now mentoring Sizwe sells." (still there after
-- the removal above). If forget_account doesn't delete the shop row itself, its cascade does; either way the trigger runs.
do $$ begin perform public.forget_account('00000000-0000-4000-8000-0000000000d3'::uuid); end $$;
select is(pg_temp.told('d6'), '{}'::text[], 'deleting Sizwe''s account takes Thabo''s notification about his shop away');

-- --- A new link takes the word with it ----------------------------------------------------------------------------------

do $$ begin perform pg_temp.assign('d5', 'd7', 'd6'); end $$;
update public.shops set slug = 'mc-zola-bakes' where id = pg_temp.s('d7');
select is(pg_temp.told('d6'), array['staff-role mc-zola /mentor/mc-zola-bakes You''re now mentoring Zola bakes.'],
  'when Zola''s shop changes its link, Thabo''s notification links to the new one');

select * from finish();
rollback;
