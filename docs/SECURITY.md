# Security Requirements

## Tenant isolation

This is the single most important requirement in the project. A leak here ends the product.

- Every business table has `transport_id NOT NULL` with a foreign key to `transports`
- Row Level Security is enabled on every business table, with no exceptions and no tables left open "for now"
- Policies compare `transport_id` against the JWT claim, not against a value sent by the client
- The client never sends `transport_id`; the server derives it from the session
- The service-role key is used only in server-side code and never reaches the browser
- RLS is added in the same migration that creates the table, never in a later cleanup

## Authentication

- Email and password via Supabase Auth
- No public sign-up route exists. Accounts are created only by a super admin
- Minimum 8 character passwords, password reset by email
- Sessions expire after 7 days of inactivity
- Rate limit login attempts to 5 per email per 15 minutes

## Authorization

| Action | Super Admin | Owner | Staff |
|---|---|---|---|
| Create transport account | yes | no | no |
| Read another transport's data | no | no | no |
| Masters create/edit | no | yes | yes |
| Trip create/edit | no | yes | yes |
| Delete any record | no | yes | no |
| View profit, investment | no | yes | no |

Role is checked on the server for every mutation. Hiding a button in the UI is not authorization.

## Secrets

- All keys live in environment variables; `.env` is gitignored and `.env.example` holds placeholders only
- No key, token or connection string is ever pasted into a chat, a commit, a log line or an error message

## Database

- Parameterized queries only, through the Supabase client
- No raw SQL built by string concatenation
- Money stored as `numeric(12,2)`, never as float
- Soft delete via `deleted_at` on trips, bills and payments so a mistaken delete is recoverable
- `audit_log` records user, table, row and action on every create, update and delete

## Input validation

- Every form validated with Zod on the client and again on the server
- Tonnage, kilometres, litres and amounts must be non-negative
- `km_end` must be greater than or equal to `km_start`
- `unload_ton` must not exceed `load_ton`
- SR number is server-generated and rejected if supplied by the client

## File uploads

- Bill and maintenance photos only: jpg, png, pdf
- Maximum 5 MB per file
- Stored in a Supabase Storage bucket partitioned by `transport_id`, with a storage policy matching the table RLS
- Files are served through signed URLs that expire in 60 minutes; no public bucket
