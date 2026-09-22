# Project Memory

_Update this at the end of every working session._

## Current status

Phase 0 code scaffold written and verified. No Supabase project connected yet — that needs the owner's real account, which this chat environment cannot reach (no internet access here).

## Completed

- Reviewed the source material: the vibe-coding guide, PRIMA_Account.xlsx (7 sheets, every row) and 7 handwritten requirement notes
- Mapped the 24-point handwritten field list against the spreadsheet columns into a 27-field trip model
- Found and documented two formula bugs in the source spreadsheet (total expense omits driver advance; one row's average uses the wrong column)
- Wrote PRD, ARCHITECTURE, DESIGN, SECURITY, TEST_PLAN, DECISIONS, RULES, TASKS and .env.example
- Locked decisions with the owner: super-admin-only account creation, English-only UI, Excel import deferred, payment mode is a single cash/online field with no separate ledger screen, EMI and Investment are on hold, Driver Summary is auto-derived from trips, shortage is informational only (never auto-deducted), no GST in v1, drivers and vehicles are open-ended master lists (ADR-001 through ADR-010)
- Scaffolded the Next.js + TypeScript + Tailwind project: config files, folder structure, `src/lib/calc.ts` (the derived-value formulas), and the first Supabase migration (`transports` + `users` with RLS, implementing ADR-001)
- Verified `calc.ts`'s logic by hand against the Wakaner–Ambuja reference case using plain Node (no package install available in this environment) — matches to the paisa: profit 8,625.89

## Current task

Owner takes the scaffold into Claude Code, Cursor, or their own machine, runs `npm install`, connects a real Supabase project, and continues with Phase 1 (login and tenant isolation).

## Known issues

None — nothing is built yet.

## Blocked on

Nothing. EMI and Investment (Phases 8, 12) are intentionally on hold, not blocking — parked until the owner brings real bank/loan numbers.

## Next step

Owner runs the scaffold locally (Claude Code, Cursor, or their own setup): `npm install`, connect a real Supabase project, apply `supabase/migrations/0001_transports_and_users.sql`, then start Phase 1 — the login page and role handling.
