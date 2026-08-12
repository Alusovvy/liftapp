import assert from "node:assert/strict";
import { describe, test } from "vitest";
import fixture from "./fixtures/current-data-v9.json";
import { LiftwiseDataSchema } from "../src/domain/models/schema";
import { estimateEnergyBalance } from "../src/domain/body/energy-balance";

const WEIGHT_TREND = [
  { id: "one", date: "2026-07-01", weightKg: 80, bodyFatPercent: null, note: "", recordedAt: "" },
  { id: "two", date: "2026-07-08", weightKg: 79.5, bodyFatPercent: null, note: "", recordedAt: "" },
  {
    id: "three",
    date: "2026-07-15",
    weightKg: 79,
    bodyFatPercent: null,
    note: "",
    recordedAt: "",
  },
];

function nutritionDay(date: string, caloriesKcal: number) {
  return {
    id: `nutrition-${date}`,
    date,
    caloriesKcal,
    proteinG: 150,
    carbsG: 250,
    fatG: 70,
    fiberG: 25,
    source: "fitatu-csv",
    sourceIdentity: `fitatu:${date}`,
    contentFingerprint: `fixture-${date}`,
    sourceRowCount: 1,
    aggregation: "items",
    importBatchId: "fixture-import",
    importedAt: "2026-07-16T08:00:00.000Z",
  };
}

function dataWith(bodyMetrics: unknown[], nutritionDays: unknown[]) {
  return LiftwiseDataSchema.parse({ ...fixture, bodyMetrics, nutritionDays });
}

describe("energy balance estimate", () => {
  test("needs a weight trend before anything else is evaluated", () => {
    const data = dataWith(
      [WEIGHT_TREND[0]!],
      [nutritionDay("2026-07-01", 2200), nutritionDay("2026-07-02", 2200)],
    );
    const estimate = estimateEnergyBalance(data);

    assert.equal(estimate.status, "need-weight-trend");
    assert.equal(estimate.estimatedMaintenanceKcal, null);
  });

  test("needs at least seven nutrition days inside the weight-trend window", () => {
    const data = dataWith(WEIGHT_TREND, [
      nutritionDay("2026-07-01", 2200),
      nutritionDay("2026-07-02", 2200),
      nutritionDay("2026-07-03", 2200),
    ]);
    const estimate = estimateEnergyBalance(data);

    assert.equal(estimate.status, "need-nutrition-data");
    assert.equal(estimate.nutritionDaysInWindow, 3);
    assert.equal(estimate.requiredNutritionDays, 7);
    assert.equal(estimate.estimatedMaintenanceKcal, null);
  });

  test("derives maintenance calories from average intake and the weight trend, not a formula", () => {
    const data = dataWith(
      WEIGHT_TREND,
      ["01", "02", "03", "04", "05", "06", "07"].map((day) => nutritionDay(`2026-07-${day}`, 2200)),
    );
    const estimate = estimateEnergyBalance(data);

    assert.equal(estimate.status, "estimated");
    assert.equal(estimate.weeklyWeightChangeKg, -0.5);
    assert.equal(estimate.averageIntakeKcal, 2200);
    assert.equal(estimate.nutritionDaysInWindow, 7);
    assert.equal(estimate.estimatedMaintenanceKcal, 2750);
    assert.match(estimate.method, /starting point/i);
  });

  test("ignores nutrition days outside the weight-trend window", () => {
    const data = dataWith(WEIGHT_TREND, [
      ...["01", "02", "03", "04", "05", "06", "07"].map((day) =>
        nutritionDay(`2026-07-${day}`, 2200),
      ),
      nutritionDay("2026-06-01", 5000),
      nutritionDay("2026-08-01", 5000),
    ]);
    const estimate = estimateEnergyBalance(data);

    assert.equal(estimate.status, "estimated");
    assert.equal(estimate.nutritionDaysInWindow, 7);
    assert.equal(estimate.averageIntakeKcal, 2200);
  });
});
