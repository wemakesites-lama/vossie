-- Schema catch-up Task 11: the API roles' grants across the whole schema, after stages G to J.
-- - No API role can insert, update, delete or truncate any table in public or private, except a signed-in person's own
--   form states (public.form_states, phase A), which its policy and Task 5's triggers keep to their own rows.
-- - Every table in public has row level security on (00_foundation checks this too; repeated here for the new tables).
-- - anon can run only the named read-only helpers (06_account_actions keeps the full allowlists).
begin;
select plan(4);

select is(
  array(
    select distinct grantee || ' ' || table_schema || '.' || table_name
    from information_schema.role_table_grants
    where grantee in ('anon', 'authenticated')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
      and table_schema in ('public', 'private')
    order by 1
  ),
  array['authenticated public.form_states'],
  'the API roles write no table directly but their own form states'
);

select is(
  array(
    select distinct grantee || ' ' || table_name
    from information_schema.column_privileges
    where grantee in ('anon', 'authenticated')
      and privilege_type in ('INSERT', 'UPDATE')
      and table_schema in ('public', 'private')
    order by 1
  ),
  array['authenticated form_states'],
  'and no column of any other table'
);

select is(
  array(
    select c.relname::text
    from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity
    order by 1
  ),
  '{}'::text[],
  'every table in public has row level security on'
);

select is(
  array(
    select p.proname::text
    from pg_proc p
    where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
      and has_function_privilege('anon', p.oid, 'execute')
    order by 1
  ),
  array['hub_going', 'request_offer_count', 'shop_is_public'],
  'anon runs only the read-only helpers'
);

select * from finish();
rollback;
