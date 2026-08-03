import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { analyzeRoutineOptimization } from "../src/domain/optimization/analyze-plan";
import type { OptimizationAnalysisInput } from "../src/domain/optimization/types";
import type { Routine } from "../src/domain/models/schema";

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
    assert.equal(opportunity?.coverage.find((item) => item.label === "Biceps direct work")?.after, 0);
    assert.ok(opportunity?.caveats.some((caveat) => /not biologically equivalent/i.test(caveat)));
  });

  test("replaces an unavailable machine movement only with available equipment", () => {
    const result = analyzeRoutineOptimization({
      ...base,
      objective: "equipment",
      routine: routine([
        { exerciseId: "lat-pulldown", targetSets: 3, notes: "" },
      ]),
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
});
