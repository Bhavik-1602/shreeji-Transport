# TransportERP

A multi-tenant trip and accounting system for road freight businesses. One deployment serves many transport companies; each sees only its own data.

## Status

Planning. No application code yet. Documentation in `docs/` is complete and awaiting owner review.

## Documentation

| File | Question it answers |
|---|---|
| `docs/PRD.md` | What are we building, for whom, and what is out of scope |
| `docs/ARCHITECTURE.md` | Stack, data model, tenancy, derived-value formulas |
| `docs/DESIGN.md` | Typography, color code, components, UX requirements |
| `docs/SECURITY.md` | Tenant isolation, roles, secrets, validation, uploads |
| `docs/TEST_PLAN.md` | How we verify it, including the cross-tenant suite |
| `docs/DECISIONS.md` | Why each significant choice was made |
| `docs/MEMORY.md` | Where the project stands right now |
| `RULES.md` | How code gets written here |
| `TASKS.md` | What to build next |

## Getting started

Run this in Claude Code, Cursor, or your own terminal — this chat's environment has no internet access, so `npm install` and Supabase cannot run here.

```bash
npm install
cp .env.example .env.local          # fill in your Supabase project's keys
```

Then create a Supabase project (supabase.com), install the Supabase CLI, and apply the first migration:

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase db push                # applies supabase/migrations/0001_transports_and_users.sql
```

Run the app and the test suite:

```bash
npm run dev          # http://localhost:3000
npm run test         # calc.ts unit tests — should show the reference case passing
```

## What's in this scaffold (Phase 0)

- Next.js + TypeScript + Tailwind, configured with the exact color tokens from `docs/DESIGN.md`
- `src/lib/calc.ts` — the derived-value formulas from `docs/ARCHITECTURE.md`, already unit tested against the reference trip in `docs/TEST_PLAN.md`
- `supabase/migrations/0001_transports_and_users.sql` — the first migration: `transports` and `users` tables with Row Level Security enabled from creation, implementing ADR-001
- `src/lib/supabase-server.ts` / `supabase-browser.ts` — Supabase client setup for server and client components
- No auth pages, no dashboard, no trip form yet — that's Phase 1 onward in `TASKS.md`

## Checks before any deploy

```bash
npm run typecheck && npm run lint && npm run test && npm run test:e2e && npm run build
```
