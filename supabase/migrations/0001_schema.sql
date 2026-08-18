-- Extensions
create extension if not exists postgis with schema public;
create extension if not exists pgcrypto with schema public;

-- profiles: one row per auth.users row, created by the app right after signup
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  avatar_url text,
  role text not null check (role in ('client', 'tasker', 'both')),
  bio text,
  rating_avg numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null,
  category text not null,
  budget numeric(10, 2) not null check (budget > 0),
  status text not null default 'open' check (status in ('open', 'assigned', 'completed', 'cancelled')),
  location geography(point, 4326) not null,
  address_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_location_idx on public.tasks using gist (location);
create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists tasks_client_id_idx on public.tasks (client_id);

create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  tasker_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique (task_id, tasker_id)
);

create index if not exists bids_task_id_idx on public.bids (task_id);
create index if not exists bids_tasker_id_idx on public.bids (tasker_id);

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.tasks (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  tasker_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_thread_id_idx on public.chat_messages (thread_id, created_at);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.tasks (id) on delete cascade,
  stripe_payment_intent_id text not null,
  amount numeric(10, 2) not null,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  created_at timestamptz not null default now()
);
