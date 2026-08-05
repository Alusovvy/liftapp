import { useState } from "react";
import type { LiftwiseData } from "../../domain/models/schema";
import { EXERCISE_BY_ID } from "../../domain/exercises/catalog";
import type { ActiveWorkoutDraft } from "../../domain/workout/active-workout";
import { ImportPage } from "./import/ImportPage";
import { OptimizePlanPage } from "./optimize/OptimizePlanPage";
import { WorkoutPage } from "./workout/WorkoutPage";

export type TrainTab = "workout" | "routines" | "optimize" | "history" | "import";

type TrainPageProps = {
  data: LiftwiseData;
  importUndoAvailable: boolean;
  onDataChange: (data: LiftwiseData) => void;
  onImportCommit: (
    data: LiftwiseData,
    previousData: LiftwiseData,
    batchId: string,
  ) => Promise<void>;
  onUndoImport: () => Promise<void>;
  workoutDraft: ActiveWorkoutDraft | null;
  workoutDraftProblem: string | null;
  onStartWorkout: (routineId?: string) => void;
  onWorkoutDraftChange: (draft: ActiveWorkoutDraft) => void;
  onFinishWorkout: () => Promise<void>;
  onDiscardWorkout: () => void;
  initialTab?: TrainTab | undefined;
};

const tabs: Array<{ id: TrainTab; label: string }> = [
  { id: "workout", label: "Workout" },
  { id: "routines", label: "Routines" },
  { id: "optimize", label: "Optimize plan" },
  { id: "history", label: "History" },
  { id: "import", label: "Import" },
];

export function TrainPage({
  data,
  importUndoAvailable,
  onDataChange,
  onImportCommit,
  onUndoImport,
  workoutDraft,
  workoutDraftProblem,
  onStartWorkout,
  onWorkoutDraftChange,
  onFinishWorkout,
  onDiscardWorkout,
  initialTab,
}: TrainPageProps) {
  const [tab, setTab] = useState<TrainTab>(initialTab ?? "workout");
  const [workoutNotice, setWorkoutNotice] = useState<string | null>(null);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Train</p>
          <h1>Plan, perform, review</h1>
          <p className="page-intro">
            Workout tools stay together, with optimization as an optional audit.
          </p>
        </div>
      </header>
      <div className="subnav" role="tablist" aria-label="Train sections">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section role="tabpanel" className="train-panel">
        {tab === "workout" ? (
          <>
            {workoutNotice ? (
              <div className="optimization-notice" role="status">
                <span>{workoutNotice}</span>
                <button className="text-button" type="button" onClick={() => setTab("history")}>
                  View history
                </button>
              </div>
            ) : null}
            <WorkoutPage
              data={data}
              draft={workoutDraft}
              draftProblem={workoutDraftProblem}
              onStart={(routineId) => {
                setWorkoutNotice(null);
                onStartWorkout(routineId);
              }}
              onDraftChange={onWorkoutDraftChange}
              onFinish={async () => {
                try {
                  await onFinishWorkout();
                  setWorkoutNotice(
                    "Workout saved. Your completed sets are now in history and progress.",
                  );
                } catch {
                  // The save-error banner already reports the failure; the
                  // draft stays intact so nothing is lost.
                }
              }}
              onDiscard={() => {
                onDiscardWorkout();
                setWorkoutNotice("Workout draft discarded. Completed history was not changed.");
              }}
            />
          </>
        ) : null}

        {tab === "routines" ? (
          <div className="routine-grid">
            {data.routines.length ? (
              data.routines.map((routine) => (
                <article className="routine-card-modern" key={routine.id}>
                  <p className="card-kicker">
                    {routine.weekdays.length
                      ? `${routine.weekdays.length} scheduled day${routine.weekdays.length === 1 ? "" : "s"}`
                      : "Not scheduled"}
                  </p>
                  <h2>{routine.name}</h2>
                  <ol>
                    {routine.entries.map((entry) => (
                      <li key={entry.exerciseId}>
                        <span>
                          {EXERCISE_BY_ID.get(entry.exerciseId)?.name ?? entry.exerciseId}
                        </span>
                        <strong>{entry.targetSets} sets</strong>
                      </li>
                    ))}
                  </ol>
                  <a className="button button-secondary" href="./index.html">
                    Edit in current logger
                  </a>
                </article>
              ))
            ) : (
              <div className="positive-empty">
                <strong>No routines yet.</strong>
                <a className="button button-primary" href="./index.html">
                  Create a routine
                </a>
              </div>
            )}
          </div>
        ) : null}

        {tab === "optimize" ? <OptimizePlanPage data={data} onDataChange={onDataChange} /> : null}

        {tab === "history" ? (
          <div className="history-list-modern">
            {[...data.workouts]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 30)
              .map((workout) => (
                <article key={workout.id}>
                  <time dateTime={workout.date}>{workout.date}</time>
                  <div>
                    <strong>{workout.name}</strong>
                    <span>
                      {workout.entries.length} exercises ·{" "}
                      {workout.duration ? `${workout.duration} min` : "duration not logged"}
                    </span>
                  </div>
                  <span className="source-badge">
                    {workout.source === "manual" || !workout.source ? "Manual" : "Imported"}
                  </span>
                </article>
              ))}
          </div>
        ) : null}

        {tab === "import" ? (
          <ImportPage
            data={data}
            undoAvailable={importUndoAvailable}
            onCommit={onImportCommit}
            onUndo={onUndoImport}
          />
        ) : null}
      </section>
    </div>
  );
}
