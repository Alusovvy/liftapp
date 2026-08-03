import type { Muscle, Workout } from "../models/schema";

export type ExerciseMuscleMapping = {
  id: string;
  primary: Muscle[];
  secondary: Muscle[];
};

export type WeeklyDose = Record<Muscle, number>;

const MUSCLE_KEYS: Muscle[] = [
  "Chest",
  "Back",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Calves",
  "Core",
];

function isQualifiedWorkingSet(set: Workout["entries"][number]["sets"][number]): boolean {
  if (String(set.type || "normal").toLowerCase() === "warmup") return false;
  const mode = set.measurementMode ?? "load_reps";
  if (mode === "duration") return (set.durationSeconds ?? 0) > 0;
  if (mode === "distance_duration") return (set.distanceMeters ?? 0) > 0;
  return (set.reps ?? 0) >= 1;
}

export function calculateWeeklyDose(
  workouts: Workout[],
  mappings: ExerciseMuscleMapping[],
): WeeklyDose {
  const byId = new Map(mappings.map((mapping) => [mapping.id, mapping]));
  const totals = Object.fromEntries(MUSCLE_KEYS.map((muscle) => [muscle, 0])) as WeeklyDose;

  workouts.forEach((workout) => {
    workout.entries.forEach((entry) => {
      const mapping = byId.get(entry.exerciseId);
      if (!mapping) return;
      const qualifiedSets = entry.sets.filter(isQualifiedWorkingSet).length;
      mapping.primary.forEach((muscle) => {
        totals[muscle] += qualifiedSets;
      });
      mapping.secondary.forEach((muscle) => {
        totals[muscle] += qualifiedSets * 0.5;
      });
    });
  });

  return totals;
}
