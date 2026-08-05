import assert from "node:assert/strict";
import { describe, test } from "vitest";
import fixture from "./fixtures/current-data-v9.json";
import {
  LiftwiseDataSchema,
  type WorkoutEntry,
  type WorkoutSet,
} from "../src/domain/models/schema";
import { buildExerciseProgress } from "../src/domain/progress/exercise-progress";

function workout(
  id: string,
  date: string,
  exerciseId: string,
  sets: WorkoutSet[],
  entry: Partial<WorkoutEntry> = {},
) {
  return {
    ...fixture.workouts[0],
    id,
    date,
    name: `${exerciseId} ${date}`,
    startTime: `${date}T10:00:00.000Z`,
    endTime: `${date}T11:00:00.000Z`,
    entries: [
      {
        exerciseId,
        measurementMode: "load_reps" as const,
        loadMode: "total" as const,
        repMode: "total" as const,
        sets,
        ...entry,
      },
    ],
  };
}

function set(values: Partial<WorkoutSet>): WorkoutSet {
  return {
    type: "normal",
    measurementMode: "load_reps",
    weightKg: null,
    reps: null,
    rir: null,
    ...values,
  };
}

function bareSet(values: Partial<WorkoutSet>): WorkoutSet {
  return { type: "normal", ...values } as WorkoutSet;
}

describe("exercise progress decisions", () => {
  test("keeps absent history and a single appearance visibly below trend sufficiency", () => {
    const empty = LiftwiseDataSchema.parse({ ...fixture, workouts: [] });
    const baselines = buildExerciseProgress(empty);
    assert.equal(baselines.length, 2);
    assert.ok(baselines.every((item) => item.evidence === "need-data"));
    assert.match(baselines[0]!.recommendation, /establish a baseline/i);

    const one = buildExerciseProgress(LiftwiseDataSchema.parse(fixture));
    const bench = one.find((item) => item.exerciseId === "db-bench");
    assert.equal(bench?.evidence, "emerging");
    assert.equal(bench?.lastPerformance, "24 kg × 10");
    assert.match(bench?.reason ?? "", /second comparable session/i);
  });

  test("reports direct load or rep improvement without creating a synthetic score", () => {
    const data = LiftwiseDataSchema.parse({
      ...fixture,
      routines: [],
      workouts: [
        workout("older", "2026-07-20", "db-bench", [set({ weightKg: 24, reps: 9, rir: 2 })]),
        workout("latest", "2026-07-27", "db-bench", [set({ weightKg: 24, reps: 10, rir: 2 })]),
      ],
    });
    const summary = buildExerciseProgress(data)[0]!;

    assert.equal(summary.change, "improved");
    assert.equal(summary.evidence, "enough-evidence");
    assert.match(summary.reason, /24 kg × 10 improved/i);
    assert.equal("score" in summary, false);
  });

  test("uses three comparable hard sessions for a review prompt, not a diagnosis", () => {
    const data = LiftwiseDataSchema.parse({
      ...fixture,
      routines: [],
      workouts: [
        workout("first", "2026-07-10", "curl", [set({ weightKg: 12, reps: 8, rir: 1 })]),
        workout("second", "2026-07-17", "curl", [set({ weightKg: 12, reps: 8, rir: 1 })]),
        workout("third", "2026-07-24", "curl", [set({ weightKg: 12, reps: 8, rir: 0.5 })]),
      ],
    });
    const summary = buildExerciseProgress(data)[0]!;

    assert.equal(summary.change, "review");
    assert.match(summary.recommendation, /Review load, recovery, technique/i);
    assert.match(summary.reason, /not a diagnosis/i);
  });

  test("asks for effort when RIR is missing and excludes changed loading conventions", () => {
    const data = LiftwiseDataSchema.parse({
      ...fixture,
      routines: [],
      workouts: [
        workout("per-hand", "2026-07-10", "db-bench", [set({ weightKg: 20, reps: 10, rir: 3 })], {
          loadMode: "per_hand",
        }),
        workout("older", "2026-07-17", "db-bench", [set({ weightKg: 40, reps: 8, rir: 2 })]),
        workout("latest", "2026-07-24", "db-bench", [
          set({ weightKg: 40, reps: 8, rir: null, rawRpe: null }),
        ]),
      ],
    });
    const summary = buildExerciseProgress(data)[0]!;

    assert.equal(summary.evidence, "emerging");
    assert.equal(summary.excludedAppearances, 1);
    assert.match(summary.recommendation, /record RIR/i);
  });

  test("compares repetitions, duration, distance, pace, and assistance by their own rules", () => {
    const cases = [
      {
        id: "push-up",
        older: set({ measurementMode: "reps", reps: 10, rir: 2 }),
        latest: set({ measurementMode: "reps", reps: 12, rir: 2 }),
        entry: { measurementMode: "reps" as const, loadMode: "none" as const },
        label: "12 reps",
      },
      {
        id: "plank-hold",
        older: set({ measurementMode: "duration", durationSeconds: 30, reps: null, rir: 2 }),
        latest: set({ measurementMode: "duration", durationSeconds: 40, reps: null, rir: 2 }),
        entry: { measurementMode: "duration" as const, loadMode: "none" as const },
        label: "40 sec",
      },
      {
        id: "dead-bug",
        older: set({
          measurementMode: "distance_duration",
          distanceMeters: 1000,
          durationSeconds: 360,
          reps: null,
          rir: 2,
        }),
        latest: set({
          measurementMode: "distance_duration",
          distanceMeters: 1000,
          durationSeconds: 350,
          reps: null,
          rir: 2,
        }),
        entry: { measurementMode: "distance_duration" as const, loadMode: "none" as const },
        label: "1 km · 5m 50s",
      },
      {
        id: "pull-up",
        older: set({ weightKg: 20, reps: 8, rir: 2 }),
        latest: set({ weightKg: 15, reps: 8, rir: 2 }),
        entry: { measurementMode: "load_reps" as const, loadMode: "assistance" as const },
        label: "15 kg × 8",
      },
    ];

    cases.forEach((item) => {
      const data = LiftwiseDataSchema.parse({
        ...fixture,
        routines: [],
        workouts: [
          workout(`${item.id}-old`, "2026-07-10", item.id, [item.older], item.entry),
          workout(`${item.id}-new`, "2026-07-17", item.id, [item.latest], item.entry),
        ],
      });
      const summary = buildExerciseProgress(data)[0]!;
      assert.equal(summary.change, "improved", item.id);
      assert.equal(summary.lastPerformance, item.label);
    });
  });

  test("retains a neutral next step when comparable performance is maintained", () => {
    const data = LiftwiseDataSchema.parse({
      ...fixture,
      routines: [],
      workouts: [
        workout("older", "2026-07-10", "curl", [
          set({ weightKg: 12, reps: 8, rir: 2 }),
          set({ type: "warmup", weightKg: 6, reps: 20, rir: null }),
        ]),
        workout("latest", "2026-07-17", "curl", [set({ weightKg: 12, reps: 8, rir: 2 })]),
      ],
    });
    const summary = buildExerciseProgress(data)[0]!;

    assert.equal(summary.category, "maintained");
    assert.match(summary.recommendation, /aim for one more clean rep/i);
  });

  test("selects the best qualified set for every measurement mode", () => {
    const base = workout(
      "mixed",
      "2026-07-17",
      "curl",
      [
        bareSet({ weightKg: 12, reps: 8, rawRpe: 8 }),
        bareSet({ weightKg: 12, reps: 10, rawRpe: 8 }),
        bareSet({ weightKg: 14, reps: 8, rawRpe: 8 }),
        bareSet({ type: "warmup", weightKg: 20, reps: 20 }),
      ],
      { measurementMode: null, loadMode: null, repMode: null },
    );
    const entries = [
      base.entries[0],
      {
        exerciseId: "plank-hold",
        measurementMode: "duration" as const,
        loadMode: "none" as const,
        repMode: "total" as const,
        sets: [bareSet({ durationSeconds: 30 }), bareSet({ durationSeconds: 65 })],
      },
      {
        exerciseId: "dead-bug",
        measurementMode: "distance_duration" as const,
        loadMode: "none" as const,
        repMode: "total" as const,
        sets: [
          bareSet({ distanceMeters: 500, durationSeconds: 210 }),
          bareSet({ distanceMeters: 500, durationSeconds: 200 }),
        ],
      },
      {
        exerciseId: "push-up",
        measurementMode: "reps" as const,
        loadMode: "none" as const,
        repMode: "total" as const,
        sets: [bareSet({ reps: 8 }), bareSet({ reps: 12 })],
      },
      {
        exerciseId: "pull-up",
        measurementMode: "load_reps" as const,
        loadMode: "assistance" as const,
        repMode: "total" as const,
        sets: [bareSet({ weightKg: 20, reps: 8 }), bareSet({ weightKg: 15, reps: 8 })],
      },
      {
        exerciseId: "invalid-only",
        measurementMode: "load_reps" as const,
        sets: [bareSet({ reps: null }), bareSet({ type: "warmup", reps: 20 })],
      },
    ];
    const data = LiftwiseDataSchema.parse({
      ...fixture,
      routines: [],
      workouts: [{ ...base, entries }],
    });
    const summaries = buildExerciseProgress(data);

    assert.equal(
      summaries.find((item) => item.exerciseId === "curl")?.lastPerformance,
      "14 kg × 8",
    );
    assert.equal(
      summaries.find((item) => item.exerciseId === "plank-hold")?.lastPerformance,
      "1m 5s",
    );
    assert.equal(
      summaries.find((item) => item.exerciseId === "dead-bug")?.lastPerformance,
      "500 m · 3m 20s",
    );
    assert.equal(
      summaries.find((item) => item.exerciseId === "push-up")?.lastPerformance,
      "12 reps",
    );
    assert.equal(
      summaries.find((item) => item.exerciseId === "pull-up")?.lastPerformance,
      "15 kg × 8",
    );
    assert.equal(
      summaries.find((item) => item.exerciseId === "invalid-only")?.evidence,
      "need-data",
    );
    assert.equal(
      summaries.find((item) => item.exerciseId === "curl")?.comparableHistory[0]?.rir,
      2,
    );
  });

  test("gives mode-specific neutral advice when time, distance, or reps are maintained", () => {
    const cases = [
      {
        id: "plank-hold",
        value: bareSet({ measurementMode: "duration", durationSeconds: 60, rir: 2 }),
        entry: { measurementMode: "duration" as const, loadMode: "none" as const },
        phrase: "small amount of time",
      },
      {
        id: "dead-bug",
        value: bareSet({
          measurementMode: "distance_duration",
          distanceMeters: 800,
          durationSeconds: 300,
          rir: 2,
        }),
        entry: { measurementMode: "distance_duration" as const, loadMode: "none" as const },
        phrase: "distance or pace",
      },
      {
        id: "push-up",
        value: bareSet({ measurementMode: "reps", reps: 12, rir: 2 }),
        entry: { measurementMode: "reps" as const, loadMode: "none" as const },
        phrase: "one more clean rep",
      },
    ];

    cases.forEach((item) => {
      const data = LiftwiseDataSchema.parse({
        ...fixture,
        routines: [],
        workouts: [
          workout(`${item.id}-old`, "2026-07-10", item.id, [item.value], item.entry),
          workout(`${item.id}-new`, "2026-07-17", item.id, [item.value], item.entry),
        ],
      });
      const summary = buildExerciseProgress(data)[0]!;
      assert.equal(summary.category, "maintained");
      assert.match(summary.recommendation, new RegExp(item.phrase, "i"));
    });
  });

  test("recognizes better reserve at the same load and keeps lower-rep load changes conservative", () => {
    const data = LiftwiseDataSchema.parse({
      ...fixture,
      routines: [],
      workouts: [
        workout("reserve-old", "2026-07-10", "curl", [bareSet({ weightKg: 12, reps: 8, rir: 1 })]),
        workout("reserve-new", "2026-07-17", "curl", [bareSet({ weightKg: 12, reps: 8, rir: 3 })]),
        workout("load-old", "2026-07-10", "db-bench", [
          bareSet({ weightKg: 20, reps: 10, rir: 2 }),
        ]),
        workout("load-new", "2026-07-17", "db-bench", [bareSet({ weightKg: 22, reps: 8, rir: 2 })]),
      ],
    });
    const summaries = buildExerciseProgress(data);

    assert.equal(summaries.find((item) => item.exerciseId === "curl")?.change, "improved");
    assert.equal(summaries.find((item) => item.exerciseId === "db-bench")?.change, "maintained");
  });
});
