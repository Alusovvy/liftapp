import { buildAttentionPlan } from "../../domain/coaching/attention-engine";
import type { AttentionEngineResult, WeeklyGap } from "../../domain/coaching/types";
import { calculateWeeklyDose } from "../../domain/coaching/weekly-dose";
import { localDateKey, mondayKey, nextMondayKey } from "../../domain/dates";
import { EXERCISE_CATALOG } from "../../domain/exercises/catalog";
import { MUSCLES, type LiftwiseData, type Muscle, type Workout } from "../../domain/models/schema";

export { localDateKey, mondayKey, nextMondayKey };

export type TodayViewModel = {
  todayKey: string;
  weekWorkouts: Workout[];
  completedSessions: number;
  plannedSessions: number;
  targetMusclesInRange: number;
  totalTargetMuscles: number;
  effortCoveragePercent: number;
  attention: AttentionEngineResult;
  latestWorkout: Workout | null;
  weeklyDose: Record<Muscle, number>;
};

function hoursSinceLatestDirectWork(
  muscle: Muscle,
  workouts: Workout[],
  now: Date,
): number | undefined {
  const directIds = new Set(
    EXERCISE_CATALOG.filter((exercise) => exercise.primary.includes(muscle)).map(
      (exercise) => exercise.id,
    ),
  );
  const latest = workouts
    .filter((workout) => workout.entries.some((entry) => directIds.has(entry.exerciseId)))
    .map((workout) => new Date(`${workout.date}T12:00:00`).getTime())
    .sort((first, second) => second - first)[0];
  if (latest === undefined) return undefined;
  return Math.max(0, (now.getTime() - latest) / 3_600_000);
}

function setHasEffort(set: Workout["entries"][number]["sets"][number]): boolean {
  return typeof set.rir === "number" || typeof set.rawRpe === "number";
}

function qualifiedSet(set: Workout["entries"][number]["sets"][number]): boolean {
  if (String(set.type || "normal").toLowerCase() === "warmup") return false;
  const mode = set.measurementMode ?? "load_reps";
  if (mode === "duration") return (set.durationSeconds ?? 0) > 0;
  if (mode === "distance_duration") return (set.distanceMeters ?? 0) > 0;
  return (set.reps ?? 0) > 0;
}

export function buildTodayViewModel(data: LiftwiseData, now = new Date()): TodayViewModel {
  const todayKey = localDateKey(now);
  const weekStart = mondayKey(now);
  const weekEnd = nextMondayKey(now);
  const weekWorkouts = data.workouts.filter(
    (workout) => workout.date >= weekStart && workout.date < weekEnd,
  );
  const mappings = [
    ...EXERCISE_CATALOG.map(({ id, primary, secondary }) => ({ id, primary, secondary })),
    ...data.customExercises.map(({ id, primary, secondary }) => ({ id, primary, secondary })),
  ];
  const weeklyDose = calculateWeeklyDose(weekWorkouts, mappings);
  const availableIds = new Set(
    EXERCISE_CATALOG.filter((exercise) => {
      const allRequired = exercise.equipment.every((id) => data.profile.equipment[id] !== false);
      const anAlternative =
        exercise.equipmentAny.length === 0 ||
        exercise.equipmentAny.some((id) => data.profile.equipment[id] !== false);
      return allRequired && anAlternative;
    }).map((exercise) => exercise.id),
  );
  const weeklyGaps: WeeklyGap[] = MUSCLES.map((muscle) => {
    const [minimumSets, maximumSets] = data.targets[muscle];
    const recentDirectWorkHours = hoursSinceLatestDirectWork(muscle, data.workouts, now);
    return {
      muscle,
      currentSets: weeklyDose[muscle],
      minimumSets,
      maximumSets,
      ...(recentDirectWorkHours === undefined ? {} : { recentDirectWorkHours }),
      availableExerciseCount: EXERCISE_CATALOG.filter(
        (exercise) => exercise.primary.includes(muscle) && availableIds.has(exercise.id),
      ).length,
      evidence: weekWorkouts.length > 0 ? "enough-evidence" : "need-data",
    };
  });

  const todayRecovery = data.recoveryCheckins.find((checkin) => checkin.date === todayKey);
  const recoveryCaution = Boolean(
    todayRecovery &&
    (todayRecovery.sleepHours < 7 ||
      todayRecovery.energy <= 2 ||
      todayRecovery.soreness >= 4 ||
      todayRecovery.stress >= 4),
  );
  const recoveryReason = todayRecovery
    ? `${todayRecovery.sleepHours} h sleep · ${todayRecovery.energy}/5 energy · ${todayRecovery.soreness}/5 soreness · ${todayRecovery.stress}/5 stress`
    : undefined;
  const scheduledRoutine = data.routines.find((routine) => routine.weekdays.includes(now.getDay()));
  const abovePlanMuscles = MUSCLES.filter(
    (muscle) => weeklyDose[muscle] > data.targets[muscle][1],
  ).map((muscle) => ({
    muscle,
    currentSets: weeklyDose[muscle],
    maximumSets: data.targets[muscle][1],
  }));

  const attention = buildAttentionPlan({
    painConcern: todayRecovery?.painConcern ?? false,
    ...(todayRecovery?.note ? { painNote: todayRecovery.note } : {}),
    recoveryCaution: recoveryCaution && !todayRecovery?.painConcern,
    ...(recoveryReason ? { recoveryReason } : {}),
    ...(scheduledRoutine
      ? {
          scheduledRoutine: {
            id: scheduledRoutine.id,
            name: scheduledRoutine.name,
          },
        }
      : {}),
    ...(!weekWorkouts.length && !scheduledRoutine
      ? {
          missingBaseline: {
            count: 1,
            description:
              "Log a workout to establish this week's coverage and progression baseline.",
          },
        }
      : {}),
    weeklyGaps,
    performanceReviews: [],
    abovePlanMuscles,
  });

  const qualified = weekWorkouts.flatMap((workout) =>
    workout.entries.flatMap((entry) => entry.sets.filter(qualifiedSet)),
  );
  const effortSets = qualified.filter(setHasEffort).length;
  const targetMusclesInRange = MUSCLES.filter((muscle) => {
    const [minimum, maximum] = data.targets[muscle];
    return weeklyDose[muscle] >= minimum && weeklyDose[muscle] <= maximum;
  }).length;
  const latestWorkout =
    [...data.workouts].sort((first, second) => second.date.localeCompare(first.date))[0] ?? null;

  return {
    todayKey,
    weekWorkouts,
    completedSessions: weekWorkouts.length,
    plannedSessions: data.profile.days,
    targetMusclesInRange,
    totalTargetMuscles: MUSCLES.length,
    effortCoveragePercent: qualified.length ? Math.round((effortSets / qualified.length) * 100) : 0,
    attention,
    latestWorkout,
    weeklyDose,
  };
}
