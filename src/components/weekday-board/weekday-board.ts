import { localDateKey } from "../../domain/dates";
import { EXERCISE_CATALOG } from "../../domain/exercises/catalog";
import type { LiftwiseData, Workout } from "../../domain/models/schema";

export type WeekdayWorkout = {
  id: string;
  name: string;
  exerciseNames: string[];
};

export type WeekdayColumn = {
  dateKey: string;
  label: string;
  isToday: boolean;
  workouts: WeekdayWorkout[];
};

export function buildWeekdayBoard(
  data: LiftwiseData,
  weekStart: string,
  weekWorkouts: Workout[],
  now: Date = new Date(),
): WeekdayColumn[] {
  const catalogById = new Map(EXERCISE_CATALOG.map((exercise) => [exercise.id, exercise.name]));
  const customById = new Map(data.customExercises.map((exercise) => [exercise.id, exercise.name]));
  const nameFor = (exerciseId: string) =>
    catalogById.get(exerciseId) ?? customById.get(exerciseId) ?? exerciseId;
  const todayKey = localDateKey(now);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${weekStart}T12:00:00`);
    date.setDate(date.getDate() + index);
    const dateKey = localDateKey(date);
    const dayWorkouts = weekWorkouts
      .filter((workout) => workout.date === dateKey)
      .map((workout) => ({
        id: workout.id,
        name: workout.name,
        exerciseNames: workout.entries.map((entry) => nameFor(entry.exerciseId)),
      }));
    return {
      dateKey,
      label: new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric" }).format(date),
      isToday: dateKey === todayKey,
      workouts: dayWorkouts,
    };
  });
}
