# Architecture Decisions

## ADR-001 — Tenant isolation enforced by Row Level Security

**Date:** 2026-09-20
**Status:** Accepted

**Context.** One deployment serves many transport companies. A single missing filter in a query would expose one company's freight rates and profit to a competitor.

**Decision.** Every business table carries `transport_id` and has RLS enabled in the same migration that creates it. Policies read the tenant from the JWT, never from client input. Application-level filtering is additional, not primary.

**Consequences.** Slightly more migration work per table. In exchange, the worst case of an application bug is an empty result instead of a leak. Cross-tenant tests run on every pull request.

## ADR-002 — SR number belongs to a leg, not a journey

**Date:** 2026-09-20
**Status:** Accepted

**Context.** The owner's requirement, written on the source notes: Porbandar to Rajula and the return Bhavnagar to Ahmedabad must carry different SR numbers, because each is billed separately.

**Decision.** Each leg is its own `trips` row with its own SR number. Legs that belong together share a `round_trip_id`.

**Consequences.** Each leg bills independently. Round-trip profit is an aggregation rather than a stored field. Slightly more data entry, which a "add return leg" button that pre-fills the vehicle, driver and date mitigates.

## ADR-003 — No public sign-up

**Date:** 2026-09-20
**Status:** Accepted

**Context.** The product is sold and onboarded personally, not self-serve.

**Decision.** Accounts are created only by the super admin. No public sign-up route exists in the codebase.

**Consequences.** Simpler security surface, no email verification flow, no trial-abuse handling. Onboarding is a manual step; if self-serve is wanted later, it is a new decision.

## ADR-004 — Derived values computed in one module, stored as generated columns

**Date:** 2026-09-20
**Status:** Accepted

**Context.** The source spreadsheet had two formula bugs: total expense summed the payment-mode text column instead of the driver advance, and one row computed average from ending odometer instead of distance travelled. These survived because the formula lived in every cell.

**Decision.** Users never enter a derived value. Freight, shortage, distance, average, diesel cost, total expense and profit are computed in `src/lib/calc.ts` and persisted as Postgres generated columns.

**Consequences.** A formula change is one migration with a visible diff, not a drag across 200 rows. Historical rows recompute on migration, so any correction is applied retroactively — which is the intent.

## ADR-005 — Shortage is informational only, never deducted automatically

**Date:** 2026-09-20
**Status:** Accepted

**Context.** Loading and unloading weights differ. It was unclear whether that difference should reduce anyone's payout.

**Decision.** `total_freight = unload_ton × rate_per_ton`, unchanged. `shortage_ton = load_ton − unload_ton` is stored and shown on the trip, but no formula subtracts it from driver advance, party billing or profit. The owner reviews accumulated numbers — trips done, payment received, payment pending — at month end and decides manually rather than have the system auto-assign the cost. His words: "abhi humein bharna nahi hai... month end mein pata chal sakta hai kitne trip hui, kitna payment hua, kitna baki hai."

**Consequences.** `calc.ts` needs no shortage-liability branch. If the owner later wants an automatic rule (e.g., shortage above X% charged to driver), that is a new decision layered on top of the existing `shortage_ton` field, not a rebuild.

## ADR-006 — Payment mode is one shared two-option field

**Date:** 2026-09-20
**Status:** Accepted

**Context.** The spreadsheet mixes `UPI` and `CASE` as free text in different columns across sheets. The owner clarified there are exactly two modes, used the same way everywhere money moves: "case or online, ye dono option honge payment mein."

**Decision.** A single `payment_mode` enum, `cash | online`, is reused on `trips.advance_mode`, `diesel_entries.mode`, `maintenance.mode` and `fastag_recharges.mode`. There is no separate `PAYMENT` ledger screen — the spreadsheet's empty `PAYMENT` sheet was this field, not a distinct feature.

**Consequences.** One enum, one dropdown component, used everywhere. Nothing else needed.

## ADR-007 — EMI and Investment deferred

**Date:** 2026-09-20
**Status:** Accepted

**Context.** A handwritten note listed vehicle loans against specific banks, which looked like it might define the `INVESTMENT` sheet. Asked directly, the owner said to leave this for now.

**Decision.** `emis`, `emi_payments` and `investments` remain as schema placeholders in ARCHITECTURE.md so a later addition doesn't require restructuring other tables, but Phases 8 and 12 in TASKS.md are on hold. No form, screen or report is built for them until the owner provides real numbers.

**Consequences.** Dashboard and reports in Phase 11 exclude EMI and investment figures for now. Revisit this ADR when the owner brings the details back.

## ADR-008 — Driver Summary is a computed view

**Date:** 2026-09-20
**Status:** Accepted

**Context.** The spreadsheet's Driver Summary sheet has headers but has never been filled in, while Daily Hisab already carries driver name and advance per trip. The owner confirmed it should build itself automatically rather than be entered twice.

**Decision.** Driver Summary is a read-only aggregation over `trips` and `driver_ledger`, grouped by driver. It is not a table a user writes to directly.

**Consequences.** No duplicate data entry. If a future need arises for manual driver-ledger adjustments outside of trips, `driver_ledger` already supports that without a schema change.

## ADR-009 — No GST in v1

**Date:** 2026-09-20
**Status:** Accepted

**Context.** Party billing needed to know whether to include tax fields and calculations.

**Decision.** No GST field, rate or calculation exists anywhere in v1. `bills` has no GSTIN or tax column.

**Consequences.** Bill printouts are plain amounts. Adding GST later is a new migration and a new decision, not a flag to flip.

## ADR-010 — Drivers and vehicles are open-ended master lists

**Date:** 2026-09-20
**Status:** Accepted

**Context.** It was unclear whether the system needed to plan around a fixed fleet size or a fixed number of drivers per trip.

**Decision.** Both `vehicles` and `drivers` are plain masters the owner adds to whenever needed, with no upper limit and no assumption about count. Each new entry appears in the relevant dropdown immediately. A trip leg picks exactly one driver; if a round trip needs a different driver on the return leg, that leg (already its own row per ADR-002) simply picks a different one.

**Consequences.** No capacity planning or multi-driver-per-leg logic is built. If the owner later wants two drivers recorded against a single leg (e.g., a co-driver), that is a new field, not a redesign.
