-- Reference data (supabase foundation plan, Task 4; backend spec 4.2 and 4.3): campuses, categories and pickup points.
-- Anyone may read them, and a pickup point only while it isn't retired. Writes go through the admin client only
-- (stage G), so anon and authenticated get select and nothing else.

create table public.campuses (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  region text not null,
  sort int not null,
  is_online boolean not null default false
);

create table public.categories (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  sort int not null
);

create table public.pickup_points (
  id uuid primary key default gen_random_uuid(),
  campus_slug text not null references public.campuses (slug),
  name text not null check (char_length(name) between 2 and 60),
  -- Compared as shop names are (nameKey in lib/selling/rules.ts), so "Library entrance" and "LIBRARY entrance!" clash.
  name_key text generated always as (private.name_key(name)) stored,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  -- Also the index for the campus foreign key (campus_slug comes first).
  unique (campus_slug, name_key)
);

alter table public.campuses enable row level security;
alter table public.categories enable row level security;
alter table public.pickup_points enable row level security;

-- Explicit grants (spec decision 7). Supabase's default privileges give the API roles truncate, references, trigger
-- and maintain on new tables; truncate ignores RLS, so everything is revoked first.
revoke all on table public.campuses, public.categories, public.pickup_points from anon, authenticated;
grant select on table public.campuses, public.categories, public.pickup_points to anon, authenticated;
grant all on table public.campuses, public.categories, public.pickup_points to service_role;

create policy "Anyone reads campuses"
on public.campuses for select
to anon, authenticated
using (true);

create policy "Anyone reads categories"
on public.categories for select
to anon, authenticated
using (true);

create policy "Anyone reads live pickup points"
on public.pickup_points for select
to anon, authenticated
using (retired_at is null);
