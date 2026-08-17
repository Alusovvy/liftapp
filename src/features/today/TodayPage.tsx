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
import { WeekNav } from "../../components/navigation/WeekNav";
import { WeekdayBoard } from "../../components/weekday-board/WeekdayBoard";
import { buildWeekdayBoard } from "../../components/weekday-board/weekday-board";
import { evidenceLabel } from "../../domain/coaching/evidence-sufficiency";
import { formatWeekLabel } from "../../domain/dates";
import type { CoachingAction } from "../../domain/coaching/types";
import type { LiftwiseData, Muscle } from "../../domain/models/schema";
import { buildTodayViewModel, mondayKey, nextMondayKey } from "./selectors";

function progressPercent(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

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
// modern app, so those two kinds keep pointing at the legacy interface.
// Every other kind already has a working modern destination and must not
// fall back to it.
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
  // The hero recommendation and weekly-focus list are always about today —
  // "add a set" or "start this routine" makes no sense for a past week —
  // so they stay pinned to the real current date regardless of the week
  // navigator below, which only moves the descriptive/browsable widgets
  // (weekly summary, muscle coverage, day-by-day log).
  const todayView = buildTodayViewModel(data);

  const [weekOffset, setWeekOffset] = useState(0);
  const referenceNow = useMemo(() => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + weekOffset * 7);
    return date;
  }, [weekOffset]);
  const weekView = useMemo(() => buildTodayViewModel(data, referenceNow), [data, referenceNow]);
  const weekStart = mondayKey(referenceNow);
  const weekEnd = nextMondayKey(referenceNow);
  const muscleRows = buildMuscleMapRows(data, weekView.weeklyDose);
  const [selectedMuscle, setSelectedMuscle] = useState<Muscle | null>(null);
  const selectedRow = muscleRows.find((row) => row.muscle === selectedMuscle) ?? null;
  const earliestWorkoutMonday = useMemo(() => {
    if (!data.workouts.length) return null;
    const earliestDate = data.workouts.reduce(
      (min, workout) => (workout.date < min ? workout.date : min),
      data.workouts[0]!.date,
    );
    return mondayKey(new Date(`${earliestDate}T12:00:00`));
  }, [data.workouts]);
  const weekdayDays = buildWeekdayBoard(data, weekStart, weekView.weekWorkouts);
  const isCurrentWeek = weekOffset === 0;
  const weekNavLabel = formatWeekLabel(weekStart, weekEnd, isCurrentWeek);
  const goToPreviousWeek = () => setWeekOffset((current) => current - 1);
  const goToNextWeek = () => setWeekOffset((current) => Math.min(0, current + 1));
  const previousWeekDisabled = earliestWorkoutMonday !== null && weekStart <= earliestWorkoutMonday;
  const nextWeekDisabled = weekOffset >= 0;

  return (
    <div className="page page-today">
      <header className="page-header">
        <div>
          <p className="eyebrow">{formattedToday()}</p>
          <h1>What matters today</h1>
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

      <section className="today-hero" aria-label="Today's recommendation">
        <RecommendationCard
          action={todayView.attention.primary}
          primary={primaryDestination(todayView.attention.primary, {
            onStartRecommendedWorkout,
            onOpenTrainWorkout,
            onOpenProgress,
          })}
          alternative={alternativeDestination(todayView.attention.primary, {
            onOpenTrainWorkout,
            onOpenTrainRoutines,
            onOpenProgress,
          })}
        />
      </section>

      <section
        className="page-section weekly-summary-section"
        aria-labelledby="weekly-summary-heading"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Weekly summary</p>
            <h2 id="weekly-summary-heading">
              {isCurrentWeek ? "How this week is going" : "How that week went"}
            </h2>
          </div>
          <WeekNav
            label={weekNavLabel}
            onPrevious={goToPreviousWeek}
            onNext={goToNextWeek}
            previousDisabled={previousWeekDisabled}
            nextDisabled={nextWeekDisabled}
          />
        </div>
        <div className="stat-tile-row">
          <div className="stat-tile">
            <p className="stat-tile-label">Sessions</p>
            <p className="stat-tile-value">
              {weekView.completedSessions}
              <span> / {weekView.plannedSessions}</span>
            </p>
            <div className="stat-tile-track" aria-hidden="true">
              <span
                className="stat-tile-fill"
                style={{
                  width: `${progressPercent(weekView.completedSessions, weekView.plannedSessions)}%`,
                }}
              />
            </div>
          </div>
          <div className="stat-tile">
            <p className="stat-tile-label">Muscles in range</p>
            <p className="stat-tile-value">
              {weekView.targetMusclesInRange}
              <span> / {weekView.totalTargetMuscles}</span>
            </p>
            <div className="stat-tile-track" aria-hidden="true">
              <span
                className="stat-tile-fill"
                style={{
                  width: `${progressPercent(weekView.targetMusclesInRange, weekView.totalTargetMuscles)}%`,
                }}
              />
            </div>
          </div>
          <div className="stat-tile">
            <p className="stat-tile-label">Effort logged</p>
            <p className="stat-tile-value">
              {weekView.effortCoveragePercent}
              <span>%</span>
            </p>
            <div className="stat-tile-track" aria-hidden="true">
              <span
                className="stat-tile-fill"
                style={{ width: `${weekView.effortCoveragePercent}%` }}
              />
            </div>
          </div>
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
            : "Tap a muscle to see its set count against your weekly target range."}
        </p>
        {selectedMuscle ? (
          <MuscleExerciseBreakdown
            key={selectedMuscle}
            data={data}
            muscle={selectedMuscle}
            contributions={buildMuscleExerciseBreakdown(
              data,
              weekView.weekWorkouts,
              selectedMuscle,
            )}
          />
        ) : null}
      </section>

      <section className="page-section" aria-labelledby="weekly-focus-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Weekly focus</p>
            <h2 id="weekly-focus-heading">What to prioritize next</h2>
          </div>
          <button className="text-button" type="button" onClick={onOpenProgress}>
            Open progress
          </button>
        </div>
        {todayView.attention.weeklyFocus.length ? (
          <ol className="focus-list">
            {todayView.attention.weeklyFocus.map((focus, index) => (
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
            <h2 id="last-session-heading">
              {todayView.latestWorkout?.name ?? "No workout logged yet"}
            </h2>
          </div>
          {todayView.latestWorkout ? (
            <time dateTime={todayView.latestWorkout.date}>{todayView.latestWorkout.date}</time>
          ) : null}
        </div>
        {todayView.latestWorkout ? (
          <div className="last-session-summary">
            <div>
              <strong>{todayView.latestWorkout.entries.length}</strong>
              <span>exercises</span>
            </div>
            <div>
              <strong>
                {todayView.latestWorkout.entries.reduce(
                  (total, entry) =>
                    total + entry.sets.filter((set) => set.type !== "warmup").length,
                  0,
                )}
              </strong>
              <span>working sets</span>
            </div>
            <div>
              <strong>{todayView.latestWorkout.duration ?? "—"}</strong>
              <span>{todayView.latestWorkout.duration ? "minutes" : "duration missing"}</span>
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
            <h2 id="weekday-board-heading">Day by day</h2>
          </div>
        </div>
        <WeekdayBoard
          days={weekdayDays}
          weekLabel={weekNavLabel}
          onPrevious={goToPreviousWeek}
          onNext={goToNextWeek}
          previousDisabled={previousWeekDisabled}
          nextDisabled={nextWeekDisabled}
        />
      </section>
    </div>
  );
}
