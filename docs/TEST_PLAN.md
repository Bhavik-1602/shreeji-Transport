# Test Plan

## The test that matters most

Create transport A and transport B, each with one owner and three trips. Then, logged in as A:

- The trip list shows exactly A's three trips
- A direct request for B's trip id returns not-found, not the row
- Search, filter, export and every report return only A's data
- Changing the id in the URL changes nothing
- The same checks repeat for vehicles, drivers, maintenance, diesel, bills and payments

This suite runs on every pull request. If it fails, nothing merges.

## Authentication

- Valid email and password logs in and lands on the dashboard
- Wrong password shows an error and does not reveal whether the email exists
- Logged-out user hitting any app route is redirected to login
- Six failed attempts in 15 minutes are blocked
- There is no reachable public sign-up route
- Staff cannot see the profit column or the investment page
- Staff cannot delete, by button or by direct API call

## Masters

- Adding a vehicle, driver, party, location, pump and bank account works and they appear in trip form dropdowns
- Duplicate vehicle number within the same transport is rejected
- The same vehicle number in a different transport is allowed
- Deactivating a master hides it from new entries but keeps it on old records

## Trip entry

Reference case, from the existing spreadsheet — Wakaner to Ambuja, 40.07 ton at ₹900:

| Field | Expected |
|---|---|
| Total freight | 36,063.00 |
| Total km (3200 − 2612) | 588 |
| Average (588 ÷ 207) | 2.84 |
| Total expense (3,600 + 20,602.11 + 3,235) | 27,437.11 |
| Profit | 8,625.89 |

Note the spreadsheet reports 12,225.89 profit for this trip because its formula omits the ₹3,600 driver advance. The application value is the correct one. This case is the regression test for that bug.

Other cases:

- Every computed field updates live as the user types, before save
- `km_end` below `km_start` is rejected with a clear message
- `unload_ton` above `load_ton` is rejected
- Saving a trip issues the next SR number for that transport, and two transports never share a sequence
- Adding a return leg issues a different SR number and links both legs to one round trip
- Round-trip view shows the sum of both legs

## Search and filter

- Search by SR number returns the exact trip
- Date range, vehicle, driver, payment mode and payment status filters combine correctly
- Clearing filters restores the full list
- An empty result shows the empty state, not a blank page

## Ledgers

- A diesel entry against a pump moves that pump's balance by the right amount and in the right direction
- A driver advance recorded on a trip appears in that driver's ledger
- Recording a payment against a bill reduces outstanding and flips status to Received

## Responsive and accessibility

- Trip entry form is usable at 375px width
- Wide tables scroll inside their container without moving the page
- Every interactive element is reachable by keyboard with a visible focus ring
- No status is communicated by color alone

## Before every deploy

`npm run typecheck` · `npm run lint` · `npm run test` · `npm run test:e2e` · `npm run build` — all five clean.
