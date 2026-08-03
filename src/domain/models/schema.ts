import { z } from "zod";

export const CURRENT_SCHEMA_VERSION = 9 as const;
export const MUSCLES = [
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
] as const;

export const MeasurementModeSchema = z.enum(["load_reps", "reps", "duration", "distance_duration"]);
export const LoadModeSchema = z.enum(["total", "per_hand", "added_bodyweight", "assistance", "none"]);
export const RepModeSchema = z.enum(["total", "per_side"]);
export const DateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const OptionalIsoDateSchema = z.string().datetime({ offset: true }).nullable().optional();

const LooseRecordSchema = z.record(z.string(), z.unknown());

export const EffortSourceSchema = z.enum([
  "manual",
  "manual-cleared",
  "explicit-rir",
  "derived-from-rpe",
  "missing",
]).or(z.string());

export const WorkoutSetSchema = z.object({
  index: z.number().int().nonnegative().optional(),
  sourceSetId: z.string().nullable().optional(),
  type: z.string().default("normal"),
  measurementMode: MeasurementModeSchema.optional(),
  weightKg: z.number().nullable().optional(),
  reps: z.number().nullable().optional(),
  durationSeconds: z.number().nullable().optional(),
  distanceMeters: z.number().nullable().optional(),
  rawRpe: z.number().nullable().optional(),
  explicitImportedRir: z.number().nullable().optional(),
  manualRir: z.number().nullable().optional(),
  manualRirCleared: z.boolean().optional(),
  rir: z.number().nullable().optional(),
  rirManual: z.boolean().optional(),
  effortSource: EffortSourceSchema.optional(),
}).passthrough();

export const WorkoutEntrySchema = z.object({
  exerciseId: z.string().min(1),
  sourceExerciseName: z.string().optional(),
  exerciseNotes: z.string().optional(),
  supersetId: z.string().nullable().optional(),
  measurementMode: MeasurementModeSchema.nullable().optional(),
  loadMode: LoadModeSchema.nullable().optional(),
  repMode: RepModeSchema.nullable().optional(),
  sets: z.array(WorkoutSetSchema),
}).passthrough();

export const RecoveryCheckinSchema = z.object({
  id: z.string().min(1),
  date: DateKeySchema,
  sleepHours: z.number().min(0).max(24),
  energy: z.number().int().min(1).max(5),
  soreness: z.number().int().min(1).max(5),
  stress: z.number().int().min(1).max(5),
  painConcern: z.boolean(),
  note: z.string().default(""),
  recordedAt: z.string(),
}).passthrough();

export const WorkoutSchema = z.object({
  id: z.string().min(1),
  source: z.string().optional(),
  sourceIdentity: z.string().nullable().optional(),
  sourceKeys: z.array(z.string()).optional(),
  contentFingerprint: z.string().nullable().optional(),
  date: DateKeySchema,
  name: z.string().min(1),
  duration: z.number().nonnegative().nullable().optional(),
  notes: z.string().default(""),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  entries: z.array(WorkoutEntrySchema),
  recoverySnapshot: RecoveryCheckinSchema.nullable().optional(),
  importBatchId: z.string().nullable().optional(),
  importBatchIds: z.array(z.string()).optional(),
  updatedAt: z.string().nullable().optional(),
}).passthrough();

export const RoutineEntrySchema = z.object({
  exerciseId: z.string().min(1),
  targetSets: z.number().int().min(1).max(20),
  targetRir: z.number().nullable().optional(),
  notes: z.string().default(""),
}).passthrough();

export const RoutineSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  notes: z.string().default(""),
  weekdays: z.array(z.number().int().min(0).max(6)),
  entries: z.array(RoutineEntrySchema),
  createdAt: z.string().nullable().optional(),
}).passthrough();

export const OptimizationObjectiveSchema = z.enum([
  "save_time",
  "simplify",
  "add_variety",
  "equipment",
  "prioritize",
  "comfort",
]);

export const OptimizationPreferencesSchema = z.object({
  enabled: z.boolean().default(true),
  objective: OptimizationObjectiveSchema.default("simplify"),
  maxVisibleOpportunities: z.literal(3).default(3),
  protectedExerciseIds: z.array(z.string()).default([]),
  suppressedRelationshipIds: z.array(z.string()).default([]),
  snoozedOpportunityIds: z.record(z.string(), z.string()).default({}),
}).passthrough();

export const RoutineRevisionSchema = z.object({
  id: z.string().min(1),
  routineId: z.string().min(1),
  revision: z.number().int().positive(),
  createdAt: z.string(),
  action: z.enum(["apply", "undo"]),
  sourceOpportunityId: z.string().nullable(),
  revertsRevisionId: z.string().nullable(),
  before: RoutineSchema,
  after: RoutineSchema,
}).passthrough();

export const NutritionDaySchema = z.object({
  id: z.string().min(1),
  date: DateKeySchema,
  caloriesKcal: z.number().nonnegative().nullable(),
  proteinG: z.number().nonnegative().nullable(),
  carbsG: z.number().nonnegative().nullable(),
  fatG: z.number().nonnegative().nullable(),
  fiberG: z.number().nonnegative().nullable(),
  source: z.string(),
  sourceIdentity: z.string(),
  contentFingerprint: z.string(),
  sourceRowCount: z.number().int().nonnegative(),
  aggregation: z.string(),
  importBatchId: z.string().nullable().optional(),
  importedAt: z.string(),
}).passthrough();

export const BodyMetricSchema = z.object({
  id: z.string().min(1),
  date: DateKeySchema,
  // The legacy normalizer deliberately supports body-fat-only measurements.
  weightKg: z.number().positive().nullable(),
  bodyFatPercent: z.number().min(0).max(100).nullable().optional(),
  note: z.string().default(""),
  recordedAt: z.string(),
}).passthrough();

export const CustomExerciseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  short: z.string(),
  primary: z.array(z.enum(MUSCLES)),
  secondary: z.array(z.enum(MUSCLES)),
  pattern: z.string(),
  type: z.string(),
  difficulty: z.string(),
  range: z.tuple([z.number(), z.number()]),
  icon: z.string(),
  note: z.string(),
  equipment: z.array(z.string()),
  equipmentAny: z.array(z.string()),
  machine: z.boolean(),
  swapId: z.string(),
  homeReplacementId: z.string(),
  measurementMode: MeasurementModeSchema,
  loadMode: LoadModeSchema.nullable().optional(),
  repMode: RepModeSchema.nullable().optional(),
  aliases: z.array(z.string()),
}).passthrough();

export const ProfileSchema = z.object({
  name: z.string().min(1),
  goal: z.string(),
  days: z.number().int().min(1).max(7),
  experience: z.enum(["beginner", "intermediate", "advanced"]),
  equipment: z.record(z.string(), z.boolean()),
  equipmentProfileVersion: z.number().int().nonnegative(),
  showMachineExercises: z.boolean(),
  loadIncrementKg: z.number().positive(),
  locale: z.string(),
  units: z.enum(["kg", "lb"]),
}).passthrough();

const TargetRangeSchema = z.tuple([z.number().nonnegative(), z.number().positive()])
  .refine(([minimum, maximum]) => maximum >= minimum, "Target maximum must be at least the minimum");

export const TargetsSchema = z.object(Object.fromEntries(
  MUSCLES.map((muscle) => [muscle, TargetRangeSchema]),
) as Record<(typeof MUSCLES)[number], typeof TargetRangeSchema>);

export const ImportBatchSchema = z.object({
  id: z.string().min(1),
  importedAt: z.string().nullable(),
  fileName: z.string(),
  source: z.string(),
  kind: z.enum(["nutrition", "workouts"]),
  workoutCount: z.number().int().nonnegative(),
  dayCount: z.number().int().nonnegative(),
  scope: z.enum(["recent", "all"]),
  mode: z.enum(["merge", "replace"]),
  added: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  unchanged: z.number().int().nonnegative(),
  conflicted: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  affectedDates: z.array(DateKeySchema),
}).passthrough();

export const LiftwiseDataSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  profile: ProfileSchema,
  targets: TargetsSchema,
  customExercises: z.array(CustomExerciseSchema).default([]),
  routines: z.array(RoutineSchema).default([]),
  routineRevisions: z.array(RoutineRevisionSchema).default([]),
  optimizationPreferences: OptimizationPreferencesSchema.default({
    enabled: true,
    objective: "simplify",
    maxVisibleOpportunities: 3,
    protectedExerciseIds: [],
    suppressedRelationshipIds: [],
    snoozedOpportunityIds: {},
  }),
  importAliases: z.record(z.string(), z.string()).default({}),
  exercisePreferences: z.record(z.string(), LooseRecordSchema).default({}),
  favoriteExercises: z.array(z.string()).default([]),
  libraryPreferences: z.object({
    availableOnly: z.boolean(),
    density: z.enum(["comfortable", "compact"]),
    sort: z.enum(["recent", "alphabetical", "catalog"]),
  }).passthrough(),
  importBatches: z.array(ImportBatchSchema).default([]),
  bodyMetrics: z.array(BodyMetricSchema).default([]),
  nutritionDays: z.array(NutritionDaySchema).default([]),
  recoveryCheckins: z.array(RecoveryCheckinSchema).default([]),
  integrations: z.object({
    garmin: z.object({
      status: z.string(),
      lastSyncAt: z.string().nullable(),
    }).passthrough(),
    fitatu: z.object({
      status: z.string(),
      lastImportAt: z.string().nullable(),
      lastFileName: z.string().nullable(),
    }).passthrough(),
  }).passthrough(),
  appMeta: z.object({
    lastBackupAt: z.string().nullable(),
    lastSavedAt: z.string().nullable(),
  }).passthrough(),
  workouts: z.array(WorkoutSchema),
}).passthrough();

export type LiftwiseData = z.infer<typeof LiftwiseDataSchema>;
export type Workout = z.infer<typeof WorkoutSchema>;
export type WorkoutEntry = z.infer<typeof WorkoutEntrySchema>;
export type WorkoutSet = z.infer<typeof WorkoutSetSchema>;
export type Routine = z.infer<typeof RoutineSchema>;
export type RoutineRevision = z.infer<typeof RoutineRevisionSchema>;
export type OptimizationPreferences = z.infer<typeof OptimizationPreferencesSchema>;
export type NutritionDay = z.infer<typeof NutritionDaySchema>;
export type RecoveryCheckin = z.infer<typeof RecoveryCheckinSchema>;
export type Muscle = (typeof MUSCLES)[number];
