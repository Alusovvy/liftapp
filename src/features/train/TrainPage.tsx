import { useState } from "react";
import type { LiftwiseData } from "../../domain/models/schema";
import { EXERCISE_BY_ID } from "../../domain/exercises/catalog";
import { ImportPage } from "./import/ImportPage";
import { OptimizePlanPage } from "./optimize/OptimizePlanPage";

type TrainPageProps = {
  data: LiftwiseData;
  importUndoAvailable: boolean;
  onDataChange: (data: LiftwiseData) => void;
  onImportCommit: (
    data: LiftwiseData,
    previousData: LiftwiseData,
    batchId: string,
  ) => void;
  onUndoImport: () => void;
};

type TrainTab = "workout" | "routines" | "optimize" | "history" | "import";

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
}: TrainPageProps) {
  const [tab, setTab] = useState<TrainTab>("workout");
  const latest = [...data.workouts].sort((a, b) => b.date.localeCompare(a.date))[0];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Train</p>
          <h1>Plan, perform, review</h1>
          <p className="page-intro">Workout tools stay together, with optimization as an optional audit.</p>
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
          <div className="train-start">
            <div>
              <p className="eyebrow">Workout workspace</p>
              <h2>Start with the current proven logger</h2>
              <p>
                The focused React set editor is the next migration surface. Until its draft,
                autosave, import provenance, and recovery tests pass, the existing logger remains in charge.
              </p>
              <a className="button button-primary" href="./index.html">Open workout logger</a>
            </div>
            {latest ? (
              <aside>
                <span>Last completed</span>
                <strong>{latest.name}</strong>
                <small>{latest.date} · {latest.entries.length} exercises</small>
              </aside>
            ) : null}
          </div>
        ) : null}

        {tab === "routines" ? (
          <div className="routine-grid">
            {data.routines.length ? data.routines.map((routine) => (
              <article className="routine-card-modern" key={routine.id}>
                <p className="card-kicker">
                  {routine.weekdays.length ? `${routine.weekdays.length} scheduled day${routine.weekdays.length === 1 ? "" : "s"}` : "Not scheduled"}
                </p>
                <h2>{routine.name}</h2>
                <ol>
                  {routine.entries.map((entry) => (
                    <li key={entry.exerciseId}>
                      <span>{EXERCISE_BY_ID.get(entry.exerciseId)?.name ?? entry.exerciseId}</span>
                      <strong>{entry.targetSets} sets</strong>
                    </li>
                  ))}
                </ol>
                <a className="button button-secondary" href="./index.html">Edit in current logger</a>
              </article>
            )) : (
              <div className="positive-empty">
                <strong>No routines yet.</strong>
                <a className="button button-primary" href="./index.html">Create a routine</a>
              </div>
            )}
          </div>
        ) : null}

        {tab === "optimize" ? (
          <OptimizePlanPage data={data} onDataChange={onDataChange} />
        ) : null}

        {tab === "history" ? (
          <div className="history-list-modern">
            {[...data.workouts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30).map((workout) => (
              <article key={workout.id}>
                <time dateTime={workout.date}>{workout.date}</time>
                <div>
                  <strong>{workout.name}</strong>
                  <span>{workout.entries.length} exercises · {workout.duration ? `${workout.duration} min` : "duration not logged"}</span>
                </div>
                <span className="source-badge">{workout.source === "manual" || !workout.source ? "Manual" : "Imported"}</span>
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
