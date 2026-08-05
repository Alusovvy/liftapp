import {
  RecommendationCard,
  type RecommendationDestination,
} from "../../components/actions/RecommendationCard";
import { evidenceLabel } from "../../domain/coaching/evidence-sufficiency";
import type { CoachingAction } from "../../domain/coaching/types";
import type { LiftwiseData } from "../../domain/models/schema";
import { buildTodayViewModel } from "./selectors";

type TodayPageProps = {
  data: LiftwiseData;
  onOpenProgress: () => void;
  onOpenImport: () => void;
  onStartRecommendedWorkout: (routineId?: string) => void;
  onOpenTrainWorkout: () => void;
  onOpenTrainRoutines: () => void;
};

function formattedToday(): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

const LEGACY_HREF = "./index.html";

// Safety- and recovery-editing flows are intentionally not yet ported to the
// modern app (REMAINING-WORK-SPEC.md P0.1/P0.2), so those two kinds keep
// pointing at the legacy interface. Every other kind already has a working
// modern destination and must not fall back to it.
function primaryDestination(
  action: CoachingAction,
  handlers: Pick<
    TodayPageProps,
    "onStartRecommendedWorkout" | "onOpenTrainWorkout" | "onOpenProgress"
  >,
): RecommendationDestination {
  switch (action.kind) {
    case "planned-session":
      return {
        type: "action",
        onClick: () => handlers.onStartRecommendedWorkout(action.routineId),
      };
    case "weekly-gap":
    case "data-quality":
    case "maintenance":
      return { type: "action", onClick: handlers.onOpenTrainWorkout };
    case "performance-review":
      return { type: "action", onClick: handlers.onOpenProgress };
    case "above-plan-review":
    case "safety":
    case "recovery":
    default:
      return { type: "link", href: LEGACY_HREF };
  }
}

function alternativeDestination(
  action: CoachingAction,
  handlers: Pick<TodayPageProps, "onOpenTrainWorkout" | "onOpenTrainRoutines" | "onOpenProgress">,
): RecommendationDestination | undefined {
  if (!action.alternativeActionLabel) return undefined;
  switch (action.kind) {
    case "data-quality":
      return { type: "action", onClick: handlers.onOpenTrainRoutines };
    case "planned-session":
      return { type: "action", onClick: handlers.onOpenTrainWorkout };
    case "weekly-gap":
    case "maintenance":
    case "performance-review":
    case "above-plan-review":
      return { type: "action", onClick: handlers.onOpenProgress };
    case "safety":
    case "recovery":
    default:
      return { type: "link", href: LEGACY_HREF };
  }
}

export function TodayPage({
  data,
  onOpenProgress,
  onOpenImport,
  onStartRecommendedWorkout,
  onOpenTrainWorkout,
  onOpenTrainRoutines,
}: TodayPageProps) {
  const view = buildTodayViewModel(data);

  return (
    <div className="page page-today">
      <header className="page-header">
        <div>
          <p className="eyebrow">{formattedToday()}</p>
          <h1>What matters today</h1>
          <p className="page-intro">
            One useful action first. The calculation is available when you want it.
          </p>
        </div>
        <div className="page-header-actions">
          <button className="button button-secondary" type="button" onClick={onOpenImport}>
            Import
          </button>
          <a className="button button-secondary quick-log" href="./index.html">
            Quick log
          </a>
        </div>
      </header>

      <section className="today-hero" aria-label="Today's recommendation and week status">
        <RecommendationCard
          action={view.attention.primary}
          primary={primaryDestination(view.attention.primary, {
            onStartRecommendedWorkout,
            onOpenTrainWorkout,
            onOpenProgress,
          })}
          alternative={alternativeDestination(view.attention.primary, {
            onOpenTrainWorkout,
            onOpenTrainRoutines,
            onOpenProgress,
          })}
        />
        <aside className="week-strip" aria-labelledby="week-status-title">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">This week</p>
              <h2 id="week-status-title">Current plan</h2>
            </div>
            <button className="text-button" type="button" onClick={onOpenProgress}>
              Details
            </button>
          </div>
          <dl className="week-metrics">
            <div>
              <dt>Sessions</dt>
              <dd>
                {view.completedSessions} / {view.plannedSessions}
              </dd>
            </div>
            <div>
              <dt>Muscles in range</dt>
              <dd>
                {view.targetMusclesInRange} / {view.totalTargetMuscles}
              </dd>
            </div>
            <div>
              <dt>Effort data</dt>
              <dd>{view.effortCoveragePercent}%</dd>
            </div>
          </dl>
          <p className="week-note">
            Updated from {view.completedSessions} session{view.completedSessions === 1 ? "" : "s"}{" "}
            in the current Monday–Sunday week.
          </p>
        </aside>
      </section>

      <section className="page-section" aria-labelledby="weekly-focus-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Weekly focus</p>
            <h2 id="weekly-focus-heading">Up to three useful priorities</h2>
          </div>
          <button className="text-button" type="button" onClick={onOpenProgress}>
            Open progress
          </button>
        </div>
        {view.attention.weeklyFocus.length ? (
          <ol className="focus-list">
            {view.attention.weeklyFocus.map((focus, index) => (
              <li key={focus.id}>
                <span className="focus-number">{index + 1}</span>
                <div>
                  <strong>{focus.title}</strong>
                  <p>{focus.reason}</p>
                </div>
                <span className={`evidence-badge evidence-${focus.evidence}`}>
                  {evidenceLabel(focus.evidence)}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="positive-empty">
            <strong>No competing priority needs attention.</strong>
            <p>Continue the current plan or choose a preferred session.</p>
          </div>
        )}
      </section>

      <section className="page-section last-session-section" aria-labelledby="last-session-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Last session</p>
            <h2 id="last-session-heading">{view.latestWorkout?.name ?? "No workout logged yet"}</h2>
          </div>
          {view.latestWorkout ? (
            <time dateTime={view.latestWorkout.date}>{view.latestWorkout.date}</time>
          ) : null}
        </div>
        {view.latestWorkout ? (
          <div className="last-session-summary">
            <div>
              <strong>{view.latestWorkout.entries.length}</strong>
              <span>exercises</span>
            </div>
            <div>
              <strong>
                {view.latestWorkout.entries.reduce(
                  (total, entry) =>
                    total + entry.sets.filter((set) => set.type !== "warmup").length,
                  0,
                )}
              </strong>
              <span>working sets</span>
            </div>
            <div>
              <strong>{view.latestWorkout.duration ?? "—"}</strong>
              <span>{view.latestWorkout.duration ? "minutes" : "duration missing"}</span>
            </div>
            <a className="button button-secondary" href="./index.html">
              Review workout
            </a>
          </div>
        ) : (
          <p className="empty-copy">
            Log one workout to establish exercise history and weekly coverage.
          </p>
        )}
      </section>
    </div>
  );
}
