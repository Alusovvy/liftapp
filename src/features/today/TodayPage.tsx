import { useMemo, useState } from "react";
import {
  RecommendationCard,
  type RecommendationDestination,
} from "../../components/actions/RecommendationCard";
import { MuscleExerciseBreakdown } from "../../components/muscle-map/MuscleExerciseBreakdown";
import { MuscleMap } from "../../components/muscle-map/MuscleMap";
import {
  buildMuscleExerciseBreakdown,
  buildMuscleMapRows,
} from "../../components/muscle-map/muscle-map-rows";
import { WeekdayBoard } from "../../components/weekday-board/WeekdayBoard";
import { buildWeekdayBoard } from "../../components/weekday-board/weekday-board";
import { evidenceLabel } from "../../domain/coaching/evidence-sufficiency";
import { formatWeekLabel } from "../../domain/dates";
import type { CoachingAction } from "../../domain/coaching/types";
import type { LiftwiseData, Muscle } from "../../domain/models/schema";
import { buildTodayViewModel, mondayKey, nextMondayKey } from "./selectors";

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
  const muscleRows = buildMuscleMapRows(data, view.weeklyDose);
  const [selectedMuscle, setSelectedMuscle] = useState<Muscle | null>(null);
  const selectedRow = muscleRows.find((row) => row.muscle === selectedMuscle) ?? null;

  const [boardWeekOffset, setBoardWeekOffset] = useState(0);
  const boardReferenceNow = useMemo(() => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + boardWeekOffset * 7);
    return date;
  }, [boardWeekOffset]);
  const boardWeekStart = mondayKey(boardReferenceNow);
  const boardWeekEnd = nextMondayKey(boardReferenceNow);
  const boardWeekWorkouts = data.workouts.filter(
    (workout) => workout.date >= boardWeekStart && workout.date < boardWeekEnd,
  );
  const earliestWorkoutMonday = useMemo(() => {
    if (!data.workouts.length) return null;
    const earliestDate = data.workouts.reduce(
      (min, workout) => (workout.date < min ? workout.date : min),
      data.workouts[0]!.date,
    );
    return mondayKey(new Date(`${earliestDate}T12:00:00`));
  }, [data.workouts]);
  const weekdayDays = buildWeekdayBoard(data, boardWeekStart, boardWeekWorkouts);

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

      <section className="page-section muscle-map-section" aria-labelledby="muscle-map-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">This week</p>
            <h2 id="muscle-map-heading">Muscle coverage</h2>
          </div>
          <button className="text-button" type="button" onClick={onOpenProgress}>
            Details
          </button>
        </div>
        <MuscleMap
          rows={muscleRows}
          selectedMuscle={selectedMuscle}
          onSelectMuscle={(muscle) =>
            setSelectedMuscle((current) => (current === muscle ? null : muscle))
          }
        />
        <p className="muscle-map-selection" aria-live="polite">
          {selectedRow
            ? `${selectedRow.muscle}: ${selectedRow.status} — ${selectedRow.value} of ${selectedRow.minimum}–${selectedRow.maximum} weekly sets.`
            : "Tap a muscle to see this week's set count against its target range."}
        </p>
        {selectedMuscle ? (
          <MuscleExerciseBreakdown
            key={selectedMuscle}
            data={data}
            muscle={selectedMuscle}
            contributions={buildMuscleExerciseBreakdown(data, view.weekWorkouts, selectedMuscle)}
          />
        ) : null}
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

      <section className="page-section" aria-labelledby="weekday-board-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Session log</p>
            <h2 id="weekday-board-heading">This week, day by day</h2>
          </div>
        </div>
        <WeekdayBoard
          days={weekdayDays}
          weekLabel={formatWeekLabel(boardWeekStart, boardWeekEnd, boardWeekOffset === 0)}
          onPrevious={() => setBoardWeekOffset((current) => current - 1)}
          onNext={() => setBoardWeekOffset((current) => Math.min(0, current + 1))}
          previousDisabled={
            earliestWorkoutMonday !== null && boardWeekStart <= earliestWorkoutMonday
          }
          nextDisabled={boardWeekOffset >= 0}
        />
      </section>
    </div>
  );
}
