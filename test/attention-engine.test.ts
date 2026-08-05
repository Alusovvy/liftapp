import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { buildAttentionPlan } from "../src/domain/coaching/attention-engine";
import { classifyEvidence, evidenceLabel } from "../src/domain/coaching/evidence-sufficiency";
import { calculateWeeklyDose } from "../src/domain/coaching/weekly-dose";
import type { AttentionEngineInput } from "../src/domain/coaching/types";
import type { Workout } from "../src/domain/models/schema";

const baseline: AttentionEngineInput = {
  painConcern: false,
  recoveryCaution: false,
  weeklyGaps: [],
  performanceReviews: [],
  abovePlanMuscles: [],
};

describe("attention priority ladder", () => {
  test("pain always outranks recovery, schedule, and volume gaps", () => {
    const result = buildAttentionPlan({
      ...baseline,
      painConcern: true,
      recoveryCaution: true,
      scheduledRoutine: { id: "lower", name: "Lower" },
      weeklyGaps: [
        {
          muscle: "Quads",
          currentSets: 0,
          minimumSets: 8,
          maximumSets: 14,
          availableExerciseCount: 4,
          evidence: "enough-evidence",
        },
      ],
    });

    assert.equal(result.primary.kind, "safety");
    assert.deepEqual(result.ruleTrace, ["attention.safety"]);
  });

  test("recovery caution outranks the scheduled routine", () => {
    const result = buildAttentionPlan({
      ...baseline,
      recoveryCaution: true,
      scheduledRoutine: { id: "upper", name: "Upper" },
    });
    assert.equal(result.primary.kind, "recovery");
  });

  test("uses safe fallback language when optional safety context is absent", () => {
    const pain = buildAttentionPlan({ ...baseline, painConcern: true });
    const recovery = buildAttentionPlan({ ...baseline, recoveryCaution: true });

    assert.match(pain.primary.reason, /today's recovery check-in/i);
    assert.match(recovery.primary.reason, /reducing work/i);
  });

  test("scheduled routine outranks an otherwise actionable weekly gap", () => {
    const result = buildAttentionPlan({
      ...baseline,
      scheduledRoutine: { id: "upper", name: "Upper", estimatedMinutes: 45 },
      weeklyGaps: [
        {
          muscle: "Back",
          currentSets: 5,
          minimumSets: 10,
          maximumSets: 16,
          availableExerciseCount: 3,
          evidence: "enough-evidence",
        },
      ],
    });

    assert.equal(result.primary.kind, "planned-session");
    assert.match(result.primary.title, /about 45 min/);
  });

  test("describes a scheduled routine without inventing time or gap evidence", () => {
    const result = buildAttentionPlan({
      ...baseline,
      scheduledRoutine: { id: "upper", name: "Upper" },
    });

    assert.equal(result.primary.title, "Train Upper");
    assert.match(result.primary.reason, /scheduled today/i);
    assert.equal(result.primary.evidence, "enough-evidence");
  });

  test("places data quality before gaps when a baseline is explicitly missing", () => {
    const result = buildAttentionPlan({
      ...baseline,
      missingBaseline: {
        count: 1,
        description: "One useful session is needed.",
      },
      weeklyGaps: [
        {
          muscle: "Chest",
          currentSets: 0,
          minimumSets: 8,
          maximumSets: 14,
          availableExerciseCount: 2,
          evidence: "need-data",
        },
      ],
    });

    assert.equal(result.primary.kind, "data-quality");
    assert.equal(result.primary.reason, "One useful session is needed.");
  });

  test("recent direct work deprioritizes a muscle before gap size", () => {
    const result = buildAttentionPlan({
      ...baseline,
      weeklyGaps: [
        {
          muscle: "Quads",
          currentSets: 0,
          minimumSets: 8,
          maximumSets: 14,
          recentDirectWorkHours: 12,
          availableExerciseCount: 3,
          evidence: "enough-evidence",
        },
        {
          muscle: "Back",
          currentSets: 7,
          minimumSets: 10,
          maximumSets: 16,
          recentDirectWorkHours: 72,
          availableExerciseCount: 3,
          evidence: "enough-evidence",
        },
      ],
    });

    assert.equal(result.primary.muscle, "Back");
  });

  test("ranks equal actionable gaps deterministically and ignores unavailable or complete gaps", () => {
    const result = buildAttentionPlan({
      ...baseline,
      weeklyGaps: [
        {
          muscle: "Chest",
          currentSets: 0,
          minimumSets: 8,
          maximumSets: 14,
          availableExerciseCount: 0,
          evidence: "enough-evidence",
        },
        {
          muscle: "Back",
          currentSets: 10,
          minimumSets: 10,
          maximumSets: 16,
          availableExerciseCount: 3,
          evidence: "enough-evidence",
        },
        {
          muscle: "Quads",
          currentSets: 7,
          minimumSets: 8,
          maximumSets: 14,
          availableExerciseCount: 3,
          evidence: "enough-evidence",
        },
        {
          muscle: "Biceps",
          currentSets: 5,
          minimumSets: 6,
          maximumSets: 12,
          availableExerciseCount: 3,
          evidence: "enough-evidence",
        },
      ],
    });

    assert.equal(result.primary.muscle, "Biceps");
    assert.equal(result.primary.title, "Add 1 weighted set for Biceps");
    assert.equal(result.weeklyFocus[0]?.muscle, "Quads");
  });

  test("walks through performance, above-plan, and maintenance fallbacks", () => {
    const performance = buildAttentionPlan({
      ...baseline,
      missingBaseline: { count: 0, description: "Not active" },
      performanceReviews: [
        {
          exerciseId: "curl",
          exerciseName: "Dumbbell Curl",
          reason: "Three comparable exposures are flat.",
          evidence: "emerging",
        },
      ],
    });
    const abovePlan = buildAttentionPlan({
      ...baseline,
      abovePlanMuscles: [
        {
          muscle: "Chest",
          currentSets: 18,
          maximumSets: 14,
        },
      ],
    });
    const maintenance = buildAttentionPlan(baseline);

    assert.equal(performance.primary.kind, "performance-review");
    assert.equal(performance.primary.evidence, "emerging");
    assert.equal(performance.weeklyFocus.length, 0);
    assert.equal(abovePlan.primary.kind, "above-plan-review");
    assert.match(abovePlan.primary.reason, /18 weighted sets/);
    assert.equal(abovePlan.weeklyFocus.length, 0);
    assert.equal(maintenance.primary.kind, "maintenance");
    assert.deepEqual(maintenance.ruleTrace, ["attention.maintenance"]);
  });

  test("deduplicates repeated secondary findings before applying the three-item limit", () => {
    const repeated = {
      exerciseId: "curl",
      exerciseName: "Dumbbell Curl",
      reason: "Review the recent pattern.",
      evidence: "enough-evidence" as const,
    };
    const result = buildAttentionPlan({
      ...baseline,
      scheduledRoutine: { id: "upper", name: "Upper" },
      performanceReviews: [repeated, repeated],
      abovePlanMuscles: [
        {
          muscle: "Chest",
          currentSets: 18,
          maximumSets: 14,
        },
      ],
    });

    assert.deepEqual(
      result.weeklyFocus.map(({ id }) => id),
      ["performance:curl", "above-plan:Chest"],
    );
  });

  test("returns no more than three secondary focus items", () => {
    const result = buildAttentionPlan({
      ...baseline,
      weeklyGaps: [
        ["Chest", 0, 8, 14],
        ["Back", 0, 10, 16],
        ["Quads", 0, 8, 14],
        ["Hamstrings", 0, 8, 14],
        ["Glutes", 0, 6, 12],
      ].map(([muscle, currentSets, minimumSets, maximumSets]) => ({
        muscle,
        currentSets,
        minimumSets,
        maximumSets,
        availableExerciseCount: 2,
        evidence: "enough-evidence" as const,
      })) as AttentionEngineInput["weeklyGaps"],
    });

    assert.equal(result.weeklyFocus.length, 3);
  });
});

describe("evidence sufficiency", () => {
  test("uses named states rather than a numeric confidence score", () => {
    assert.equal(
      classifyEvidence({ observations: 0, requiredObservations: 3, hasBaseline: false }),
      "need-data",
    );
    assert.equal(
      classifyEvidence({ observations: 0, requiredObservations: 3, hasBaseline: true }),
      "need-data",
    );
    assert.equal(
      classifyEvidence({ observations: 2, requiredObservations: 3, hasBaseline: true }),
      "emerging",
    );
    assert.equal(
      classifyEvidence({ observations: 3, requiredObservations: 3, hasBaseline: true }),
      "enough-evidence",
    );
    assert.equal(evidenceLabel("need-data"), "Need data");
    assert.equal(evidenceLabel("emerging"), "Emerging");
    assert.equal(evidenceLabel("enough-evidence"), "Enough evidence");
  });
});

describe("weekly dose characterization", () => {
  test("counts qualified primary sets as one and secondary sets as one half", () => {
    const workouts: Workout[] = [
      {
        id: "dose-fixture",
        date: "2026-08-01",
        name: "Upper",
        notes: "",
        entries: [
          {
            exerciseId: "db-bench",
            sets: [
              { type: "warmup", reps: 10 },
              { type: "normal", reps: 10 },
              { type: "normal", reps: 8 },
            ],
          },
        ],
      },
    ];

    const dose = calculateWeeklyDose(workouts, [
      {
        id: "db-bench",
        primary: ["Chest"],
        secondary: ["Triceps", "Shoulders"],
      },
    ]);

    assert.equal(dose.Chest, 2);
    assert.equal(dose.Triceps, 1);
    assert.equal(dose.Shoulders, 1);
  });

  test("qualifies duration and distance work without counting empty or unmapped sets", () => {
    const workouts: Workout[] = [
      {
        id: "mixed-dose-fixture",
        date: "2026-08-02",
        name: "Conditioning",
        notes: "",
        entries: [
          {
            exerciseId: "plank",
            sets: [
              { type: "normal", measurementMode: "duration", durationSeconds: 45 },
              { type: "normal", measurementMode: "duration", durationSeconds: 0 },
            ],
          },
          {
            exerciseId: "carry",
            sets: [
              { type: "normal", measurementMode: "distance_duration", distanceMeters: 30 },
              { type: "normal", measurementMode: "distance_duration", distanceMeters: 0 },
            ],
          },
          {
            exerciseId: "unmapped",
            sets: [{ type: "normal", reps: 12 }],
          },
          {
            exerciseId: "curl",
            sets: [
              { type: "normal", reps: 0 },
              { type: "normal", reps: 1 },
            ],
          },
        ],
      },
    ];

    const dose = calculateWeeklyDose(workouts, [
      { id: "plank", primary: ["Core"], secondary: [] },
      { id: "carry", primary: ["Core"], secondary: ["Shoulders"] },
      { id: "curl", primary: ["Biceps"], secondary: [] },
    ]);

    assert.equal(dose.Core, 2);
    assert.equal(dose.Shoulders, 0.5);
    assert.equal(dose.Biceps, 1);
  });
});
