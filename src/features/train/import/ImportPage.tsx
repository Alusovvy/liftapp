import { useMemo, useState, type ChangeEvent } from "react";
import {
  buildFitatuImportPlan,
  commitFitatuImport,
  parseFitatuCsv,
  type FitatuImportMode,
  type PendingFitatuImport,
} from "../../../domain/import/fitatu-import";
import {
  buildWorkoutImportPlan,
  commitWorkoutImport,
  parseWorkoutCsv,
  type PendingWorkoutImport,
} from "../../../domain/import/workout-import";
import type { LiftwiseData } from "../../../domain/models/schema";

type ImportKind = "workouts" | "nutrition";
type PendingImport = PendingFitatuImport | PendingWorkoutImport;

type ImportPageProps = {
  data: LiftwiseData;
  undoAvailable: boolean;
  onCommit: (
    data: LiftwiseData,
    previousData: LiftwiseData,
    batchId: string,
  ) => void;
  onUndo: () => void;
};

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error ?? new Error("The file could not be read.")));
    reader.readAsText(file);
  });
}

function importedRecordLabel(value: object): string {
  const candidate = value as {
    name?: unknown;
    caloriesKcal?: unknown;
    proteinG?: unknown;
  };
  if (typeof candidate.name === "string") return candidate.name;
  const calories = typeof candidate.caloriesKcal === "number" ? candidate.caloriesKcal : "—";
  const protein = typeof candidate.proteinG === "number" ? candidate.proteinG : "—";
  return `${calories} kcal · ${protein} g protein`;
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function ImportPage({
  data,
  undoAvailable,
  onCommit,
  onUndo,
}: ImportPageProps) {
  const [kind, setKind] = useState<ImportKind | null>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [mode, setMode] = useState<FitatuImportMode>("merge");
  const [acceptValidRowsOnly, setAcceptValidRowsOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  const plan = useMemo(() => {
    if (!pending) return null;
    return pending.kind === "nutrition"
      ? buildFitatuImportPlan(data, pending, mode)
      : buildWorkoutImportPlan(data, pending, mode);
  }, [data, mode, pending]);

  const chooseKind = (next: ImportKind) => {
    setKind(next);
    setPending(null);
    setMode("merge");
    setAcceptValidRowsOnly(false);
    setError(null);
    setStatus(null);
    setInputKey((current) => current + 1);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !kind) return;
    setBusy(true);
    setError(null);
    setStatus("Reading and validating the selected file…");
    try {
      if (file.size > 10_000_000) throw new Error("The CSV exceeds the 10 MB safety limit.");
      const text = await readFile(file);
      const parsed = kind === "nutrition"
        ? parseFitatuCsv(text, file.name)
        : parseWorkoutCsv(text, file.name);
      setPending(parsed);
      setAcceptValidRowsOnly(false);
      setStatus(
        parsed.rejectedRows.length
          ? "Preview ready. Review rejected rows before importing valid data."
          : "Preview ready. Nothing has been written yet.",
      );
    } catch (caught) {
      setPending(null);
      setError(caught instanceof Error ? caught.message : "The file could not be imported.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = () => {
    if (!pending) return;
    setError(null);
    try {
      const committed = pending.kind === "nutrition"
        ? commitFitatuImport({
          data,
          pending,
          mode,
          acceptValidRowsOnly,
        })
        : commitWorkoutImport({
          data,
          pending,
          mode,
          acceptValidRowsOnly,
        });
      onCommit(committed.data, committed.previousData, committed.batchId);
      const added = pending.kind === "nutrition"
        ? countLabel(committed.counts.added, "nutrition day", "nutrition days")
        : countLabel(committed.counts.added, "workout", "workouts");
      setStatus(
        `${added} added · ${committed.counts.updated} updated · ${committed.counts.unchanged} unchanged. Undo is available.`,
      );
      setPending(null);
      setInputKey((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The import could not be saved.");
    }
  };

  const undoImport = () => {
    setError(null);
    try {
      onUndo();
      setStatus("Import undone. The exact pre-import data was restored.");
      setPending(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The import could not be undone.");
    }
  };

  return (
    <div className="import-workspace">
      <header className="import-heading">
        <div>
          <p className="eyebrow">{kind ? pending ? "Step 3 of 4" : "Step 2 of 4" : "Step 1 of 4"}</p>
          <h2>{kind ? "Choose a CSV file" : "What are you importing?"}</h2>
          <p>
            {kind
              ? "The file is parsed locally. You will review all changes before saving."
              : "Choose the data type before opening a file picker."}
          </p>
        </div>
        {kind ? (
          <button className="text-button" type="button" onClick={() => chooseKind(kind === "nutrition" ? "workouts" : "nutrition")}>
            Switch to {kind === "nutrition" ? "workout" : "meal"} import
          </button>
        ) : null}
      </header>

      {!kind ? (
        <div className="import-kind-grid">
          <button type="button" className="import-option" onClick={() => chooseKind("workouts")}>
            <strong>Workout import</strong>
            <span>Hevy-style sessions, sets, RPE/RIR, and source provenance</span>
          </button>
          <button type="button" className="import-option" onClick={() => chooseKind("nutrition")}>
            <strong>Meal / Fitatu import</strong>
            <span>Daily calories, protein, carbohydrates, fat, and fiber</span>
          </button>
        </div>
      ) : (
        <label className="file-picker">
          <strong>{kind === "nutrition" ? "Fitatu meal-plan CSV" : "Workout CSV"}</strong>
          <span>Maximum 10 MB. Selecting a file cannot change saved data.</span>
          <input
            key={inputKey}
            aria-label={kind === "nutrition" ? "Fitatu meal-plan CSV" : "Workout CSV"}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            disabled={busy}
          />
        </label>
      )}

      {error ? (
        <div className="import-error" role="alert">
          <strong>Import stopped safely</strong>
          <span>{error}</span>
          <span>Your existing data was not changed. Choose a corrected file to try again.</span>
        </div>
      ) : null}

      {status ? (
        <div className="import-status" role="status">
          <span>{status}</span>
          {undoAvailable && !pending ? (
            <button className="text-button" type="button" onClick={undoImport}>
              Undo last import
            </button>
          ) : null}
        </div>
      ) : null}

      {!status && undoAvailable && !pending ? (
        <div className="import-status">
          <span>A pre-import snapshot is available.</span>
          <button className="text-button" type="button" onClick={undoImport}>
            Undo last import
          </button>
        </div>
      ) : null}

      {pending && plan ? (
        <section className="import-preview" aria-labelledby="import-preview-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Nothing saved yet</p>
              <h3 id="import-preview-title">Review {pending.fileName}</h3>
            </div>
            <span>{pending.dateRange}</span>
          </div>

          <dl className="import-summary-modern">
            <div>
              <dt>{pending.kind === "nutrition" ? "Nutrition days" : "Workouts"}</dt>
              <dd>{pending.kind === "nutrition" ? pending.days.length : pending.workouts.length}</dd>
            </div>
            <div><dt>Accepted rows</dt><dd>{pending.acceptedRowCount}</dd></div>
            <div><dt>Rejected rows</dt><dd>{pending.rejectedRows.length}</dd></div>
            <div><dt>Changes</dt><dd>{plan.counts.added + plan.counts.updated}</dd></div>
          </dl>

          {pending.warnings.length ? (
            <ul className="import-warnings" aria-label="Import warnings">
              {pending.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          ) : null}

          <fieldset className="import-mode">
            <legend>How should this file be applied?</legend>
            <label>
              <input
                type="radio"
                name="modern-import-mode"
                checked={mode === "merge"}
                onChange={() => setMode("merge")}
              />
              <span><strong>Merge</strong> Add new records and update matching source records.</span>
            </label>
            <label>
              <input
                type="radio"
                name="modern-import-mode"
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
              />
              <span>
                <strong>Replace imported collection</strong>
                {pending.kind === "nutrition"
                  ? " Replace nutrition days only; workouts and body data stay."
                  : " Replace workouts only; profile, nutrition, and body data stay."}
              </span>
            </label>
          </fieldset>

          <div className="import-diff-modern" aria-label="Import changes">
            {(["added", "updated", "unchanged", "conflicted"] as const).map((key) => (
              key in plan.counts ? (
                <div key={key}>
                  <strong>{plan.counts[key as keyof typeof plan.counts]}</strong>
                  <span>{key}</span>
                </div>
              ) : null
            ))}
          </div>

          <ul className="import-record-preview">
            {plan.changes.slice(0, 20).map((change) => (
              <li key={`${change.incoming.date}:${change.incoming.id}`}>
                <time dateTime={change.incoming.date}>{change.incoming.date}</time>
                <strong>{importedRecordLabel(change.incoming)}</strong>
                <span>{change.status}</span>
              </li>
            ))}
          </ul>

          {pending.rejectedRows.length ? (
            <div className="partial-import-review">
              <details>
                <summary>Review {pending.rejectedRows.length} rejected row{pending.rejectedRows.length === 1 ? "" : "s"}</summary>
                <ul>
                  {pending.rejectedRows.slice(0, 20).map((row) => (
                    <li key={row.rowNumber}>
                      Row {row.rowNumber}: {row.reasons.join("; ")}
                    </li>
                  ))}
                </ul>
              </details>
              <label>
                <input
                  type="checkbox"
                  checked={acceptValidRowsOnly}
                  onChange={(event) => setAcceptValidRowsOnly(event.target.checked)}
                />
                I reviewed the rejected rows and want to import only valid data.
              </label>
            </div>
          ) : null}

          <div className="import-confirmation">
            <div>
              <p className="eyebrow">Step 4 of 4</p>
              <strong>Save these reviewed changes?</strong>
              <span>An exact pre-import snapshot will be kept for undo.</span>
            </div>
            <button
              className="button button-primary"
              type="button"
              onClick={confirmImport}
              disabled={pending.rejectedRows.length > 0 && !acceptValidRowsOnly}
            >
              Confirm import
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
