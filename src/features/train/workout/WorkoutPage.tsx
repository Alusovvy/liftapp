import { useMemo, useState } from "react";
import {
  EXERCISE_BY_ID,
  EXERCISE_CATALOG,
  isExerciseAvailable,
} from "../../../domain/exercises/catalog";
import type { LiftwiseData } from "../../../domain/models/schema";
import {
  activeWorkoutReadiness,
  addExerciseToDraft,
  addSetToDraft,
  removeExerciseFromDraft,
  removeSetFromDraft,
  updateDraftDetails,
  updateDraftSet,
  type ActiveWorkoutDraft,
} from "../../../domain/workout/active-workout";

type WorkoutPageProps = {
  data: LiftwiseData;
  draft: ActiveWorkoutDraft | null;
  draftProblem: string | null;
  onStart: (routineId?: string) => void;
  onDraftChange: (draft: ActiveWorkoutDraft) => void;
  onFinish: () => void;
  onDiscard: () => void;
};

function parseOptionalNumber(
  raw: string,
  options: { minimum: number; maximum: number; integer?: boolean },
): number | null {
  if (raw === "") return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error("Enter a valid number.");
  const value = options.integer ? Math.round(parsed) : parsed;
  if (value < options.minimum || value > options.maximum) {
    throw new Error(`Use a value from ${options.minimum} to ${options.maximum}.`);
  }
  return value;
}

function exerciseName(data: LiftwiseData, exerciseId: string): string {
  return (
    EXERCISE_BY_ID.get(exerciseId)?.name ??
    data.customExercises.find((exercise) => exercise.id === exerciseId)?.name ??
    exerciseId
  );
}

function referenceLabel(weightKg: number | null, reps: number | null): string {
  if (weightKg === null && reps === null) return "No previous set";
  if (weightKg === null) return `${reps ?? "—"} reps`;
  return `${weightKg} kg × ${reps ?? "—"}`;
}

export function WorkoutPage({
  data,
  draft,
  draftProblem,
  onStart,
  onDraftChange,
  onFinish,
  onDiscard,
}: WorkoutPageProps) {
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const latest = [...data.workouts].sort((left, right) =>
    (right.endTime ?? right.date).localeCompare(left.endTime ?? left.date),
  )[0];

  const availableExercises = useMemo(() => {
    const existing = new Set(draft?.entries.map((entry) => entry.exerciseId) ?? []);
    const catalog = EXERCISE_CATALOG.filter((exercise) =>
      isExerciseAvailable(exercise, data.profile.equipment),
    ).map((exercise) => ({ id: exercise.id, name: exercise.name }));
    const custom = data.customExercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
    }));
    return [...catalog, ...custom]
      .filter((exercise) => !existing.has(exercise.id))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [data.customExercises, data.profile.equipment, draft?.entries]);

  const applyChange = (change: () => ActiveWorkoutDraft) => {
    setError(null);
    try {
      onDraftChange(change());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The workout draft could not be updated.",
      );
    }
  };

  if (!draft) {
    return (
      <div className="workout-start">
        <div className="workout-start-copy">
          <p className="eyebrow">Workout workspace</p>
          <h2>Start with a clear plan</h2>
          <p>
            Previous loads are carried forward to reduce typing. Nothing becomes history until you
            finish the workout.
          </p>
          {draftProblem ? (
            <div className="import-error" role="alert">
              <strong>The previous draft was isolated</strong>
              <span>{draftProblem}</span>
              <span>Your completed workout history was not changed.</span>
            </div>
          ) : null}
          <div className="workout-start-actions">
            {data.routines.map((routine) => (
              <button
                className="routine-start-option"
                type="button"
                key={routine.id}
                aria-label={`Start ${routine.name}`}
                onClick={() => onStart(routine.id)}
              >
                <span>Start routine</span>
                <strong>{routine.name}</strong>
                <small>
                  {routine.entries.length} exercise{routine.entries.length === 1 ? "" : "s"}
                  {" · "}
                  {routine.entries.reduce((sum, entry) => sum + entry.targetSets, 0)} planned sets
                </small>
              </button>
            ))}
            <button
              className="routine-start-option routine-start-empty"
              type="button"
              aria-label="Start empty workout"
              onClick={() => onStart()}
            >
              <span>Flexible session</span>
              <strong>Start empty workout</strong>
              <small>Add only the exercises you need today.</small>
            </button>
          </div>
        </div>
        {latest ? (
          <aside className="workout-last-session">
            <span>Last completed</span>
            <strong>{latest.name}</strong>
            <small>
              {latest.date} · {latest.entries.length} exercises
            </small>
          </aside>
        ) : null}
      </div>
    );
  }

  const readiness = activeWorkoutReadiness(draft);
  const completionPercent = readiness.totalSets
    ? Math.round((readiness.completedSets / readiness.totalSets) * 100)
    : 0;

  return (
    <div className="active-workout">
      <header className="active-workout-header">
        <div>
          <p className="eyebrow">Active workout · autosaved locally</p>
          <label className="workout-name-field">
            <span>Workout name</span>
            <input
              value={draft.name}
              onChange={(event) =>
                applyChange(() => updateDraftDetails(draft, { name: event.target.value }))
              }
            />
          </label>
          <p>
            Mark a set done after performing it. Unchecked planning rows are not saved to history.
          </p>
        </div>
        <div
          className="workout-progress"
          aria-label={`${completionPercent}% of planned sets complete`}
        >
          <strong>
            {readiness.completedSets}/{readiness.totalSets}
          </strong>
          <span>sets complete</span>
          <div aria-hidden="true">
            <i style={{ width: `${completionPercent}%` }} />
          </div>
        </div>
      </header>

      {error ? (
        <div className="save-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="rir-explainer">
        <strong>RIR starts at 3 when no target is provided.</strong>
        <span>RIR means good reps still in reserve; adjust it after each set if needed.</span>
      </div>

      <div className="active-exercise-list">
        {draft.entries.map((entry) => {
          const name = exerciseName(data, entry.exerciseId);
          return (
            <article className="active-exercise" key={entry.id}>
              <header>
                <div>
                  <span>{EXERCISE_BY_ID.get(entry.exerciseId)?.pattern ?? "Custom exercise"}</span>
                  <h3>{name}</h3>
                </div>
                <button
                  className="text-button danger-text"
                  type="button"
                  onClick={() => applyChange(() => removeExerciseFromDraft(draft, entry.id))}
                >
                  Remove exercise
                </button>
              </header>

              <div className="set-table" role="group" aria-label={`${name} sets`}>
                <div className="set-table-heading" aria-hidden="true">
                  <span>Set</span>
                  <span>Previous</span>
                  <span>Weight (kg)</span>
                  <span>Reps</span>
                  <span>RIR</span>
                  <span>Done</span>
                  <span />
                </div>
                {entry.sets.map((set, index) => {
                  const setNumber = index + 1;
                  return (
                    <div
                      className={`active-set ${set.completed ? "is-complete" : ""}`}
                      key={set.id}
                    >
                      <strong className="set-number">{setNumber}</strong>
                      <span className="set-reference">
                        {referenceLabel(set.referenceWeightKg, set.referenceReps)}
                      </span>
                      <label>
                        <span>Weight (kg)</span>
                        <input
                          aria-label={`${name} set ${setNumber} weight in kg`}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max="2000"
                          step={data.profile.loadIncrementKg}
                          value={set.weightKg ?? ""}
                          onChange={(event) =>
                            applyChange(() =>
                              updateDraftSet(draft, entry.id, set.id, {
                                weightKg: parseOptionalNumber(event.target.value, {
                                  minimum: 0,
                                  maximum: 2000,
                                }),
                              }),
                            )
                          }
                        />
                      </label>
                      <label>
                        <span>Reps</span>
                        <input
                          aria-label={`${name} set ${setNumber} reps`}
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max="1000"
                          value={set.reps ?? ""}
                          onChange={(event) =>
                            applyChange(() =>
                              updateDraftSet(draft, entry.id, set.id, {
                                reps: parseOptionalNumber(event.target.value, {
                                  minimum: 1,
                                  maximum: 1000,
                                  integer: true,
                                }),
                              }),
                            )
                          }
                        />
                      </label>
                      <label>
                        <span>RIR</span>
                        <input
                          aria-label={`${name} set ${setNumber} RIR`}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max="10"
                          step="0.5"
                          value={set.rir ?? ""}
                          onChange={(event) =>
                            applyChange(() =>
                              updateDraftSet(draft, entry.id, set.id, {
                                rir: parseOptionalNumber(event.target.value, {
                                  minimum: 0,
                                  maximum: 10,
                                }),
                              }),
                            )
                          }
                        />
                      </label>
                      <label className="set-complete">
                        <span>Done</span>
                        <input
                          aria-label={`Mark ${name} set ${setNumber} complete`}
                          type="checkbox"
                          checked={set.completed}
                          onChange={(event) =>
                            applyChange(() =>
                              updateDraftSet(draft, entry.id, set.id, {
                                completed: event.target.checked,
                              }),
                            )
                          }
                        />
                      </label>
                      <button
                        className="set-remove"
                        type="button"
                        aria-label={`Remove ${name} set ${setNumber}`}
                        onClick={() =>
                          applyChange(() => removeSetFromDraft(draft, entry.id, set.id))
                        }
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                className="button button-secondary add-set-button"
                type="button"
                onClick={() => applyChange(() => addSetToDraft(draft, entry.id))}
              >
                Add set
              </button>
            </article>
          );
        })}
      </div>

      <section className="add-exercise-panel" aria-labelledby="add-exercise-title">
        <div>
          <p className="eyebrow">Adjust today, not the routine</p>
          <h3 id="add-exercise-title">Add an exercise</h3>
        </div>
        <label>
          <span>Exercise</span>
          <select
            value={selectedExerciseId}
            onChange={(event) => setSelectedExerciseId(event.target.value)}
          >
            <option value="">Choose an available exercise</option>
            {availableExercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button button-secondary"
          type="button"
          disabled={!selectedExerciseId}
          onClick={() => {
            applyChange(() => addExerciseToDraft(draft, data, selectedExerciseId));
            setSelectedExerciseId("");
          }}
        >
          Add exercise
        </button>
      </section>

      <label className="workout-notes">
        <span>Workout notes (optional)</span>
        <textarea
          rows={3}
          value={draft.notes}
          onChange={(event) =>
            applyChange(() => updateDraftDetails(draft, { notes: event.target.value }))
          }
          placeholder="Only note what will help you next time."
        />
      </label>

      <footer className="workout-finish">
        <div>
          {readiness.errors.length ? (
            <>
              <strong>Before finishing</strong>
              <span>{readiness.errors.join(" ")}</span>
            </>
          ) : (
            <>
              <strong>Ready to finish</strong>
              <span>
                Only {readiness.completedSets} completed set
                {readiness.completedSets === 1 ? "" : "s"} will be saved.
              </span>
            </>
          )}
        </div>
        <div className="workout-finish-actions">
          {confirmDiscard ? (
            <>
              <button className="button button-danger" type="button" onClick={onDiscard}>
                Confirm discard
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => setConfirmDiscard(false)}
              >
                Keep workout
              </button>
            </>
          ) : (
            <button
              className="text-button danger-text"
              type="button"
              onClick={() => setConfirmDiscard(true)}
            >
              Discard draft
            </button>
          )}
          <button
            className="button button-primary"
            type="button"
            disabled={readiness.errors.length > 0}
            onClick={onFinish}
          >
            Finish workout
          </button>
        </div>
      </footer>
    </div>
  );
}
