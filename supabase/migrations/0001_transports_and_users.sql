-- Phase 1: tenants and users, with Row Level Security from birth.
-- See docs/ARCHITECTURE.md and docs/DECISIONS.md ADR-001, ADR-003.

create extension if not exists "pgcrypto";

create table transports (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  owner_name    text not null,
  phone         text,
  city          text,
  status        text not null default 'active' check (status in ('active', 'suspended')),
  created_at    timestamptz not null default now()
);

create type user_role as enum ('super_admin', 'owner', 'staff');

-- Mirrors auth.users so the app can read transport_id and role without
-- hitting the auth schema directly. One row per Supabase Auth user.
create table users (
  id            uuid primary key references auth.users(id) on delete cascade,
  transport_id  uuid references transports(id) on delete cascade,
  email         text not null,
  name          text not null,
  role          user_role not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),

  -- Every role except super_admin must belong to a transport.
  constraint tenant_required_unless_super_admin
    check (role = 'super_admin' or transport_id is not null)
);

create index users_transport_id_idx on users(transport_id);

alter table transports enable row level security;
alter table users enable row level security;

-- Helper: current user's row from the users table. Called by every policy
-- below instead of repeating the subquery, so there is exactly one place
-- that defines "who am I."
create or replace function current_app_user()
returns users
language sql
security definer
stable
as $$
  select * from users where id = auth.uid();
$$;

-- transports: super admin sees and manages all; an owner/staff can read
-- only their own transport's row, and cannot write to this table at all.
create policy "super_admin_full_access_transports"
  on transports for all
  using ((select role from current_app_user()) = 'super_admin')
  with check ((select role from current_app_user()) = 'super_admin');

create policy "own_transport_read_only"
  on transports for select
  using (id = (select transport_id from current_app_user()));

-- users: super admin manages all; everyone else can read only users
-- belonging to their own transport, and cannot write to this table
-- directly (account creation is a super-admin action — see ADR-003).
create policy "super_admin_full_access_users"
  on users for all
  using ((select role from current_app_user()) = 'super_admin')
  with check ((select role from current_app_user()) = 'super_admin');

create policy "own_transport_users_read_only"
  on users for select
  using (transport_id = (select transport_id from current_app_user()));
