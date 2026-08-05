import { useMemo, useState } from "react";
import { analyzeRoutineOptimization } from "../../../domain/optimization/analyze-plan";
import {
  applyRoutineOpportunity,
  coverageForProposedEntries,
  routineRevisionToken,
  snoozeUntilSixWeeksFrom,
  undoRoutineRevision,
  withOptimizationPreferences,
} from "../../../domain/optimization/routine-revisions";
import type {
  OptimizationObjective,
  OptimizationOpportunity,
  RoutineEntryChange,
} from "../../../domain/optimization/types";
import type { LiftwiseData } from "../../../domain/models/schema";

type OptimizePlanPageProps = {
  data: LiftwiseData;
  onDataChange: (data: LiftwiseData) => void;
};

type PreviewState = {
  opportunity: OptimizationOpportunity;
  expectedRoutineToken: string;
};

type Notice = {
  tone: "success" | "review";
  message: string;
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

export function OptimizePlanPage({ data, onDataChange }: OptimizePlanPageProps) {
  const [objective, setObjective] = useState<OptimizationObjective>(
    data.optimizationPreferences.objective,
  );
  const [routineId, setRoutineId] = useState(data.routines[0]?.id ?? "");
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [proposalSets, setProposalSets] = useState<Record<string, number>>({});
  const [lastAppliedRevisionId, setLastAppliedRevisionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
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

  const activeSnoozes = useMemo(
    () =>
      Object.entries(data.optimizationPreferences.snoozedOpportunityIds)
        .filter(([, until]) => new Date(until).getTime() > Date.now())
        .map(([id]) => id),
    [data.optimizationPreferences.snoozedOpportunityIds],
  );

  const analysis = useMemo(
    () =>
      routine
        ? analyzeRoutineOptimization({
            routine,
            objective,
            equipment: data.profile.equipment,
            protectedExerciseIds: data.optimizationPreferences.protectedExerciseIds,
            suppressedOpportunityIds: [...activeSnoozes, ...dismissedIds],
            suppressedRelationshipIds: data.optimizationPreferences.suppressedRelationshipIds,
            completedAppearances: appearances,
          })
        : null,
    [
      activeSnoozes,
      appearances,
      data.optimizationPreferences.protectedExerciseIds,
      data.optimizationPreferences.suppressedRelationshipIds,
      data.profile.equipment,
      dismissedIds,
      objective,
      routine,
    ],
  );
  const preview = previewState?.opportunity ?? null;
  const previewProposals: RoutineEntryChange[] = preview
    ? preview.proposedEntries.map((entry) => ({
        ...entry,
        targetSets: proposalSets[entry.exerciseId] ?? entry.targetSets,
      }))
    : [];
  const previewCoverage = preview ? coverageForProposedEntries(preview, previewProposals) : [];

  const persistPreferences = (
    update: Parameters<typeof withOptimizationPreferences>[1],
    nextNotice?: Notice,
  ) => {
    try {
      onDataChange(withOptimizationPreferences(data, update));
      if (nextNotice) setNotice(nextNotice);
      return true;
    } catch {
      setNotice({
        tone: "review",
        message: "The preference could not be saved. Your existing plan was not changed.",
      });
      return false;
    }
  };

  const selectObjective = (next: OptimizationObjective) => {
    setObjective(next);
    setPreviewState(null);
    persistPreferences((preferences) => ({ ...preferences, objective: next }));
  };

  const openPreview = (opportunity: OptimizationOpportunity) => {
    if (!routine) return;
    setPreviewState({
      opportunity,
      expectedRoutineToken: routineRevisionToken(routine),
    });
    setProposalSets(
      Object.fromEntries(
        opportunity.proposedEntries.map((entry) => [entry.exerciseId, entry.targetSets]),
      ),
    );
    setNotice(null);
  };

  const applyPreview = () => {
    if (!previewState) return;
    try {
      const result = applyRoutineOpportunity({
        data,
        opportunity: previewState.opportunity,
        expectedRoutineToken: previewState.expectedRoutineToken,
        proposedEntries: previewProposals,
      });
      onDataChange(result.data);
      setLastAppliedRevisionId(result.revision.id);
      setPreviewState(null);
      setNotice({
        tone: "success",
        message: "Routine revision saved. The previous routine remains available for exact undo.",
      });
    } catch (error) {
      setNotice({
        tone: "review",
        message:
          error instanceof Error
            ? error.message
            : "The routine could not be changed. Your existing plan was preserved.",
      });
    }
  };

  const undoLastRevision = () => {
    if (!lastAppliedRevisionId) return;
    try {
      const result = undoRoutineRevision(data, lastAppliedRevisionId);
      onDataChange(result.data);
      setLastAppliedRevisionId(null);
      setNotice({
        tone: "success",
        message: "Undo complete. The exact previous routine was restored.",
      });
    } catch (error) {
      setNotice({
        tone: "review",
        message: error instanceof Error ? error.message : "Undo could not be completed safely.",
      });
    }
  };

  const snoozePreview = () => {
    if (!preview) return;
    const until = snoozeUntilSixWeeksFrom();
    const saved = persistPreferences(
      (preferences) => ({
        ...preferences,
        snoozedOpportunityIds: {
          ...preferences.snoozedOpportunityIds,
          [preview.id]: until,
        },
      }),
      {
        tone: "success",
        message: `Snoozed until ${new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
        }).format(new Date(until))}.`,
      },
    );
    if (saved) setPreviewState(null);
  };

  const suppressPreview = () => {
    if (!preview) return;
    const relationshipIds = preview.ruleIds.filter((id) => id.startsWith("relationship."));
    const identifiers = relationshipIds.length ? relationshipIds : [preview.id];
    const saved = persistPreferences(
      (preferences) => ({
        ...preferences,
        suppressedRelationshipIds: [
          ...new Set([...preferences.suppressedRelationshipIds, ...identifiers]),
        ],
      }),
      {
        tone: "success",
        message: "This reviewed replacement will no longer be suggested.",
      },
    );
    if (saved) setPreviewState(null);
  };

  const protectPreviewExercise = () => {
    if (!preview) return;
    const proposedIds = new Set(preview.proposedEntries.map(({ exerciseId }) => exerciseId));
    const protectedId =
      preview.sourceEntries.find(({ exerciseId }) => !proposedIds.has(exerciseId))?.exerciseId ??
      preview.sourceEntries[0]?.exerciseId;
    if (!protectedId) return;
    const saved = persistPreferences(
      (preferences) => ({
        ...preferences,
        protectedExerciseIds: [...new Set([...preferences.protectedExerciseIds, protectedId])],
      }),
      {
        tone: "success",
        message: "Exercise protected. Opportunities that remove it are now excluded.",
      },
    );
    if (saved) setPreviewState(null);
  };

  if (!routine) {
    return (
      <div className="positive-empty">
        <strong>Create a routine before optimizing it.</strong>
        <p>The optimizer audits an intended plan; it does not invent one from isolated history.</p>
        <a className="button button-primary" href="./index.html">
          Create a routine
        </a>
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
            Similar planned coverage is not the same as an identical biological effect. Every option
            shows what is preserved and what changes.
          </p>
        </div>
        <label className="select-field">
          Routine
          <select
            value={routine.id}
            onChange={(event) => {
              setRoutineId(event.target.value);
              setPreviewState(null);
            }}
          >
            {data.routines.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
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
                onChange={() => selectObjective(item.id)}
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

      {notice ? (
        <div className={`optimization-notice notice-${notice.tone}`} role="status">
          <span>{notice.message}</span>
          {lastAppliedRevisionId ? (
            <button className="text-button" type="button" onClick={undoLastRevision}>
              Undo revision
            </button>
          ) : null}
        </div>
      ) : null}

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
                    <strong key={entry.exerciseId}>
                      {entry.exerciseName} · {entry.targetSets} sets
                    </strong>
                  ))}
                </div>
                <span aria-hidden="true">→</span>
                <div>
                  <span>Option</span>
                  {opportunity.proposedEntries.map((entry) => (
                    <strong key={entry.exerciseId}>
                      {entry.exerciseName} · {entry.targetSets} sets
                    </strong>
                  ))}
                </div>
              </div>
              <div className="preserved-changed">
                <div>
                  <strong>Preserved</strong>
                  <ul>
                    {opportunity.preserved.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <strong>Changed</strong>
                  <ul>
                    {opportunity.changed.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="opportunity-actions">
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => openPreview(opportunity)}
                >
                  Preview routine
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => {
                    setDismissedIds((current) => [...new Set([...current, opportunity.id])]);
                    if (preview?.id === opportunity.id) setPreviewState(null);
                    setNotice({
                      tone: "success",
                      message: "Kept current for this review. No plan data changed.",
                    });
                  }}
                >
                  Keep current
                </button>
              </div>
              <details>
                <summary>Why this appeared</summary>
                <p>Evidence: {opportunity.evidence.replace("-", " ")}</p>
                <p>Rules: {opportunity.ruleIds.join(" · ")}</p>
                {opportunity.caveats.map((caveat) => (
                  <p key={caveat}>{caveat}</p>
                ))}
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
              <p className="eyebrow">Revision preview</p>
              <h3 id="routine-preview-title">{preview.title}</h3>
            </div>
            <button className="text-button" type="button" onClick={() => setPreviewState(null)}>
              Close
            </button>
          </div>
          <fieldset className="proposal-editor">
            <legend>Proposed routine entries</legend>
            {previewProposals.map((entry) => (
              <label key={entry.exerciseId}>
                <span>{entry.exerciseName}</span>
                <input
                  aria-label={`${entry.exerciseName} proposed sets`}
                  type="number"
                  min="1"
                  max="20"
                  step="1"
                  value={entry.targetSets}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setProposalSets((current) => ({
                      ...current,
                      [entry.exerciseId]: value,
                    }));
                  }}
                />
                <span>sets</span>
              </label>
            ))}
          </fieldset>
          <div className="coverage-table" role="table" aria-label="Coverage comparison">
            <div role="row" className="coverage-header">
              <span role="columnheader">Coverage</span>
              <span role="columnheader">Before</span>
              <span role="columnheader">After</span>
            </div>
            {previewCoverage.map((item) => (
              <div role="row" key={`${item.label}:${item.unit}`}>
                <span role="cell">
                  {item.label}
                  <small>{item.unit}</small>
                </span>
                <strong role="cell">{item.before}</strong>
                <strong role="cell" className={`coverage-${item.tone}`}>
                  {item.after}
                </strong>
              </div>
            ))}
          </div>
          <p className="preview-gate">
            Applying creates an immutable routine revision. It does not change workouts, targets, or
            historical performance data.
          </p>
          <div className="preview-actions">
            <button
              className="button button-primary"
              type="button"
              onClick={applyPreview}
              disabled={previewProposals.some(
                ({ targetSets }) =>
                  !Number.isInteger(targetSets) || targetSets < 1 || targetSets > 20,
              )}
            >
              Apply as new revision
            </button>
            <button className="button button-secondary" type="button" onClick={snoozePreview}>
              Snooze 6 weeks
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={protectPreviewExercise}
            >
              Protect exercise
            </button>
            <button className="text-button" type="button" onClick={suppressPreview}>
              Never suggest this replacement
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
