-- ==============================================================================
-- 0003_seed_all_demo_data.sql
-- Run this in Supabase SQL Editor to seed all Vehicles, Drivers, Parties,
-- Locations, Pumps, and Trips directly into your Supabase Database.
-- ==============================================================================

-- 1. Seed Vehicles
insert into vehicles (id, transport_id, vehicle_no, model, owner_name, purchase_date, is_active)
values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'GJ-03-AB-1234', 'Tata LPT 3521', 'Shreeji Transport', '2023-06-15', true),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'GJ-03-CD-5678', 'Ashok Leyland 3520', 'Shreeji Transport', '2024-01-10', true),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'GJ-11-EF-9012', 'BharatBenz 2823', 'Shreeji Transport', '2024-08-20', true),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'GJ-03-GH-3456', 'Tata Signa 3518', 'Shreeji Transport', '2022-11-05', true),
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'GJ-11-JK-7890', 'Eicher Pro 6037', 'Shreeji Transport', '2025-03-12', true),
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'GJ-03-LM-2345', 'Tata LPT 2518', 'Shreeji Transport', '2021-09-30', false)
on conflict (id) do update set
  vehicle_no = excluded.vehicle_no,
  model = excluded.model,
  is_active = excluded.is_active;

-- 2. Seed Drivers
insert into drivers (id, transport_id, name, phone, licence_no, opening_balance, is_active)
values
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Ramesh Solanki', '9876543210', 'GJ03-2019-0045678', 0, true),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Bharat Joshi', '9876543211', 'GJ11-2020-0078901', 2000, true),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Kishan Patel', '9876543212', 'GJ03-2018-0012345', 0, true),
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Vijay Rabari', '9876543213', 'GJ03-2021-0034567', 5000, true),
  ('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Mahesh Gohil', '9876543214', 'GJ11-2022-0056789', 0, false)
on conflict (id) do update set
  name = excluded.name,
  phone = excluded.phone,
  licence_no = excluded.licence_no,
  is_active = excluded.is_active;

-- 3. Seed Parties
insert into parties (id, transport_id, name, gstin, address, phone, is_active)
values
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Ambuja Cement Ltd', '24AABCA1234F1ZP', 'Kodinar, Gujarat', '02846-220100', true),
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'UltraTech Cement', '24AABCU5678G1ZQ', 'Jafrabad, Gujarat', '02845-230200', true),
  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Sanghi Industries', '24AABCS9012H1ZR', 'Kutch, Gujarat', '02832-240300', true),
  ('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Saurashtra Cement', '24AABCS3456I1ZS', 'Ranavav, Gujarat', '0286-250400', true)
on conflict (id) do update set
  name = excluded.name,
  gstin = excluded.gstin;

-- 4. Seed Locations
insert into locations (id, transport_id, name, district, is_active)
values
  ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Wakaner', 'Morbi', true),
  ('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Ambuja (Kodinar)', 'Gir Somnath', true),
  ('f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Porbandar', 'Porbandar', true),
  ('f0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Rajula', 'Amreli', true),
  ('f0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Bhavnagar', 'Bhavnagar', true),
  ('f0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Ahmedabad', 'Ahmedabad', true),
  ('f0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'Morbi', 'Morbi', true),
  ('f0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'Jamnagar', 'Jamnagar', true)
on conflict (id) do update set
  name = excluded.name,
  district = excluded.district;

-- 5. Seed Pumps
insert into pumps (id, transport_id, name, phone, opening_balance, is_active)
values
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Krishna Petroleum', '9876001001', 0, true),
  ('10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Jay Ambe Diesel Point', '9876001002', 15000, true),
  ('10000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Mahadev Fuel Station', '9876001003', 0, true)
on conflict (id) do update set
  name = excluded.name,
  phone = excluded.phone;

-- 6. Seed Initial Trips
insert into trips (
  id, transport_id, sr_number, date, vehicle_no, driver_name, party_name,
  loading_from, loading_to, ton, unload_ton, rate_per_ton, total_freight,
  silik_date, driver_silik, payment_mode,
  diesel_km_start, diesel_km_end, total_km, diesel_litres, diesel_rate,
  average_kmpl, diesel_cost, toll, other_expense, total_expense, profit,
  payment_status, notes
)
values
  (
    '20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
    'SR/26-27/0001', '2026-09-15', 'GJ-03-AB-1234', 'Ramesh Solanki', 'Ambuja Cement Ltd',
    'Wakaner', 'Ambuja (Kodinar)', 40.07, 40.07, 900, 36063,
    '2026-09-15', 3600, 'cash',
    2612, 3200, 588, 207, 99.53,
    2.84, 20602, 3235, 0, 27437, 8626,
    'received', 'Wakaner to Ambuja reference case'
  ),
  (
    '20000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
    'SR/26-27/0002', '2026-09-16', 'GJ-03-CD-5678', 'Bharat Joshi', 'UltraTech Cement',
    'Bhavnagar', 'Ahmedabad', 38.50, 38.20, 850, 32725,
    '2026-09-16', 3000, 'upi',
    3200, 3750, 550, 185, 99.53,
    2.97, 18413, 2800, 0, 24213, 8512,
    'pending', 'Bhavnagar to Ahmedabad route'
  ),
  (
    '20000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
    'SR/26-27/0003', '2026-09-17', 'GJ-03-AB-1234', 'Ramesh Solanki', 'Ambuja Cement Ltd',
    'Morbi', 'Ambuja (Kodinar)', 42.00, 41.80, 920, 38640,
    '2026-09-17', 4000, 'cash',
    5100, 5680, 580, 195, 99.80,
    2.97, 19461, 3100, 0, 26561, 12079,
    'received', 'Morbi tile clay loading'
  ),
  (
    '20000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
    'SR/26-27/0004', '2026-09-18', 'GJ-11-EF-9012', 'Kishan Patel', 'Sanghi Industries',
    'Porbandar', 'Rajula', 36.80, 36.80, 780, 28704,
    '2026-09-18', 2500, 'diesel_slip',
    4100, 4520, 420, 145, 99.50,
    2.90, 14427, 1850, 0, 18777, 9927,
    'pending', 'Porbandar to Rajula gypsum'
  ),
  (
    '20000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
    'SR/26-27/0005', '2026-09-19', 'GJ-03-GH-3456', 'Vijay Rabari', 'Saurashtra Cement',
    'Ranavav', 'Ahmedabad', 41.50, 41.20, 890, 36935,
    '2026-09-19', 3500, 'bank_transfer',
    6200, 6850, 650, 220, 99.60,
    2.95, 21912, 3450, 0, 28862, 8073,
    'overdue', 'Clinker bulk transport'
  )
on conflict (id) do update set
  sr_number = excluded.sr_number,
  total_freight = excluded.total_freight,
  profit = excluded.profit;
