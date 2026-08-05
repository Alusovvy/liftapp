import assert from "node:assert/strict";
import { test } from "vitest";
import * as domain from "../src/domain.js";

const TODAY = "2026-08-03";

test("isValidDateKey accepts real calendar dates and rejects the rest", () => {
  assert.equal(domain.isValidDateKey("2026-08-03"), true);
  assert.equal(domain.isValidDateKey("2026-02-30"), false);
  assert.equal(domain.isValidDateKey("not-a-date"), false);
  assert.equal(domain.isValidDateKey(""), false);
});

test("normalizeBodyMetric accepts a weight-only or body-fat-only record", () => {
  const weightOnly = domain.normalizeBodyMetric({ date: "2026-08-01", weightKg: 82 }, 0, TODAY);
  const bodyFatOnly = domain.normalizeBodyMetric(
    { date: "2026-08-01", bodyFatPercent: 18 },
    0,
    TODAY,
  );
  assert.equal(weightOnly.weightKg, 82);
  assert.equal(weightOnly.bodyFatPercent, null);
  assert.equal(bodyFatOnly.weightKg, null);
  assert.equal(bodyFatOnly.bodyFatPercent, 18);
});

test("normalizeBodyMetric rejects future dates and out-of-range values", () => {
  const future = domain.normalizeBodyMetric({ date: "2026-08-10", weightKg: 82 }, 0, TODAY);
  const tooLight = domain.normalizeBodyMetric({ date: "2026-08-01", weightKg: 5 }, 0, TODAY);
  const nothingUseful = domain.normalizeBodyMetric({ date: "2026-08-01" }, 0, TODAY);
  assert.equal(future, null);
  assert.equal(tooLight, null);
  assert.equal(nothingUseful, null);
});

test("normalizeBodyMetrics de-duplicates repeated Garmin source records", () => {
  const metrics = domain.normalizeBodyMetrics(
    [
      { date: "2026-08-01", weightKg: 82, source: "garmin", sourceId: "g-1" },
      { date: "2026-08-01", weightKg: 82.4, source: "garmin", sourceId: "g-1" },
      { date: "2026-08-02", weightKg: 81.6, source: "garmin", sourceId: "g-2" },
    ],
    TODAY,
  );
  assert.equal(metrics.length, 2);
  assert.equal(metrics[0].weightKg, 82);
});

test("normalizeNutritionDay rejects a day with no usable macro values", () => {
  const empty = domain.normalizeNutritionDay({ date: "2026-08-01" }, 0, TODAY);
  const future = domain.normalizeNutritionDay({ date: "2026-08-10", caloriesKcal: 2200 }, 0, TODAY);
  assert.equal(empty, null);
  assert.equal(future, null);
});

test("nutritionDayFingerprint is stable for identical macro values and changes when they differ", () => {
  const day = domain.normalizeNutritionDay(
    { date: "2026-08-01", caloriesKcal: 2200, proteinG: 160 },
    0,
    TODAY,
  );
  const sameAgain = domain.normalizeNutritionDay(
    { date: "2026-08-01", caloriesKcal: 2200, proteinG: 160 },
    0,
    TODAY,
  );
  const corrected = domain.normalizeNutritionDay(
    { date: "2026-08-01", caloriesKcal: 2250, proteinG: 160 },
    0,
    TODAY,
  );
  assert.equal(day.contentFingerprint, sameAgain.contentFingerprint);
  assert.notEqual(day.contentFingerprint, corrected.contentFingerprint);
});

test("normalizeNutritionDays keeps only the most recently imported record per date", () => {
  const days = domain.normalizeNutritionDays(
    [
      { date: "2026-08-01", caloriesKcal: 2000, importedAt: "2026-08-01T08:00:00.000Z" },
      { date: "2026-08-01", caloriesKcal: 2200, importedAt: "2026-08-02T08:00:00.000Z" },
    ],
    TODAY,
  );
  assert.equal(days.length, 1);
  assert.equal(days[0].caloriesKcal, 2200);
});

test("normalizeRecoveryCheckin requires all 1-5 ratings and rejects future dates", () => {
  const valid = domain.normalizeRecoveryCheckin(
    { date: "2026-08-01", sleepHours: 7.25, energy: 3, soreness: 2, stress: 2 },
    0,
    TODAY,
  );
  const badEnergy = domain.normalizeRecoveryCheckin(
    { date: "2026-08-01", sleepHours: 7, energy: 6, soreness: 2, stress: 2 },
    0,
    TODAY,
  );
  const future = domain.normalizeRecoveryCheckin(
    { date: "2026-08-10", sleepHours: 7, energy: 3, soreness: 2, stress: 2 },
    0,
    TODAY,
  );
  assert.equal(valid.sleepHours, 7.3);
  assert.equal(valid.painConcern, false);
  assert.equal(badEnergy, null);
  assert.equal(future, null);
});

test("normalizeRecoveryCheckins keeps only the most recently recorded check-in per date", () => {
  const checkins = domain.normalizeRecoveryCheckins(
    [
      {
        date: "2026-08-01",
        sleepHours: 6,
        energy: 2,
        soreness: 3,
        stress: 3,
        recordedAt: "2026-08-01T08:00:00.000Z",
      },
      {
        date: "2026-08-01",
        sleepHours: 8,
        energy: 4,
        soreness: 1,
        stress: 1,
        recordedAt: "2026-08-01T20:00:00.000Z",
      },
    ],
    TODAY,
  );
  assert.equal(checkins.length, 1);
  assert.equal(checkins[0].sleepHours, 8);
});
