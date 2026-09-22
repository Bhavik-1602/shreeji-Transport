# Development Rules

Rules for any AI assistant or developer working in this repository. Read `docs/` before writing code.

## General

- Read `docs/PRD.md`, `docs/ARCHITECTURE.md` and `docs/DESIGN.md` before the first line of a feature
- Build one feature at a time, as a vertical slice: database, API, UI, test, all the way through
- Never refactor unrelated files while implementing a feature
- Never invent a requirement. If something is unclear, stop and ask, then record the answer in `docs/DECISIONS.md`
- Update `docs/MEMORY.md` at the end of every session

## Before coding

- Confirm which phase of `TASKS.md` this work belongs to
- Confirm the tables involved already have `transport_id` and an RLS policy
- If a new table is needed, write the migration with RLS in the same file

## Database

- Every business table has `transport_id NOT NULL` and RLS enabled from birth
- Money is `numeric(12,2)`. Never float
- Derived values are generated columns backed by `src/lib/calc.ts`. Never accept them as user input
- Migrations are forward-only and live in `supabase/migrations/`

## UI

- English labels only, in the wording listed in `docs/DESIGN.md`
- Only the color tokens in `docs/DESIGN.md`. No new colors, ever
- Status is never communicated by color alone
- Every list has loading, empty and error states
- Every form shows computed values live before save
- Error messages say what to do, not what went wrong internally

## Security

- The client never sends `transport_id`; the server derives it from the session
- Every mutation checks role on the server
- Service-role key stays server-side
- No secret in a commit, a log or an error message
- Validate with Zod on both client and server

## Testing

- Every feature ships with a test in the same pull request
- Any bug fix starts with a failing test that reproduces it
- The cross-tenant isolation suite runs on every pull request and must pass
- Before any deploy: typecheck, lint, unit tests, e2e tests, build — all clean

## Git

- One branch per feature, named `phase-N/feature-name`
- Commit messages describe the change, not the tool that made it
- Never commit `.env`, keys, or the client's real data
- Deploy to a Vercel preview and check it before production
