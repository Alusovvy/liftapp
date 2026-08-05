import { useMemo, useState } from "react";
import { MUSCLES, type LiftwiseData } from "../../domain/models/schema";
import { buildExerciseProgress } from "../../domain/progress/exercise-progress";
import { buildTodayViewModel, mondayKey, nextMondayKey } from "../today/selectors";
import { MuscleMap } from "./MuscleMap";

type ProgressPageProps = {
  data: LiftwiseData;
  onOpenTrain: () => void;
};

type ProgressTab = "focus" | "exercises" | "muscles" | "recovery";

const tabs: Array<{ id: ProgressTab; label: string }> = [
  { id: "focus", label: "Focus" },
  { id: "exercises", label: "Exercises" },
  { id: "muscles", label: "Muscles" },
  { id: "recovery", label: "Recovery" },
];

const evidenceLabels = {
  "need-data": "Need data",
  emerging: "Emerging",
  "enough-evidence": "Enough evidence",
} as const;

function weekLabel(weekStartKey: string, weekEndExclusiveKey: string, isCurrent: boolean): string {
  if (isCurrent) return "Current week";
  const start = new Date(`${weekStartKey}T12:00:00`);
  const end = new Date(`${weekEndExclusiveKey}T12:00:00`);
  end.setDate(end.getDate() - 1);
  const sameMonth = start.getMonth() === end.getMonth();
  const startText = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    start,
  );
  const endText = new Intl.DateTimeFormat(
    undefined,
    sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" },
  ).format(end);
  return `${startText} – ${endText}`;
}

type WeekNavProps = {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  previousDisabled: boolean;
  nextDisabled: boolean;
};

function WeekNav({ label, onPrevious, onNext, previousDisabled, nextDisabled }: WeekNavProps) {
  return (
    <div className="week-nav" role="group" aria-label="Select week">
      <button
        className="week-nav-button"
        type="button"
        onClick={onPrevious}
        disabled={previousDisabled}
        aria-label="Previous week"
      >
        ←
      </button>
      <span className="week-nav-label">{label}</span>
      <button
        className="week-nav-button"
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        aria-label="Next week"
      >
        →
      </button>
    </div>
  );
}

function recoveryAdjustment(checkin: LiftwiseData["recoveryCheckins"][number]): {
  label: string;
  explanation: string;
} {
  if (checkin.painConcern) {
    return {
      label: "Generated training paused",
      explanation: "The app paused generated training because you reported a pain concern.",
    };
  }
  const reasons = [
    checkin.sleepHours < 7 ? "sleep under 7 h" : null,
    checkin.energy <= 2 ? "energy at 2/5 or lower" : null,
    checkin.soreness >= 4 ? "soreness at 4/5 or higher" : null,
    checkin.stress >= 4 ? "stress at 4/5 or higher" : null,
  ].filter((reason): reason is string => reason !== null);
  if (reasons.length) {
    return {
      label: "Reduced session suggested",
      explanation: `The transparent recovery rule was triggered by ${reasons.join(", ")}.`,
    };
  }
  return {
    label: "Plan unchanged",
    explanation: "This check-in did not cross a configured recovery caution threshold.",
  };
}

export function ProgressPage({ data, onOpenTrain }: ProgressPageProps) {
  const [tab, setTab] = useState<ProgressTab>("focus");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedMuscle, setSelectedMuscle] = useState<(typeof MUSCLES)[number] | null>(null);
  const referenceNow = useMemo(() => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + weekOffset * 7);
    return date;
  }, [weekOffset]);
  const weekStart = mondayKey(referenceNow);
  const weekEnd = nextMondayKey(referenceNow);
  const earliestWorkoutMonday = useMemo(() => {
    if (!data.workouts.length) return null;
    const earliestDate = data.workouts.reduce(
      (min, workout) => (workout.date < min ? workout.date : min),
      data.workouts[0]!.date,
    );
    return mondayKey(new Date(`${earliestDate}T12:00:00`));
  }, [data.workouts]);
  const view = buildTodayViewModel(data, referenceNow);
  const exerciseProgress = useMemo(() => buildExerciseProgress(data), [data]);
  const focus = [
    ...(view.attention.primary.kind === "maintenance" ? [] : [view.attention.primary]),
    ...view.attention.weeklyFocus,
  ]
    .filter(
      (item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index,
    )
    .slice(0, 3);

  const rows = MUSCLES.map((muscle) => {
    const [minimum, maximum] = data.targets[muscle];
    const value = view.weeklyDose[muscle];
    const status =
      value < minimum ? "Below range" : value > maximum ? "Review above range" : "In range";
    return { muscle, minimum, maximum, value, status };
  }).sort((first, second) => {
    const firstGap = Math.max(0, first.minimum - first.value);
    const secondGap = Math.max(0, second.minimum - second.value);
    return secondGap - firstGap || first.muscle.localeCompare(second.muscle);
  });
  const maxScale = Math.max(...rows.map((row) => Math.max(row.maximum, row.value)), 1);
  const recovery = [...data.recoveryCheckins]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 12);
  const weekNav = (
    <WeekNav
      label={weekLabel(weekStart, weekEnd, weekOffset === 0)}
      onPrevious={() => setWeekOffset((current) => current - 1)}
      onNext={() => setWeekOffset((current) => Math.min(0, current + 1))}
      previousDisabled={earliestWorkoutMonday !== null && weekStart <= earliestWorkoutMonday}
      nextDisabled={weekOffset >= 0}
    />
  );

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Progress</p>
          <h1>What is changing—and what to do next</h1>
          <p className="page-intro">
            Observations, recommendations, and missing evidence stay visibly separate.
          </p>
        </div>
      </header>

      <div className="subnav" role="tablist" aria-label="Progress sections">
        {tabs.map((item) => (
          <button
            key={item.id}
            id={`progress-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`progress-panel-${item.id}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section
        className="progress-panel"
        id={`progress-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`progress-tab-${tab}`}
      >
        {tab === "focus" ? (
          <div className="progress-focus">
            <header className="progress-section-intro">
              <div>
                <p className="eyebrow">Maximum three</p>
                <h2>Highest-value reviews for this week</h2>
              </div>
              <div className="progress-section-intro-side">
                <span>
                  {view.weekWorkouts.length} logged session
                  {view.weekWorkouts.length === 1 ? "" : "s"} this week
                </span>
                {weekNav}
              </div>
            </header>
            {focus.length ? (
              <ol className="progress-focus-list">
                {focus.map((item, index) => (
                  <li key={item.id}>
                    <span className="focus-rank">{index + 1}</span>
                    <div>
                      <span className="progress-observation">Recommended action</span>
                      <h3>{item.title}</h3>
                      <p>{item.reason}</p>
                      <details>
                        <summary>Evidence: {evidenceLabels[item.evidence]}</summary>
                        <p>
                          Rule <code>{item.ruleId}</code>. Weekly dose counts qualified direct sets
                          as 1.0 and secondary sets as 0.5; recent direct work may lower a gap’s
                          rank.
                        </p>
                      </details>
                    </div>
                    <button className="button button-secondary" type="button" onClick={onOpenTrain}>
                      {item.primaryActionLabel}
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="positive-empty">
                <strong>No priority review is competing for attention.</strong>
                <p>Continue your chosen plan or review exercise history.</p>
              </div>
            )}
            <div className="progress-boundary-note">
              <strong>Planning model, not a readiness score</strong>
              <span>
                Safety and reported recovery always outrank coverage. The list does not diagnose
                fatigue, injury, or muscle growth.
              </span>
            </div>
          </div>
        ) : null}

        {tab === "exercises" ? (
          <div className="exercise-progress">
            <header className="progress-section-intro">
              <div>
                <p className="eyebrow">Comparable sessions only</p>
                <h2>Exercise decisions</h2>
              </div>
              <span>
                {exerciseProgress.length} tracked exercise{exerciseProgress.length === 1 ? "" : "s"}
              </span>
            </header>
            {exerciseProgress.length ? (
              <div className="exercise-progress-list">
                {exerciseProgress.map((item) => (
                  <article
                    className={`exercise-progress-row change-${item.change}`}
                    key={item.exerciseId}
                  >
                    <div className="exercise-progress-decision">
                      <span className="progress-observation">
                        {item.change === "improved"
                          ? "Observed improvement"
                          : item.change === "review"
                            ? "Review prompt"
                            : "Next decision"}
                      </span>
                      <h3>{item.recommendation}</h3>
                      <strong>{item.exerciseName}</strong>
                    </div>
                    <div className="exercise-progress-latest">
                      <span>Last comparable</span>
                      <strong>{item.lastPerformance}</strong>
                      <time dateTime={item.lastDate ?? undefined}>
                        {item.lastDate ?? "Not logged"}
                      </time>
                    </div>
                    <div
                      className="compact-trend"
                      aria-label={`Recent comparable history for ${item.exerciseName}`}
                    >
                      {item.comparableHistory.length ? (
                        item.comparableHistory
                          .slice(0, 3)
                          .reverse()
                          .map((point) => (
                            <span key={point.workoutId}>
                              <small>{point.date}</small>
                              <strong>{point.label}</strong>
                            </span>
                          ))
                      ) : (
                        <span>
                          <strong>Baseline needed</strong>
                        </span>
                      )}
                    </div>
                    <span className={`evidence-badge evidence-${item.evidence}`}>
                      {evidenceLabels[item.evidence]}
                    </span>
                    <details>
                      <summary>Why and comparable history</summary>
                      <p>{item.reason}</p>
                      {item.excludedAppearances ? (
                        <p>
                          {item.excludedAppearances} appearance
                          {item.excludedAppearances === 1 ? " was" : "s were"} excluded because the
                          measurement or loading convention changed.
                        </p>
                      ) : null}
                      {item.comparableHistory.length ? (
                        <div className="progress-data-table">
                          <table>
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Top qualified set</th>
                                <th>RIR</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.comparableHistory.map((point) => (
                                <tr key={`${point.workoutId}:${point.date}`}>
                                  <td>{point.date}</td>
                                  <td>{point.label}</td>
                                  <td>{point.rir ?? "Not logged"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </details>
                  </article>
                ))}
              </div>
            ) : (
              <div className="positive-empty">
                <strong>No exercise history yet.</strong>
                <p>Finish a workout to establish the first honest baseline.</p>
                <button className="button button-primary" type="button" onClick={onOpenTrain}>
                  Start a workout
                </button>
              </div>
            )}
          </div>
        ) : null}

        {tab === "muscles" ? (
          <div className="page-section progress-muscles" aria-labelledby="muscle-coverage-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Weekly coverage</p>
                <h2 id="muscle-coverage-title">Muscle coverage</h2>
              </div>
              <div className="progress-section-intro-side">
                <span className="evidence-badge evidence-enough-evidence">
                  {view.weekWorkouts.length
                    ? `${view.weekWorkouts.length} logged sessions`
                    : "Need data"}
                </span>
                {weekNav}
              </div>
            </div>
            <p className="method-note">
              Coverage is a configurable planning model, not a direct measurement of muscle growth.
            </p>
            <MuscleMap
              rows={rows}
              selectedMuscle={selectedMuscle}
              onSelectMuscle={(muscle) =>
                setSelectedMuscle((current) => (current === muscle ? null : muscle))
              }
            />
            <div className="muscle-bars" role="list">
              {rows.map((row) => (
                <div
                  className={`muscle-bar-row ${selectedMuscle === row.muscle ? "is-selected" : ""}`}
                  role="listitem"
                  key={row.muscle}
                  id={`muscle-row-${row.muscle}`}
                >
                  <div className="muscle-bar-label">
                    <strong>{row.muscle}</strong>
                    <span>
                      {row.value} / {row.minimum}–{row.maximum} weighted sets
                    </span>
                  </div>
                  <div className="muscle-track" aria-hidden="true">
                    <span
                      className="target-band"
                      style={{
                        left: `${(row.minimum / maxScale) * 100}%`,
                        width: `${((row.maximum - row.minimum) / maxScale) * 100}%`,
                      }}
                    />
                    <span
                      className="actual-bar"
                      style={{ width: `${Math.min(100, (row.value / maxScale) * 100)}%` }}
                    />
                  </div>
                  <span
                    className={`status-text status-${row.status.toLowerCase().replaceAll(" ", "-")}`}
                  >
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "recovery" ? (
          <div className="recovery-progress">
            <header className="progress-section-intro">
              <div>
                <p className="eyebrow">Your reports and app response</p>
                <h2>Recovery check-ins</h2>
              </div>
              <span>
                {recovery.length} recent check-in{recovery.length === 1 ? "" : "s"}
              </span>
            </header>
            {recovery.length ? (
              <div className="recovery-timeline">
                {recovery.map((checkin) => {
                  const adjustment = recoveryAdjustment(checkin);
                  return (
                    <article key={checkin.id}>
                      <time dateTime={checkin.date}>{checkin.date}</time>
                      <dl>
                        <div>
                          <dt>Sleep</dt>
                          <dd>{checkin.sleepHours} h</dd>
                        </div>
                        <div>
                          <dt>Energy</dt>
                          <dd>{checkin.energy}/5</dd>
                        </div>
                        <div>
                          <dt>Soreness</dt>
                          <dd>{checkin.soreness}/5</dd>
                        </div>
                        <div>
                          <dt>Stress</dt>
                          <dd>{checkin.stress}/5</dd>
                        </div>
                      </dl>
                      <div>
                        <span className="progress-observation">App response</span>
                        <strong>{adjustment.label}</strong>
                        <p>{adjustment.explanation}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="positive-empty">
                <strong>No recovery check-ins yet.</strong>
                <p>
                  Training history still works. A check-in is optional context, not a requirement.
                </p>
              </div>
            )}
            <p className="method-note">
              These rows show what you reported and which deterministic rule the app applied. They
              do not prove that a recovery input caused a performance result.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
