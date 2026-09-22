// Single source of truth for every derived trip number.
// See docs/ARCHITECTURE.md "Derived values" and docs/DECISIONS.md ADR-004,
// ADR-005. Nothing here is user-editable — these are the only formulas
// allowed to compute these values anywhere in the app.
//
// This module intentionally has zero dependencies so it can be unit
// tested directly (tests/unit/calc.test.ts) and reused by both the client
// form preview and any server-side recompute.

export interface TripInput {
  loadTon: number | null;
  unloadTon: number | null;
  ratePerTon: number | null;
  driverAdvance: number | null;
  kmStart: number | null;
  kmEnd: number | null;
  dieselLitre: number | null;
  dieselRate: number | null;
  tollAmount: number | null;
  otherExpense: number | null;
}

export interface TripDerived {
  shortageTon: number | null;
  totalFreight: number | null;
  totalKm: number | null;
  averageKmpl: number | null;
  dieselAmount: number | null;
  totalExpense: number | null;
  profit: number | null;
}

const n = (v: number | null | undefined) => (v == null ? 0 : v);

export function computeTrip(input: TripInput): TripDerived {
  const shortageTon =
    input.loadTon != null && input.unloadTon != null
      ? round2(input.loadTon - input.unloadTon)
      : null;

  // Billed on unloaded weight — the party pays for what actually arrived.
  // See ADR-005. Change this in one place only, never in a form or a report.
  const totalFreight =
    input.unloadTon != null && input.ratePerTon != null
      ? round2(input.unloadTon * input.ratePerTon)
      : null;

  const totalKm =
    input.kmStart != null && input.kmEnd != null
      ? input.kmEnd - input.kmStart
      : null;

  const averageKmpl =
    totalKm != null && input.dieselLitre
      ? round2(totalKm / input.dieselLitre)
      : null;

  const dieselAmount =
    input.dieselLitre != null && input.dieselRate != null
      ? round2(input.dieselLitre * input.dieselRate)
      : null;

  // ADR-004: this is the fix for the spreadsheet bug where total expense
  // summed the UPI/CASE text column instead of the driver advance number.
  const totalExpense = round2(
    n(input.driverAdvance) +
      n(dieselAmount) +
      n(input.tollAmount) +
      n(input.otherExpense)
  );

  const profit =
    totalFreight != null ? round2(totalFreight - totalExpense) : null;

  return {
    shortageTon,
    totalFreight,
    totalKm,
    averageKmpl,
    dieselAmount,
    totalExpense,
    profit,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
