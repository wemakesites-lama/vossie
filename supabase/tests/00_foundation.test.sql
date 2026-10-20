-- Task 3: the private schema, the extensions, the helpers and the RLS backstop (supabase foundation plan).
begin;
select plan(50);

-- The private schema: there, and closed to the API roles.
select has_schema('private');
select ok(not has_schema_privilege('anon', 'private', 'usage'), 'anon has no usage on private');
select ok(not has_schema_privilege('authenticated', 'private', 'usage'), 'authenticated has no usage on private');
select ok(not has_schema_privilege('anon', 'private', 'create'), 'anon cannot create in private');

-- Extensions.
select has_extension('pg_cron');
select has_extension('extensions', 'unaccent', 'unaccent lives in extensions');
select has_extension('extensions', 'pgcrypto', 'pgcrypto lives in extensions');

-- Short ids (spec 4.1): 10 characters of a to z and 0 to 9, and no repeats in 2,000.
select matches(private.new_short_id(), '^[a-z0-9]{10}$', 'a short id is 10 characters of a-z and 0-9');
select is(
  (select count(distinct id) from (select private.new_short_id() as id from generate_series(1, 2000)) s),
  2000::bigint,
  '2,000 short ids are all different'
);
select ok(
  (select bool_and(id ~ '^[a-z0-9]{10}$') from (select private.new_short_id() as id from generate_series(1, 500)) s),
  'every one of 500 short ids has the shape'
);
select ok(
  not has_function_privilege('anon', 'private.new_short_id()', 'execute'),
  'anon cannot run new_short_id'
);

-- private.name_key is nameKey in lib/selling/rules.ts. The cases are lib/selling/rules.test.ts's, then more scripts
-- and compatibility characters; every expected value was printed by running nameKey itself in Node.
select is(private.name_key(input), expected, format('name_key(%L)', translate(input, E'\t\n', '  ')))
from (values
  ('Tech Corner!', 'tech corner'),
  ('Zoë''s  café', 'zoes cafe'),
  ('tech-corner', 'tech corner'),
  ('TECH CORNER', 'tech corner'),
  ('Zoe''s Cafe', 'zoes cafe'),
  ('Zoes Cafe', 'zoes cafe'),
  ('Zoe’s Cafe', 'zoes cafe'),
  ('Ζήτα Café', 'ζητα cafe'),
  ('東京 2', '東京 2'),
  ('東京', '東京'),
  ('大阪', '大阪'),
  ('Кафе', 'кафе'),
  ('КАФЕ', 'кафе'),
  ('  ☕ Cafe  ', 'cafe'),
  ('24/7', '24 7'),
  ('!?!', ''),
  ('Straße', 'straße'),
  ('Ørsted Øl', 'ørsted øl'),
  ('İstanbul', 'istanbul'),
  ('½ price', '1 2 price'),
  ('x² studio', 'x2 studio'),
  ('Ⅻ Club', 'xii club'),
  ('नमस्ते दुकान', 'नमसत दकन'),
  ('ﬁne ＡＢＣ', 'fine abc'),
  ('٣ متجر', '٣ متجر'),
  (E'Ñandú\tshop\n', 'nandu shop'),
  ('O’Neill & Sons', 'oneill sons'),
  ('ΣΟΦΟΣ', 'σοφος')
) as cases(input, expected);
select isnt(private.name_key('東京'), private.name_key('大阪'), 'two names in another script do not collide');
select is(private.name_key(null), null, 'name_key(null) is null');
select is(
  (select provolatile from pg_proc where oid = 'private.name_key(text)'::regprocedure),
  'i'::"char",
  'name_key is immutable, so a generated column can use it'
);

-- SAST days (spec 4.1): 22:00 UTC is midnight in Johannesburg, whatever the session's time zone.
set local timezone = 'America/New_York';
select is(private.sast_day('2026-10-14 21:59:59+00'), date '2026-10-14', 'one second before SAST midnight');
select is(private.sast_day('2026-10-14 22:00:00+00'), date '2026-10-15', 'SAST midnight is 22:00 UTC');
reset timezone;

-- The RLS backstop: a table made in public without RLS fails the transaction that made it.
create table public.rls_probe_with (id int);
alter table public.rls_probe_with enable row level security;
select lives_ok('set constraints all immediate', 'a public table with RLS passes the check');
set constraints all deferred;

savepoint no_rls;
create table public.rls_probe_without (id int);
select throws_like(
  'set constraints all immediate',
  '%public.rls_probe_without%row level security%',
  'a public table without RLS fails the check'
);
rollback to savepoint no_rls;

savepoint disabled;
alter table public.rls_probe_with disable row level security;
select throws_like(
  'set constraints all immediate',
  '%public.rls_probe_with%row level security%',
  'turning RLS off on a public table fails the check'
);
rollback to savepoint disabled;

select lives_ok('create table private.rls_probe_private (id int)', 'a table in private needs no RLS');
select lives_ok('set constraints all immediate', 'and passes the check');

-- Every table in public has RLS turned on.
select is(
  array(
    select c.relname::text from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity
      and c.relname not like 'rls_probe_%'
  ),
  '{}'::text[],
  'every table in public has row level security on'
);

select * from finish();
rollback;
