import { z } from "zod";
import { EXERCISE_BY_ID } from "../exercises/catalog";
import {
  LiftwiseDataSchema,
  WorkoutSchema,
  type LiftwiseData,
  type Routine,
  type Workout,
} from "../models/schema";

export const DEFAULT_ACTIVE_RIR = 3;

const DraftSetSchema = z.object({
  id: z.string().min(1),
  type: z.string().default("normal"),
  weightKg: z.number().nonnegative().nullable(),
  reps: z.number().int().positive().nullable(),
  rir: z.number().min(0).max(10).nullable(),
  completed: z.boolean(),
  referenceWeightKg: z.number().nonnegative().nullable(),
  referenceReps: z.number().int().positive().nullable(),
});

const DraftEntrySchema = z.object({
  id: z.string().min(1),
  exerciseId: z.string().min(1),
  notes: z.string(),
  sets: z.array(DraftSetSchema),
});

export const ActiveWorkoutDraftSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  routineId: z.string().nullable(),
  name: z.string(),
  notes: z.string(),
  startedAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  entries: z.array(DraftEntrySchema),
});

export type ActiveWorkoutDraft = z.infer<typeof ActiveWorkoutDraftSchema>;
export type ActiveWorkoutDraftEntry = z.infer<typeof DraftEntrySchema>;
export type ActiveWorkoutDraftSet = z.infer<typeof DraftSetSchema>;

type DraftOptions = {
  routineId?: string | null;
  now?: string;
  createId?: () => string;
};

type SetPatch = Partial<
  Pick<ActiveWorkoutDraftSet, "weightKg" | "reps" | "rir" | "completed" | "type">
>;

type PreviousSet = {
  weightKg: number | null;
  reps: number | null;
};

function defaultId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function latestExerciseSets(data: LiftwiseData, exerciseId: string): PreviousSet[] {
  const workouts = [...data.workouts].sort((left, right) =>
    (right.endTime ?? `${right.date}T23:59:59`).localeCompare(
      left.endTime ?? `${left.date}T23:59:59`,
    ),
  );
  const entry = workouts
    .flatMap((workout) => workout.entries)
    .find((candidate) => candidate.exerciseId === exerciseId);
  if (!entry) return [];
  return entry.sets
    .filter((set) => set.type !== "warmup")
    .map((set) => ({
      weightKg: set.weightKg ?? null,
      reps: set.reps ?? null,
    }));
}

function makeSet(
  previous: PreviousSet | undefined,
  rir: number,
  createId: () => string,
): ActiveWorkoutDraftSet {
  return {
    id: createId(),
    type: "normal",
    weightKg: previous?.weightKg ?? null,
    reps: previous?.reps ?? null,
    rir,
    completed: false,
    referenceWeightKg: previous?.weightKg ?? null,
    referenceReps: previous?.reps ?? null,
  };
}

function routineEntryToDraft(
  data: LiftwiseData,
  routineEntry: Routine["entries"][number],
  createId: () => string,
): ActiveWorkoutDraftEntry {
  const previous = latestExerciseSets(data, routineEntry.exerciseId);
  const rir = routineEntry.targetRir ?? DEFAULT_ACTIVE_RIR;
  return {
    id: createId(),
    exerciseId: routineEntry.exerciseId,
    notes: routineEntry.notes,
    sets: Array.from({ length: routineEntry.targetSets }, (_, index) =>
      makeSet(previous[index] ?? previous.at(-1), rir, createId),
    ),
  };
}

export function createActiveWorkoutDraft(
  data: LiftwiseData,
  options: DraftOptions = {},
): ActiveWorkoutDraft {
  const now = options.now ?? new Date().toISOString();
  const createId = options.createId ?? defaultId;
  const routine = options.routineId
    ? data.routines.find((candidate) => candidate.id === options.routineId)
    : undefined;
  if (options.routineId && !routine) {
    throw new Error("The selected routine no longer exists.");
  }

  return ActiveWorkoutDraftSchema.parse({
    version: 1,
    id: createId(),
    routineId: routine?.id ?? null,
    name: routine?.name ?? "Workout",
    notes: routine?.notes ?? "",
    startedAt: now,
    updatedAt: now,
    entries: routine?.entries.map((entry) => routineEntryToDraft(data, entry, createId)) ?? [],
  });
}

export function addExerciseToDraft(
  draft: ActiveWorkoutDraft,
  data: LiftwiseData,
  exerciseId: string,
  options: Pick<DraftOptions, "now" | "createId"> = {},
): ActiveWorkoutDraft {
  if (draft.entries.some((entry) => entry.exerciseId === exerciseId)) {
    throw new Error("This exercise is already in the active workout.");
  }
  if (!exerciseId) throw new Error("Choose an exercise first.");
  const known =
    EXERCISE_BY_ID.has(exerciseId) ||
    data.customExercises.some((exercise) => exercise.id === exerciseId);
  if (!known) {
    const inHistoryOrPlan =
      data.workouts.some((workout) =>
        workout.entries.some((entry) => entry.exerciseId === exerciseId),
      ) ||
      data.routines.some((routine) =>
        routine.entries.some((entry) => entry.exerciseId === exerciseId),
      );
    if (!inHistoryOrPlan) throw new Error("The selected exercise is no longer available.");
  }
  const createId = options.createId ?? defaultId;
  const previous = latestExerciseSets(data, exerciseId);
  return ActiveWorkoutDraftSchema.parse({
    ...draft,
    updatedAt: options.now ?? new Date().toISOString(),
    entries: [
      ...draft.entries,
      {
        id: createId(),
        exerciseId,
        notes: "",
        sets: [makeSet(previous[0], DEFAULT_ACTIVE_RIR, createId)],
      },
    ],
  });
}

export function addSetToDraft(
  draft: ActiveWorkoutDraft,
  entryId: string,
  options: Pick<DraftOptions, "now" | "createId"> = {},
): ActiveWorkoutDraft {
  const createId = options.createId ?? defaultId;
  let found = false;
  const entries = draft.entries.map((entry) => {
    if (entry.id !== entryId) return entry;
    found = true;
    const last = entry.sets.at(-1);
    return {
      ...entry,
      sets: [
        ...entry.sets,
        {
          ...makeSet(
            last
              ? {
                  weightKg: last.weightKg,
                  reps: last.reps,
                }
              : undefined,
            last?.rir ?? DEFAULT_ACTIVE_RIR,
            createId,
          ),
          referenceWeightKg: last?.referenceWeightKg ?? null,
          referenceReps: last?.referenceReps ?? null,
        },
      ],
    };
  });
  if (!found) throw new Error("The exercise is no longer in this workout.");
  return ActiveWorkoutDraftSchema.parse({
    ...draft,
    updatedAt: options.now ?? new Date().toISOString(),
    entries,
  });
}

export function updateDraftSet(
  draft: ActiveWorkoutDraft,
  entryId: string,
  setId: string,
  patch: SetPatch,
  now = new Date().toISOString(),
): ActiveWorkoutDraft {
  let found = false;
  const entries = draft.entries.map((entry) =>
    entry.id === entryId
      ? {
          ...entry,
          sets: entry.sets.map((set) => {
            if (set.id !== setId) return set;
            found = true;
            return { ...set, ...patch };
          }),
        }
      : entry,
  );
  if (!found) throw new Error("The set is no longer in this workout.");
  return ActiveWorkoutDraftSchema.parse({ ...draft, entries, updatedAt: now });
}

export function updateDraftDetails(
  draft: ActiveWorkoutDraft,
  patch: Partial<Pick<ActiveWorkoutDraft, "name" | "notes">>,
  now = new Date().toISOString(),
): ActiveWorkoutDraft {
  return ActiveWorkoutDraftSchema.parse({ ...draft, ...patch, updatedAt: now });
}

export function removeSetFromDraft(
  draft: ActiveWorkoutDraft,
  entryId: string,
  setId: string,
  now = new Date().toISOString(),
): ActiveWorkoutDraft {
  const entry = draft.entries.find((candidate) => candidate.id === entryId);
  if (!entry?.sets.some((set) => set.id === setId)) {
    throw new Error("The set is no longer in this workout.");
  }
  return ActiveWorkoutDraftSchema.parse({
    ...draft,
    updatedAt: now,
    entries: draft.entries.map((candidate) =>
      candidate.id === entryId
        ? { ...candidate, sets: candidate.sets.filter((set) => set.id !== setId) }
        : candidate,
    ),
  });
}

export function removeExerciseFromDraft(
  draft: ActiveWorkoutDraft,
  entryId: string,
  now = new Date().toISOString(),
): ActiveWorkoutDraft {
  if (!draft.entries.some((entry) => entry.id === entryId)) {
    throw new Error("The exercise is no longer in this workout.");
  }
  return ActiveWorkoutDraftSchema.parse({
    ...draft,
    updatedAt: now,
    entries: draft.entries.filter((entry) => entry.id !== entryId),
  });
}

export function activeWorkoutReadiness(draft: ActiveWorkoutDraft): {
  completedSets: number;
  totalSets: number;
  errors: string[];
} {
  const completed = draft.entries.flatMap((entry) => entry.sets.filter((set) => set.completed));
  const errors: string[] = [];
  if (!draft.name.trim()) errors.push("Give the workout a name.");
  if (!completed.length) errors.push("Complete at least one set.");
  if (completed.some((set) => set.reps === null || set.reps < 1)) {
    errors.push("Every completed set needs at least one rep.");
  }
  return {
    completedSets: completed.length,
    totalSets: draft.entries.reduce((sum, entry) => sum + entry.sets.length, 0),
    errors,
  };
}

function localDateKey(isoDate: string): string {
  const date = new Date(isoDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function completeActiveWorkout(
  data: LiftwiseData,
  draft: ActiveWorkoutDraft,
  now = new Date().toISOString(),
): { data: LiftwiseData; workout: Workout } {
  const parsedDraft = ActiveWorkoutDraftSchema.parse(draft);
  const readiness = activeWorkoutReadiness(parsedDraft);
  if (readiness.errors.length) throw new Error(readiness.errors.join(" "));

  const started = new Date(parsedDraft.startedAt).getTime();
  const ended = new Date(now).getTime();
  const duration = Math.max(0, Math.round((ended - started) / 60_000));
  const workout = WorkoutSchema.parse({
    id: `manual:${parsedDraft.id}`,
    source: "manual",
    sourceIdentity: null,
    sourceKeys: [],
    contentFingerprint: null,
    date: localDateKey(now),
    name: parsedDraft.name.trim(),
    duration,
    notes: parsedDraft.notes.trim(),
    startTime: parsedDraft.startedAt,
    endTime: now,
    updatedAt: now,
    entries: parsedDraft.entries.flatMap((entry) => {
      const completed = entry.sets.filter((set) => set.completed);
      if (!completed.length) return [];
      return [
        {
          exerciseId: entry.exerciseId,
          exerciseNotes: entry.notes,
          measurementMode: "load_reps" as const,
          loadMode: null,
          repMode: "total" as const,
          sets: completed.map((set, index) => {
            const rir = set.rir ?? DEFAULT_ACTIVE_RIR;
            return {
              index,
              sourceSetId: null,
              type: set.type,
              measurementMode: "load_reps" as const,
              weightKg: set.weightKg,
              reps: set.reps,
              rir,
              manualRir: rir,
              rirManual: true,
              effortSource: "manual",
            };
          }),
        },
      ];
    }),
  });
  return {
    workout,
    data: LiftwiseDataSchema.parse({
      ...data,
      workouts: [...data.workouts.filter((candidate) => candidate.id !== workout.id), workout],
      appMeta: { ...data.appMeta, lastSavedAt: now },
    }),
  };
}
