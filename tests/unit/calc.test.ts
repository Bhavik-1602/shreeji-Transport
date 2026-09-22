import { describe, it, expect } from "vitest";
import { computeTrip } from "@/lib/calc";

// Reference case from docs/TEST_PLAN.md — the Wakaner to Ambuja trip that
// exposed the spreadsheet's expense bug. This is the regression test for
// that bug: it must always resolve to profit 8,625.89, never 12,225.89.
describe("computeTrip — Wakaner to Ambuja reference case", () => {
  it("matches the corrected hand calculation", () => {
    const result = computeTrip({
      loadTon: 40.07,
      unloadTon: 40.07,
      ratePerTon: 900,
      driverAdvance: 3600,
      kmStart: 2612,
      kmEnd: 3200,
      dieselLitre: 207,
      dieselRate: 99.5271, // 20,602.11 / 207 — matches the sheet exactly
      tollAmount: 3235,
      otherExpense: 0,
    });

    expect(result.totalFreight).toBeCloseTo(36063, 2);
    expect(result.totalKm).toBe(588);
    expect(result.averageKmpl).toBeCloseTo(2.84, 2);
    expect(result.totalExpense).toBeCloseTo(27437.11, 1);
    expect(result.profit).toBeCloseTo(8625.89, 1);
  });
});

describe("computeTrip — edge cases", () => {
  it("returns nulls when required inputs are missing", () => {
    const result = computeTrip({
      loadTon: null,
      unloadTon: null,
      ratePerTon: null,
      driverAdvance: null,
      kmStart: null,
      kmEnd: null,
      dieselLitre: null,
      dieselRate: null,
      tollAmount: null,
      otherExpense: null,
    });
    expect(result.totalFreight).toBeNull();
    expect(result.profit).toBeNull();
  });

  it("computes shortage as load minus unload, informational only", () => {
    const result = computeTrip({
      loadTon: 40.46,
      unloadTon: 39.9,
      ratePerTon: 690,
      driverAdvance: 0,
      kmStart: 0,
      kmEnd: 0,
      dieselLitre: null,
      dieselRate: null,
      tollAmount: 0,
      otherExpense: 0,
    });
    expect(result.shortageTon).toBeCloseTo(0.56, 2);
    // Freight is billed on unload_ton, shortage never reduces it further.
    expect(result.totalFreight).toBeCloseTo(39.9 * 690, 2);
  });
});
