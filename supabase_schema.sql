-- ============================================
-- EventHub FEU Roosevelt – Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  email text,
  role text default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Events table
create table if not exists public.events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  date date not null,
  time time,
  location text,
  capacity integer,
  status text default 'draft' check (status in ('draft', 'published', 'cancelled')),
  created_at timestamptz default now()
);

-- 3. Registrations table
create table if not exists public.registrations (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  status text default 'confirmed',
  checked_in boolean default false,
  checked_in_at timestamptz,
  created_at timestamptz default now(),
  unique(event_id, user_id)
);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;

-- Profiles: users can read all, update own
create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Events: published events visible to all authenticated users; admins can do everything
create policy "Published events visible to authenticated users"
  on public.events for select
  using (status = 'published' or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "Admins can insert events"
  on public.events for insert
  with check (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "Admins can update events"
  on public.events for update
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "Admins can delete events"
  on public.events for delete
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- Registrations: users can see and manage their own; admins see all
create policy "Users can view own registrations"
  on public.registrations for select
  using (
    user_id = auth.uid() or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Users can insert own registration"
  on public.registrations for insert
  with check (user_id = auth.uid());

create policy "Users can delete own registration"
  on public.registrations for delete
  using (user_id = auth.uid());

create policy "Admins can update registrations"
  on public.registrations for update
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- ============================================
-- Make yourself admin (run after signing up)
-- Replace 'your@email.com' with your email
-- ============================================
-- update public.profiles set role = 'admin' where email = 'your@email.com';
