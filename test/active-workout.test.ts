import assert from "node:assert/strict";
import { describe, test } from "vitest";
import fixture from "./fixtures/current-data-v9.json";
import { LiftwiseDataSchema } from "../src/domain/models/schema";
import {
  DEFAULT_ACTIVE_RIR,
  activeWorkoutReadiness,
  addExerciseToDraft,
  addSetToDraft,
  completeActiveWorkout,
  createActiveWorkoutDraft,
  removeExerciseFromDraft,
  removeSetFromDraft,
  updateDraftDetails,
  updateDraftSet,
} from "../src/domain/workout/active-workout";

function ids() {
  let current = 0;
  return () => `id-${++current}`;
}

describe("active workout domain", () => {
  test("starts from a routine, carries previous load forward, and defaults missing RIR to three", () => {
    const data = LiftwiseDataSchema.parse({
      ...fixture,
      routines: [
        {
          ...fixture.routines[0],
          entries: [
            fixture.routines[0]!.entries[0],
            {
              exerciseId: "curl",
              targetSets: 2,
              targetRir: null,
              notes: "",
            },
          ],
        },
      ],
    });

    const draft = createActiveWorkoutDraft(data, {
      routineId: "routine-upper",
      now: "2026-08-03T10:00:00.000Z",
      createId: ids(),
    });

    assert.equal(draft.name, "Upper");
    assert.equal(draft.entries[0]?.sets.length, 3);
    assert.equal(draft.entries[0]?.sets[0]?.weightKg, 24);
    assert.equal(draft.entries[0]?.sets[0]?.reps, 10);
    assert.equal(draft.entries[0]?.sets[0]?.rir, 2);
    assert.equal(draft.entries[1]?.sets[0]?.rir, DEFAULT_ACTIVE_RIR);
    assert.equal(draft.entries[0]?.sets[0]?.completed, false);
  });

  test("edits the draft immutably and gives newly added sets a useful carry-forward", () => {
    const data = LiftwiseDataSchema.parse(fixture);
    const createId = ids();
    const initial = createActiveWorkoutDraft(data, {
      now: "2026-08-03T10:00:00.000Z",
      createId,
    });
    const withExercise = addExerciseToDraft(initial, data, "db-bench", {
      now: "2026-08-03T10:01:00.000Z",
      createId,
    });
    const entry = withExercise.entries[0]!;
    const edited = updateDraftSet(
      withExercise,
      entry.id,
      entry.sets[0]!.id,
      {
        weightKg: 26,
        reps: 8,
        rir: 1.5,
        completed: true,
      },
      "2026-08-03T10:02:00.000Z",
    );
    const withSet = addSetToDraft(edited, entry.id, {
      now: "2026-08-03T10:03:00.000Z",
      createId,
    });

    assert.equal(initial.entries.length, 0);
    assert.deepEqual(withSet.entries[0]?.sets[1], {
      id: "id-4",
      type: "normal",
      weightKg: 26,
      reps: 8,
      rir: 1.5,
      completed: false,
      referenceWeightKg: 24,
      referenceReps: 10,
    });
    assert.equal(activeWorkoutReadiness(withSet).completedSets, 1);

    const withoutSet = removeSetFromDraft(
      withSet,
      entry.id,
      withSet.entries[0]!.sets[1]!.id,
      "2026-08-03T10:04:00.000Z",
    );
    const withoutExercise = removeExerciseFromDraft(
      withoutSet,
      entry.id,
      "2026-08-03T10:05:00.000Z",
    );
    assert.equal(withoutSet.entries[0]?.sets.length, 1);
    assert.equal(withoutExercise.entries.length, 0);
  });

  test("saves only completed sets and applies RIR three when the field was left blank", () => {
    const data = LiftwiseDataSchema.parse(fixture);
    const createId = ids();
    let draft = createActiveWorkoutDraft(data, {
      now: "2026-08-03T10:00:00.000Z",
      createId,
    });
    draft = addExerciseToDraft(draft, data, "db-bench", {
      now: "2026-08-03T10:01:00.000Z",
      createId,
    });
    const entry = draft.entries[0]!;
    draft = updateDraftSet(
      draft,
      entry.id,
      entry.sets[0]!.id,
      {
        weightKg: 25,
        reps: 9,
        rir: null,
        completed: true,
      },
      "2026-08-03T10:02:00.000Z",
    );
    draft = addSetToDraft(draft, entry.id, {
      now: "2026-08-03T10:03:00.000Z",
      createId,
    });
    draft = updateDraftDetails(
      draft,
      {
        name: "  Focused upper  ",
        notes: "  Felt good  ",
      },
      "2026-08-03T10:04:00.000Z",
    );

    const completed = completeActiveWorkout(data, draft, "2026-08-03T10:50:00.000Z");

    assert.equal(completed.workout.name, "Focused upper");
    assert.equal(completed.workout.notes, "Felt good");
    assert.equal(completed.workout.duration, 50);
    assert.equal(completed.workout.entries[0]?.sets.length, 1);
    assert.equal(completed.workout.entries[0]?.sets[0]?.rir, 3);
    assert.equal(completed.workout.entries[0]?.sets[0]?.effortSource, "manual");
    assert.equal(completed.data.workouts.at(-1)?.id, `manual:${draft.id}`);

    const repeated = completeActiveWorkout(completed.data, draft, "2026-08-03T10:51:00.000Z");
    assert.equal(
      repeated.data.workouts.filter((workout) => workout.id === completed.workout.id).length,
      1,
    );
  });

  test("blocks empty names, missing completed sets, and completed rows without reps", () => {
    const data = LiftwiseDataSchema.parse(fixture);
    const createId = ids();
    let draft = createActiveWorkoutDraft(data, {
      now: "2026-08-03T10:00:00.000Z",
      createId,
    });
    draft = updateDraftDetails(draft, { name: " " });
    assert.deepEqual(activeWorkoutReadiness(draft).errors, [
      "Give the workout a name.",
      "Complete at least one set.",
    ]);

    draft = addExerciseToDraft(draft, data, "curl", { createId });
    const entry = draft.entries[0]!;
    draft = updateDraftSet(draft, entry.id, entry.sets[0]!.id, {
      reps: null,
      completed: true,
    });
    assert.match(activeWorkoutReadiness(draft).errors.join(" "), /needs at least one rep/i);
    assert.throws(() => completeActiveWorkout(data, draft), /Give the workout a name/);
    assert.throws(
      () => createActiveWorkoutDraft(data, { routineId: "missing" }),
      /no longer exists/i,
    );
    assert.throws(() => addExerciseToDraft(draft, data, "unknown"), /no longer available/i);
  });

  test("handles stale controls, empty exercise rows, and uncatalogued exercises retained in history", () => {
    const data = LiftwiseDataSchema.parse({
      ...fixture,
      workouts: [
        ...fixture.workouts,
        {
          id: "historic-custom",
          source: "manual",
          date: "2026-08-02",
          name: "Historic custom work",
          duration: null,
          notes: "",
          startTime: null,
          endTime: null,
          entries: [
            {
              exerciseId: "historic-custom-exercise",
              sets: [
                {
                  type: "normal",
                  weightKg: null,
                  reps: null,
                  rir: 3,
                },
              ],
            },
          ],
        },
      ],
    });
    let draft = createActiveWorkoutDraft(data, {
      routineId: "routine-upper",
      now: "2026-08-03T10:00:00.000Z",
      createId: ids(),
    });

    assert.throws(() => addExerciseToDraft(draft, data, ""), /Choose an exercise/i);
    assert.throws(
      () => addExerciseToDraft(draft, data, "db-bench"),
      /already in the active workout/i,
    );
    assert.throws(() => addSetToDraft(draft, "stale-entry"), /no longer in this workout/i);
    assert.throws(
      () => updateDraftSet(draft, draft.entries[0]!.id, "stale-set", { reps: 8 }),
      /set is no longer/i,
    );
    assert.throws(
      () => removeSetFromDraft(draft, draft.entries[0]!.id, "stale-set"),
      /set is no longer/i,
    );
    assert.throws(() => removeExerciseFromDraft(draft, "stale-entry"), /exercise is no longer/i);

    const first = draft.entries[0]!;
    draft = {
      ...draft,
      entries: [{ ...first, sets: [] }, ...draft.entries.slice(1)],
    };
    const restoredSet = addSetToDraft(draft, first.id);
    assert.deepEqual(restoredSet.entries[0]?.sets[0], {
      id: restoredSet.entries[0]?.sets[0]?.id,
      type: "normal",
      weightKg: null,
      reps: null,
      rir: 3,
      completed: false,
      referenceWeightKg: null,
      referenceReps: null,
    });
    const removedAgain = removeSetFromDraft(
      restoredSet,
      first.id,
      restoredSet.entries[0]!.sets[0]!.id,
    );
    assert.equal(removedAgain.entries[1]?.exerciseId, "one-arm-db-row");

    const custom = addExerciseToDraft(
      createActiveWorkoutDraft(data),
      data,
      "historic-custom-exercise",
    );
    assert.equal(custom.entries[0]?.exerciseId, "historic-custom-exercise");
    assert.equal(custom.entries[0]?.sets[0]?.weightKg, null);
    assert.equal(custom.entries[0]?.sets[0]?.reps, null);
  });
});
