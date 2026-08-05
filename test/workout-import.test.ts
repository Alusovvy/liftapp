import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "vitest";
import fixture from "./fixtures/current-data-v9.json";
import {
  buildWorkoutImportPlan,
  commitWorkoutImport,
  parseWorkoutCsv,
} from "../src/domain/import/workout-import";
import { LiftwiseDataSchema } from "../src/domain/models/schema";

const samplePath = new URL("./fixtures/hevy-workouts.csv", import.meta.url);

describe("typed workout CSV import", () => {
  test("parses sessions, maps known exercises, and keeps unknown exercises explicitly unmapped", () => {
    const pending = parseWorkoutCsv(
      readFileSync(samplePath, "utf8"),
      "workouts.csv",
      new Date("2026-08-03T10:00:00.000Z"),
    );

    assert.equal(pending.workouts.length, 1);
    assert.equal(pending.setCount, 3);
    assert.equal(pending.workouts[0]?.entries[0]?.exerciseId, "db-bench");
    assert.match(pending.workouts[0]?.entries[1]?.exerciseId ?? "", /^custom-/);
    assert.equal(pending.unmatchedExercises.length, 1);
    assert.match(pending.warnings.join(" "), /unmapped custom/i);
  });

  test("defaults missing imported RIR to 3 while retaining RPE provenance", () => {
    const pending = parseWorkoutCsv(
      readFileSync(samplePath, "utf8"),
      "workouts.csv",
      new Date("2026-08-03T10:00:00.000Z"),
    );
    const sets = pending.workouts[0]?.entries[0]?.sets;

    assert.equal(sets?.[0]?.rir, 3);
    assert.equal(sets?.[0]?.effortSource, "defaulted");
    assert.equal(sets?.[0]?.defaultedRir, true);
    assert.equal(sets?.[1]?.rir, 2);
    assert.equal(sets?.[1]?.effortSource, "derived-from-rpe");
  });

  test("previews, commits, and then recognizes an unchanged source session", () => {
    const data = LiftwiseDataSchema.parse({
      ...fixture,
      workouts: [],
      customExercises: [],
    });
    const pending = parseWorkoutCsv(
      readFileSync(samplePath, "utf8"),
      "workouts.csv",
      new Date("2026-08-03T10:00:00.000Z"),
    );
    const plan = buildWorkoutImportPlan(data, pending, "merge");
    assert.deepEqual(plan.counts, {
      added: 1,
      updated: 0,
      unchanged: 0,
      conflicted: 0,
    });

    const committed = commitWorkoutImport({
      data,
      pending,
      mode: "merge",
      acceptValidRowsOnly: false,
      now: "2026-08-03T10:00:00.000Z",
      batchId: "workout-test",
    });
    assert.equal(committed.data.workouts.length, 1);
    assert.equal(committed.data.customExercises.length, 1);
    assert.equal(committed.data.importBatches.at(-1)?.kind, "workouts");

    const repeated = buildWorkoutImportPlan(committed.data, pending, "merge");
    assert.equal(repeated.counts.unchanged, 1);
  });

  test("converts pounds and requires consent for a partial import", () => {
    const csv = [
      "title,start_time,exercise_title,set_index,weight_lbs,reps",
      "Upper,2026-08-01T16:00:00.000Z,Dumbbell Bench Press,0,52.91,10",
      "Upper,not-a-date,Dumbbell Bench Press,1,52.91,10",
    ].join("\n");
    const pending = parseWorkoutCsv(csv, "partial.csv", new Date("2026-08-03T10:00:00.000Z"));

    assert.equal(pending.workouts[0]?.entries[0]?.sets[0]?.weightKg, 24);
    assert.equal(pending.rejectedRows.length, 1);
    assert.match(pending.warnings.join(" "), /pounds/i);
    assert.throws(
      () =>
        commitWorkoutImport({
          data: LiftwiseDataSchema.parse(fixture),
          pending,
          mode: "merge",
          acceptValidRowsOnly: false,
        }),
      /Confirm that only valid rows/i,
    );
  });

  test("supports alternate headers, Hevy dates, generic kilograms, warmups, and explicit RIR", () => {
    const csv = [
      "workout_name,date,exercise_name,set_type,weight,reps,rir",
      '"","01 Aug 2026, 16:00",Dumbbell Bicep Curl,warmup,8,12,',
      '"","01 Aug 2026, 16:00",Dumbbell Bicep Curl,normal,12,10,1',
    ].join("\n");
    const pending = parseWorkoutCsv(csv, "alternate.csv", new Date("2026-08-03T10:00:00.000Z"));
    const workout = pending.workouts[0];

    assert.equal(workout?.name, "Imported workout");
    assert.equal(workout?.entries[0]?.exerciseId, "curl");
    assert.equal(workout?.entries[0]?.sets[0]?.type, "warmup");
    assert.equal(workout?.entries[0]?.sets[0]?.rir, null);
    assert.equal(workout?.entries[0]?.sets[1]?.rir, 1);
    assert.match(pending.warnings.join(" "), /generic weight column/i);
  });

  test("updates a corrected source session and replace mode preserves non-workout data", () => {
    const data = LiftwiseDataSchema.parse({
      ...fixture,
      workouts: [],
      customExercises: [],
    });
    const source = readFileSync(samplePath, "utf8");
    const firstPending = parseWorkoutCsv(
      source,
      "workouts.csv",
      new Date("2026-08-03T10:00:00.000Z"),
    );
    const first = commitWorkoutImport({
      data,
      pending: firstPending,
      mode: "merge",
      acceptValidRowsOnly: false,
      now: "2026-08-03T10:00:00.000Z",
      batchId: "first",
    });
    const correctedPending = parseWorkoutCsv(
      source.replace(",24,10,", ",26,10,"),
      "workouts.csv",
      new Date("2026-08-03T10:00:00.000Z"),
    );
    const correction = buildWorkoutImportPlan(first.data, correctedPending, "merge");
    assert.equal(correction.counts.updated, 1);

    const updated = commitWorkoutImport({
      data: first.data,
      pending: correctedPending,
      mode: "merge",
      acceptValidRowsOnly: false,
      now: "2026-08-03T11:00:00.000Z",
      batchId: "second",
    });
    assert.equal(updated.data.workouts.length, 1);
    assert.equal(updated.data.workouts[0]?.entries[0]?.sets[0]?.weightKg, 26);
    assert.equal(updated.data.customExercises.length, 1);

    const replaced = commitWorkoutImport({
      data: LiftwiseDataSchema.parse(fixture),
      pending: firstPending,
      mode: "replace",
      acceptValidRowsOnly: false,
      now: "2026-08-03T12:00:00.000Z",
      batchId: "replace",
    });
    assert.equal(replaced.data.workouts.length, 1);
    assert.deepEqual(replaced.data.nutritionDays, LiftwiseDataSchema.parse(fixture).nutritionDays);
    assert.deepEqual(replaced.data.bodyMetrics, LiftwiseDataSchema.parse(fixture).bodyMetrics);
  });

  test("reports duplicate headers and rejects invalid rows without creating an empty import", () => {
    assert.throws(
      () =>
        parseWorkoutCsv(
          "title,title,start_time,exercise_title\nA,A,2026-08-01T10:00:00Z,Curl",
          "duplicate.csv",
        ),
      /duplicate column/i,
    );
    const invalid = [
      "title,start_time,end_time,exercise_title,weight_kg,reps",
      "Future,2026-08-10T10:00:00Z,not-an-end,,not-a-number,999",
    ].join("\n");
    assert.throws(
      () => parseWorkoutCsv(invalid, "invalid.csv", new Date("2026-08-03T10:00:00Z")),
      /No valid workouts/i,
    );
    assert.throws(
      () => parseWorkoutCsv("title,start_time,exercise_title", "empty.csv"),
      /does not contain workout rows/i,
    );
  });

  test("rejects malformed and oversized workout files", () => {
    assert.throws(
      () => parseWorkoutCsv("wrong,columns\none,two", "wrong.csv"),
      /does not look like/i,
    );
    assert.throws(() => parseWorkoutCsv("x".repeat(10_000_001), "large.csv"), /10 MB/i);
  });
});
