-- ==============================================================================
-- 0002_complete_erp_schema_and_seed.sql
-- Complete Transport ERP Schema with Masters, Trips, Operations, and Seed Data
-- ==============================================================================

-- 1. Ensure required extensions
create extension if not exists "pgcrypto";

-- 2. Transports & Users (Tenants & Auth)
create table if not exists transports (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  owner_name    text not null,
  phone         text,
  city          text,
  status        text not null default 'active' check (status in ('active', 'suspended')),
  created_at    timestamptz not null default now()
);

do $$ begin
  create type user_role as enum ('super_admin', 'owner', 'staff');
exception
  when duplicate_object then null;
end $$;

create table if not exists users (
  id            uuid primary key references auth.users(id) on delete cascade,
  transport_id  uuid references transports(id) on delete cascade,
  email         text not null,
  name          text not null,
  role          user_role not null default 'owner',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  constraint tenant_required_unless_super_admin
    check (role = 'super_admin' or transport_id is not null)
);

-- Default Transport (Tenant) for Shreeji Transport
insert into transports (id, name, owner_name, phone, city, status)
values (
  'a0000000-0000-0000-0000-000000000001',
  'Shreeji Transport',
  'Jaymin Patel',
  '9876543210',
  'Rajkot, Gujarat',
  'active'
)
on conflict (id) do update set
  name = excluded.name,
  owner_name = excluded.owner_name,
  city = excluded.city;

-- Helper variable for default transport ID:
-- 'a0000000-0000-0000-0000-000000000001'

-- ==============================================================================
-- 3. MASTERS TABLES
-- ==============================================================================

-- 3.1 Vehicles Master
create table if not exists vehicles (
  id            uuid primary key default gen_random_uuid(),
  transport_id  uuid not null references transports(id) on delete cascade default 'a0000000-0000-0000-0000-000000000001',
  vehicle_no    text not null,
  model         text,
  owner_name    text default 'Shreeji Transport',
  purchase_date date,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- 3.2 Drivers Master
create table if not exists drivers (
  id              uuid primary key default gen_random_uuid(),
  transport_id    uuid not null references transports(id) on delete cascade default 'a0000000-0000-0000-0000-000000000001',
  name            text not null,
  phone           text,
  licence_no      text,
  opening_balance numeric(12,2) not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- 3.3 Parties Master (Customers)
create table if not exists parties (
  id            uuid primary key default gen_random_uuid(),
  transport_id  uuid not null references transports(id) on delete cascade default 'a0000000-0000-0000-0000-000000000001',
  name          text not null,
  gstin         text,
  address       text,
  phone         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- 3.4 Locations Master
create table if not exists locations (
  id            uuid primary key default gen_random_uuid(),
  transport_id  uuid not null references transports(id) on delete cascade default 'a0000000-0000-0000-0000-000000000001',
  name          text not null,
  district      text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- 3.5 Pumps Master (Fuel Stations)
create table if not exists pumps (
  id              uuid primary key default gen_random_uuid(),
  transport_id    uuid not null references transports(id) on delete cascade default 'a0000000-0000-0000-0000-000000000001',
  name            text not null,
  phone           text,
  opening_balance numeric(12,2) not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- 3.6 Bank Accounts Master
create table if not exists bank_accounts (
  id              uuid primary key default gen_random_uuid(),
  transport_id    uuid not null references transports(id) on delete cascade default 'a0000000-0000-0000-0000-000000000001',
  label           text not null,
  bank_name       text,
  account_holder  text,
  type            text not null default 'bank' check (type in ('bank', 'cash')),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ==============================================================================
-- 4. OPERATIONS TABLES
-- ==============================================================================

-- 4.1 Trips & Daily Hisab Table
create table if not exists trips (
  id                uuid primary key default gen_random_uuid(),
  transport_id      uuid not null references transports(id) on delete cascade default 'a0000000-0000-0000-0000-000000000001',
  sr_number         text not null,
  date              date not null default current_date,
  vehicle_no        text not null,
  driver_name       text not null,
  party_name        text not null,
  loading_from      text not null,
  loading_to        text not null,
  ton               numeric(10,2),
  unload_ton        numeric(10,2),
  rate_per_ton      numeric(10,2),
  total_freight     numeric(12,2),
  silik_date        date,
  driver_silik      numeric(10,2),
  payment_mode      text default 'cash',
  diesel_km_start   numeric(10,1),
  diesel_km_end     numeric(10,1),
  total_km          numeric(10,1),
  diesel_litres     numeric(10,2),
  diesel_rate       numeric(10,2),
  average_kmpl      numeric(10,2),
  diesel_cost       numeric(12,2),
  toll              numeric(10,2),
  other_expense     numeric(10,2),
  total_expense     numeric(12,2),
  profit            numeric(12,2),
  payment_status    text not null default 'pending',
  notes             text,
  is_return_leg     boolean default false,
  return_leg_for    uuid references trips(id) on delete set null,
  created_at        timestamptz not null default now()
);

-- 4.2 Maintenance Table
create table if not exists maintenance (
  id                uuid primary key default gen_random_uuid(),
  transport_id      uuid not null references transports(id) on delete cascade default 'a0000000-0000-0000-0000-000000000001',
  date              date not null default current_date,
  vehicle_no        text not null,
  work_part         text not null,
  amount            numeric(12,2) not null,
  paid_to           text,
  payment_method    text not null default 'cash',
  bill_receipt_no   text,
  note              text,
  created_at        timestamptz not null default now()
);

-- 4.3 FASTag Recharges Table
create table if not exists fastag (
  id                uuid primary key default gen_random_uuid(),
  transport_id      uuid not null references transports(id) on delete cascade default 'a0000000-0000-0000-0000-000000000001',
  fastag_no         text not null,
  vehicle_no        text not null,
  date              date not null default current_date,
  recharge_amount   numeric(12,2) not null,
  payment_mode      text not null default 'upi',
  note              text,
  created_at        timestamptz not null default now()
);

-- 4.4 Payments / Freight Collections Table
create table if not exists payments (
  id                uuid primary key default gen_random_uuid(),
  transport_id      uuid not null references transports(id) on delete cascade default 'a0000000-0000-0000-0000-000000000001',
  date              date not null default current_date,
  party_name        text not null,
  vehicle_no        text,
  trip_ref          text,
  freight_amount    numeric(12,2),
  received_amount   numeric(12,2) not null,
  balance           numeric(12,2),
  payment_mode      text not null default 'bank_transfer',
  bank_account      text,
  transaction_ref   text,
  note              text,
  created_at        timestamptz not null default now()
);

-- 4.5 Investments / Capital Expenses Table
create table if not exists investments (
  id                uuid primary key default gen_random_uuid(),
  transport_id      uuid not null references transports(id) on delete cascade default 'a0000000-0000-0000-0000-000000000001',
  date              date not null default current_date,
  category          text not null,
  description       text not null,
  vehicle_no        text,
  amount            numeric(12,2) not null,
  payment_mode      text not null default 'cash',
  paid_to           text,
  bill_receipt_no   text,
  note              text,
  created_at        timestamptz not null default now()
);

-- 4.6 Driver Summary / Silik Records Table
create table if not exists driver_summaries (
  id                uuid primary key default gen_random_uuid(),
  transport_id      uuid not null references transports(id) on delete cascade default 'a0000000-0000-0000-0000-000000000001',
  date              date not null default current_date,
  vehicle_no        text not null,
  driver_name       text not null,
  silik_amount      numeric(12,2) not null,
  note              text,
  created_at        timestamptz not null default now()
);

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

alter table transports enable row level security;
alter table users enable row level security;
alter table vehicles enable row level security;
alter table drivers enable row level security;
alter table parties enable row level security;
alter table locations enable row level security;
alter table pumps enable row level security;
alter table bank_accounts enable row level security;
alter table trips enable row level security;
alter table maintenance enable row level security;
alter table fastag enable row level security;
alter table payments enable row level security;
alter table investments enable row level security;
alter table driver_summaries enable row level security;

-- Permissive Development & Production Tenant Policies (allowing reading & writing)
do $$
declare
  tbl text;
begin
  for tbl in select unnest(array[
    'transports', 'users', 'vehicles', 'drivers', 'parties', 'locations', 'pumps',
    'bank_accounts', 'trips', 'maintenance', 'fastag',
    'payments', 'investments', 'driver_summaries'
  ]) loop
    -- Drop existing policy if any
    execute format('drop policy if exists "tenant_access_%s" on %I;', tbl, tbl);
    -- Create policy that allows full access
    execute format('
      create policy "tenant_access_%s" on %I
      for all
      using (true)
      with check (true);
    ', tbl, tbl);
  end loop;
end $$;

-- ==============================================================================
-- 6. SEED INITIAL DATA (Bank Accounts, Vehicles, Drivers, Parties, Trips, etc.)
-- ==============================================================================

-- 6.1 Seed Bank Accounts (User's specific accounts)
insert into bank_accounts (id, transport_id, label, bank_name, account_holder, type)
values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Jaymin - HDFC', 'HDFC Bank', 'Jaymin', 'bank'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Shreeji - ICICI', 'ICICI Bank', 'Shreeji Transport', 'bank'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Vijay - HDFC', 'HDFC Bank', 'Vijay', 'bank'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Jaymin - IDFC', 'IDFC FIRST Bank', 'Jaymin', 'bank'),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Cash', 'Cash Counter', 'Shreeji Transport', 'cash'),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Online / UPI', 'UPI / Online QR', 'Shreeji Transport', 'bank')
on conflict (id) do nothing;

