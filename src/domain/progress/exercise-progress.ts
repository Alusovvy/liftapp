import { EXERCISE_BY_ID } from "../exercises/catalog";
import type {
  LiftwiseData,
  Workout,
  WorkoutEntry,
  WorkoutSet,
} from "../models/schema";
import type { EvidenceState } from "../coaching/types";

type MeasurementMode = "load_reps" | "reps" | "duration" | "distance_duration";
type ProgressCategory = "action" | "emerging" | "maintained" | "baseline";

export type ComparablePerformance = {
  workoutId: string;
  date: string;
  mode: MeasurementMode;
  signature: string;
  label: string;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  rir: number | null;
};

export type ExerciseProgressSummary = {
  exerciseId: string;
  exerciseName: string;
  category: ProgressCategory;
  evidence: EvidenceState;
  recommendation: string;
  reason: string;
  lastDate: string | null;
  lastPerformance: string;
  comparableHistory: ComparablePerformance[];
  excludedAppearances: number;
  change: "improved" | "review" | "maintained" | "need-data";
};

function numeric(value: number | null | undefined, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function modeFor(entry: WorkoutEntry, set: WorkoutSet): MeasurementMode {
  return set.measurementMode ?? entry.measurementMode ?? "load_reps";
}

function qualified(set: WorkoutSet, mode: MeasurementMode): boolean {
  if (set.type.toLowerCase() === "warmup") return false;
  if (mode === "duration") return numeric(set.durationSeconds) > 0;
  if (mode === "distance_duration") return numeric(set.distanceMeters) > 0;
  return numeric(set.reps) > 0;
}

function effortFor(set: WorkoutSet): number | null {
  if (typeof set.rir === "number") return set.rir;
  if (typeof set.rawRpe === "number") return Math.max(0, 10 - set.rawRpe);
  return null;
}

function signature(entry: WorkoutEntry, mode: MeasurementMode): string {
  return [
    mode,
    entry.loadMode ?? "unspecified-load",
    entry.repMode ?? "total",
  ].join(":");
}

function bestSet(entry: WorkoutEntry): WorkoutSet | null {
  const working = entry.sets.filter((set) => qualified(set, modeFor(entry, set)));
  if (!working.length) return null;
  const mode = modeFor(entry, working[0]!);
  return [...working].sort((left, right) => {
    if (mode === "duration") {
      return numeric(right.durationSeconds) - numeric(left.durationSeconds);
    }
    if (mode === "distance_duration") {
      const distance = numeric(right.distanceMeters) - numeric(left.distanceMeters);
      return distance || numeric(left.durationSeconds, Number.POSITIVE_INFINITY)
        - numeric(right.durationSeconds, Number.POSITIVE_INFINITY);
    }
    if (mode === "reps") return numeric(right.reps) - numeric(left.reps);
    const load = entry.loadMode === "assistance"
      ? numeric(left.weightKg) - numeric(right.weightKg)
      : numeric(right.weightKg) - numeric(left.weightKg);
    return load || numeric(right.reps) - numeric(left.reps);
  })[0]!;
}

function secondsLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes} min`;
}

function performanceLabel(
  set: WorkoutSet,
  mode: MeasurementMode,
): string {
  if (mode === "duration") return secondsLabel(numeric(set.durationSeconds));
  if (mode === "distance_duration") {
    const distance = numeric(set.distanceMeters);
    const distanceLabel = distance >= 1000
      ? `${Math.round((distance / 1000) * 100) / 100} km`
      : `${distance} m`;
    return `${distanceLabel} · ${secondsLabel(numeric(set.durationSeconds))}`;
  }
  if (mode === "reps" || set.weightKg === null || set.weightKg === undefined) {
    return `${numeric(set.reps)} reps`;
  }
  return `${set.weightKg} kg × ${numeric(set.reps)}`;
}

function toPerformance(
  workout: Workout,
  entry: WorkoutEntry,
): ComparablePerformance | null {
  const set = bestSet(entry);
  if (!set) return null;
  const mode = modeFor(entry, set);
  return {
    workoutId: workout.id,
    date: workout.date,
    mode,
    signature: signature(entry, mode),
    label: performanceLabel(set, mode),
    weightKg: set.weightKg ?? null,
    reps: set.reps ?? null,
    durationSeconds: set.durationSeconds ?? null,
    distanceMeters: set.distanceMeters ?? null,
    rir: effortFor(set),
  };
}

function improved(
  current: ComparablePerformance,
  previous: ComparablePerformance,
): boolean {
  if (current.mode === "duration") {
    return numeric(current.durationSeconds) > numeric(previous.durationSeconds);
  }
  if (current.mode === "distance_duration") {
    return numeric(current.distanceMeters) > numeric(previous.distanceMeters)
      || (
        current.distanceMeters === previous.distanceMeters
        && numeric(current.durationSeconds, Number.POSITIVE_INFINITY)
          < numeric(previous.durationSeconds, Number.POSITIVE_INFINITY)
      );
  }
  if (current.mode === "reps") return numeric(current.reps) > numeric(previous.reps);
  const assistance = current.signature.includes(":assistance:");
  const currentLoad = numeric(current.weightKg);
  const previousLoad = numeric(previous.weightKg);
  const loadImproved = assistance
    ? currentLoad < previousLoad
    : currentLoad > previousLoad;
  if (loadImproved && numeric(current.reps) >= numeric(previous.reps)) return true;
  if (currentLoad === previousLoad && numeric(current.reps) > numeric(previous.reps)) {
    return true;
  }
  return currentLoad === previousLoad
    && current.reps === previous.reps
    && current.rir !== null
    && previous.rir !== null
    && current.rir > previous.rir;
}

function maintainedRecommendation(mode: MeasurementMode): string {
  if (mode === "duration") return "Repeat the setup and add a small amount of time if form stays stable.";
  if (mode === "distance_duration") return "Repeat the route or setup before changing distance or pace.";
  if (mode === "reps") return "Repeat the variation and aim for one more clean rep.";
  return "Repeat the current load and aim for one more clean rep.";
}

function nameFor(data: LiftwiseData, exerciseId: string): string {
  return EXERCISE_BY_ID.get(exerciseId)?.name
    ?? data.customExercises.find((exercise) => exercise.id === exerciseId)?.name
    ?? data.workouts
      .flatMap((workout) => workout.entries)
      .find((entry) => entry.exerciseId === exerciseId)?.sourceExerciseName
    ?? exerciseId;
}

export function buildExerciseProgress(
  data: LiftwiseData,
): ExerciseProgressSummary[] {
  const exerciseIds = new Set([
    ...data.routines.flatMap((routine) => routine.entries.map((entry) => entry.exerciseId)),
    ...data.workouts.flatMap((workout) => workout.entries.map((entry) => entry.exerciseId)),
  ]);
  const order: Record<ProgressCategory, number> = {
    action: 0,
    emerging: 1,
    maintained: 2,
    baseline: 3,
  };

  return [...exerciseIds].map((exerciseId): ExerciseProgressSummary => {
    const allHistory = [...data.workouts]
      .sort((left, right) => (
        (right.endTime ?? right.date).localeCompare(left.endTime ?? left.date)
      ))
      .flatMap((workout) => workout.entries
        .filter((entry) => entry.exerciseId === exerciseId)
        .map((entry) => toPerformance(workout, entry))
        .filter((item): item is ComparablePerformance => item !== null));
    const latest = allHistory[0];
    if (!latest) {
      return {
        exerciseId,
        exerciseName: nameFor(data, exerciseId),
        category: "baseline",
        evidence: "need-data",
        recommendation: "Log one normal working set to establish a baseline.",
        reason: "No qualified set is available for a comparison.",
        lastDate: null,
        lastPerformance: "No baseline",
        comparableHistory: [],
        excludedAppearances: 0,
        change: "need-data",
      };
    }

    const comparable = allHistory.filter((item) => item.signature === latest.signature);
    const excludedAppearances = allHistory.length - comparable.length;
    if (comparable.length === 1) {
      return {
        exerciseId,
        exerciseName: nameFor(data, exerciseId),
        category: "emerging",
        evidence: "emerging",
        recommendation: "Repeat the same setup once before using a trend.",
        reason: "One qualified appearance establishes a baseline; a second comparable session enables a change review.",
        lastDate: latest.date,
        lastPerformance: latest.label,
        comparableHistory: comparable,
        excludedAppearances,
        change: "maintained",
      };
    }

    const previous = comparable[1]!;
    const latestImproved = improved(latest, previous);
    const latestThree = comparable.slice(0, 3);
    const hardThree = latestThree.length === 3
      && latestThree.every((item) => item.rir !== null && item.rir <= 1);
    const noRecentImprovement = latestThree.length === 3
      && !improved(latestThree[0]!, latestThree[1]!)
      && !improved(latestThree[1]!, latestThree[2]!);
    const missingEffort = latest.rir === null;

    if (hardThree && noRecentImprovement) {
      return {
        exerciseId,
        exerciseName: nameFor(data, exerciseId),
        category: "action",
        evidence: "enough-evidence",
        recommendation: "Review load, recovery, technique, or exercise choice.",
        reason: "Performance has not improved across three comparable hard sessions. This is a review prompt, not a diagnosis.",
        lastDate: latest.date,
        lastPerformance: latest.label,
        comparableHistory: comparable,
        excludedAppearances,
        change: "review",
      };
    }
    if (latestImproved) {
      return {
        exerciseId,
        exerciseName: nameFor(data, exerciseId),
        category: "action",
        evidence: "enough-evidence",
        recommendation: "Keep the successful setup and make the improvement repeatable.",
        reason: `${latest.label} improved on the previous comparable ${previous.label}.`,
        lastDate: latest.date,
        lastPerformance: latest.label,
        comparableHistory: comparable,
        excludedAppearances,
        change: "improved",
      };
    }
    if (missingEffort) {
      return {
        exerciseId,
        exerciseName: nameFor(data, exerciseId),
        category: "emerging",
        evidence: "emerging",
        recommendation: "Repeat the setup and record RIR after the top set.",
        reason: "The performances are comparable, but the latest effort is missing.",
        lastDate: latest.date,
        lastPerformance: latest.label,
        comparableHistory: comparable,
        excludedAppearances,
        change: "maintained",
      };
    }
    return {
      exerciseId,
      exerciseName: nameFor(data, exerciseId),
      category: "maintained",
      evidence: "enough-evidence",
      recommendation: maintainedRecommendation(latest.mode),
      reason: `${latest.label} is similar to the previous comparable ${previous.label}.`,
      lastDate: latest.date,
      lastPerformance: latest.label,
      comparableHistory: comparable,
      excludedAppearances,
      change: "maintained",
    };
  }).sort((left, right) => (
    order[left.category] - order[right.category]
    || (right.lastDate ?? "").localeCompare(left.lastDate ?? "")
    || left.exerciseName.localeCompare(right.exerciseName)
  ));
}
