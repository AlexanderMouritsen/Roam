-- ===========================================
-- ROAM DATABASE SCHEMA
-- ===========================================
-- Run this in Supabase SQL Editor to set up the database
-- 
-- Tables: countries, profiles, trip, activities, photos
-- Includes: triggers for auto-updating timestamps, RLS policies for security

-- ===========================================
-- TABLES
-- ===========================================

-- Countries: canonical list of all countries (reference data)
create table countries (
  code text primary key,
  name text not null,
  continent text not null,
  flag_url text
);

create index countries_continent_idx on countries(continent);

-- Profiles: extends Supabase auth.users with app-specific data
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  home_country text references countries(code),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trip: a journey containing multiple activities (limited to one country per trip for MVP)
create table trip (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  country_code text not null references countries(code),
  title text not null,
  description text,
  cover_photo_url text,
  start_date date,
  end_date date,
  status text not null default 'planned' check (status in ('planned', 'ongoing', 'completed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index trip_user_id_idx on trip(user_id);
create index trip_country_code_idx on trip(country_code);

-- Activities: individual experiences within a trip
create table activities (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trip(id) on delete cascade,
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
create index activities_start_datetime_idx on activities(start_datetime desc);

-- Photos: images linked to trips or activities
create table photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  trip_id uuid references trip(id) on delete cascade,
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
$$ language plpgsql
set search_path = pg_catalog, public;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

create trigger trip_updated_at
  before update on trip
  for each row execute function update_updated_at();

create trigger activities_updated_at
  before update on activities
  for each row execute function update_updated_at();

-- Auto-create profile when user signs up (username set later by user)
create or replace function create_profile_on_signup()
returns trigger as $$
begin
  insert into profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer
set search_path = pg_catalog, public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function create_profile_on_signup();


-- ===========================================
-- ROW LEVEL SECURITY (RLS)
-- ===========================================

alter table profiles enable row level security;
alter table trip enable row level security;
alter table activities enable row level security;
alter table photos enable row level security;
alter table countries enable row level security;

-- Countries: public read (reference data)
create policy "Countries are viewable by everyone"
  on countries for select using (true);

-- Profiles: public read, owner write
create policy "Profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Trip: owner only
create policy "Users can view own trips"
  on trip for select using (auth.uid() = user_id);

create policy "Users can create own trips"
  on trip for insert with check (auth.uid() = user_id);

create policy "Users can update own trips"
  on trip for update using (auth.uid() = user_id);

create policy "Users can delete own trips"
  on trip for delete using (auth.uid() = user_id);

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

create policy "Users can update own photos"
  on photos for update using (auth.uid() = user_id);

create policy "Users can delete own photos"
  on photos for delete using (auth.uid() = user_id);