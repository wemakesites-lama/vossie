-- Clears the sample seed from the live project (Supabase phase B decision 10, runbook B3 and B4). Keeps campuses,
-- categories, pickup points, policy versions and the live allowed domains. Run in the dashboard's SQL editor, as it is:
-- it's a dry run, which prints the counts before and after and ends in rollback, so nothing changes. For the real run,
-- Lama changes only the last line to commit;. Then, if "files" wasn't 0, empty the photos bucket in Storage (deleting
-- rows in storage.objects by SQL would leave the files).
-- Never `supabase db reset --linked`: that drops everything the migrations made.
begin;

select 'before' as at,
       (select count(*) from auth.users) as users,
       (select count(*) from public.profiles) as profiles,
       (select count(*) from public.shops) as shops,
       (select count(*) from public.listings) as listings,
       (select count(*) from public.requests) as requests,
       (select count(*) from public.hub_posts) as hub_posts,
       (select count(*) from storage.objects) as files;

-- Content first. None of it is real: the project has only ever held the seed and test accounts.
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

-- Then every Auth user (the @vossie.test accounts and any test sign-ups), with their sessions and codes.
delete from auth.users;

-- Only the live domains may sign in (Lama's decision 2).
delete from private.allowed_email_domains where domain not in ('vossie.net', 'eduvos.com');

select 'after' as at,
       (select count(*) from auth.users) as users,
       (select count(*) from public.profiles) as profiles,
       (select count(*) from public.shops) as shops,
       (select count(*) from public.listings) as listings,
       (select count(*) from public.campuses) as campuses,
       (select count(*) from public.categories) as categories,
       (select count(*) from public.pickup_points) as pickup_points,
       (select count(*) from private.policy_versions) as policy_versions,
       (select string_agg(domain, ', ' order by domain) from private.allowed_email_domains) as domains,
       (select count(*) from storage.objects) as files;

rollback;
