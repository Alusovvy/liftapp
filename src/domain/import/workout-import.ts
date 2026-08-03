import {
  compareSourceWorkout,
  contentFingerprint,
  defaultMissingRir,
  hash,
  normalizeCsvHeader,
  normalizeEffortSet,
  normalizeText,
  numberOrNull,
  parseDelimitedRows,
} from "../../domain.js";
import { EXERCISE_CATALOG } from "../exercises/catalog";
import {
  CustomExerciseSchema,
  LiftwiseDataSchema,
  WorkoutSchema,
  WorkoutSetSchema,
  type LiftwiseData,
  type Workout,
  type WorkoutSet,
} from "../models/schema";
import type { z } from "zod";

const MAX_CSV_BYTES = 10_000_000;
const MAX_CSV_ROWS = 100_000;
const MAX_IMPORT_HISTORY = 30;
const KG_PER_POUND = 0.45359237;

type CustomExercise = z.infer<typeof CustomExerciseSchema>;
type CsvRecord = Record<string, string> & {
  __rowNumber: string;
  __columnMismatch: string;
};

export type RejectedWorkoutRow = {
  rowNumber: number;
  exercise: string;
  workout: string;
  reasons: string[];
};

export type PendingWorkoutImport = {
  kind: "workouts";
  fileName: string;
  workouts: Workout[];
  warnings: string[];
  rejectedRows: RejectedWorkoutRow[];
  acceptedRowCount: number;
  totalRowCount: number;
  setCount: number;
  dateRange: string;
  unmatchedExercises: Array<{ id: string; name: string; setCount: number }>;
};

export type WorkoutImportMode = "merge" | "replace";
export type WorkoutImportStatus = "added" | "updated" | "unchanged" | "conflicted";

export type WorkoutImportChange = {
  status: WorkoutImportStatus;
  incoming: Workout;
  existing: Workout | null;
  reason?: string;
};

export type WorkoutImportPlan = {
  changes: WorkoutImportChange[];
  counts: Record<WorkoutImportStatus, number>;
};

function parseDate(value: string): Date | null {
  const input = value.trim();
  const hevy = input.match(
    /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (hevy) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const month = months.indexOf(hevy[2]!.toLowerCase());
    if (month >= 0) {
      return new Date(
        Number(hevy[3]),
        month,
        Number(hevy[1]),
        Number(hevy[4]),
        Number(hevy[5]),
        Number(hevy[6] ?? 0),
      );
    }
  }
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function recordValue(record: CsvRecord, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[normalizeCsvHeader(key)];
    if (value !== undefined && value.trim()) return value.trim();
  }
  return "";
}

function boundedNumber(
  record: CsvRecord,
  label: string,
  keys: string[],
  minimum: number,
  maximum: number,
): { value: number | null; error?: string } {
  const raw = recordValue(record, ...keys);
  if (!raw) return { value: null };
  const value = numberOrNull(raw);
  if (value === null) return { value: null, error: `${label} is not a number` };
  if (value < minimum || value > maximum) {
    return { value: null, error: `${label} must be ${minimum}–${maximum}` };
  }
  return { value };
}

const catalogByName = new Map(
  EXERCISE_CATALOG.map((exercise) => [normalizeText(exercise.name), exercise.id]),
);
const reviewedAliases = new Map<string, string>([
  ["dumbbell bench press", "db-bench"],
  ["one arm dumbbell row", "one-arm-db-row"],
  ["romanian deadlift barbell", "rdl"],
  ["dumbbell bicep curl", "curl"],
  ["barbell bench press", "bench-press"],
  ["pull up", "pull-up"],
]);

function exerciseIdFor(name: string): string {
  const normalized = normalizeText(name);
  return catalogByName.get(normalized)
    ?? reviewedAliases.get(normalized)
    ?? `custom-${hash(normalized)}`;
}

function normalizedImportedSet(input: {
  index: number;
  type: string;
  weightKg: number | null;
  reps: number | null;
  rawRpe: number | null;
  explicitImportedRir: number | null;
  sourceSetId: string;
}): WorkoutSet {
  const base = input.type.toLowerCase().includes("warm")
    ? normalizeEffortSet(input, { source: "hevy-csv" })
    : defaultMissingRir(input, 3, { source: "hevy-csv" });
  const defaulted = input.type.toLowerCase().includes("warm")
    ? false
    : input.rawRpe === null && input.explicitImportedRir === null;
  return WorkoutSetSchema.parse({
    ...base,
    type: input.type || "normal",
    measurementMode: "load_reps",
    ...(defaulted ? { effortSource: "defaulted", defaultedRir: true } : {}),
  });
}

function dateRange(workouts: Workout[]): string {
  const dates = workouts.map(({ date }) => date).sort();
  if (!dates.length) return "No dates";
  return dates[0] === dates.at(-1) ? dates[0]! : `${dates[0]} – ${dates.at(-1)}`;
}

export function parseWorkoutCsv(
  text: string,
  fileName: string,
  now = new Date(),
): PendingWorkoutImport {
  if (new TextEncoder().encode(text).byteLength > MAX_CSV_BYTES) {
    throw new Error("The CSV exceeds the 10 MB safety limit.");
  }
  const parsed = parseDelimitedRows(text, MAX_CSV_ROWS + 1) as {
    rows: string[][];
  };
  if (parsed.rows.length < 2) throw new Error("The CSV does not contain workout rows.");
  const [headerRow, ...valueRows] = parsed.rows;
  const headers = headerRow!.map(normalizeCsvHeader);
  if (new Set(headers).size !== headers.length) {
    throw new Error("The CSV contains duplicate column names.");
  }
  const hasTitle = headers.some((header) => ["title", "workout_title", "workout_name"].includes(header));
  const hasStart = headers.some((header) => ["start_time", "date"].includes(header));
  const hasExercise = headers.some((header) => ["exercise_title", "exercise_name"].includes(header));
  if (!hasTitle || !hasStart || !hasExercise) {
    throw new Error("This does not look like a workout CSV. Expected title, start_time, and exercise_title columns.");
  }

  const records: CsvRecord[] = valueRows.map((values, index) => ({
    ...Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""])),
    __rowNumber: String(index + 2),
    __columnMismatch: String(values.length !== headers.length),
  }));
  const usesPounds = headers.includes("weight_lbs") || headers.includes("weight_lb");
  const usesGenericWeight = !usesPounds && !headers.includes("weight_kg") && headers.includes("weight");
  const warnings: string[] = [];
  if (usesPounds) warnings.push("Weights in pounds will be converted to kilograms.");
  if (usesGenericWeight) warnings.push("The generic weight column is treated as kilograms.");

  type MutableEntry = {
    exerciseId: string;
    sourceExerciseName: string;
    exerciseNotes: string;
    sets: WorkoutSet[];
  };
  type MutableWorkout = Omit<Workout, "entries"> & { entries: Map<string, MutableEntry> };
  const workouts = new Map<string, MutableWorkout>();
  const rejectedRows: RejectedWorkoutRow[] = [];
  const exerciseCounts = new Map<string, number>();

  records.forEach((record) => {
    const reasons: string[] = [];
    const title = recordValue(record, "title", "workout_title", "workout_name") || "Imported workout";
    const exerciseName = recordValue(record, "exercise_title", "exercise_name");
    const start = parseDate(recordValue(record, "start_time", "date"));
    if (record.__columnMismatch === "true") reasons.push("column count does not match the header");
    if (!exerciseName) reasons.push("exercise title is missing");
    if (!start) reasons.push("start date is invalid");
    if (start && dateKey(start) > dateKey(now)) reasons.push("future workout dates are not accepted");

    const endRaw = recordValue(record, "end_time");
    const end = endRaw ? parseDate(endRaw) : null;
    if (endRaw && !end) reasons.push("end date is invalid");
    if (start && end && end < start) reasons.push("end time is before start time");
    const kg = boundedNumber(record, "weight_kg", ["weight_kg"], 0, 2000);
    const pounds = boundedNumber(record, "weight_lbs", ["weight_lbs", "weight_lb"], 0, 4409.25);
    const generic = boundedNumber(record, "weight", ["weight"], 0, 2000);
    const reps = boundedNumber(record, "reps", ["reps"], 0, 100);
    const rpe = boundedNumber(record, "RPE", ["rpe"], 0, 10);
    const rir = boundedNumber(record, "RIR", ["rir"], 0, 10);
    const setIndex = boundedNumber(record, "set_index", ["set_index", "set_order"], 0, 500);
    [kg, pounds, generic, reps, rpe, rir, setIndex].forEach((result) => {
      if (result.error) reasons.push(result.error);
    });
    if (reasons.length || !start) {
      rejectedRows.push({
        rowNumber: Number(record.__rowNumber),
        exercise: exerciseName || "—",
        workout: title,
        reasons: [...new Set(reasons)],
      });
      return;
    }

    const workoutKey = `${start.toISOString()}|${title}`;
    const identity = `hevy:${hash(workoutKey)}`;
    if (!workouts.has(workoutKey)) {
      workouts.set(workoutKey, {
        id: `hevy-${hash(identity)}`,
        source: "hevy-csv",
        sourceIdentity: identity,
        sourceKeys: [identity],
        contentFingerprint: null,
        date: dateKey(start),
        name: title,
        duration: end ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000)) : 0,
        notes: recordValue(record, "description", "workout_notes"),
        startTime: start.toISOString(),
        endTime: end?.toISOString() ?? null,
        entries: new Map(),
      });
    }
    const workout = workouts.get(workoutKey)!;
    const entryKey = normalizeText(exerciseName);
    if (!workout.entries.has(entryKey)) {
      workout.entries.set(entryKey, {
        exerciseId: exerciseIdFor(exerciseName),
        sourceExerciseName: exerciseName,
        exerciseNotes: recordValue(record, "exercise_notes", "notes"),
        sets: [],
      });
    }
    const entry = workout.entries.get(entryKey)!;
    const index = setIndex.value ?? entry.sets.length;
    const weightKg = kg.value
      ?? (pounds.value === null ? generic.value : Math.round(pounds.value * KG_PER_POUND * 100) / 100);
    entry.sets.push(normalizedImportedSet({
      index,
      type: recordValue(record, "set_type") || "normal",
      weightKg,
      reps: reps.value,
      rawRpe: rpe.value,
      explicitImportedRir: rir.value,
      sourceSetId: `${identity}:${entryKey}:${index}`,
    }));
    exerciseCounts.set(exerciseName, (exerciseCounts.get(exerciseName) ?? 0) + 1);
  });

  const normalizedWorkouts = [...workouts.values()].map((workout) => {
    const normalized = WorkoutSchema.parse({
      ...workout,
      entries: [...workout.entries.values()],
    });
    return WorkoutSchema.parse({
      ...normalized,
      contentFingerprint: contentFingerprint(normalized),
    });
  });
  if (!normalizedWorkouts.length) throw new Error("No valid workouts were found in the CSV.");
  const unmatchedExercises = [...exerciseCounts.entries()]
    .filter(([name]) => exerciseIdFor(name).startsWith("custom-"))
    .map(([name, setCount]) => ({
      id: exerciseIdFor(name),
      name,
      setCount,
    }));
  if (unmatchedExercises.length) {
    warnings.push(`${unmatchedExercises.length} exercise${unmatchedExercises.length === 1 ? "" : "s"} will be kept as unmapped custom exercises.`);
  }
  if (rejectedRows.length) {
    warnings.push(`${rejectedRows.length} invalid row${rejectedRows.length === 1 ? " was" : "s were"} rejected.`);
  }

  return {
    kind: "workouts",
    fileName,
    workouts: normalizedWorkouts,
    warnings,
    rejectedRows,
    acceptedRowCount: records.length - rejectedRows.length,
    totalRowCount: records.length,
    setCount: normalizedWorkouts.reduce((total, workout) => (
      total + workout.entries.reduce((entryTotal, entry) => entryTotal + entry.sets.length, 0)
    ), 0),
    dateRange: dateRange(normalizedWorkouts),
    unmatchedExercises,
  };
}

export function buildWorkoutImportPlan(
  data: LiftwiseData,
  pending: PendingWorkoutImport,
  mode: WorkoutImportMode,
): WorkoutImportPlan {
  const changes = pending.workouts.map((incoming): WorkoutImportChange => {
    const existing = mode === "replace"
      ? null
      : data.workouts.find((workout) => workout.sourceIdentity === incoming.sourceIdentity) ?? null;
    const comparison = compareSourceWorkout(existing, incoming) as {
      status: WorkoutImportStatus;
      incoming: Workout;
      existing: Workout | null;
      reason?: string;
    };
    return {
      status: comparison.status,
      incoming: WorkoutSchema.parse(comparison.incoming),
      existing: comparison.existing,
      ...(comparison.reason ? { reason: comparison.reason } : {}),
    };
  });
  const counts: WorkoutImportPlan["counts"] = {
    added: 0,
    updated: 0,
    unchanged: 0,
    conflicted: 0,
  };
  changes.forEach(({ status }) => {
    counts[status] += 1;
  });
  return { changes, counts };
}

function customExercise({ id, name }: { id: string; name: string }): CustomExercise {
  return {
    id,
    name,
    short: name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase().slice(0, 5) || "EX",
    primary: [],
    secondary: [],
    pattern: "Imported",
    type: "Custom",
    difficulty: "Unmapped",
    range: [8, 12],
    icon: "＋",
    note: "Imported movement. Map it before using it for muscle coverage.",
    equipment: [],
    equipmentAny: [],
    machine: false,
    swapId: "",
    homeReplacementId: "",
    measurementMode: "load_reps",
    loadMode: null,
    repMode: null,
    aliases: [name],
  };
}

export function commitWorkoutImport(input: {
  data: LiftwiseData;
  pending: PendingWorkoutImport;
  mode: WorkoutImportMode;
  acceptValidRowsOnly: boolean;
  now?: string;
  batchId?: string;
}): {
  data: LiftwiseData;
  previousData: LiftwiseData;
  batchId: string;
  counts: WorkoutImportPlan["counts"];
} {
  const {
    data,
    pending,
    mode,
    acceptValidRowsOnly,
    now = new Date().toISOString(),
    batchId = `workout-import-${Date.now()}`,
  } = input;
  if (pending.rejectedRows.length && !acceptValidRowsOnly) {
    throw new Error("Confirm that only valid rows should be imported after reviewing rejected rows.");
  }
  const plan = buildWorkoutImportPlan(data, pending, mode);
  let workouts = mode === "replace" ? [] : [...data.workouts];
  const affectedDates: string[] = [];
  plan.changes.forEach((change) => {
    if (change.status === "unchanged" || change.status === "conflicted") return;
    const incoming = WorkoutSchema.parse({
      ...change.incoming,
      importBatchId: batchId,
      importBatchIds: [batchId],
      updatedAt: now,
    });
    const index = workouts.findIndex((workout) => workout.id === change.existing?.id);
    if (index >= 0) workouts[index] = incoming;
    else workouts.push(incoming);
    affectedDates.push(incoming.date);
  });
  workouts.sort((first, second) => first.date.localeCompare(second.date));

  const existingCustomIds = new Set(data.customExercises.map(({ id }) => id));
  const additions = pending.unmatchedExercises
    .filter(({ id }) => !existingCustomIds.has(id))
    .map(customExercise);
  const next = LiftwiseDataSchema.parse({
    ...data,
    workouts,
    customExercises: [...data.customExercises, ...additions],
    importBatches: [
      ...data.importBatches,
      {
        id: batchId,
        importedAt: now,
        fileName: pending.fileName,
        source: "hevy-csv",
        kind: "workouts",
        workoutCount: plan.counts.added + plan.counts.updated,
        dayCount: 0,
        scope: "all",
        mode,
        added: plan.counts.added,
        updated: plan.counts.updated,
        unchanged: plan.counts.unchanged,
        conflicted: plan.counts.conflicted,
        rejected: pending.rejectedRows.length,
        affectedDates,
      },
    ].slice(-MAX_IMPORT_HISTORY),
  });
  return {
    data: next,
    previousData: data,
    batchId,
    counts: plan.counts,
  };
}
