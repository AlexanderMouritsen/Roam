-- ===========================================
-- ROAM DATABASE SCHEMA
-- ===========================================
-- Run this in Supabase SQL Editor to set up the database
-- 
-- Tables: profiles, trips, activities, photos, visited_countries, bucket_list
-- Includes: triggers for auto-updating timestamps, RLS policies for security

-- ===========================================
-- TABLES
-- ===========================================

-- Profiles: extends Supabase auth.users with app-specific data
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  home_country text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trips: a journey containing multiple activities
create table trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  cover_photo_url text,
  start_date date,
  end_date date,
  status text not null default 'planned' check (status in ('planned', 'ongoing', 'completed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index trips_user_id_idx on trips(user_id);

-- Activities: individual experiences within a trip
create table activities (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  activity_type text not null default 'other' check (activity_type in ('hike', 'food', 'transport', 'museum', 'beach', 'accommodation', 'shopping', 'concert', 'nature', 'other')),
  location_name text,
  latitude double precision,
  longitude double precision,
  notes text,
  start_datetime timestamptz,
  is_highlight boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index activities_trip_id_idx on activities(trip_id);
create index activities_user_id_idx on activities(user_id);

-- Photos: images linked to trips or activities
create table photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  trip_id uuid references trips(id) on delete cascade,
  activity_id uuid references activities(id) on delete set null,
  url text not null,
  thumbnail_url text,
  caption text,
  taken_at timestamptz,
  created_at timestamptz default now()
);

create index photos_trip_id_idx on photos(trip_id);
create index photos_activity_id_idx on photos(activity_id);
create index photos_user_id_idx on photos(user_id);

-- Visited countries: powers the world map coloring
create table visited_countries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  country_code text not null,
  first_visit date,
  notes text,
  created_at timestamptz default now(),
  unique(user_id, country_code)
);

create index visited_countries_user_id_idx on visited_countries(user_id);

-- Bucket list: countries the user wants to visit
create table bucket_list (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  country_code text not null,
  place_name text,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  notes text,
  created_at timestamptz default now(),
  unique(user_id, country_code)
);

create index bucket_list_user_id_idx on bucket_list(user_id);


-- ===========================================
-- TRIGGERS AND FUNCTIONS
-- ===========================================

-- Auto-update updated_at timestamp on row changes
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

create trigger trips_updated_at
  before update on trips
  for each row execute function update_updated_at();

create trigger activities_updated_at
  before update on activities
  for each row execute function update_updated_at();

-- Auto-create profile when user signs up
create or replace function create_profile_on_signup()
returns trigger as $$
begin
  insert into profiles (id, username)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function create_profile_on_signup();


-- ===========================================
-- ROW LEVEL SECURITY (RLS)
-- ===========================================

alter table profiles enable row level security;
alter table trips enable row level security;
alter table activities enable row level security;
alter table photos enable row level security;
alter table visited_countries enable row level security;
alter table bucket_list enable row level security;

-- Profiles: public read, owner write
create policy "Profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Trips: owner only
create policy "Users can view own trips"
  on trips for select using (auth.uid() = user_id);

create policy "Users can create own trips"
  on trips for insert with check (auth.uid() = user_id);

create policy "Users can update own trips"
  on trips for update using (auth.uid() = user_id);

create policy "Users can delete own trips"
  on trips for delete using (auth.uid() = user_id);

-- Activities: owner only
create policy "Users can view own activities"
  on activities for select using (auth.uid() = user_id);

create policy "Users can create own activities"
  on activities for insert with check (auth.uid() = user_id);

create policy "Users can update own activities"
  on activities for update using (auth.uid() = user_id);

create policy "Users can delete own activities"
  on activities for delete using (auth.uid() = user_id);

-- Photos: owner only
create policy "Users can view own photos"
  on photos for select using (auth.uid() = user_id);

create policy "Users can upload own photos"
  on photos for insert with check (auth.uid() = user_id);

create policy "Users can delete own photos"
  on photos for delete using (auth.uid() = user_id);

-- Visited countries: owner only
create policy "Users can view own visited countries"
  on visited_countries for select using (auth.uid() = user_id);

create policy "Users can add visited countries"
  on visited_countries for insert with check (auth.uid() = user_id);

create policy "Users can remove visited countries"
  on visited_countries for delete using (auth.uid() = user_id);

-- Bucket list: owner only
create policy "Users can view own bucket list"
  on bucket_list for select using (auth.uid() = user_id);

create policy "Users can add to bucket list"
  on bucket_list for insert with check (auth.uid() = user_id);

create policy "Users can update bucket list"
  on bucket_list for update using (auth.uid() = user_id);

create policy "Users can remove from bucket list"
  on bucket_list for delete using (auth.uid() = user_id);