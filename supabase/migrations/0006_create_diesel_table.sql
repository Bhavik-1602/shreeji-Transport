-- ==============================================================================
-- 0006_create_diesel_table.sql
-- Creates the diesel management table and seeds initial records from Excel
-- ==============================================================================

create table if not exists diesel (
  id              uuid primary key default gen_random_uuid(),
  transport_id    uuid not null default 'a0000000-0000-0000-0000-000000000001',
  trip_id         uuid,
  sr_no           integer,
  date            date not null default current_date,
  slip_no         text,
  truck_no        text not null,
  diesel_liter    numeric(10,2) not null,
  rate            numeric(10,2) not null,
  amount          numeric(12,2) not null,
  driver_name     text not null,
  pump_name       text,
  notes           text,
  created_at      timestamptz not null default now()
);

-- Ensure trip_id column exists if table was created previously without it
alter table diesel add column if not exists trip_id uuid;

alter table diesel enable row level security;

-- Drop policy if exists to avoid conflicts
drop policy if exists "Users can access own transport diesel" on diesel;

create policy "Users can access own transport diesel"
  on diesel for all
  using (true)
  with check (true);

-- Seed initial records from the user's Excel sheet
insert into diesel (id, transport_id, sr_no, date, slip_no, truck_no, diesel_liter, rate, amount, driver_name)
values
  ('30000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 1, '2026-09-09', '117', 'GJ03CW9144', 302.10, 99.53, 30068.01, 'SANJAY'),
  ('30000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 2, '2026-09-10', '122', 'GJ03CW9144', 207.00, 99.53, 20602.71, 'SANJAY'),
  ('30000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 3, '2026-09-12', '134', 'GJ03CW9144', 214.38, 99.53, 21337.24, 'SEBAJ'),
  ('30000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 4, '2026-09-15', '148', 'GJ03CW9144', 266.13, 99.53, 26487.92, 'SEBAJ'),
  ('30000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 5, '2026-09-17', '157', 'GJ03CW9144', 231.01, 99.53, 22992.43, 'IQBAL'),
  ('30000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 6, '2026-09-20', '169', 'GJ03CW9144', 250.04, 99.53, 24886.48, 'SEBAJ')
on conflict (id) do nothing;

-- Backfill any existing diesel records from trips into the diesel table
insert into diesel (
  id,
  transport_id,
  trip_id,
  date,
  slip_no,
  truck_no,
  diesel_liter,
  rate,
  amount,
  driver_name,
  notes,
  created_at
)
select
  gen_random_uuid(),
  coalesce(t.transport_id, 'a0000000-0000-0000-0000-000000000001'::uuid),
  t.id,
  coalesce(t.date, current_date),
  case 
    when t.is_return_leg = true then coalesce(t.sr_number, '') || ' (Return)'
    else coalesce(t.sr_number, 'TRIP-DIESEL')
  end,
  coalesce(t.vehicle_no, '—'),
  case
    when coalesce(t.diesel_litres, 0) > 0 then t.diesel_litres
    when coalesce(t.diesel_cost, 0) > 0 and coalesce(t.diesel_rate, 0) > 0 then round(t.diesel_cost / t.diesel_rate, 2)
    when coalesce(t.diesel_cost, 0) > 0 then round(t.diesel_cost / 99.53, 2)
    else 0
  end,
  case
    when coalesce(t.diesel_rate, 0) > 0 then t.diesel_rate
    when coalesce(t.diesel_litres, 0) > 0 and coalesce(t.diesel_cost, 0) > 0 then round(t.diesel_cost / t.diesel_litres, 2)
    else 99.53
  end,
  case
    when coalesce(t.diesel_cost, 0) > 0 then t.diesel_cost
    else round(coalesce(t.diesel_litres, 0) * coalesce(t.diesel_rate, 99.53), 2)
  end,
  coalesce(t.driver_name, '—'),
  'Trip: ' || coalesce(t.sr_number, '') || ' (' || coalesce(t.loading_from, '') || ' to ' || coalesce(t.loading_to, '') || ')',
  coalesce(t.created_at, now())
from trips t
where (coalesce(t.diesel_litres, 0) > 0 or coalesce(t.diesel_cost, 0) > 0)
  and not exists (
    select 1 from diesel d where d.trip_id = t.id
  );

-- Trigger function to automatically sync any diesel entered on a trip into diesel table
create or replace function sync_trip_diesel_to_diesel_table()
returns trigger as $$
declare
  v_liter numeric(10,2);
  v_rate numeric(10,2);
  v_amount numeric(12,2);
  v_slip text;
begin
  v_liter := coalesce(new.diesel_litres, 0);
  v_rate := coalesce(new.diesel_rate, 99.53);
  if v_rate <= 0 then
    v_rate := 99.53;
  end if;
  
  if coalesce(new.diesel_cost, 0) > 0 then
    v_amount := new.diesel_cost;
    if v_liter <= 0 and v_rate > 0 then
      v_liter := round(v_amount / v_rate, 2);
    end if;
  else
    v_amount := round(v_liter * v_rate, 2);
  end if;

  v_slip := case when new.is_return_leg = true then coalesce(new.sr_number, '') || ' (Return)' else coalesce(new.sr_number, '') end;

  if v_liter > 0 or v_amount > 0 then
    if exists (select 1 from diesel where trip_id = new.id) then
      update diesel set
        date = coalesce(new.date, current_date),
        slip_no = v_slip,
        truck_no = coalesce(new.vehicle_no, truck_no),
        diesel_liter = v_liter,
        rate = v_rate,
        amount = v_amount,
        driver_name = coalesce(new.driver_name, driver_name),
        notes = 'Trip: ' || coalesce(new.sr_number, '') || ' (' || coalesce(new.loading_from, '') || ' to ' || coalesce(new.loading_to, '') || ')'
      where trip_id = new.id;
    else
      insert into diesel (
        transport_id,
        trip_id,
        date,
        slip_no,
        truck_no,
        diesel_liter,
        rate,
        amount,
        driver_name,
        notes
      ) values (
        coalesce(new.transport_id, 'a0000000-0000-0000-0000-000000000001'::uuid),
        new.id,
        coalesce(new.date, current_date),
        v_slip,
        coalesce(new.vehicle_no, '—'),
        v_liter,
        v_rate,
        v_amount,
        coalesce(new.driver_name, '—'),
        'Trip: ' || coalesce(new.sr_number, '') || ' (' || coalesce(new.loading_from, '') || ' to ' || coalesce(new.loading_to, '') || ')'
      );
    end if;
  else
    delete from diesel where trip_id = new.id;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_sync_trip_diesel on trips;
create trigger trigger_sync_trip_diesel
  after insert or update on trips
  for each row
  execute function sync_trip_diesel_to_diesel_table();

