# Product Requirements Document

## Product

**TransportERP** — a multi-tenant trip and accounting system for road freight (truck) businesses in Gujarat, India. One hosted application serves many independent transport companies. Each company sees only its own data.

## Problem

Transport owners run their entire business on a shared Excel file. This breaks in five ways:

1. Formulas get edited or dragged wrong. The current sheet under-reports expense on every trip because total expense sums the payment-mode text column instead of the driver advance column.
2. Only one person can enter data at a time.
3. There is no separate SR number per loading leg, so onward and return trips cannot be billed independently.
4. Diesel, maintenance, Fastag, EMI and driver advances live in separate sheets with no link back to the trip that caused them.
5. Nothing is auditable. There is no record of who changed what.

## Target users

| User | Role | What they do |
|---|---|---|
| Super Admin | Platform owner | Creates transport company accounts, suspends them, never reads their business data |
| Transport Owner | Tenant admin | Full access to their own company: masters, trips, expenses, reports, profit |
| Staff / Munim | Tenant operator | Enters trips and expenses. Cannot delete. Cannot see profit or investment |

## Goal

A transport owner should be able to record a complete loading trip in under two minutes, and see accurate per-trip, per-vehicle, per-driver and per-month profit without touching a formula.

## Core features

1. Super-admin account provisioning (no public sign-up)
2. Email and password login with role-based access
3. Masters: vehicles, drivers, parties, locations, pumps, bank accounts
4. Trip entry with automatic calculation of freight, shortage, total km, average, diesel cost, total expense and profit
5. SR number issued per loading leg, with onward and return legs linked as one round trip
6. Trip list with search and filter by SR number, date range, vehicle, driver, payment mode and payment status
7. Diesel entries linked to a pump, with a running credit/debit balance per pump
8. Maintenance log with bill photo upload and month-wise summary
9. Fastag recharge log and per-vehicle toll spend
10. Vehicle EMI schedule — **on hold**, owner will provide bank/loan details later
11. Party billing, bill submission date, payment received, outstanding
12. Driver ledger of advances given and recovered
13. Dashboard and reports with Excel and PDF export — including the month-end view the owner specifically asked for: trips done, payment received, payment pending, all rolled up from whatever was entered day to day
14. Investment register per vehicle — **on hold**, same as EMI above

## MVP

The first release ships phases 0 to 4 only:

- Super admin creates a transport account
- Owner logs in and sees an empty dashboard
- Owner adds vehicles, drivers, locations and parties
- Owner records a trip; every derived number is computed by the system
- Owner searches and filters the trip list and sees profit per trip

Everything else is built after the owner has used the MVP on real trips for at least one week.

## Out of scope for v1

- Native mobile app (the web app is mobile-responsive instead)
- Live GPS tracking
- E-way bill or GST portal integration
- A separate driver-facing app
- Automated WhatsApp messages
- Gujarati / English language switch — v1 is English only
- Bulk import of the historical Excel file (deferred; see TASKS Phase 13)

## Success criteria

- A trip entry takes under two minutes for a user who has done it five times
- Total expense and profit match a hand calculation on ten sample trips
- A user logged into transport A cannot retrieve any row belonging to transport B by any route, including direct API calls
- The owner stops maintaining the parallel Excel file within one month of launch

## Payment mode — kept simple

Every place money moves — driver advance, diesel, maintenance, Fastag recharge, party bill — carries the same two-option payment mode: **Cash** or **Online**. There is no separate payment ledger screen. This mirrors the owner's own instruction: "case or online, ye dono option honge payment mein." `UPI` and `CASE` in the source spreadsheet both fold into this one field, spelled `cash | online`.

## Deferred for now

Vehicle loans, EMI schedules and the investment register are **on hold at the owner's request** ("abhi isko rehne do"). The `emis`, `emi_payments` and `investments` tables stay in the schema as placeholders so nothing has to be rebuilt later, but no screen, form or report is built for them until the owner brings this back with real numbers. Phases 8 and 12 in `TASKS.md` are marked on hold, not removed.

## Questions resolved — Phase 3 unblocked

1. **Shortage (ghat).** No formula deducts it from anyone right now. `load_ton` and `unload_ton` are both captured on the trip; the difference is shown as an informational `shortage_ton` field. `total_freight` is billed on `unload_ton` and profit is `total_freight − total_expense`, unchanged. The owner will look at accumulated month-end numbers — trips done, payment received, payment pending — and decide manually rather than have the system auto-assign the cost. See ADR-005.
2. **GST.** Not charged in v1. No GST field exists on `bills`. If it's needed later, it is a new column and a new decision, not a retrofit of existing data.
3. **Multiple drivers.** No special rule needed. Drivers are a master list the owner adds to freely; a trip leg picks one driver from that list. If a round trip changes driver partway, the return leg (already a separate row per ADR-002) simply picks a different driver.
4. **Vehicle count and daily volume.** No fixed number. Vehicles are a master list added as the owner acquires them; each becomes a dropdown option the moment it's added. The system does not assume or cap a count.
