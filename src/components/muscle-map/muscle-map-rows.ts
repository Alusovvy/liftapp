import { isQualifiedWorkingSet } from "../../domain/coaching/weekly-dose";
import { EXERCISE_CATALOG, isExerciseAvailable } from "../../domain/exercises/catalog";
import { MUSCLES, type LiftwiseData, type Muscle, type Workout } from "../../domain/models/schema";
import type { MuscleMapRow } from "./MuscleMap";

export function buildMuscleMapRows(
  data: LiftwiseData,
  weeklyDose: Record<Muscle, number>,
): MuscleMapRow[] {
  return MUSCLES.map((muscle) => {
    const [minimum, maximum] = data.targets[muscle];
    const value = weeklyDose[muscle];
    const status =
      value < minimum ? "Below range" : value > maximum ? "Review above range" : "In range";
    return { muscle, minimum, maximum, value, status };
  }).sort((first, second) => {
    const firstGap = Math.max(0, first.minimum - first.value);
    const secondGap = Math.max(0, second.minimum - second.value);
    return secondGap - firstGap || first.muscle.localeCompare(second.muscle);
  });
}

export type MuscleExerciseContribution = {
  exerciseId: string;
  name: string;
  sets: number;
  role: "primary" | "secondary";
  credit: number;
};

export function buildMuscleExerciseBreakdown(
  data: LiftwiseData,
  weekWorkouts: Workout[],
  muscle: Muscle,
): MuscleExerciseContribution[] {
  const catalogById = new Map(EXERCISE_CATALOG.map((exercise) => [exercise.id, exercise]));
  const customById = new Map(data.customExercises.map((exercise) => [exercise.id, exercise]));
  const totals = new Map<string, { name: string; sets: number; role: "primary" | "secondary" }>();

  weekWorkouts.forEach((workout) => {
    workout.entries.forEach((entry) => {
      const mapping = catalogById.get(entry.exerciseId) ?? customById.get(entry.exerciseId);
      if (!mapping) return;
      const role = mapping.primary.includes(muscle)
        ? "primary"
        : mapping.secondary.includes(muscle)
          ? "secondary"
          : null;
      if (!role) return;
      const qualifiedSets = entry.sets.filter(isQualifiedWorkingSet).length;
      if (!qualifiedSets) return;
      const current = totals.get(entry.exerciseId);
      if (current) current.sets += qualifiedSets;
      else totals.set(entry.exerciseId, { name: mapping.name, sets: qualifiedSets, role });
    });
  });

  return [...totals.entries()]
    .map(([exerciseId, { name, sets, role }]) => ({
      exerciseId,
      name,
      sets,
      role,
      credit: role === "primary" ? sets : sets * 0.5,
    }))
    .sort((first, second) => second.credit - first.credit || first.name.localeCompare(second.name));
}

export type MuscleExerciseSuggestion = {
  exerciseId: string;
  name: string;
  pattern: string;
  equipmentLabel: string;
  available: boolean;
};

const SUGGESTION_LIMIT = 6;

export function buildPrimaryExerciseSuggestions(
  data: LiftwiseData,
  muscle: Muscle,
  excludeExerciseIds: Set<string>,
): MuscleExerciseSuggestion[] {
  return EXERCISE_CATALOG.filter(
    (exercise) => exercise.primary.includes(muscle) && !excludeExerciseIds.has(exercise.id),
  )
    .map((exercise) => ({
      exerciseId: exercise.id,
      name: exercise.name,
      pattern: exercise.pattern,
      equipmentLabel: exercise.equipment.length
        ? exercise.equipment.join(" + ")
        : exercise.equipmentAny.length
          ? exercise.equipmentAny.join(" or ")
          : "Bodyweight",
      available: isExerciseAvailable(exercise, data.profile.equipment),
    }))
    .sort(
      (first, second) =>
        Number(second.available) - Number(first.available) || first.name.localeCompare(second.name),
    )
    .slice(0, SUGGESTION_LIMIT);
}
