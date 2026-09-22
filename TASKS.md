# Tasks

Work top to bottom. Finish and verify a phase before starting the next.

## Phase 0 — Setup and documentation
- [x] Create Next.js + TypeScript project with Tailwind
- [x] Create Supabase project (dev), record keys in `.env.local` — **connected with Supabase**
- [x] Commit `docs/`, `RULES.md`, `TASKS.md`, `.env.example`, `.gitignore`
- [ ] Install and configure Playwright — config written, run `npm install` to activate
- [x] Add npm scripts: typecheck, lint, test, test:e2e, build
- [ ] First commit and GitHub repo — **owner does this locally**

## Phase 1 — Login and tenant isolation
- [ ] Migration: `transports`, `users`, with RLS
- [x] Supabase Auth email + password login page
- [x] Session, route protection, logout
- [ ] Role handling: super_admin, owner, staff
- [ ] Super admin screen to create a transport and its owner user
- [ ] App shell: sidebar, header, empty dashboard
- [ ] **Verify:** two transports created; neither can see the other's data by any route

## Phase 2 — Masters
- [ ] Migrations with RLS: vehicles, drivers, parties, locations, pumps, bank_accounts
- [ ] List, add, edit, deactivate for each
- [ ] Duplicate vehicle number blocked within a transport
- [ ] **Verify:** all six masters appear in dropdowns, scoped to the logged-in transport

## Phase 3 — Trip entry
_All four blocking questions are resolved (see PRD.md and ADR-005, ADR-009, ADR-010). No formula deducts shortage from anyone; no GST; drivers and vehicles are open master lists. Clear to start._
- [ ] `src/lib/calc.ts` with the seven derived formulas plus unit tests
- [ ] Migrations: `trips`, `round_trips`, generated columns, SR sequence per transport
- [ ] Trip form: 27 fields, live computed preview, Zod validation
- [ ] "Add return leg" pre-filled from the onward leg, new SR number, shared round trip
- [ ] **Verify:** the Wakaner–Ambuja reference case in TEST_PLAN matches exactly

## Phase 4 — Trip list, search and filter
- [ ] Paginated trip table with the data color code applied
- [ ] Filters: date range, vehicle, driver, payment mode, payment status
- [ ] Search by SR number
- [ ] Trip detail view and edit
- [ ] Round-trip combined view
- [ ] **MVP ships here.** Owner uses it on real trips for one week before Phase 5

## Phase 5 — Diesel and pump ledger
- [ ] Migrations: `diesel_entries`, `pump_ledger`
- [ ] Diesel entry linked to a trip and a pump
- [ ] Credit / debit entries and running balance per pump
- [ ] Pump statement view

## Phase 6 — Maintenance
- [ ] Migration: `maintenance`
- [ ] Entry with bill photo upload to Supabase Storage
- [ ] Month-wise and vehicle-wise summary

## Phase 7 — Fastag and toll
- [ ] Migration: `fastag_recharges`
- [ ] Recharge log and per-vehicle toll spend

## Phase 8 — EMI and bank accounts — ON HOLD
Owner said to leave this for now (2026-09-20). Do not start until the owner brings real bank/loan numbers.
- [ ] Migrations: `emis`, `emi_payments`
- [ ] EMI schedule per vehicle with due dates
- [ ] Record an instalment against a bank account
- [ ] Upcoming dues on the dashboard

## Phase 9 — Billing and payments
- [ ] Migrations: `bills`, `payments`
- [ ] Generate a bill from one or more trips
- [ ] Bill submitted date, payment received, outstanding per party
- [ ] Printable bill

## Phase 10 — Driver ledger
- [ ] Migration: `driver_ledger`
- [ ] Advances flow automatically from trips
- [ ] Manual recovery entries, driver statement

## Phase 11 — Dashboard and reports
- [ ] Dashboard: month profit, trips, pending payments
- [ ] Reports by month, vehicle, driver and party
- [ ] Excel and PDF export

## Phase 12 — Investment — ON HOLD
Same reason as Phase 8. Revisit together.
- [ ] Migration: `investments`
- [ ] Per-vehicle investment register, owner-only

## Phase 13 — QA and production
- [ ] Full Playwright suite green, including cross-tenant isolation
- [ ] Production Supabase project, environment variables on Vercel
- [ ] Preview deploy, owner QA, then production
- [ ] Optional: import historical Excel data
