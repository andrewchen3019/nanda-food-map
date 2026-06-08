create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name_local text not null,
  name_en text not null default '',
  lat double precision not null,
  lng double precision not null,
  categories text[] not null default '{}',
  description text not null default '',
  maps_url text not null default '',
  place_group text not null default 'recommended' check (place_group in ('recommended','new')),
  visited boolean not null default false,
  visited_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.restaurant_photos (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  src text not null,
  caption text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists restaurants_sort_order_idx on public.restaurants(sort_order, created_at);
create index if not exists restaurant_photos_restaurant_sort_idx on public.restaurant_photos(restaurant_id, sort_order, created_at);

drop trigger if exists restaurants_set_updated_at on public.restaurants;
create trigger restaurants_set_updated_at
before update on public.restaurants
for each row
execute function public.set_updated_at();

drop trigger if exists restaurant_photos_set_updated_at on public.restaurant_photos;
create trigger restaurant_photos_set_updated_at
before update on public.restaurant_photos
for each row
execute function public.set_updated_at();

alter table public.restaurants enable row level security;
alter table public.restaurant_photos enable row level security;

drop policy if exists "Public can read restaurants" on public.restaurants;
create policy "Public can read restaurants"
on public.restaurants
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated users can insert restaurants" on public.restaurants;
create policy "Authenticated users can insert restaurants"
on public.restaurants
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update restaurants" on public.restaurants;
create policy "Authenticated users can update restaurants"
on public.restaurants
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete restaurants" on public.restaurants;
create policy "Authenticated users can delete restaurants"
on public.restaurants
for delete
to authenticated
using (true);

drop policy if exists "Public can read restaurant photos" on public.restaurant_photos;
create policy "Public can read restaurant photos"
on public.restaurant_photos
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated users can insert restaurant photos" on public.restaurant_photos;
create policy "Authenticated users can insert restaurant photos"
on public.restaurant_photos
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update restaurant photos" on public.restaurant_photos;
create policy "Authenticated users can update restaurant photos"
on public.restaurant_photos
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete restaurant photos" on public.restaurant_photos;
create policy "Authenticated users can delete restaurant photos"
on public.restaurant_photos
for delete
to authenticated
using (true);

insert into storage.buckets (id, name, public)
values ('restaurant-photos', 'restaurant-photos', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Public can read restaurant storage" on storage.objects;
create policy "Public can read restaurant storage"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'restaurant-photos');

drop policy if exists "Authenticated users can upload restaurant storage" on storage.objects;
create policy "Authenticated users can upload restaurant storage"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'restaurant-photos');

drop policy if exists "Authenticated users can update restaurant storage" on storage.objects;
create policy "Authenticated users can update restaurant storage"
on storage.objects
for update
to authenticated
using (bucket_id = 'restaurant-photos')
with check (bucket_id = 'restaurant-photos');

drop policy if exists "Authenticated users can delete restaurant storage" on storage.objects;
create policy "Authenticated users can delete restaurant storage"
on storage.objects
for delete
to authenticated
using (bucket_id = 'restaurant-photos');
