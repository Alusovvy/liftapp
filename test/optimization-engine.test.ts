import assert from "node:assert/strict";
import { describe, test } from "vitest";
import fixture from "./fixtures/current-data-v9.json";
import { LiftwiseDataSchema, type Routine } from "../src/domain/models/schema";
import { analyzeRoutineOptimization } from "../src/domain/optimization/analyze-plan";
import {
  applyRoutineOpportunity,
  coverageForProposedEntries,
  routineAfterOpportunity,
  RoutineRevisionError,
  routineRevisionToken,
  snoozeUntilSixWeeksFrom,
  StaleRoutineRevisionError,
  undoRoutineRevision,
  withOptimizationPreferences,
} from "../src/domain/optimization/routine-revisions";
import type { OptimizationAnalysisInput } from "../src/domain/optimization/types";

function routine(entries: Routine["entries"]): Routine {
  return {
    id: "routine-test",
    name: "Test routine",
    notes: "",
    weekdays: [1],
    entries,
  };
}

const base: Omit<OptimizationAnalysisInput, "routine"> = {
  objective: "simplify",
  equipment: {
    dumbbells: true,
    barbell: true,
    bench: true,
    pullupDipBar: true,
    squatRack: false,
    inclineBench: false,
    machine: false,
  },
};

describe("routine optimization eligibility", () => {
  test("consolidates two plus two same-role direct sets into four", () => {
    const result = analyzeRoutineOptimization({
      ...base,
      routine: routine([
        { exerciseId: "curl", targetSets: 2, notes: "" },
        { exerciseId: "concentration-curl", targetSets: 2, notes: "" },
      ]),
      completedAppearances: { curl: 3, "concentration-curl": 3 },
    });

    const opportunity = result.opportunities[0];
    assert.equal(opportunity?.kind, "same_role");
    assert.equal(opportunity?.proposedEntries[0]?.targetSets, 4);
    assert.equal(opportunity?.coverage[0]?.tone, "preserved");
    assert.equal(opportunity?.evidence, "usage-confirmed");
  });

  test("does not claim that four sets replace a three plus three pair", () => {
    const result = analyzeRoutineOptimization({
      ...base,
      routine: routine([
        { exerciseId: "curl", targetSets: 3, notes: "" },
        { exerciseId: "concentration-curl", targetSets: 3, notes: "" },
      ]),
    });

    assert.equal(result.opportunities.length, 0);
    assert.deepEqual(result.ruleTrace, ["optimization.keep-current"]);
  });

  test("never removes a protected exercise", () => {
    const result = analyzeRoutineOptimization({
      ...base,
      routine: routine([
        { exerciseId: "curl", targetSets: 2, notes: "" },
        { exerciseId: "concentration-curl", targetSets: 2, notes: "" },
      ]),
      protectedExerciseIds: ["concentration-curl"],
    });

    assert.equal(result.opportunities.length, 0);
  });

  test("keeps horizontal and vertical pulling roles distinct", () => {
    const result = analyzeRoutineOptimization({
      ...base,
      routine: routine([
        { exerciseId: "one-arm-db-row", targetSets: 3, notes: "" },
        { exerciseId: "pull-up", targetSets: 3, notes: "" },
      ]),
    });

    assert.equal(result.opportunities.length, 0);
    assert.match(result.doNotCombine[0]?.reason ?? "", /horizontal and vertical/);
  });

  test("labels compound consolidation as a direct-work trade-off", () => {
    const result = analyzeRoutineOptimization({
      ...base,
      objective: "save_time",
      routine: routine([
        { exerciseId: "one-arm-db-row", targetSets: 3, notes: "" },
        { exerciseId: "curl", targetSets: 2, notes: "" },
      ]),
    });

    const opportunity = result.opportunities.find((item) => item.kind === "time_saving_tradeoff");
    assert.equal(opportunity?.label, "Saves time; changes direct work");
    assert.equal(
      opportunity?.coverage.find((item) => item.label === "Biceps direct work")?.after,
      0,
    );
    assert.ok(opportunity?.caveats.some((caveat) => /not biologically equivalent/i.test(caveat)));
  });

  test("replaces an unavailable machine movement only with available equipment", () => {
    const result = analyzeRoutineOptimization({
      ...base,
      objective: "equipment",
      routine: routine([{ exerciseId: "lat-pulldown", targetSets: 3, notes: "" }]),
    });

    const opportunity = result.opportunities[0];
    assert.equal(opportunity?.kind, "equipment_alternative");
    assert.equal(opportunity?.proposedEntries[0]?.exerciseId, "pull-up");
  });

  test("returns at most three deterministic opportunities", () => {
    const input: OptimizationAnalysisInput = {
      ...base,
      objective: "save_time",
      routine: routine([
        { exerciseId: "curl", targetSets: 2, notes: "" },
        { exerciseId: "concentration-curl", targetSets: 2, notes: "" },
        { exerciseId: "goblet-squat", targetSets: 2, notes: "" },
        { exerciseId: "db-squat", targetSets: 2, notes: "" },
        { exerciseId: "ohp", targetSets: 2, notes: "" },
        { exerciseId: "db-shoulder-press", targetSets: 2, notes: "" },
        { exerciseId: "one-arm-db-row", targetSets: 3, notes: "" },
      ]),
    };

    const first = analyzeRoutineOptimization(input);
    const second = analyzeRoutineOptimization(input);
    assert.equal(first.opportunities.length, 3);
    assert.deepEqual(first, second);
  });

  test("suppresses a reviewed relationship rather than broad muscle overlap", () => {
    const current = routine([
      { exerciseId: "curl", targetSets: 2, notes: "" },
      { exerciseId: "concentration-curl", targetSets: 2, notes: "" },
    ]);
    const shown = analyzeRoutineOptimization({ ...base, routine: current });
    const relationshipId = shown.opportunities[0]?.ruleIds.find((id) =>
      id.startsWith("relationship."),
    );
    assert.ok(relationshipId);

    const hidden = analyzeRoutineOptimization({
      ...base,
      routine: current,
      suppressedRelationshipIds: [relationshipId],
    });

    assert.equal(hidden.opportunities.length, 0);
  });

  test("supports temporary opportunity dismissal separately from permanent relationship suppression", () => {
    const current = routine([
      { exerciseId: "curl", targetSets: 2, notes: "" },
      { exerciseId: "concentration-curl", targetSets: 2, notes: "" },
    ]);
    const opportunity = analyzeRoutineOptimization({ ...base, routine: current }).opportunities[0];
    assert.ok(opportunity);

    const hidden = analyzeRoutineOptimization({
      ...base,
      routine: current,
      suppressedOpportunityIds: [opportunity.id],
    });

    assert.deepEqual(hidden.ruleTrace, ["optimization.keep-current"]);
  });

  test("does not produce consolidation for an unrelated objective or a protected isolation trade-off", () => {
    const curls = routine([
      { exerciseId: "curl", targetSets: 2, notes: "" },
      { exerciseId: "concentration-curl", targetSets: 2, notes: "" },
    ]);
    assert.equal(
      analyzeRoutineOptimization({
        ...base,
        objective: "add_variety",
        routine: curls,
      }).opportunities.length,
      0,
    );

    const pull = routine([
      { exerciseId: "one-arm-db-row", targetSets: 3, notes: "" },
      { exerciseId: "curl", targetSets: 2, notes: "" },
    ]);
    assert.equal(
      analyzeRoutineOptimization({
        ...base,
        objective: "save_time",
        routine: pull,
        protectedExerciseIds: ["curl"],
      }).opportunities.length,
      0,
    );
  });
});

describe("immutable routine revisions", () => {
  function fixtureWithRoutine(currentRoutine: Routine) {
    return LiftwiseDataSchema.parse({
      ...fixture,
      routines: [currentRoutine],
    });
  }

  test("applies a reviewed diff and undo restores the exact routine", () => {
    const original = routine([
      { exerciseId: "curl", targetSets: 2, targetRir: 2, notes: "Keep tempo" },
      { exerciseId: "concentration-curl", targetSets: 2, targetRir: 3, notes: "" },
      { exerciseId: "plank-hold", targetSets: 3, targetRir: null, notes: "" },
    ]);
    const data = fixtureWithRoutine(original);
    const opportunity = analyzeRoutineOptimization({
      ...base,
      routine: original,
    }).opportunities[0];
    assert.ok(opportunity);

    const applied = applyRoutineOpportunity({
      data,
      opportunity,
      expectedRoutineToken: routineRevisionToken(original),
      now: "2026-08-03T09:00:00.000Z",
    });

    assert.deepEqual(
      applied.data.routines[0]?.entries.map(({ exerciseId, targetSets }) => ({
        exerciseId,
        targetSets,
      })),
      [
        { exerciseId: "curl", targetSets: 4 },
        { exerciseId: "plank-hold", targetSets: 3 },
      ],
    );
    assert.equal(applied.data.routines[0]?.entries[0]?.notes, "Keep tempo");
    assert.deepEqual(applied.data.targets, data.targets);
    assert.deepEqual(applied.data.workouts, data.workouts);
    assert.equal(applied.revision.action, "apply");

    const undone = undoRoutineRevision(
      applied.data,
      applied.revision.id,
      "2026-08-03T09:01:00.000Z",
    );

    assert.deepEqual(undone.data.routines[0], original);
    assert.equal(undone.revision.action, "undo");
    assert.equal(undone.revision.revertsRevisionId, applied.revision.id);
    assert.equal(undone.data.routineRevisions.length, 2);
  });

  test("blocks apply and undo when the routine changed after preview", () => {
    const original = routine([
      { exerciseId: "curl", targetSets: 2, notes: "" },
      { exerciseId: "concentration-curl", targetSets: 2, notes: "" },
    ]);
    const data = fixtureWithRoutine(original);
    const opportunity = analyzeRoutineOptimization({
      ...base,
      routine: original,
    }).opportunities[0];
    assert.ok(opportunity);

    const changed = {
      ...data,
      routines: [
        {
          ...original,
          notes: "Changed elsewhere",
        },
      ],
    };
    assert.throws(
      () =>
        applyRoutineOpportunity({
          data: changed,
          opportunity,
          expectedRoutineToken: routineRevisionToken(original),
        }),
      StaleRoutineRevisionError,
    );

    const applied = applyRoutineOpportunity({
      data,
      opportunity,
      expectedRoutineToken: routineRevisionToken(original),
    });
    const changedAfterApply = {
      ...applied.data,
      routines: [
        {
          ...applied.data.routines[0]!,
          weekdays: [2],
        },
      ],
    };
    assert.throws(
      () => undoRoutineRevision(changedAfterApply, applied.revision.id),
      StaleRoutineRevisionError,
    );
  });

  test("persists explicit user controls without mutating the previous state", () => {
    const data = LiftwiseDataSchema.parse(fixture);
    const updated = withOptimizationPreferences(data, (preferences) => ({
      ...preferences,
      protectedExerciseIds: [...preferences.protectedExerciseIds, "curl"],
      suppressedRelationshipIds: [
        ...preferences.suppressedRelationshipIds,
        "relationship.curl-variations",
      ],
      snoozedOpportunityIds: {
        ...preferences.snoozedOpportunityIds,
        "same-role:test": snoozeUntilSixWeeksFrom(new Date("2026-08-03T10:00:00.000Z")),
      },
    }));

    assert.equal(data.optimizationPreferences.protectedExerciseIds.length, 0);
    assert.deepEqual(updated.optimizationPreferences.protectedExerciseIds, ["curl"]);
    assert.equal(
      updated.optimizationPreferences.snoozedOpportunityIds["same-role:test"],
      "2026-09-14T10:00:00.000Z",
    );
  });

  test("rejects mismatched, empty, invalid, and stale proposals", () => {
    const original = routine([
      { exerciseId: "curl", targetSets: 2, notes: "" },
      { exerciseId: "concentration-curl", targetSets: 2, notes: "" },
    ]);
    const opportunity = analyzeRoutineOptimization({
      ...base,
      routine: original,
    }).opportunities[0];
    assert.ok(opportunity);

    assert.throws(
      () => routineAfterOpportunity(original, { ...opportunity, routineId: "another" }),
      RoutineRevisionError,
    );
    assert.throws(
      () => routineAfterOpportunity(original, opportunity, []),
      /at least one exercise/i,
    );
    assert.throws(
      () =>
        routineAfterOpportunity(original, opportunity, [
          {
            ...opportunity.proposedEntries[0]!,
            targetSets: 2.5,
          },
        ]),
      /whole numbers/i,
    );
    assert.throws(
      () =>
        routineAfterOpportunity(original, {
          ...opportunity,
          sourceEntries: [],
        }),
      /no longer present/i,
    );

    const data = fixtureWithRoutine(original);
    assert.throws(
      () =>
        applyRoutineOpportunity({
          data: { ...data, routines: [] },
          opportunity,
          expectedRoutineToken: routineRevisionToken(original),
        }),
      /no longer exists/i,
    );
    assert.throws(() => undoRoutineRevision(data, "missing"), /not found/i);
  });

  test("defaults a newly substituted exercise to RIR 3 and keeps its insertion point", () => {
    const original = routine([
      { exerciseId: "plank-hold", targetSets: 2, targetRir: 2, notes: "" },
      { exerciseId: "lat-pulldown", targetSets: 3, notes: "Machine setup" },
      { exerciseId: "curl", targetSets: 2, targetRir: 1, notes: "" },
    ]);
    const opportunity = analyzeRoutineOptimization({
      ...base,
      objective: "equipment",
      routine: original,
    }).opportunities[0];
    assert.ok(opportunity);

    const after = routineAfterOpportunity(original, opportunity);

    assert.deepEqual(
      after.entries.map(({ exerciseId }) => exerciseId),
      ["plank-hold", "pull-up", "curl"],
    );
    assert.equal(after.entries[1]?.targetRir, 3);
    assert.equal(after.entries[1]?.notes, "");
  });

  test("recalculates edited coverage without claiming preservation", () => {
    const sameRole = analyzeRoutineOptimization({
      ...base,
      routine: routine([
        { exerciseId: "curl", targetSets: 2, notes: "" },
        { exerciseId: "concentration-curl", targetSets: 2, notes: "" },
      ]),
    }).opportunities[0];
    assert.ok(sameRole);
    assert.equal(
      coverageForProposedEntries(sameRole, [
        {
          ...sameRole.proposedEntries[0]!,
          targetSets: 3,
        },
      ])[0]?.tone,
      "lost",
    );
    assert.equal(
      coverageForProposedEntries(sameRole, [
        {
          ...sameRole.proposedEntries[0]!,
          targetSets: 4,
        },
      ])[0]?.tone,
      "preserved",
    );
    assert.equal(
      coverageForProposedEntries(sameRole, [
        {
          ...sameRole.proposedEntries[0]!,
          targetSets: 5,
        },
      ])[0]?.tone,
      "gained",
    );

    const tradeoff = analyzeRoutineOptimization({
      ...base,
      objective: "save_time",
      routine: routine([
        { exerciseId: "one-arm-db-row", targetSets: 3, notes: "" },
        { exerciseId: "curl", targetSets: 2, notes: "" },
      ]),
    }).opportunities.find(({ kind }) => kind === "time_saving_tradeoff");
    assert.ok(tradeoff);
    const reduced = coverageForProposedEntries(tradeoff, [
      {
        ...tradeoff.proposedEntries[0]!,
        targetSets: 2,
      },
    ]);
    assert.equal(reduced[0]?.tone, "lost");
    assert.equal(reduced[1]?.after, 0);
    assert.equal(reduced[2]?.after, 1);
    assert.equal(
      coverageForProposedEntries(tradeoff, [
        {
          ...tradeoff.proposedEntries[0]!,
          targetSets: 3,
        },
      ])[0]?.tone,
      "preserved",
    );
    assert.equal(
      coverageForProposedEntries(tradeoff, [
        {
          ...tradeoff.proposedEntries[0]!,
          targetSets: 4,
        },
      ])[0]?.tone,
      "gained",
    );
    assert.equal(coverageForProposedEntries(tradeoff, [])[0]?.after, 0);

    const untouched = {
      ...sameRole,
      kind: "controlled_trial" as const,
    };
    assert.deepEqual(
      coverageForProposedEntries(untouched, untouched.proposedEntries),
      untouched.coverage,
    );
  });

  test("reports a missing routine when an otherwise valid revision cannot be undone", () => {
    const original = routine([
      { exerciseId: "curl", targetSets: 2, notes: "" },
      { exerciseId: "concentration-curl", targetSets: 2, notes: "" },
    ]);
    const data = fixtureWithRoutine(original);
    const opportunity = analyzeRoutineOptimization({
      ...base,
      routine: original,
    }).opportunities[0];
    assert.ok(opportunity);
    const applied = applyRoutineOpportunity({
      data,
      opportunity,
      expectedRoutineToken: routineRevisionToken(original),
    });

    assert.throws(
      () => undoRoutineRevision({ ...applied.data, routines: [] }, applied.revision.id),
      /no longer exists/i,
    );
  });
});
