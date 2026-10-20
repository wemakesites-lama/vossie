-- Selling (supabase foundation plan, Task 6; backend spec 4.2 and 4.3): shops, their pickup points, listings, photos
-- and the onboarding wizard's drafts, with the rules of lib/data/catalog.ts as policies.
--
-- - Who sees what: a shop and its listings are public while the shop is approved or paused (private.shop_is_public);
--   drafts never are. The owner sees all of their shop's, whatever its status.
-- - Owners write through Task 9's functions only, so authenticated has no insert, update or delete grant here: each
--   rule lives in one place (plan decision 2). The admin client (service role) writes everything.
-- - shops.owner_id isn't readable by anon or authenticated (column grants): the owner's account id isn't public. A
--   query through the API names its columns rather than using *.
-- - Seed shops and listings use the art in /public/placeholders, so a shop's image and a listing's photo is either a
--   stored photo or a placeholder path (an addition to the plan's columns, for Task 11's seed).

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  -- "listing:<id>", "shop" or "draft" once a form has used it; null while it waits (selling plan decision 11).
  use text check (use in ('shop', 'draft') or use ~ '^listing:[a-z0-9]+(-[a-z0-9]+)*$'),
  type text not null check (type in ('image/jpeg', 'image/png', 'image/webp')),
  -- The file in the private photos bucket: {owner}/{id}.
  path text not null unique,
  created_at timestamptz not null default now(),
  check (path = owner_id::text || '/' || id::text)
);
-- Also the index for the owner foreign key.
create index photos_owner_id_use_idx on public.photos (owner_id, use);

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  -- Null for a sample shop no account owns (always open). Deleting the owner's profile deletes the shop: with "set
  -- null" a pending or paused shop would turn into an ownerless shop, which counts as approved and is public.
  owner_id uuid references public.profiles (id) on delete cascade,
  -- Names, taglines, titles and swap wishes are one line of clean text, and an about or a description clean text with
  -- its line breaks (private.is_clean_line and is_clean_text: what the app's cleanLine and cleanText leave).
  name text not null check (char_length(name) between 2 and 60 and private.is_clean_line(name)),
  name_key text generated always as (private.name_key(name)) stored,
  tagline text not null default '' check (char_length(tagline) <= 80 and private.is_clean_line(tagline)),
  category_slug text not null references public.categories (slug),
  campus_slug text not null references public.campuses (slug),
  verified boolean not null default false,
  badge text check (badge in ('trusted', 'responsive', 'new-seller')),
  about text not null default '' check (char_length(about) <= 600 and private.is_clean_text(about)),
  -- YYYY-MM: the month the shop started.
  since text not null check (since ~ '^\d{4}-\d{2}$'),
  -- The shop's photo, or a placeholder's path, or neither for its category's picture.
  image_photo_id uuid references public.photos (id) on delete set null,
  image_placeholder text check (image_placeholder ~ '^/placeholders/[a-z0-9/-]+\.svg$'),
  image_alt text not null default '' check (char_length(image_alt) <= 125),
  slug_changed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (image_photo_id is null or image_placeholder is null),
  -- Also the index for the campus foreign key.
  unique (campus_slug, name_key)
);
create index shops_owner_id_idx on public.shops (owner_id);
create index shops_category_slug_idx on public.shops (category_slug);
create index shops_image_photo_id_idx on public.shops (image_photo_id);

alter table public.seller_profiles
  add constraint seller_profiles_shop_id_fkey foreign key (shop_id) references public.shops (id) on delete set null;

create table public.shop_pickup_points (
  shop_id uuid not null references public.shops (id) on delete cascade,
  pickup_point_id uuid not null references public.pickup_points (id) on delete cascade,
  primary key (shop_id, pickup_point_id)
);
create index shop_pickup_points_pickup_point_id_idx on public.shop_pickup_points (pickup_point_id);

create table public.listings (
  -- Short text (spec 4.1): 10 random characters for new listings, "l-001" and so on for the seed.
  id text primary key default private.new_short_id()
    check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 20),
  shop_id uuid not null references public.shops (id) on delete cascade,
  state text not null check (state in ('draft', 'available', 'paused', 'sold')),
  kind text not null check (kind in ('item', 'service')),
  title text not null check (char_length(title) between 1 and 70 and private.is_clean_line(title)),
  category_slug text not null references public.categories (slug),
  condition text check (condition in ('new', 'like-new', 'good', 'fair')),
  -- Rand: 0 when free, null when swap-only.
  price_zar int check (price_zar between 0 and 100000),
  price_is_from boolean not null default false,
  pay_mode text not null check (pay_mode in ('cash', 'swap', 'both')),
  swap_for text check (char_length(swap_for) between 1 and 200 and private.is_clean_line(swap_for)),
  description text not null check (char_length(description) between 1 and 1000 and private.is_clean_text(description)),
  handover text not null check (handover in ('pickup', 'on-campus', 'on-campus-or-online', 'online')),
  pickup_point_id uuid references public.pickup_points (id),
  campus_slug text not null references public.campuses (slug),
  created_at timestamptz not null default now(),
  -- Set once, the first time it's published, and never cleared (amendment 9.2; the trigger below).
  first_published_at timestamptz,
  updated_at timestamptz not null default now(),
  -- The selling rules a check can say (checkListing in lib/selling/rules.ts). The pickup point being one of the
  -- shop's is checked by Task 9's save function.
  constraint listings_free_is_cash check (price_zar is distinct from 0 or pay_mode = 'cash'),
  constraint listings_price_unless_swap check ((pay_mode = 'swap') = (price_zar is null)),
  constraint listings_swap_for_when_swaps check ((pay_mode in ('swap', 'both')) = (swap_for is not null)),
  constraint listings_condition_for_items check ((kind = 'item') = (condition is not null)),
  constraint listings_pickup_point_for_pickup check ((handover = 'pickup') = (pickup_point_id is not null)),
  constraint listings_from_for_priced_services check (not price_is_from or (kind = 'service' and price_zar > 0)),
  constraint listings_published_unless_draft check (state = 'draft' or first_published_at is not null)
);
-- Every foreign key has an index (advisor 0001). On a fresh database the advisor's INFO finding 0005 (unused_index)
-- lists them all until queries use them; that's expected, here and in the other migrations.
create index listings_shop_id_idx on public.listings (shop_id);
create index listings_campus_state_published_idx on public.listings (campus_slug, state, first_published_at desc);
create index listings_category_slug_idx on public.listings (category_slug);
create index listings_pickup_point_id_idx on public.listings (pickup_point_id);

create function private.keep_first_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.first_published_at is not null and new.first_published_at is distinct from old.first_published_at then
    raise exception 'listing %: first_published_at is set once and never changed', old.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function private.keep_first_published_at() from public, anon, authenticated;

create trigger listings_keep_first_published_at
before update on public.listings
for each row execute function private.keep_first_published_at();

create table public.listing_photos (
  listing_id text not null references public.listings (id) on delete cascade,
  photo_id uuid references public.photos (id) on delete cascade,
  placeholder_src text check (placeholder_src ~ '^/placeholders/[a-z0-9/-]+\.svg$'),
  -- In order: 0 is the cover. Six at most.
  position smallint not null check (position between 0 and 5),
  -- "" means "the title" (selling spec 2.5).
  alt text not null default '' check (char_length(alt) <= 125),
  primary key (listing_id, position),
  check ((photo_id is null) <> (placeholder_src is null))
);
-- A stored photo belongs to one listing. Also the index for the photo foreign key.
create unique index listing_photos_photo_id_key on public.listing_photos (photo_id);

-- The onboarding wizard's answers so far (OnboardingDraftRow). Each field may still be empty.
create table public.onboarding_drafts (
  account_id uuid primary key references public.profiles (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 60),
  tagline text not null default '' check (char_length(tagline) <= 80),
  category_slug text references public.categories (slug),
  about text not null default '' check (char_length(about) <= 600),
  -- The shop photo (OnboardingDraftRow.photoSrc is its /photos/ address), or null for the category's picture.
  photo_id uuid references public.photos (id) on delete set null,
  campus_slug text references public.campuses (slug),
  pickup_point_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);
create index onboarding_drafts_category_slug_idx on public.onboarding_drafts (category_slug);
create index onboarding_drafts_campus_slug_idx on public.onboarding_drafts (campus_slug);
create index onboarding_drafts_photo_id_idx on public.onboarding_drafts (photo_id);

alter table public.photos enable row level security;
alter table public.shops enable row level security;
alter table public.shop_pickup_points enable row level security;
alter table public.listings enable row level security;
alter table public.listing_photos enable row level security;
alter table public.onboarding_drafts enable row level security;

-- A shop's status (shopStatus in lib/data/catalog.ts): its owner's seller profile's; approved for a sample shop with no
-- owner; pending for an owned shop whose seller profile has gone. Null for an unknown shop.
create function private.shop_status(shop uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when s.owner_id is null then 'approved' else coalesce(sp.status, 'pending') end
  from public.shops s
  left join public.seller_profiles sp on sp.account_id = s.owner_id
  where s.id = shop;
$$;

-- Whether a shop has a storefront: approved or paused (selling plan decision 2).
create function private.shop_is_public(shop uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.shop_status(shop) in ('approved', 'paused'), false);
$$;

revoke all on function private.shop_status(uuid), private.shop_is_public(uuid) from public, anon, authenticated;
grant execute on function private.shop_is_public(uuid) to anon, authenticated, service_role;
grant execute on function private.shop_status(uuid) to service_role;

-- Grants. Reads only for the API roles; the owner's id stays private (column list).
revoke all on table public.photos, public.shops, public.shop_pickup_points, public.listings, public.listing_photos,
  public.onboarding_drafts from anon, authenticated;
grant select (
  id, slug, name, name_key, tagline, category_slug, campus_slug, verified, badge, about, since, image_photo_id,
  image_placeholder, image_alt, slug_changed, created_at, updated_at
) on table public.shops to anon, authenticated;
grant select on table public.shop_pickup_points, public.listings, public.listing_photos to anon, authenticated;
grant select on table public.photos, public.onboarding_drafts to authenticated;
grant all on table public.photos, public.shops, public.shop_pickup_points, public.listings, public.listing_photos,
  public.onboarding_drafts to service_role;

-- One policy per role and table, so Postgres runs one check per row.
create policy "Anyone reads open shops"
on public.shops for select
to anon
using (private.shop_is_public(id));

create policy "Signed-in people read open shops, and owners their own"
on public.shops for select
to authenticated
using (private.shop_is_public(id) or private.owns_shop(id));

-- The shop's row decides: the shops policies above apply inside this subquery.
create policy "Pickup points of shops the reader can see"
on public.shop_pickup_points for select
to anon, authenticated
using (exists (select 1 from public.shops s where s.id = shop_id));

create policy "Anyone reads published listings of open shops"
on public.listings for select
to anon
using (state <> 'draft' and private.shop_is_public(shop_id));

create policy "Signed-in people read published listings of open shops, and owners all of theirs"
on public.listings for select
to authenticated
using ((state <> 'draft' and private.shop_is_public(shop_id)) or private.owns_shop(shop_id));

-- The listing's row decides (the listings policies apply inside the subquery): anyone sees the photo order and alt
-- text of a public listing, and the owner those of all their listings. The bytes come from /photos/[id] only.
create policy "Photos of listings the reader can see"
on public.listing_photos for select
to anon, authenticated
using (exists (select 1 from public.listings l where l.id = listing_id));

create policy "Owners read their photos"
on public.photos for select
to authenticated
using (owner_id = (select auth.uid()));

create policy "Owners read their onboarding draft"
on public.onboarding_drafts for select
to authenticated
using (account_id = (select auth.uid()));
