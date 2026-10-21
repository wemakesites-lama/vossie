-- Clears the sample seed from the live project (Supabase phase B decision 10, review fix 3; runbook B3 and B4). Keeps
-- campuses, categories, pickup points, policy versions and the live allowed domains. Run in the dashboard's SQL
-- editor, as postgres.
--
-- As written it's a dry run: it clears everything inside its transaction, then stops with an error that reads
-- "dry run: nothing changed." followed by the counts before and after, so nothing is kept. For the real run, Lama
-- changes only the dry_run line in the second block, from true to false; it then ends with a notice, "cleared: …",
-- and commits. If "files" isn't 0, empty the photos bucket in Storage afterwards (deleting rows in
-- storage.objects by SQL would leave the files).
--
-- The guard runs first: if any profile belongs to an address outside @vossie.test, real students have signed up, and
-- the script refuses ("refused: …") before it clears anything, dry run or not. An Auth user with no profile (such as
-- the delivery test's, runbook A7) doesn't stop it.
--
-- Never `supabase db reset --linked`: that drops everything the migrations made.
begin;

-- The guard.
do $$
declare
  real_profiles bigint;
begin
  select count(*) into real_profiles
  from public.profiles p
  left join auth.users u on u.id = p.id
  where u.email is null or lower(u.email) not like '%@vossie.test';
  if real_profiles > 0 then
    raise exception 'refused: % profile belongs to an address outside @vossie.test, so real students have signed up. Nothing was cleared.', real_profiles
      using hint = 'This script is only for the sample seed, before the first real sign-in.';
  end if;
end
$$;

-- The clear-out, and its report.
do $$
declare
  dry_run boolean := true;
  before text;
  after text;
begin
  select format('users %s, profiles %s, shops %s, listings %s, requests %s, hub posts %s, files %s',
                (select count(*) from auth.users), (select count(*) from public.profiles),
                (select count(*) from public.shops), (select count(*) from public.listings),
                (select count(*) from public.requests), (select count(*) from public.hub_posts),
                (select count(*) from storage.objects))
    into before;

  -- Content first. None of it is real: the guard has checked that only the seed's and test accounts have profiles.
  delete from public.featured_draws;
  delete from public.featured_pins;
  delete from public.hub_bookings;
  delete from public.hub_rsvps;
  delete from public.hub_posts;
  delete from public.mentor_notes;
  delete from public.saved_searches;
  delete from public.follows;
  delete from public.notifications;
  delete from public.reports;
  delete from public.messages;
  delete from public.conversations;
  delete from public.requests;
  delete from public.listing_photos;
  delete from public.listings;
  delete from public.shop_pickup_points;
  delete from public.shop_previous_slugs;
  delete from public.shops;
  delete from public.onboarding_drafts;
  delete from public.seller_profiles;
  delete from public.photos;
  delete from public.audit_log;
  delete from public.form_states;
  delete from public.consents;
  delete from public.profiles;
  delete from private.sign_in_attempts;
  delete from private.code_sends;
  delete from private.ip_code_sends;

  -- Then every Auth user (the @vossie.test accounts and any test sign-ups), with their sessions and codes.
  delete from auth.users;

  -- Only the live domains may sign in (Lama's decision 2).
  delete from private.allowed_email_domains where domain not in ('vossie.net', 'eduvos.com');

  select format('users %s, profiles %s, shops %s, listings %s, requests %s, hub posts %s, campuses %s, categories %s, '
                || 'pickup points %s, policy versions %s, domains %s, files %s',
                (select count(*) from auth.users), (select count(*) from public.profiles),
                (select count(*) from public.shops), (select count(*) from public.listings),
                (select count(*) from public.requests), (select count(*) from public.hub_posts),
                (select count(*) from public.campuses), (select count(*) from public.categories),
                (select count(*) from public.pickup_points), (select count(*) from private.policy_versions),
                (select string_agg(domain, ', ' order by domain) from private.allowed_email_domains),
                (select count(*) from storage.objects))
    into after;

  if dry_run then
    raise exception 'dry run: nothing changed. %', format('before: %s. after: %s.', before, after)
      using hint = 'For the real run, change dry_run to false and run the script again.';
  end if;
  raise notice 'cleared: %', after;
end
$$;

commit;
