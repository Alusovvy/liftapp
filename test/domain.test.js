import assert from "node:assert/strict";
import { test } from "vitest";
import * as domain from "../src/domain.js";

test("derived RIR retains imported RPE provenance", () => {
  const set = domain.normalizeEffortSet({ rpe: 8 }, { source: "hevy-csv" });
  assert.equal(set.rir, 2);
  assert.equal(set.rawRpe, 8);
  assert.equal(set.effortSource, "derived-from-rpe");
  assert.equal(set.rirManual, false);
});

test("only a touched RIR becomes a manual override", () => {
  const untouched = domain.updateManualRir({ rpe: 8 }, "2", false);
  const changed = domain.updateManualRir({ rpe: 8 }, "1.5", true);
  assert.equal(untouched.effortSource, "derived-from-rpe");
  assert.equal(changed.effortSource, "manual");
  assert.equal(changed.manualRir, 1.5);
  assert.equal(changed.rawRpe, 8);
});

test("cleared manual RIR survives source-derived effort", () => {
  const cleared = domain.updateManualRir({ rpe: 8, rir: 2 }, "", true);
  assert.equal(cleared.rir, null);
  assert.equal(cleared.manualRirCleared, true);
  assert.equal(cleared.effortSource, "manual-cleared");
});

test("missing manual effort defaults to 3 RIR without overriding supplied effort", () => {
  const missing = domain.defaultMissingRir({}, undefined, { source: "manual" });
  const planned = domain.defaultMissingRir({}, 2, { source: "manual" });
  const explicit = domain.defaultMissingRir({ rir: 1.5 }, undefined, { source: "manual" });
  const derived = domain.defaultMissingRir({ rpe: 8 }, undefined, { source: "manual" });
  const cleared = domain.defaultMissingRir({ manualRirCleared: true }, undefined, { source: "manual" });

  assert.equal(domain.DEFAULT_RIR, 3);
  assert.equal(missing.rir, 3);
  assert.equal(missing.effortSource, "manual");
  assert.equal(planned.rir, 2);
  assert.equal(explicit.rir, 1.5);
  assert.equal(derived.rir, 2);
  assert.equal(cleared.rir, null);
  assert.equal(cleared.effortSource, "manual-cleared");
});

test("corrected source workout is updated without losing manual RIR", () => {
  const existing = {
    id: "hevy-1",
    source: "hevy-csv",
    sourceIdentity: "hevy:abc",
    entries: [{
      exerciseId: "bench-press",
      sets: [{
        sourceSetId: "hevy:abc:bench:1",
        weightKg: 50,
        reps: 8,
        rawRpe: 8,
        manualRir: 1,
        rirManual: true,
      }],
    }],
  };
  existing.contentFingerprint = domain.contentFingerprint(existing);
  const incoming = {
    source: "hevy-csv",
    sourceIdentity: "hevy:abc",
    entries: [{
      exerciseId: "bench-press",
      sets: [{
        sourceSetId: "hevy:abc:bench:1",
        weightKg: 55,
        reps: 8,
        rawRpe: 8,
      }],
    }],
  };
  const result = domain.compareSourceWorkout(existing, incoming);
  assert.equal(result.status, "updated");
  assert.equal(result.incoming.id, "hevy-1");
  assert.equal(result.incoming.entries[0].sets[0].weightKg, 55);
  assert.equal(result.incoming.entries[0].sets[0].manualRir, 1);
  assert.equal(result.incoming.entries[0].sets[0].rir, 1);
});

test("corrected source workout conflicts when a manually edited set disappears", () => {
  const existing = {
    id: "hevy-1",
    source: "hevy-csv",
    sourceIdentity: "hevy:abc",
    entries: [{
      exerciseId: "bench-press",
      sets: [
        { sourceSetId: "set-1", weightKg: 50, reps: 8 },
        { sourceSetId: "set-2", weightKg: 50, reps: 8, manualRir: 1, rirManual: true },
      ],
    }],
  };
  existing.contentFingerprint = domain.contentFingerprint(existing);
  const incoming = {
    source: "hevy-csv",
    sourceIdentity: "hevy:abc",
    entries: [{
      exerciseId: "bench-press",
      sets: [{ sourceSetId: "set-1", weightKg: 52.5, reps: 8 }],
    }],
  };
  const result = domain.compareSourceWorkout(existing, incoming);
  assert.equal(result.status, "conflicted");
  assert.deepEqual(result.unmatchedManual, ["set-2"]);
  assert.match(result.reason, /manually edited RIR/);
});

test("unchanged source workout is skipped", () => {
  const workout = {
    id: "hevy-1",
    source: "hevy-csv",
    sourceIdentity: "hevy:abc",
    name: "Upper",
    entries: [{ exerciseId: "bench-press", sets: [{ weightKg: 50, reps: 8 }] }],
  };
  workout.contentFingerprint = domain.contentFingerprint(workout);
  const result = domain.compareSourceWorkout(workout, { ...workout, id: undefined });
  assert.equal(result.status, "unchanged");
});

test("day aggregation deduplicates exercise rows but preserves sessions", () => {
  const groups = domain.groupWorkoutsByDay([
    { id: "am", date: "2026-07-20", entries: [{ exerciseId: "pull-up", sets: [{ reps: 5 }] }] },
    { id: "pm", date: "2026-07-20", entries: [{ exerciseId: "pull-up", sets: [{ reps: 6 }] }] },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].sessions.length, 2);
  assert.equal(groups[0].entries.length, 1);
  assert.equal(groups[0].entries[0].sets.length, 2);
});

test("measurement modes qualify appropriate non-warm-up sets", () => {
  assert.equal(domain.isQualifiedSet({ measurementMode: "duration", durationSeconds: 30 }), true);
  assert.equal(domain.isQualifiedSet({ measurementMode: "distance_duration", distanceMeters: 1000 }), true);
  assert.equal(domain.isQualifiedSet({ measurementMode: "load_reps", reps: 0 }), false);
  assert.equal(domain.isQualifiedSet({ type: "warmup", reps: 10 }), false);
});

test("load conventions normalize volume", () => {
  const set = { weightKg: 20, reps: 10 };
  assert.equal(domain.normalizedSetVolume(set, "total", "total"), 200);
  assert.equal(domain.normalizedSetVolume(set, "per_hand", "total"), 400);
  assert.equal(domain.normalizedSetVolume(set, "per_hand", "per_side"), 400);
  assert.equal(domain.normalizedSetVolume(set, "assistance", "total"), 0);
});

test("Fitatu parser accepts Polish headers, semicolons, decimal commas, and carried dates", () => {
  const csv = [
    "Data;Posiłek;Produkt;Kalorie (kcal);Białko (g);Węglowodany (g);Tłuszcze (g);Błonnik (g)",
    "01.08.2026;Śniadanie;Owsianka;450,5;25,5;60;12;8",
    ";Obiad;Kurczak z ryżem;700;55;70;20;6",
  ].join("\n");
  const result = domain.parseFitatuExport(csv, { today: "2026-08-02" });
  assert.equal(result.delimiter, ";");
  assert.equal(result.days.length, 1);
  assert.deepEqual(result.days[0], {
    date: "2026-08-01",
    caloriesKcal: 1150.5,
    proteinG: 80.5,
    carbsG: 130,
    fatG: 32,
    fiberG: 14,
    rowCount: 2,
    sourceRowCount: 2,
    aggregation: "items",
  });
});

test("Fitatu daily total takes precedence over item rows", () => {
  const csv = [
    "Date,Meal,Food,Calories,Protein,Carbohydrates,Fat",
    "2026-08-01,Breakfast,Oats,450,25,60,12",
    "2026-08-01,Lunch,Rice bowl,700,55,70,20",
    "2026-08-01,Daily total,,2100,150,220,70",
  ].join("\n");
  const result = domain.parseFitatuExport(csv, { today: "2026-08-02" });
  assert.equal(result.days[0].caloriesKcal, 2100);
  assert.equal(result.days[0].proteinG, 150);
  assert.equal(result.days[0].aggregation, "daily-total");
  assert.equal(result.days[0].sourceRowCount, 3);
});

test("Fitatu parser skips metadata and reports future planned rows", () => {
  const csv = [
    "Fitatu export;;;;",
    "Date;Calories;Protein;Carbs;Fat",
    "2026-08-01;2 100;150;220;70",
    "2026-08-03;2200;155;230;75",
  ].join("\n");
  const result = domain.parseFitatuExport(csv, { today: "2026-08-02" });
  assert.equal(result.headerRowNumber, 2);
  assert.equal(result.days.length, 1);
  assert.equal(result.days[0].caloriesKcal, 2100);
  assert.equal(result.rejectedRows.length, 1);
  assert.match(result.rejectedRows[0].reasons.join(" "), /future planned/);
});

test("Fitatu meal-plan columns preserve three-place decimal values", () => {
  const csv = [
    "Date,Meal,\"Products and dishes\",\"Kitchen measure\",\"quantity (g)\",\"calories (kcal)\",\"Protein (g)\",\"Plant (g)\",\"Animal (g)\",\"Fats (g)\",\"Carbohydrates (g)\",\"Fibre (g)\"",
    "2026-08-01,Snack,Banana,\"120x g\",120,118.452,1.44,1.44,0,0.36,27,3.12",
    "2026-08-01,Snack,Dessert,\"1x portion\",41.65,217.413,2.499,,,12.0785,24.53185,0",
  ].join("\n");
  const result = domain.parseFitatuExport(csv, { today: "2026-08-02" });
  assert.equal(result.acceptedRowCount, 2);
  assert.equal(result.rejectedRows.length, 0);
  assert.equal(result.days[0].caloriesKcal, 335.87);
  assert.equal(result.days[0].proteinG, 3.94);
  assert.equal(result.days[0].fatG, 12.44);
  assert.equal(result.days[0].carbsG, 51.53);
});
