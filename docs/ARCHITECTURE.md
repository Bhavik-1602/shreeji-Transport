# Architecture

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (email + password) |
| File storage | Supabase Storage |
| Testing | Playwright (end-to-end), Vitest (unit) |
| Hosting | Vercel — preview first, then production |
| Version control | Git + GitHub |

## Tenancy model

Shared database, shared schema, row-level isolation.

Every business table carries a `transport_id` column referencing `transports.id`. Isolation is enforced by PostgreSQL Row Level Security, not by application code. Application code may also filter, but the database is the authority. This means a missing `WHERE` clause in a query returns zero rows instead of leaking another company's data.

Each authenticated user carries their `transport_id` and `role` in a JWT claim. Every RLS policy compares the row's `transport_id` against that claim.

Super admin is a separate role that can read and write the `transports` and `users` tables but is denied by policy on all business tables.

## Data model

```
transports        id, name, owner_name, phone, city, status, created_at
users             id, transport_id, email, name, role, is_active
                  role: super_admin | owner | staff

vehicles          id, transport_id, vehicle_no, model, owner_name, purchase_date, is_active
drivers           id, transport_id, name, phone, licence_no, opening_balance, is_active
parties           id, transport_id, name, gstin, address, phone, is_active
locations         id, transport_id, name, district, is_active
pumps             id, transport_id, name, phone, opening_balance, is_active
bank_accounts     id, transport_id, label, bank_name, account_holder, type
                  type: bank | cash

-- payment_mode is used on trips.advance_mode, diesel_entries.mode,
-- maintenance.mode and fastag_recharges.mode. Always the same two values:
-- payment_mode: cash | online

trips             id, transport_id, round_trip_id, sr_number, trip_date,
                  vehicle_id, driver_id, party_id,
                  from_location_id, to_location_id,
                  load_ton, unload_ton, rate_per_ton,
                  driver_advance, advance_date, advance_mode,
                  km_start, km_end, diesel_litre, diesel_rate,
                  toll_amount, other_expense,
                  bill_submitted_on, payment_status, notes,
                  created_by, created_at, updated_at

round_trips       id, transport_id, label, started_on
diesel_entries    id, transport_id, trip_id, pump_id, entry_date, litre, rate, amount, mode
pump_ledger       id, transport_id, pump_id, entry_date, direction, amount, reference
                  direction: credit | debit
maintenance       id, transport_id, vehicle_id, entry_date, work, amount,
                  paid_to, mode, bill_no, bill_image_url, notes
fastag_recharges  id, transport_id, vehicle_id, entry_date, amount, mode, reference

-- ON HOLD at the owner's request (2026-09-20). Schema kept as a placeholder
-- only — no migration, screen or report is built against these until the
-- owner returns with real bank/loan details.
emis              id, transport_id, vehicle_id, lender, emi_amount, due_day,
                  start_date, total_instalments, bank_account_id
emi_payments      id, transport_id, emi_id, paid_on, amount, bank_account_id
bills             id, transport_id, party_id, bill_no, bill_date, amount,
                  submitted_on, status
payments          id, transport_id, bill_id, received_on, amount,
                  bank_account_id, reference
driver_ledger     id, transport_id, driver_id, entry_date, direction, amount, trip_id
-- ON HOLD, same as emis/emi_payments above
investments       id, transport_id, vehicle_id, investor_name, amount, invested_on, notes
audit_log         id, transport_id, user_id, table_name, row_id, action, changed_at
```

## Derived values — never stored as user input

These are computed in a single shared module (`src/lib/calc.ts`) and used identically by the form preview, the API and the reports. There is exactly one implementation.

```
shortage_ton   = load_ton - unload_ton
total_freight  = unload_ton * rate_per_ton
total_km       = km_end - km_start
average_kmpl   = total_km / diesel_litre
diesel_amount  = diesel_litre * diesel_rate
total_expense  = driver_advance + diesel_amount + toll_amount + other_expense
profit         = total_freight - total_expense
```

Shortage is informational only and is not part of `profit` — see ADR-005. It is shown on the trip so the owner can review it, but no formula deducts it from anyone automatically.

`total_freight` uses unload_ton because the party pays on delivered weight. If the business bills on loaded weight instead, this changes here and nowhere else.

Whether to store computed columns or compute on read: store them as generated columns in Postgres so reports can aggregate without recomputation, and so a formula change is a migration with a visible diff.

## Driver Summary is a view, not a table

The spreadsheet's "Driver Summary" sheet has headers but no data — the owner confirmed it should build itself from the trip entries rather than be typed in twice. It is a read-only aggregation over `trips` (advance per trip) and `driver_ledger` (recoveries), grouped by driver: total advanced, total recovered, running balance. No separate input form exists for it.

## SR number

An SR number belongs to a leg, not to a journey. Porbandar to Rajula and the return Bhavnagar to Ahmedabad each get their own SR number and can each be billed separately. Both rows share a `round_trip_id`, which is what lets the dashboard show combined round-trip profit.

Format: `SR/{FY}/{0001}`, sequential per transport, generated by a Postgres sequence per tenant. Never reused, never editable after save.

## Folder layout

```
src/
  app/                 routes
  components/          shared UI
  features/
    auth/ masters/ trips/ diesel/ maintenance/
    fastag/ emi/ billing/ drivers/ reports/
  lib/                 calc.ts, supabase client, formatting
  types/               generated database types
tests/
  unit/ integration/ e2e/
docs/
supabase/migrations/
```

Each feature folder holds its own components, queries and validation schemas. Nothing in `features/` imports from another feature folder; shared code moves to `lib/` or `components/`.
