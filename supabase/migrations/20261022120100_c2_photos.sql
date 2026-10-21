-- Phase C2's photos SQL (supabase phase C2/C3 plan, Task 2; decisions 11, 12, 14 and 15, and the controller's answers
-- to open questions 3 and 4).
--
-- 1. /photos/[id] asks the database one question (decision 11): public.photo_file(id), the file's path and type and who
--    may see it. Service role only: the route serves the file with the admin client (spec section 6).
-- 2. Hub staff read the Hub's photos (decision 14): photoSrcsOf("hub") lists the Hub's waiting covers. One select
--    policy replaces "Owners read their photos" (20261015004015_selling.sql:243), so the multiple-permissive-policies
--    advisor stays quiet.
-- 3. The daily sweep (decision 15; spec section 7), run by /api/cron/photos behind CRON_SECRET: the rows of waiting
--    photos a day old, then the files no photo row names. SQL never deletes storage.objects: the route removes the
--    files through the Storage API.
--
-- Every upload is rows first, then files (decision 12): a photo row is made (add_photos, add_hub_photo) before its file
-- is uploaded, and removed if the upload fails. So an orphan is only ever a file whose row has gone (a removal that
-- failed after forget_account, a replaced photo, a swept row).

-- --- Who may see a photo (decision 11) -------------------------------------------------------------------------------

-- A photo for /photos/[id] (photoFor, lib/data/photos.ts): one row, or none for a photo that isn't there or a waiting
-- one a day old (selling amendment 9.5: a student's, or a Hub cover still 'hub-draft').
-- - owner_only: a photo of a listing the Hub hid goes to its uploader only (staff tools amendment 13.5);
-- - hub_only: the Hub's waiting covers and covers of posts that aren't published go to Hub staff only (step 2 review M4;
--   Supabase only, the controller's answer to open question 4).
-- Everything else is anyone's who has the link, a waiting photo's for its one day included (open question 3).
create function public.photo_file(p_photo uuid)
returns table (path text, type text, owner_only uuid, hub_only boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.path, p.type,
    case
      when p.use like 'listing:%' and exists (
        select 1 from public.listings l where l.id = substr(p.use, char_length('listing:') + 1) and l.hidden_at is not null
      ) then p.owner_id
    end,
    coalesce(p.use = 'hub-draft' or (p.use like 'post:%' and not exists (
      select 1 from public.hub_posts h where h.id = substr(p.use, char_length('post:') + 1) and h.published
    )), false)
  from public.photos p
  where p.id = p_photo
    and not ((p.use is null or p.use = 'hub-draft') and p.created_at <= now() - interval '24 hours');
$$;

-- --- Reading photos (decision 14) ----------------------------------------------------------------------------------------

-- A student reads their own photos (photoSrcsOf: the listing form's waiting thumbnails), and Hub staff the Hub's (owner
-- null: its waiting covers and posts' covers), for the Hub editor.
drop policy "Owners read their photos" on public.photos;
create policy "Owners read their photos, and Hub staff the Hub's"
on public.photos for select
to authenticated
using (owner_id = (select auth.uid()) or (owner_id is null and (select private.is_staff('hub'))));

-- --- The sweep (decision 15) ------------------------------------------------------------------------------------------

-- The sweep's rows (spec section 7): waiting photos (use null) and the Hub's waiting covers ('hub-draft') a day old or
-- more. Their files' paths, sorted, for the caller to remove. A photo a form has used (a listing's, a shop's, an
-- onboarding draft's 'draft', a post's) is never swept, however old.
create function public.sweep_waiting_photos()
returns text[]
language sql
volatile
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.photos p
    where (p.use is null or p.use = 'hub-draft') and p.created_at <= now() - interval '24 hours'
    returning p.path
  )
  select coalesce(array_agg(gone.path order by gone.path), '{}') from gone;
$$;

-- Files in the photos bucket that no photo row names and that are more than an hour old (so an upload in flight, whose
-- row is made first, is never one), sorted, at most p_limit (1 to 1,000; 1,000 when not given). The caller removes them
-- through the Storage API and calls again while it gets a full page.
create function public.orphan_photo_paths(p_limit int default 1000)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(o.name order by o.name), '{}')
  from (
    select s.name
    from storage.objects s
    where s.bucket_id = 'photos' and s.created_at <= now() - interval '1 hour'
      and not exists (select 1 from public.photos p where p.path = s.name)
    order by s.name
    limit greatest(1, least(coalesce(p_limit, 1000), 1000))
  ) o;
$$;

-- Supabase's default privileges give every new function to anon and authenticated, so the revoke is written out.
revoke all on function public.photo_file(uuid), public.sweep_waiting_photos(), public.orphan_photo_paths(int)
from public, anon, authenticated;
grant execute on function public.photo_file(uuid), public.sweep_waiting_photos(), public.orphan_photo_paths(int)
to service_role;
