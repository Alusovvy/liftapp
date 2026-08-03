import { useState, type ChangeEvent } from "react";
import { LiftwiseDataSchema, MUSCLES, type LiftwiseData } from "../../domain/models/schema";

type SettingsPageProps = {
  data: LiftwiseData;
  onExport: () => void;
  onRestore: (data: LiftwiseData) => void;
};

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error ?? new Error("The backup could not be read.")));
    reader.readAsText(file);
  });
}

export function SettingsPage({ data, onExport, onRestore }: SettingsPageProps) {
  const [pendingRestore, setPendingRestore] = useState<LiftwiseData | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const enabledEquipment = Object.entries(data.profile.equipment)
    .filter(([, enabled]) => enabled)
    .map(([id]) => id);

  const selectBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setRestoreError(null);
    setPendingRestore(null);
    setRestoreConfirmed(false);
    setStatus("Reading and validating the backup locally…");
    try {
      if (file.size > 10_000_000) throw new Error("The backup exceeds the 10 MB safety limit.");
      const parsed: unknown = JSON.parse(await readFile(file));
      const validated = LiftwiseDataSchema.parse(parsed);
      setPendingRestore(validated);
      setStatus("Backup validated. Review the replacement summary before confirming.");
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : "The backup is invalid.");
      setStatus(null);
    }
  };

  const confirmRestore = () => {
    if (!pendingRestore || !restoreConfirmed) return;
    try {
      onRestore(pendingRestore);
      setPendingRestore(null);
      setRestoreConfirmed(false);
      setStatus("Backup restored. The validated replacement is now the local source of truth.");
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : "The backup could not be restored.");
    }
  };

  return (
    <div className="page">
      <header className="page-header settings-heading">
        <div>
          <p className="eyebrow">Settings & data</p>
          <h1>Control the inputs and keep the data</h1>
          <p className="page-intro">
            Targets and equipment constrain recommendations. Your full dataset remains local unless you export it.
          </p>
        </div>
        <button className="button button-primary" type="button" onClick={onExport}>
          Export backup
        </button>
      </header>

      <section className="data-safety" aria-labelledby="data-safety-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Backup comes first</p>
            <h2 id="data-safety-title">Data safety</h2>
          </div>
          <span>Schema v{data.schemaVersion} · stored in this browser</span>
        </div>
        <div className="data-safety-grid">
          <article>
            <span className="settings-step">1</span>
            <h3>Export before a risky change</h3>
            <p>
              Download workouts, routines, body measurements, nutrition, preferences, and source history as validated JSON.
            </p>
            <button className="button button-primary" type="button" onClick={onExport}>
              Download JSON backup
            </button>
          </article>
          <article>
            <span className="settings-step">2</span>
            <h3>Restore with a preview</h3>
            <p>Selecting a file cannot overwrite data. Replacement requires a validated preview and confirmation.</p>
            <label className="settings-file-picker">
              <span>Choose Liftwise backup</span>
              <input type="file" accept=".json,application/json" onChange={selectBackup} />
            </label>
          </article>
        </div>

        {restoreError ? (
          <div className="import-error" role="alert">
            <strong>Restore stopped safely</strong>
            <span>{restoreError}</span>
            <span>Current local data was not changed.</span>
          </div>
        ) : null}
        {status ? <div className="import-status" role="status">{status}</div> : null}
        {pendingRestore ? (
          <div className="restore-preview">
            <div>
              <p className="eyebrow">Replacement preview</p>
              <h3>{pendingRestore.profile.name} · schema v{pendingRestore.schemaVersion}</h3>
              <p>
                This replaces the complete local dataset. It does not merge records.
              </p>
            </div>
            <div className="restore-comparison">
              <div><span>Workouts</span><strong>{data.workouts.length} → {pendingRestore.workouts.length}</strong></div>
              <div><span>Routines</span><strong>{data.routines.length} → {pendingRestore.routines.length}</strong></div>
              <div><span>Nutrition days</span><strong>{data.nutritionDays.length} → {pendingRestore.nutritionDays.length}</strong></div>
              <div><span>Body records</span><strong>{data.bodyMetrics.length} → {pendingRestore.bodyMetrics.length}</strong></div>
            </div>
            <label className="restore-confirm-check">
              <input
                type="checkbox"
                checked={restoreConfirmed}
                onChange={(event) => setRestoreConfirmed(event.target.checked)}
              />
              I reviewed the counts and want to replace all current local data.
            </label>
            <div className="restore-actions">
              <button className="button button-danger" type="button" disabled={!restoreConfirmed} onClick={confirmRestore}>
                Replace with this backup
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setPendingRestore(null);
                  setRestoreConfirmed(false);
                  setStatus("Restore cancelled. Current data remains unchanged.");
                }}
              >
                Cancel restore
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="settings-grid">
        <article>
          <p className="card-kicker">Profile and units</p>
          <h2>{data.profile.name}</h2>
          <dl>
            <div><dt>Training days</dt><dd>{data.profile.days} per week</dd></div>
            <div><dt>Experience</dt><dd>{data.profile.experience}</dd></div>
            <div><dt>Units</dt><dd>{data.profile.units}</dd></div>
            <div><dt>Smallest load jump</dt><dd>{data.profile.loadIncrementKg} kg</dd></div>
          </dl>
          <a className="text-button" href="./index.html">Edit profile in current tools</a>
        </article>
        <article>
          <p className="card-kicker">Training plan and targets</p>
          <h2>{data.routines.length} routine{data.routines.length === 1 ? "" : "s"}</h2>
          <div className="target-summary">
            {MUSCLES.map((muscle) => (
              <span key={muscle}>{muscle} {data.targets[muscle][0]}–{data.targets[muscle][1]}</span>
            ))}
          </div>
          <a className="text-button" href="./index.html">Edit target ranges</a>
        </article>
        <article>
          <p className="card-kicker">Equipment and preferences</p>
          <h2>{enabledEquipment.length ? `${enabledEquipment.length} enabled` : "Bodyweight only"}</h2>
          <p>{enabledEquipment.length ? enabledEquipment.join(" · ") : "No equipment marked available"}</p>
          <p>Machines {data.profile.showMachineExercises ? "included" : "hidden"} in compatible choices.</p>
          <a className="text-button" href="./index.html">Edit equipment</a>
        </article>
        <article>
          <p className="card-kicker">Integrations and imports</p>
          <h2>Fitatu: {data.integrations.fitatu.status}</h2>
          <dl>
            <div><dt>Last file</dt><dd>{data.integrations.fitatu.lastFileName ?? "None"}</dd></div>
            <div><dt>Nutrition days</dt><dd>{data.nutritionDays.length}</dd></div>
            <div><dt>Import batches</dt><dd>{data.importBatches.length}</dd></div>
          </dl>
        </article>
        <article>
          <p className="card-kicker">Display and accessibility</p>
          <h2>{data.libraryPreferences.density} library</h2>
          <p>Primary navigation reflows to a five-item bottom bar. Controls remain keyboard operable.</p>
          <p>Reduced-motion and forced-colors preferences are respected by the interface.</p>
        </article>
        <article>
          <p className="card-kicker">About coaching rules</p>
          <h2>Transparent and deterministic</h2>
          <p>
            Safety → recovery → schedule → missing data → plan gaps → performance review → above-plan review.
          </p>
          <p>No readiness score or hidden engagement ranking is used.</p>
        </article>
      </section>
    </div>
  );
}
