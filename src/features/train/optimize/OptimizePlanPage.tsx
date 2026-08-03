import { useMemo, useState } from "react";
import { analyzeRoutineOptimization } from "../../../domain/optimization/analyze-plan";
import type {
  OptimizationObjective,
  OptimizationOpportunity,
} from "../../../domain/optimization/types";
import type { LiftwiseData } from "../../../domain/models/schema";

type OptimizePlanPageProps = {
  data: LiftwiseData;
};

const objectives: Array<{
  id: OptimizationObjective;
  label: string;
  description: string;
}> = [
  { id: "save_time", label: "Save time", description: "Fewer exercises or setup changes" },
  { id: "simplify", label: "Simplify", description: "Reduce genuinely redundant variations" },
  { id: "add_variety", label: "Add variety", description: "One controlled alternative at a time" },
  { id: "equipment", label: "Equipment", description: "Fit the equipment you actually have" },
  { id: "prioritize", label: "Prioritize", description: "Protect a muscle or strength skill" },
  { id: "comfort", label: "Comfort", description: "Explore a user-chosen alternative" },
];

function opportunityTone(opportunity: OptimizationOpportunity): string {
  return opportunity.kind === "time_saving_tradeoff" ? "tradeoff" : "preserved";
}

export function OptimizePlanPage({ data }: OptimizePlanPageProps) {
  const [objective, setObjective] = useState<OptimizationObjective>("simplify");
  const [routineId, setRoutineId] = useState(data.routines[0]?.id ?? "");
  const [protectedIds, setProtectedIds] = useState<string[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const routine = data.routines.find((item) => item.id === routineId) ?? data.routines[0];

  const appearances = useMemo(() => {
    const counts: Record<string, number> = {};
    data.workouts.forEach((workout) => {
      new Set(workout.entries.map((entry) => entry.exerciseId)).forEach((id) => {
        counts[id] = (counts[id] ?? 0) + 1;
      });
    });
    return counts;
  }, [data.workouts]);

  const analysis = useMemo(() => (
    routine ? analyzeRoutineOptimization({
      routine,
      objective,
      equipment: data.profile.equipment,
      protectedExerciseIds: protectedIds,
      completedAppearances: appearances,
    }) : null
  ), [appearances, data.profile.equipment, objective, protectedIds, routine]);
  const preview = analysis?.opportunities.find((item) => item.id === previewId) ?? null;

  if (!routine) {
    return (
      <div className="positive-empty">
        <strong>Create a routine before optimizing it.</strong>
        <p>The optimizer audits an intended plan; it does not invent one from isolated history.</p>
        <a className="button button-primary" href="./index.html">Create a routine</a>
      </div>
    );
  }

  return (
    <div className="optimizer">
      <header className="optimizer-header">
        <div>
          <p className="eyebrow">Plan audit</p>
          <h2>Find avoidable complexity</h2>
          <p>
            Similar planned coverage is not the same as an identical biological effect.
            Every option shows what is preserved and what changes.
          </p>
        </div>
        <label className="select-field">
          Routine
          <select value={routine.id} onChange={(event) => {
            setRoutineId(event.target.value);
            setPreviewId(null);
          }}>
            {data.routines.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
      </header>

      <fieldset className="objective-selector">
        <legend>What do you want to improve?</legend>
        <div>
          {objectives.map((item) => (
            <label key={item.id} className={objective === item.id ? "selected" : ""}>
              <input
                type="radio"
                name="optimization-objective"
                value={item.id}
                checked={objective === item.id}
                onChange={() => {
                  setObjective(item.id);
                  setPreviewId(null);
                }}
              />
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="analysis-source">
        Based on <strong>{routine.name}</strong>, {data.workouts.length} saved workout
        {data.workouts.length === 1 ? "" : "s"}, and your current equipment.
      </div>

      {analysis?.opportunities.length ? (
        <div className="opportunity-list" aria-label="Optimization opportunities">
          {analysis.opportunities.map((opportunity) => (
            <article
              className={`opportunity-card opportunity-${opportunityTone(opportunity)}`}
              key={opportunity.id}
            >
              <p className="card-kicker">{opportunity.label}</p>
              <h3>{opportunity.title}</h3>
              <p>{opportunity.summary}</p>
              <div className="opportunity-comparison">
                <div>
                  <span>Current</span>
                  {opportunity.sourceEntries.map((entry) => (
                    <strong key={entry.exerciseId}>{entry.exerciseName} · {entry.targetSets} sets</strong>
                  ))}
                </div>
                <span aria-hidden="true">→</span>
                <div>
                  <span>Option</span>
                  {opportunity.proposedEntries.map((entry) => (
                    <strong key={entry.exerciseId}>{entry.exerciseName} · {entry.targetSets} sets</strong>
                  ))}
                </div>
              </div>
              <div className="preserved-changed">
                <div>
                  <strong>Preserved</strong>
                  <ul>{opportunity.preserved.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div>
                  <strong>Changed</strong>
                  <ul>{opportunity.changed.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              </div>
              <div className="opportunity-actions">
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => setPreviewId(opportunity.id)}
                >
                  Preview routine
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => {
                    const removable = opportunity.sourceEntries
                      .find((entry) => !opportunity.proposedEntries.some(
                        (proposed) => proposed.exerciseId === entry.exerciseId,
                      ));
                    if (removable) {
                      setProtectedIds((current) => [...new Set([...current, removable.exerciseId])]);
                    }
                  }}
                >
                  Keep current
                </button>
              </div>
              <details>
                <summary>Why this appeared</summary>
                <p>Evidence: {opportunity.evidence.replace("-", " ")}</p>
                <p>Rules: {opportunity.ruleIds.join(" · ")}</p>
                {opportunity.caveats.map((caveat) => <p key={caveat}>{caveat}</p>)}
              </details>
            </article>
          ))}
        </div>
      ) : (
        <div className="positive-empty">
          <strong>No useful change for this objective.</strong>
          <p>
            The routine either has distinct roles, needs more mapping, or is already simple.
            Repeated exercises are not changed merely for novelty.
          </p>
        </div>
      )}

      {analysis?.doNotCombine.length ? (
        <section className="do-not-combine" aria-labelledby="kept-distinct-heading">
          <p className="eyebrow">Protected distinctions</p>
          <h3 id="kept-distinct-heading">Similar by muscle, different by role</h3>
          {analysis.doNotCombine.map((item) => (
            <article key={item.id}>
              <strong>{item.title}</strong>
              <p>{item.reason}</p>
            </article>
          ))}
        </section>
      ) : null}

      {preview ? (
        <section className="routine-preview" aria-labelledby="routine-preview-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Read-only preview</p>
              <h3 id="routine-preview-title">{preview.title}</h3>
            </div>
            <button className="text-button" type="button" onClick={() => setPreviewId(null)}>Close</button>
          </div>
          <div className="coverage-table" role="table" aria-label="Coverage comparison">
            <div role="row" className="coverage-header">
              <span role="columnheader">Coverage</span>
              <span role="columnheader">Before</span>
              <span role="columnheader">After</span>
            </div>
            {preview.coverage.map((item) => (
              <div role="row" key={`${item.label}:${item.unit}`}>
                <span role="cell">{item.label}<small>{item.unit}</small></span>
                <strong role="cell">{item.before}</strong>
                <strong role="cell" className={`coverage-${item.tone}`}>{item.after}</strong>
              </div>
            ))}
          </div>
          <p className="preview-gate">
            Applying changes remains locked during the read-only audit phase. Routine revisions,
            confirmation, and exact undo are required before mutation is enabled.
          </p>
        </section>
      ) : null}
    </div>
  );
}
