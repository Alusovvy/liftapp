import * as Domain from "./domain.js";
import { bindImportChooser } from "./ui/import-chooser.js";

/* Liftwise keeps its data local and its coaching calculations explainable. */
const STORAGE_KEY = "liftwise-data-v1";
const RECOVERY_KEY = "liftwise-data-recovery-v7";
const CORRUPT_KEY = "liftwise-data-corrupt";
const IMPORT_UNDO_KEY = "liftwise-import-undo";
const WORKOUT_DRAFT_KEY = "liftwise-workout-draft";
const VIEW_STATE_KEY = "liftwise-view-state";
const SCHEMA_VERSION = Domain.SCHEMA_VERSION;
const MUSCLES = ["Chest", "Back", "Quads", "Hamstrings", "Glutes", "Shoulders", "Biceps", "Triceps", "Calves", "Core"];
const DEFAULT_TARGETS = {
  Chest: [8, 14], Back: [10, 16], Quads: [8, 14], Hamstrings: [8, 14], Glutes: [6, 12],
  Shoulders: [8, 14], Biceps: [6, 12], Triceps: [6, 12], Calves: [6, 12], Core: [4, 10],
};
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EQUIPMENT_OPTIONS = [
  { id: "dumbbells", label: "Dumbbells", defaultValue: true },
  { id: "barbell", label: "Barbell", defaultValue: true },
  { id: "bench", label: "Flat bench", defaultValue: true },
  { id: "pullupDipBar", label: "Pull-up / dip bar", defaultValue: true },
  { id: "squatRack", label: "Squat / bench rack or stands", defaultValue: false },
  { id: "inclineBench", label: "Adjustable / incline bench", defaultValue: false },
  { id: "machine", label: "Cable or selectorized machines", defaultValue: false },
];
const DEFAULT_EQUIPMENT = Object.fromEntries(EQUIPMENT_OPTIONS.map((item) => [item.id, item.defaultValue]));
const EQUIPMENT_PROFILE_VERSION = 3;
const DEFAULT_LOAD_INCREMENT_KG = 2.5;
const MAX_VOLUME_ADJUSTMENT_SETS = 3;
const MAX_MANUAL_EXERCISES = 20;
const MAX_MANUAL_SETS_PER_EXERCISE = 20;
const MAX_STORED_EXERCISES_PER_WORKOUT = 200;
const MAX_STORED_SETS_PER_EXERCISE = 500;
const MAX_BACKUP_WORKOUTS = 10000;
const MAX_BACKUP_CUSTOM_EXERCISES = 500;
const MAX_BACKUP_NUTRITION_DAYS = 20000;
const MAX_BACKUP_BYTES = 25_000_000;
const MAX_CSV_BYTES = 10_000_000;
const MAX_CSV_ROWS = 100_000;
const MAX_IMPORT_HISTORY = 30;
const WORKOUT_PAGE_SIZE = 30;
const LIBRARY_PAGE_SIZE = 36;
const PROGRESSION_COMPARISON_DAYS = 28;
const MUSCLE_MAP_WINDOW_DAYS = 7;
const MUSCLE_MAP_PROGRESS_LOOKBACK_DAYS = 21;
const MUSCLE_MAP_STALL_LOOKBACK_DAYS = 42;
const MUSCLE_MAP_STALL_MIN_SPAN_DAYS = 21;
const GARMIN_DEVELOPER_PROGRAM_URL = "https://developer.garmin.com/gc-developer-program/";

const exerciseLibrary = [
  { id: "bench-press", name: "Barbell Bench Press", short: "BP", primary: ["Chest"], secondary: ["Triceps", "Shoulders"], pattern: "Horizontal push", type: "Compound", difficulty: "Intermediate", range: [6, 10], icon: "↔", note: "A stable horizontal press. Use it only when your bench/rack setup lets you unrack and rerack safely.", equipment: ["barbell", "bench", "squatRack"], swapId: "db-bench" },
  { id: "db-bench", name: "Dumbbell Bench Press", short: "DB", primary: ["Chest"], secondary: ["Triceps", "Shoulders"], pattern: "Horizontal push", type: "Compound", difficulty: "Beginner-friendly", range: [8, 12], icon: "↔", note: "A free-hand-path press that is simple to load progressively at home.", equipment: ["dumbbells", "bench"], swapId: "bench-press" },
  { id: "incline-db", name: "Incline Dumbbell Bench Press", short: "IP", primary: ["Chest"], secondary: ["Shoulders", "Triceps"], pattern: "Incline push", type: "Compound", difficulty: "Intermediate", range: [8, 12], icon: "↗", note: "A practical incline press when you have a securely adjustable bench.", equipment: ["dumbbells", "inclineBench"], swapId: "db-bench" },
  { id: "db-chest-fly", name: "Dumbbell Chest Fly", short: "CF", primary: ["Chest"], secondary: ["Shoulders"], pattern: "Chest isolation", type: "Isolation", difficulty: "Intermediate", range: [8, 15], icon: "↔", note: "A dumbbell chest isolation movement. Use a controlled range that stays comfortable at the shoulder.", equipment: ["dumbbells", "bench"], swapId: "db-bench" },
  { id: "push-up", name: "Push-up", short: "PU", primary: ["Chest"], secondary: ["Triceps", "Shoulders"], pattern: "Horizontal push", type: "Compound", difficulty: "Beginner-friendly", range: [8, 20], icon: "↔", note: "A bodyweight horizontal press that can be progressed with tempo, range, or external load.", equipment: [], swapId: "db-bench" },
  { id: "decline-push-up", name: "Decline Push-up", short: "DP", primary: ["Chest"], secondary: ["Triceps", "Shoulders"], pattern: "Decline push", type: "Compound", difficulty: "Intermediate", range: [6, 15], icon: "↗", note: "A feet-elevated push-up. Keep the trunk stable and use a secure support.", equipment: ["bench"], swapId: "push-up" },
  { id: "cable-row", name: "Seated Cable Row", short: "CR", primary: ["Back"], secondary: ["Biceps"], pattern: "Horizontal pull", type: "Compound", difficulty: "Beginner-friendly", range: [8, 12], icon: "←", note: "A cable-supported horizontal pull for lats, upper back, and biceps.", equipment: ["machine"], machine: true, homeReplacementId: "one-arm-db-row", swapId: "one-arm-db-row" },
  { id: "chest-row", name: "Chest-Supported Dumbbell Row", short: "SR", primary: ["Back"], secondary: ["Biceps"], pattern: "Horizontal pull", type: "Compound", difficulty: "Beginner-friendly", range: [8, 12], icon: "←", note: "An incline-bench row that limits lower-back fatigue and supports repeatable technique.", equipment: ["dumbbells", "inclineBench"], swapId: "one-arm-db-row" },
  { id: "one-arm-db-row", name: "One-Arm Dumbbell Row", short: "OR", primary: ["Back"], secondary: ["Biceps"], pattern: "Horizontal pull", type: "Compound", difficulty: "Beginner-friendly", range: [8, 15], icon: "←", note: "Brace one hand on your bench and use a controlled pull through a comfortable range.", equipment: ["dumbbells", "bench"], swapId: "pull-up" },
  { id: "landmine-row", name: "Landmine Row", short: "LM", primary: ["Back"], secondary: ["Biceps"], pattern: "Horizontal pull", type: "Compound", difficulty: "Intermediate", range: [8, 15], icon: "←", note: "A barbell row using a securely anchored landmine setup. Keep the torso position repeatable.", equipment: ["barbell"], swapId: "one-arm-db-row" },
  { id: "lat-pulldown", name: "Lat Pulldown", short: "LP", primary: ["Back"], secondary: ["Biceps"], pattern: "Vertical pull", type: "Compound", difficulty: "Beginner-friendly", range: [8, 12], icon: "↓", note: "A cable vertical pull for the lats and elbow flexors.", equipment: ["machine"], machine: true, homeReplacementId: "pull-up", swapId: "pull-up" },
  { id: "pull-up", name: "Pull-up", short: "PU", primary: ["Back"], secondary: ["Biceps"], pattern: "Vertical pull", type: "Compound", difficulty: "Scalable", range: [5, 10], icon: "↓", note: "Use full reps, controlled negatives, or a foot-assisted setup on your pull-up bar.", equipment: ["pullupDipBar"], swapId: "one-arm-db-row" },
  { id: "back-squat", name: "Back Squat", short: "SQ", primary: ["Quads"], secondary: ["Glutes", "Core"], pattern: "Squat", type: "Compound", difficulty: "Intermediate", range: [6, 10], icon: "⌄", note: "Requires actual squat stands or a rack. A bench-press setup alone is not assumed to be safe for this lift.", equipment: ["barbell", "squatRack"], swapId: "goblet-squat" },
  { id: "leg-press", name: "Leg Press", short: "LG", primary: ["Quads"], secondary: ["Glutes"], pattern: "Squat", type: "Compound", difficulty: "Beginner-friendly", range: [8, 15], icon: "⌄", note: "A machine squat-pattern option for adding quad work with less balance demand.", equipment: ["machine"], machine: true, homeReplacementId: "split-squat", swapId: "split-squat" },
  { id: "goblet-squat", name: "Goblet Squat", short: "GS", primary: ["Quads"], secondary: ["Glutes", "Core"], pattern: "Squat", type: "Compound", difficulty: "Beginner-friendly", range: [8, 15], icon: "⌄", note: "A home-friendly squat pattern with one dumbbell and no squat rack required.", equipment: ["dumbbells"], swapId: "split-squat" },
  { id: "db-squat", name: "Dumbbell Squat", short: "DS", primary: ["Quads"], secondary: ["Glutes", "Core"], pattern: "Squat", type: "Compound", difficulty: "Beginner-friendly", range: [8, 15], icon: "⌄", note: "A squat performed with one or two dumbbells using a stable, repeatable stance.", equipment: ["dumbbells"], swapId: "goblet-squat" },
  { id: "sumo-squat", name: "Sumo Squat", short: "SS", primary: ["Glutes", "Quads"], secondary: ["Hamstrings"], pattern: "Squat", type: "Compound", difficulty: "Beginner-friendly", range: [8, 20], icon: "⌄", note: "A wide-stance squat performed through a comfortable hip and knee range.", equipment: [], swapId: "goblet-squat" },
  { id: "split-squat", name: "Bulgarian Split Squat", short: "BS", primary: ["Quads", "Glutes"], secondary: [], pattern: "Single-leg squat", type: "Compound", difficulty: "Intermediate", range: [8, 12], icon: "◐", note: "A unilateral lower-body pattern that uses your bench and dumbbells without a rack.", equipment: ["dumbbells", "bench"], swapId: "goblet-squat" },
  { id: "lunge", name: "Bodyweight Lunge", short: "LU", primary: ["Quads", "Glutes"], secondary: ["Core"], pattern: "Single-leg squat", type: "Compound", difficulty: "Beginner-friendly", range: [8, 15], icon: "◐", note: "A bodyweight unilateral leg exercise. Use a step length and depth you can control.", equipment: [], swapId: "split-squat" },
  { id: "db-lunge", name: "Dumbbell Lunge", short: "DL", primary: ["Quads", "Glutes"], secondary: ["Core"], pattern: "Single-leg squat", type: "Compound", difficulty: "Intermediate", range: [8, 15], icon: "◐", note: "A loaded unilateral leg exercise with dumbbells held in a stable position.", equipment: ["dumbbells"], swapId: "split-squat" },
  { id: "pause-squat", name: "Paused Barbell Squat", short: "PS", primary: ["Quads"], secondary: ["Glutes", "Core"], pattern: "Squat", type: "Compound", difficulty: "Advanced", range: [4, 8], icon: "⌄", note: "A barbell squat with a controlled pause at the bottom. Use a secure rack and a load that keeps the paused position stable.", equipment: ["barbell", "squatRack"], swapId: "back-squat" },
  { id: "barbell-deadlift", name: "Barbell Deadlift", short: "BD", primary: ["Hamstrings", "Glutes"], secondary: ["Back", "Core"], pattern: "Hinge", type: "Compound", difficulty: "Intermediate", range: [3, 8], icon: "⌟", note: "A barbell floor pull. Use a setup and load that keep the start position and bar path repeatable.", equipment: ["barbell"], swapId: "rdl" },
  { id: "db-deadlift", name: "Dumbbell Deadlift", short: "DD", primary: ["Hamstrings", "Glutes"], secondary: ["Back", "Core"], pattern: "Hinge", type: "Compound", difficulty: "Beginner-friendly", range: [6, 12], icon: "⌟", note: "A dumbbell floor pull that trains the hip hinge with a flexible hand path.", equipment: ["dumbbells"], swapId: "rdl" },
  { id: "rdl", name: "Romanian Deadlift", short: "RD", primary: ["Hamstrings"], secondary: ["Glutes", "Back"], pattern: "Hinge", type: "Compound", difficulty: "Intermediate", range: [6, 10], icon: "⌟", note: "A hip hinge that gives hamstrings a long-range loading stimulus with a barbell or dumbbells.", equipmentAny: ["barbell", "dumbbells"], swapId: "hip-thrust" },
  { id: "leg-curl", name: "Seated Leg Curl", short: "LC", primary: ["Hamstrings"], secondary: [], pattern: "Knee flexion", type: "Isolation", difficulty: "Beginner-friendly", range: [10, 15], icon: "⌒", note: "A direct knee-flexion hamstring exercise performed on a machine.", equipment: ["machine"], machine: true, homeReplacementId: "rdl", swapId: "rdl" },
  { id: "hip-thrust", name: "Hip Thrust", short: "HT", primary: ["Glutes"], secondary: ["Hamstrings"], pattern: "Hip extension", type: "Compound", difficulty: "Intermediate", range: [8, 12], icon: "⌜", note: "A glute-focused hip extension using your bench and a barbell or dumbbell.", equipment: ["bench"], equipmentAny: ["barbell", "dumbbells"], swapId: "rdl" },
  { id: "glute-bridge", name: "Glute Bridge", short: "GB", primary: ["Glutes"], secondary: ["Hamstrings"], pattern: "Hip extension", type: "Isolation", difficulty: "Beginner-friendly", range: [10, 20], icon: "⌜", note: "A floor-based hip extension. Keep the rib cage and pelvis controlled at lockout.", equipment: [], swapId: "hip-thrust" },
  { id: "lateral-leg-raise", name: "Lateral Leg Raise", short: "LL", primary: ["Glutes"], secondary: [], pattern: "Hip abduction", type: "Isolation", difficulty: "Beginner-friendly", range: [12, 25], icon: "◐", note: "A side-lying or standing hip-abduction exercise performed without rotating the pelvis.", equipment: [], swapId: "clamshell" },
  { id: "ohp", name: "Overhead Press", short: "OP", primary: ["Shoulders"], secondary: ["Triceps"], pattern: "Vertical push", type: "Compound", difficulty: "Intermediate", range: [6, 10], icon: "↑", note: "A standing dumbbell or barbell vertical press for shoulders and triceps.", equipmentAny: ["barbell", "dumbbells"], swapId: "db-lateral-raise" },
  { id: "db-shoulder-press", name: "Dumbbell Shoulder Press", short: "SP", primary: ["Shoulders"], secondary: ["Triceps"], pattern: "Vertical push", type: "Compound", difficulty: "Beginner-friendly", range: [8, 12], icon: "↑", note: "A dumbbell vertical press using a standing or securely supported seated position.", equipment: ["dumbbells"], swapId: "ohp" },
  { id: "lateral-raise", name: "Cable Lateral Raise", short: "LR", primary: ["Shoulders"], secondary: [], pattern: "Shoulder isolation", type: "Isolation", difficulty: "Beginner-friendly", range: [10, 20], icon: "↗", note: "A cable lateral-delt isolation movement.", equipment: ["machine"], machine: true, homeReplacementId: "db-lateral-raise", swapId: "db-lateral-raise" },
  { id: "db-lateral-raise", name: "Dumbbell Lateral Raise", short: "DL", primary: ["Shoulders"], secondary: [], pattern: "Shoulder isolation", type: "Isolation", difficulty: "Beginner-friendly", range: [10, 20], icon: "↗", note: "A direct lateral-delt option at home; use controlled reps and the smallest useful dumbbell jump.", equipment: ["dumbbells"], swapId: "ohp" },
  { id: "rear-delt-fly", name: "Reverse Pec Deck", short: "RF", primary: ["Shoulders"], secondary: ["Back"], pattern: "Rear-delt isolation", type: "Isolation", difficulty: "Beginner-friendly", range: [10, 20], icon: "↖", note: "A machine rear-delt movement with stable chest support.", equipment: ["machine"], machine: true, homeReplacementId: "db-rear-delt-fly", swapId: "db-rear-delt-fly" },
  { id: "db-rear-delt-fly", name: "Bent-Over Dumbbell Rear-Delt Fly", short: "DF", primary: ["Shoulders"], secondary: ["Back"], pattern: "Rear-delt isolation", type: "Isolation", difficulty: "Beginner-friendly", range: [10, 20], icon: "↖", note: "A home rear-delt option. Use a light load and keep the torso position stable.", equipment: ["dumbbells"], swapId: "one-arm-db-row" },
  { id: "shrug", name: "Dumbbell / Barbell Shrug", short: "SH", primary: ["Back"], secondary: ["Shoulders"], pattern: "Scapular elevation", type: "Isolation", difficulty: "Beginner-friendly", range: [8, 15], icon: "↑", note: "Elevate and lower the shoulder blades under control without rolling the shoulders.", equipmentAny: ["dumbbells", "barbell"], swapId: "one-arm-db-row" },
  { id: "curl", name: "Dumbbell Curl", short: "DC", primary: ["Biceps"], secondary: [], pattern: "Elbow flexion", type: "Isolation", difficulty: "Beginner-friendly", range: [8, 15], icon: "⌇", note: "A direct biceps option that is easy to tailor to adjustable dumbbells.", equipment: ["dumbbells"], swapId: "pull-up" },
  { id: "barbell-curl", name: "Barbell Curl", short: "BC", primary: ["Biceps"], secondary: [], pattern: "Elbow flexion", type: "Isolation", difficulty: "Beginner-friendly", range: [8, 15], icon: "⌇", note: "A bilateral biceps curl. Keep the torso stable and use a comfortable grip width.", equipment: ["barbell"], swapId: "curl" },
  { id: "21s-curl", name: "21s Bicep Curl", short: "21", primary: ["Biceps"], secondary: [], pattern: "Elbow flexion", type: "Isolation", difficulty: "Intermediate", range: [6, 21], icon: "⌇", note: "A curl sequence using partial and full-range segments. Keep the repetition convention consistent with your existing history.", equipmentAny: ["dumbbells", "barbell"], swapId: "curl" },
  { id: "concentration-curl", name: "Concentration Curl", short: "CC", primary: ["Biceps"], secondary: [], pattern: "Elbow flexion", type: "Isolation", difficulty: "Beginner-friendly", range: [8, 15], icon: "⌇", note: "A supported single-arm curl that limits torso movement.", equipment: ["dumbbells"], swapId: "curl" },
  { id: "behind-back-wrist-curl", name: "Behind-the-Back Barbell Wrist Curl", short: "WC", primary: [], secondary: [], pattern: "Wrist flexion", type: "Isolation", difficulty: "Beginner-friendly", range: [10, 20], icon: "⌇", note: "A forearm exercise performed with a barbell behind the body. It is loggable but outside the current ten-muscle coverage model.", equipment: ["barbell"], swapId: "" },
  { id: "behind-back-bicep-wrist-curl", name: "Behind-the-Back Barbell Bicep Wrist Curl", short: "BW", primary: [], secondary: [], pattern: "Wrist flexion", type: "Isolation", difficulty: "Beginner-friendly", range: [10, 20], icon: "⌇", note: "A custom wrist-curl variation from the imported history. It is loggable but outside the current ten-muscle coverage model.", equipment: ["barbell"], swapId: "behind-back-wrist-curl" },
  { id: "pressdown", name: "Cable Pressdown", short: "CP", primary: ["Triceps"], secondary: [], pattern: "Elbow extension", type: "Isolation", difficulty: "Beginner-friendly", range: [10, 15], icon: "⌄", note: "A cable triceps isolation movement.", equipment: ["machine"], machine: true, homeReplacementId: "db-triceps-extension", swapId: "db-triceps-extension" },
  { id: "db-triceps-extension", name: "Dumbbell Overhead Triceps Extension", short: "TE", primary: ["Triceps"], secondary: [], pattern: "Elbow extension", type: "Isolation", difficulty: "Beginner-friendly", range: [10, 15], icon: "⌄", note: "A direct triceps option with a dumbbell; keep the elbow position comfortable.", equipment: ["dumbbells"], swapId: "dip" },
  { id: "dip", name: "Triceps Dip", short: "DP", primary: ["Triceps"], secondary: ["Chest", "Shoulders"], pattern: "Dip", type: "Compound", difficulty: "Intermediate", range: [6, 12], icon: "↕", note: "Use your dip bars only through a comfortable shoulder range and with a controlled tempo.", equipment: ["pullupDipBar"], swapId: "db-triceps-extension" },
  { id: "calf-raise", name: "Dumbbell Standing Calf Raise", short: "CA", primary: ["Calves"], secondary: [], pattern: "Ankle extension", type: "Isolation", difficulty: "Beginner-friendly", range: [8, 15], icon: "⌃", note: "A direct calf movement; hold dumbbells and use a controlled pause in a comfortable range.", equipment: ["dumbbells"], swapId: "split-squat" },
  { id: "standing-calf-raise", name: "Standing Calf Raise", short: "CA", primary: ["Calves"], secondary: [], pattern: "Ankle extension", type: "Isolation", difficulty: "Beginner-friendly", range: [10, 20], icon: "⌃", note: "A bodyweight standing calf raise with a controlled stretch and pause.", equipment: [], swapId: "calf-raise" },
  { id: "barbell-single-leg-calf-raise", name: "Barbell Single-Leg Standing Calf Raise", short: "SC", primary: ["Calves"], secondary: ["Core"], pattern: "Ankle extension", type: "Isolation", difficulty: "Advanced", range: [8, 15], icon: "⌃", note: "A loaded unilateral calf raise. Use a secure setup and support for balance.", equipment: ["barbell", "squatRack"], swapId: "calf-raise" },
  { id: "plank", name: "Cable Pallof Press", short: "PP", primary: ["Core"], secondary: [], pattern: "Anti-rotation", type: "Isolation", difficulty: "Beginner-friendly", range: [10, 15], icon: "⊹", note: "A cable anti-rotation trunk exercise.", equipment: ["machine"], machine: true, homeReplacementId: "dead-bug", swapId: "dead-bug" },
  { id: "dead-bug", name: "Dead Bug", short: "DG", primary: ["Core"], secondary: [], pattern: "Trunk control", type: "Isolation", difficulty: "Beginner-friendly", range: [8, 15], icon: "⊹", note: "A bodyweight trunk-control drill that fits a no-machine home setup.", equipment: [], swapId: "pull-up" },
  { id: "plank-hold", name: "Plank", short: "PL", primary: ["Core"], secondary: ["Shoulders"], pattern: "Anti-extension", type: "Isolation", difficulty: "Beginner-friendly", range: [1, 5], icon: "⊹", note: "A timed isometric trunk hold. Use the duration field when importing or tracking time-based sets.", equipment: [], swapId: "dead-bug" },
  { id: "crunch", name: "Crunch", short: "CR", primary: ["Core"], secondary: [], pattern: "Trunk flexion", type: "Isolation", difficulty: "Beginner-friendly", range: [10, 25], icon: "⊹", note: "A controlled spinal-flexion exercise performed without pulling on the neck.", equipment: [], swapId: "dead-bug" },
  { id: "flutter-kicks", name: "Flutter Kicks", short: "FK", primary: ["Core"], secondary: [], pattern: "Trunk flexion", type: "Isolation", difficulty: "Beginner-friendly", range: [10, 30], icon: "⊹", note: "Alternating leg kicks performed while keeping the pelvis and lower back controlled.", equipment: [], swapId: "ab-scissors" },
  { id: "heel-taps", name: "Heel Taps", short: "HT", primary: ["Core"], secondary: [], pattern: "Lateral trunk flexion", type: "Isolation", difficulty: "Beginner-friendly", range: [10, 30], icon: "⊹", note: "Alternating side reaches toward the heels while maintaining a controlled trunk position.", equipment: [], swapId: "crunch" },
  { id: "lying-leg-raise", name: "Lying Leg Raise", short: "LL", primary: ["Core"], secondary: [], pattern: "Trunk flexion", type: "Isolation", difficulty: "Intermediate", range: [8, 20], icon: "⌃", note: "A floor-based leg raise performed while controlling the pelvis and lower back.", equipment: [], swapId: "parallel-bar-leg-raise" },
  { id: "weighted-russian-twist", name: "Weighted Russian Twist", short: "RT", primary: ["Core"], secondary: [], pattern: "Trunk rotation", type: "Isolation", difficulty: "Intermediate", range: [10, 30], icon: "↔", note: "A loaded trunk-rotation exercise. Use a range you can control without forcing the lower back.", equipment: ["dumbbells"], swapId: "dead-bug" },
  { id: "bird-dog", name: "Bird Dog", short: "BD", primary: ["Core"], secondary: ["Glutes", "Back"], pattern: "Trunk control", type: "Isolation", difficulty: "Beginner-friendly", range: [8, 15], icon: "⊹", note: "A quadruped trunk-control drill. Reach opposite arm and leg while keeping the pelvis and rib cage steady.", equipment: [], swapId: "dead-bug" },
  { id: "ab-scissors", name: "Ab Scissors", short: "AS", primary: ["Core"], secondary: [], pattern: "Trunk flexion", type: "Isolation", difficulty: "Beginner-friendly", range: [10, 20], icon: "✂", note: "Alternate the legs while keeping the lower back and pelvis in a controlled position.", equipment: [], swapId: "dead-bug" },
  { id: "parallel-bar-leg-raise", name: "Parallel Bar Leg Raise", short: "LR", primary: ["Core"], secondary: ["Shoulders"], pattern: "Trunk flexion", type: "Compound", difficulty: "Intermediate", range: [6, 15], icon: "⌃", note: "Support yourself on parallel bars and raise the legs without using momentum or losing shoulder position.", equipment: ["pullupDipBar"], swapId: "ab-scissors" },
  { id: "clamshell", name: "Clamshell", short: "CL", primary: ["Glutes"], secondary: [], pattern: "Hip abduction", type: "Isolation", difficulty: "Beginner-friendly", range: [12, 25], icon: "◐", note: "A side-lying glute exercise. Keep the pelvis stacked while opening the top knee.", equipment: [], swapId: "frog-pump" },
  { id: "frog-pump", name: "Frog Pump", short: "FP", primary: ["Glutes"], secondary: ["Hamstrings"], pattern: "Hip extension", type: "Isolation", difficulty: "Beginner-friendly", range: [12, 30], icon: "⌜", note: "A high-repetition glute bridge variation with the soles of the feet together and knees opened.", equipment: [], swapId: "hip-thrust" },
  { id: "lying-neck-curl", name: "Lying Neck Curl", short: "NC", primary: [], secondary: [], pattern: "Neck flexion", type: "Isolation", difficulty: "Beginner-friendly", range: [10, 20], icon: "⌒", note: "Use a very light, controlled range. This movement is loggable but is not included in Liftwise’s current ten-muscle coverage model.", equipment: ["bench"], swapId: "" },
];

const byExerciseId = Object.fromEntries(exerciseLibrary.map((exercise) => [exercise.id, exercise]));
const HEVY_ALIASES = {
  "bench press barbell": "bench-press",
  "flat bench press barbell": "bench-press",
  "bench press dumbbell": "db-bench",
  "incline bench press dumbbell": "incline-db",
  "incline dumbbell bench press": "incline-db",
  "incline dumbbell press": "incline-db",
  "chest fly dumbbell": "db-chest-fly",
  "push up": "push-up",
  "decline push up": "decline-push-up",
  "seated cable row": "cable-row",
  "cable row seated": "cable-row",
  "chest supported row dumbbell": "chest-row",
  "one arm dumbbell row": "one-arm-db-row",
  "dumbbell row": "one-arm-db-row",
  "landmine row": "landmine-row",
  "lat pulldown cable": "lat-pulldown",
  "pull up": "pull-up",
  "negative pull up": "pull-up",
  "assisted pull up": "pull-up",
  "squat barbell": "back-squat",
  "back squat barbell": "back-squat",
  "squat dumbbell": "db-squat",
  "sumo squat": "sumo-squat",
  "pause squat barbell": "pause-squat",
  "paused squat barbell": "pause-squat",
  "lunge": "lunge",
  "lunge dumbbell": "db-lunge",
  "leg press machine": "leg-press",
  "bulgarian split squat dumbbell": "split-squat",
  "deadlift barbell": "barbell-deadlift",
  "deadlift dumbbell": "db-deadlift",
  "romanian deadlift barbell": "rdl",
  "romanian deadlift dumbbell": "rdl",
  "seated leg curl machine": "leg-curl",
  "hip thrust barbell": "hip-thrust",
  "glute bridge": "glute-bridge",
  "lateral leg raises": "lateral-leg-raise",
  "overhead press barbell": "ohp",
  "shoulder press barbell": "ohp",
  "shoulder press dumbbell": "db-shoulder-press",
  "lateral raise cable": "lateral-raise",
  "lateral raise dumbbell": "db-lateral-raise",
  "reverse pec deck machine": "rear-delt-fly",
  "rear delt fly dumbbell": "db-rear-delt-fly",
  "bicep curl dumbbell": "curl",
  "21s bicep curl": "21s-curl",
  "bicep curl barbell": "barbell-curl",
  "barbell bicep curl": "barbell-curl",
  "barbell curl": "barbell-curl",
  "concentration curl": "concentration-curl",
  "behind the back wrist curl barbell": "behind-back-wrist-curl",
  "behind the back bicep wrist curl barbell": "behind-back-bicep-wrist-curl",
  "triceps pushdown cable straight bar": "pressdown",
  "triceps pushdown cable": "pressdown",
  "triceps extension dumbbell": "db-triceps-extension",
  "dip bodyweight": "dip",
  "triceps dip": "dip",
  "bar dip": "dip",
  "standing calf raise": "standing-calf-raise",
  "standing calf raise dumbbell": "calf-raise",
  "dumbbell standing calf raise": "calf-raise",
  "standing calf raise machine": "calf-raise",
  "single leg standing calf raise barbell": "barbell-single-leg-calf-raise",
  "pallof press cable": "plank",
  "dead bug": "dead-bug",
  "plank": "plank-hold",
  "crunch": "crunch",
  "flutter kicks": "flutter-kicks",
  "heel taps": "heel-taps",
  "lying leg raise": "lying-leg-raise",
  "russian twist weighted": "weighted-russian-twist",
  "bird dog": "bird-dog",
  "ab scissors": "ab-scissors",
  "scissor kicks": "ab-scissors",
  "leg raise parallel bars": "parallel-bar-leg-raise",
  "parallel bars leg raise": "parallel-bar-leg-raise",
  "parallel bar leg raise": "parallel-bar-leg-raise",
  "clamshell": "clamshell",
  "frog pumps": "frog-pump",
  "frog pump": "frog-pump",
  "shrug": "shrug",
  "dumbbell shrug": "shrug",
  "shrug dumbbell": "shrug",
  "barbell shrug": "shrug",
  "lying neck curls": "lying-neck-curl",
  "lying neck curls weighted": "lying-neck-curl",
  "lying neck curl": "lying-neck-curl",
  "rear delt reverse fly dumbbell": "db-rear-delt-fly",
};

function dateAtOffset(daysAgo) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return toDateInput(date);
}

function createStarterData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: {
      name: "Alex",
      goal: "hypertrophy",
      days: 4,
      experience: "intermediate",
      equipment: { ...DEFAULT_EQUIPMENT },
      equipmentProfileVersion: EQUIPMENT_PROFILE_VERSION,
      showMachineExercises: false,
      loadIncrementKg: DEFAULT_LOAD_INCREMENT_KG,
      locale: "en",
      units: "kg",
    },
    targets: Object.fromEntries(MUSCLES.map((muscle) => [muscle, [...DEFAULT_TARGETS[muscle]]])),
    bodyMetrics: [],
    nutritionDays: [],
    recoveryCheckins: [],
    routines: [],
    importAliases: {},
    exercisePreferences: {},
    favoriteExercises: [],
    libraryPreferences: { availableOnly: true, density: "comfortable", sort: "recent" },
    importBatches: [],
    appMeta: { lastBackupAt: null, lastSavedAt: null },
    integrations: {
      garmin: { status: "setup-required", lastSyncAt: null },
      fitatu: { status: "not-imported", lastImportAt: null, lastFileName: null },
    },
    workouts: [
      { id: "seed-01", date: dateAtOffset(28), name: "Upper strength", duration: 63, notes: "Pressing felt smooth.", entries: [{ exerciseId: "db-bench", sets: 3, reps: 7, weight: 20, rir: 2 }, { exerciseId: "one-arm-db-row", sets: 3, reps: 9, weight: 22, rir: 2 }, { exerciseId: "ohp", sets: 2, reps: 7, weight: 32.5, rir: 2 }] },
      { id: "seed-02", date: dateAtOffset(25), name: "Lower A", duration: 59, notes: "", entries: [{ exerciseId: "goblet-squat", sets: 3, reps: 10, weight: 30, rir: 2 }, { exerciseId: "rdl", sets: 3, reps: 8, weight: 75, rir: 2 }, { exerciseId: "calf-raise", sets: 3, reps: 12, weight: 20, rir: 2 }] },
      { id: "seed-03", date: dateAtOffset(21), name: "Upper push", duration: 58, notes: "", entries: [{ exerciseId: "dip", sets: 3, reps: 8, weight: 0, rir: 2 }, { exerciseId: "db-bench", sets: 3, reps: 9, weight: 22, rir: 2 }, { exerciseId: "db-lateral-raise", sets: 3, reps: 14, weight: 7, rir: 2 }, { exerciseId: "db-triceps-extension", sets: 2, reps: 12, weight: 14, rir: 2 }] },
      { id: "seed-04", date: dateAtOffset(18), name: "Pull & posterior", duration: 61, notes: "", entries: [{ exerciseId: "pull-up", sets: 3, reps: 6, weight: 0, rir: 2 }, { exerciseId: "one-arm-db-row", sets: 3, reps: 10, weight: 22, rir: 2 }, { exerciseId: "hip-thrust", sets: 3, reps: 12, weight: 65, rir: 2 }, { exerciseId: "curl", sets: 2, reps: 11, weight: 12, rir: 2 }] },
      { id: "seed-05", date: dateAtOffset(14), name: "Upper A", duration: 65, notes: "Kept a rep in reserve.", entries: [{ exerciseId: "db-bench", sets: 3, reps: 8, weight: 24, rir: 1 }, { exerciseId: "one-arm-db-row", sets: 3, reps: 10, weight: 24, rir: 2 }, { exerciseId: "db-lateral-raise", sets: 3, reps: 15, weight: 7, rir: 2 }, { exerciseId: "db-triceps-extension", sets: 3, reps: 12, weight: 16, rir: 2 }] },
      { id: "seed-06", date: dateAtOffset(12), name: "Lower B", duration: 56, notes: "", entries: [{ exerciseId: "split-squat", sets: 3, reps: 11, weight: 18, rir: 2 }, { exerciseId: "rdl", sets: 3, reps: 9, weight: 80, rir: 1 }, { exerciseId: "hip-thrust", sets: 3, reps: 12, weight: 67.5, rir: 1 }, { exerciseId: "calf-raise", sets: 3, reps: 13, weight: 20, rir: 2 }] },
      { id: "seed-07", date: dateAtOffset(9), name: "Pull", duration: 52, notes: "", entries: [{ exerciseId: "pull-up", sets: 3, reps: 7, weight: 0, rir: 2 }, { exerciseId: "one-arm-db-row", sets: 3, reps: 10, weight: 24, rir: 1 }, { exerciseId: "db-rear-delt-fly", sets: 2, reps: 15, weight: 6, rir: 2 }, { exerciseId: "curl", sets: 2, reps: 12, weight: 12, rir: 2 }] },
      { id: "seed-08", date: dateAtOffset(5), name: "Lower A", duration: 58, notes: "Depth felt consistent.", entries: [{ exerciseId: "goblet-squat", sets: 3, reps: 12, weight: 30, rir: 2 }, { exerciseId: "rdl", sets: 3, reps: 8, weight: 82.5, rir: 1 }, { exerciseId: "calf-raise", sets: 3, reps: 14, weight: 20, rir: 2 }] },
      { id: "seed-09", date: dateAtOffset(3), name: "Upper pull", duration: 55, notes: "", entries: [{ exerciseId: "one-arm-db-row", sets: 3, reps: 11, weight: 24, rir: 1 }, { exerciseId: "pull-up", sets: 3, reps: 8, weight: 0, rir: 2 }, { exerciseId: "curl", sets: 2, reps: 12, weight: 12, rir: 1 }, { exerciseId: "db-rear-delt-fly", sets: 2, reps: 16, weight: 6, rir: 2 }] },
      { id: "seed-10", date: dateAtOffset(1), name: "Upper push", duration: 62, notes: "", entries: [{ exerciseId: "dip", sets: 3, reps: 9, weight: 0, rir: 1 }, { exerciseId: "db-bench", sets: 3, reps: 10, weight: 24, rir: 2 }, { exerciseId: "db-lateral-raise", sets: 3, reps: 16, weight: 7, rir: 2 }, { exerciseId: "db-triceps-extension", sets: 3, reps: 13, weight: 16, rir: 2 }] },
    ],
  };
}

function nullableNumber(value) {
  return Domain.numberOrNull(value);
}

function isValidDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime())
    && parsed.getFullYear() === Number(match[1])
    && parsed.getMonth() + 1 === Number(match[2])
    && parsed.getDate() === Number(match[3]);
}

function normalizeSet(set, index = 0, context = {}) {
  const type = String(set?.type || "normal").toLowerCase().replace(/[^a-z]/g, "");
  const measurementMode = Domain.MEASUREMENT_MODES.includes(set?.measurementMode)
    ? set.measurementMode
    : Number.isFinite(nullableNumber(set?.distanceMeters ?? set?.distance_meters))
      ? "distance_duration"
      : Number.isFinite(nullableNumber(set?.durationSeconds ?? set?.duration_seconds)) && !Number.isFinite(nullableNumber(set?.reps))
        ? "duration"
        : "load_reps";
  return Domain.normalizeEffortSet({
    index: nullableNumber(set?.index) ?? index,
    type: type === "warmupset" ? "warmup" : type === "dropset" ? "dropset" : type || "normal",
    weightKg: nullableNumber(set?.weightKg ?? set?.weight_kg ?? set?.weight),
    reps: nullableNumber(set?.reps),
    rawRpe: nullableNumber(set?.rawRpe ?? set?.rpe),
    explicitImportedRir: nullableNumber(set?.explicitImportedRir),
    manualRir: nullableNumber(set?.manualRir),
    manualRirCleared: set?.manualRirCleared === true,
    rir: nullableNumber(set?.rir),
    rirManual: set?.rirManual === true,
    distanceMeters: nullableNumber(set?.distanceMeters ?? set?.distance_meters),
    durationSeconds: nullableNumber(set?.durationSeconds ?? set?.duration_seconds),
    measurementMode,
    sourceSetId: set?.sourceSetId ? String(set.sourceSetId).slice(0, 240) : null,
  }, context);
}

function migrateEntry(entry, context = {}) {
  if (Array.isArray(entry?.sets)) {
    return {
      ...entry,
      exerciseId: String(entry.exerciseId || "").slice(0, 120),
      exerciseNotes: String(entry.exerciseNotes || "").slice(0, 2000),
      loadMode: Domain.LOAD_MODES.includes(entry.loadMode) ? entry.loadMode : null,
      repMode: Domain.REP_MODES.includes(entry.repMode) ? entry.repMode : null,
      measurementMode: Domain.MEASUREMENT_MODES.includes(entry.measurementMode) ? entry.measurementMode : null,
      sets: entry.sets.map((set, index) => normalizeSet(set, index, context)),
    };
  }
  const count = Math.min(MAX_STORED_SETS_PER_EXERCISE, Math.max(1, Math.round(nullableNumber(entry?.sets) ?? 1)));
  return {
    ...entry,
    exerciseId: String(entry?.exerciseId || "").slice(0, 120),
    exerciseNotes: String(entry?.exerciseNotes || "").slice(0, 2000),
    supersetId: entry.supersetId ?? null,
    sets: Array.from({ length: count }, (_, index) => normalizeSet({
      index,
      type: "normal",
      weightKg: entry.weight,
      reps: entry.reps,
      rir: entry.rir,
    }, index, context)),
  };
}

function normalizeCustomExercise(exercise, index = 0) {
  const primary = Array.isArray(exercise?.primary) ? [...new Set(exercise.primary.filter((muscle) => MUSCLES.includes(muscle)))] : [];
  const secondary = Array.isArray(exercise?.secondary) ? [...new Set(exercise.secondary.filter((muscle) => MUSCLES.includes(muscle) && !primary.includes(muscle)))] : [];
  const rawLow = Math.round(nullableNumber(exercise?.range?.[0]) ?? 8);
  const rawHigh = Math.round(nullableNumber(exercise?.range?.[1]) ?? 12);
  const low = Math.max(1, Math.min(100, rawLow));
  const high = Math.max(low, Math.min(100, rawHigh));
  const equipmentIds = new Set(EQUIPMENT_OPTIONS.map((item) => item.id));
  const normalizedEquipment = (value) => Array.isArray(value)
    ? [...new Set(value.filter((item) => equipmentIds.has(item)))]
    : [];
  const name = String(exercise?.name || `Custom exercise ${index + 1}`).trim().slice(0, 100) || `Custom exercise ${index + 1}`;
  return {
    ...exercise,
    id: String(exercise?.id || `custom-${simpleHash(`${name}-${index}`)}`).slice(0, 120),
    name,
    short: String(exercise?.short || name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")).trim().slice(0, 5).toUpperCase() || "EX",
    primary,
    secondary,
    pattern: String(exercise?.pattern || "Imported").slice(0, 80),
    type: String(exercise?.type || "Custom").slice(0, 40),
    difficulty: String(exercise?.difficulty || "Unmapped").slice(0, 40),
    range: [low, high],
    icon: String(exercise?.icon || "＋").slice(0, 4),
    note: String(exercise?.note || "Custom imported movement.").slice(0, 500),
    equipment: normalizedEquipment(exercise?.equipment),
    equipmentAny: normalizedEquipment(exercise?.equipmentAny),
    machine: Boolean(exercise?.machine),
    swapId: String(exercise?.swapId || "").slice(0, 120),
    homeReplacementId: String(exercise?.homeReplacementId || "").slice(0, 120),
    measurementMode: Domain.MEASUREMENT_MODES.includes(exercise?.measurementMode) ? exercise.measurementMode : "load_reps",
    loadMode: Domain.LOAD_MODES.includes(exercise?.loadMode) ? exercise.loadMode : null,
    repMode: Domain.REP_MODES.includes(exercise?.repMode) ? exercise.repMode : null,
    aliases: Array.isArray(exercise?.aliases)
      ? [...new Set(exercise.aliases.map((alias) => String(alias).trim().slice(0, 100)).filter(Boolean))].slice(0, 30)
      : [],
  };
}

function normalizeWorkout(workout, index = 0) {
  if (!workout || typeof workout !== "object" || Array.isArray(workout)) return null;
  const date = isValidDateKey(workout.date) && workout.date <= toDateInput(new Date()) ? String(workout.date) : null;
  if (!date) return null;
  const source = workout.source ? String(workout.source).slice(0, 80) : "manual";
  const entries = Array.isArray(workout.entries)
    ? workout.entries.map((entry) => migrateEntry(entry, { source })).filter((entry) => entry.exerciseId)
    : [];
  const duration = nullableNumber(workout.duration);
  const name = String(workout.name || "Untitled workout").trim().slice(0, 80) || "Untitled workout";
  return {
    ...workout,
    id: String(workout.id || `workout-${date}-${index}-${simpleHash(name)}`).slice(0, 160),
    date,
    name,
    duration: duration !== null && duration >= 0 && duration <= 1440 ? duration : 0,
    notes: String(workout.notes || workout.description || "").slice(0, 2000),
    entries,
    source,
    sourceIdentity: workout.sourceIdentity ? String(workout.sourceIdentity).slice(0, 240) : null,
    contentFingerprint: workout.contentFingerprint ? String(workout.contentFingerprint).slice(0, 120) : null,
    providerWorkoutId: workout.providerWorkoutId ? String(workout.providerWorkoutId).slice(0, 160) : null,
    legacyMerged: Boolean(workout.legacyMerged || (Array.isArray(workout.sourceKeys) && workout.sourceKeys.length > 1)),
    startTime: workout.startTime && !Number.isNaN(new Date(workout.startTime).getTime()) ? String(workout.startTime) : null,
    endTime: workout.endTime && !Number.isNaN(new Date(workout.endTime).getTime()) ? String(workout.endTime) : null,
  };
}

function normalizeBodyMetric(metric, index = 0) {
  const date = isValidDateKey(metric?.date) ? String(metric.date) : null;
  const weightKg = nullableNumber(metric?.weightKg ?? metric?.weight_kg ?? metric?.weight);
  const bodyFatPercent = nullableNumber(metric?.bodyFatPercent ?? metric?.body_fat_percent ?? metric?.bodyFat ?? metric?.body_fat);
  const validWeight = weightKg !== null && weightKg >= 20 && weightKg <= 500 ? weightKg : null;
  const validBodyFat = bodyFatPercent !== null && bodyFatPercent >= 1 && bodyFatPercent <= 100 ? bodyFatPercent : null;
  if (!date || date > toDateInput(new Date()) || (validWeight === null && validBodyFat === null)) return null;
  const source = metric?.source === "garmin" ? "garmin" : "manual";
  return {
    id: String(metric?.id || `body-${date}-${index}-${simpleHash(`${date}-${index}-${validWeight}-${validBodyFat}`)}`),
    date,
    weightKg: validWeight,
    bodyFatPercent: validBodyFat,
    source,
    sourceId: metric?.sourceId ? String(metric.sourceId) : null,
    condition: ["morning-fasted", "morning", "evening", "other"].includes(metric?.condition) ? metric.condition : "",
    note: String(metric?.note || "").slice(0, 500),
    recordedAt: metric?.recordedAt && !Number.isNaN(new Date(metric.recordedAt).getTime()) ? String(metric.recordedAt) : `${date}T12:00:00.000Z`,
  };
}

function normalizeBodyMetrics(metrics) {
  const seenGarminRecords = new Set();
  return metrics.map(normalizeBodyMetric).filter(Boolean).filter((metric) => {
    if (metric.source !== "garmin" || !metric.sourceId) return true;
    const key = `${metric.source}:${metric.sourceId}`;
    if (seenGarminRecords.has(key)) return false;
    seenGarminRecords.add(key);
    return true;
  });
}

function nutritionDayFingerprint(day) {
  return `nutrition:${simpleHash(Domain.stableStringify({
    date: day.date,
    caloriesKcal: nullableNumber(day.caloriesKcal),
    proteinG: nullableNumber(day.proteinG),
    carbsG: nullableNumber(day.carbsG),
    fatG: nullableNumber(day.fatG),
    fiberG: nullableNumber(day.fiberG),
  }))}`;
}

function normalizeNutritionDay(day, index = 0) {
  const date = isValidDateKey(day?.date) && day.date <= toDateInput(new Date()) ? String(day.date) : null;
  if (!date) return null;
  const bounded = (value, maximum) => {
    const parsed = nullableNumber(value);
    return parsed !== null && parsed >= 0 && parsed <= maximum ? Math.round(parsed * 100) / 100 : null;
  };
  const normalized = {
    id: String(day?.id || `fitatu-${date}`).slice(0, 160),
    date,
    caloriesKcal: bounded(day?.caloriesKcal ?? day?.calories, 20000),
    proteinG: bounded(day?.proteinG ?? day?.protein, 3000),
    carbsG: bounded(day?.carbsG ?? day?.carbs, 3000),
    fatG: bounded(day?.fatG ?? day?.fat, 3000),
    fiberG: bounded(day?.fiberG ?? day?.fiber, 1000),
    source: "fitatu-csv",
    sourceIdentity: `fitatu:${date}`,
    sourceRowCount: Math.max(1, Math.round(nullableNumber(day?.sourceRowCount ?? day?.rowCount) || 1)),
    aggregation: ["items", "daily-total", "total", "meal-totals"].includes(day?.aggregation) ? day.aggregation : "items",
    importBatchId: day?.importBatchId ? String(day.importBatchId).slice(0, 160) : null,
    importedAt: day?.importedAt && !Number.isNaN(new Date(day.importedAt).getTime())
      ? String(day.importedAt)
      : `${date}T12:00:00.000Z`,
  };
  if ([normalized.caloriesKcal, normalized.proteinG, normalized.carbsG, normalized.fatG, normalized.fiberG]
    .every((value) => value === null)) return null;
  normalized.contentFingerprint = nutritionDayFingerprint(normalized);
  return normalized;
}

function normalizeNutritionDays(days) {
  const byDate = new Map();
  (Array.isArray(days) ? days : []).map(normalizeNutritionDay).filter(Boolean).forEach((day) => {
    const current = byDate.get(day.date);
    if (!current || new Date(day.importedAt) >= new Date(current.importedAt)) byDate.set(day.date, day);
  });
  return [...byDate.values()].sort((first, second) => first.date.localeCompare(second.date));
}

function normalizeRecoveryCheckin(checkin, index = 0) {
  const date = isValidDateKey(checkin?.date) ? String(checkin.date) : null;
  const sleepHours = nullableNumber(checkin?.sleepHours);
  const energy = nullableNumber(checkin?.energy);
  const soreness = nullableNumber(checkin?.soreness);
  const stress = nullableNumber(checkin?.stress);
  if (!date || date > toDateInput(new Date())
    || sleepHours === null || sleepHours < 0 || sleepHours > 14
    || ![1, 2, 3, 4, 5].includes(energy)
    || ![1, 2, 3, 4, 5].includes(soreness)
    || ![1, 2, 3, 4, 5].includes(stress)) return null;
  return {
    id: String(checkin?.id || `recovery-${date}-${index}`),
    date,
    sleepHours: precision(sleepHours),
    energy,
    soreness,
    stress,
    painConcern: Boolean(checkin?.painConcern),
    note: String(checkin?.note || "").slice(0, 500),
    recordedAt: checkin?.recordedAt && !Number.isNaN(new Date(checkin.recordedAt).getTime())
      ? String(checkin.recordedAt)
      : `${date}T12:00:00.000Z`,
  };
}

function normalizeRecoveryCheckins(checkins) {
  const byDate = new Map();
  checkins.map(normalizeRecoveryCheckin).filter(Boolean).forEach((checkin) => {
    const current = byDate.get(checkin.date);
    if (!current || new Date(checkin.recordedAt) >= new Date(current.recordedAt)) byDate.set(checkin.date, checkin);
  });
  return [...byDate.values()].sort((a, b) => parseDate(a.date) - parseDate(b.date));
}

function migrateData(raw) {
  const storedProfile = raw?.profile || {};
  const storedIncrement = Number(storedProfile.loadIncrementKg);
  const storedEquipment = storedProfile.equipment || {};
  const storedEquipmentVersion = Number(storedProfile.equipmentProfileVersion) || 0;
  const storedTargets = raw?.targets || {};
  const targets = Object.fromEntries(MUSCLES.map((muscle) => {
    const fallback = DEFAULT_TARGETS[muscle];
    const candidate = storedTargets[muscle];
    const rawLow = nullableNumber(candidate?.[0]);
    const rawHigh = nullableNumber(candidate?.[1]);
    const low = rawLow === null ? null : Math.round(rawLow);
    const high = rawHigh === null ? null : Math.round(rawHigh);
    return [muscle, Number.isFinite(low) && Number.isFinite(high) && low >= 0 && low <= 40 && high >= Math.max(1, low) && high <= 50 ? [low, high] : [...fallback]];
  }));
  const storedDays = Math.round(Number(storedProfile.days));
  const safetyResetEquipment = new Set(["squatRack", "inclineBench"]);
  const profile = {
    name: String(storedProfile.name || "Athlete").trim().slice(0, 24) || "Athlete",
    goal: "hypertrophy",
    days: Number.isFinite(storedDays) && storedDays >= 2 && storedDays <= 6 ? storedDays : 4,
    experience: ["beginner", "intermediate", "advanced"].includes(storedProfile.experience) ? storedProfile.experience : "intermediate",
    equipment: Object.fromEntries(EQUIPMENT_OPTIONS.map((item) => [
      item.id,
      storedEquipmentVersion < EQUIPMENT_PROFILE_VERSION && safetyResetEquipment.has(item.id)
        ? false
        : Object.prototype.hasOwnProperty.call(storedEquipment, item.id) ? Boolean(storedEquipment[item.id]) : item.defaultValue,
    ])),
    equipmentProfileVersion: EQUIPMENT_PROFILE_VERSION,
    showMachineExercises: Boolean(storedProfile.showMachineExercises),
    loadIncrementKg: Number.isFinite(storedIncrement) && storedIncrement >= 0.5 && storedIncrement <= 10 ? storedIncrement : DEFAULT_LOAD_INCREMENT_KG,
    locale: storedProfile.locale === "pl" ? "pl" : "en",
    units: storedProfile.units === "lb" ? "lb" : "kg",
  };
  const customIds = new Set(Object.keys(byExerciseId));
  const customExercises = (Array.isArray(raw?.customExercises) ? raw.customExercises : [])
    .map(normalizeCustomExercise)
    .filter((exercise) => {
      if (!exercise.id || customIds.has(exercise.id)) return false;
      customIds.add(exercise.id);
      return true;
    });
  const customExerciseIdRemap = new Map();
  const retainedCustomExercises = customExercises.filter((exercise) => {
    const libraryMatch = findLibraryExerciseByName(exercise.name);
    const isUnmappedCustom = exercise.type === "Custom" && !exercise.primary.length && !exercise.secondary.length;
    if (!libraryMatch || !isUnmappedCustom) return true;
    customExerciseIdRemap.set(exercise.id, libraryMatch.id);
    return false;
  });
  const workoutIds = new Set();
  const workouts = (Array.isArray(raw?.workouts) ? raw.workouts : [])
    .map(normalizeWorkout)
    .filter(Boolean)
    .map((workout) => ({
      ...workout,
      entries: mergeEntriesByExerciseId(workout.entries.map((entry) => ({
        ...entry,
        exerciseId: customExerciseIdRemap.get(entry.exerciseId) || entry.exerciseId,
      }))),
    }))
    .map((workout, index) => {
      if (!workoutIds.has(workout.id)) {
        workoutIds.add(workout.id);
        return workout;
      }
      const uniqueId = `${workout.id}-${index}-${simpleHash(`${workout.date}-${workout.name}`)}`;
      workoutIds.add(uniqueId);
      return { ...workout, id: uniqueId };
    })
    .map((workout) => {
      const imported = workout.source && workout.source !== "manual";
      return {
        ...workout,
        sourceIdentity: imported ? Domain.sourceIdentity(workout) : workout.sourceIdentity,
        contentFingerprint: imported ? Domain.contentFingerprint(workout) : workout.contentFingerprint,
        recoverySnapshot: workout.recoverySnapshot ? normalizeRecoveryCheckin({
          ...workout.recoverySnapshot,
          date: workout.date,
        }) : null,
      };
    });
  const validExerciseIds = new Set([...Object.keys(byExerciseId), ...retainedCustomExercises.map((exercise) => exercise.id)]);
  const importAliases = Object.fromEntries(Object.entries(isPlainRecord(raw?.importAliases) ? raw.importAliases : {})
    .filter(([key, value]) => key.length <= 240 && validExerciseIds.has(value))
    .slice(-1000));
  const exercisePreferences = Object.fromEntries(Object.entries(isPlainRecord(raw?.exercisePreferences) ? raw.exercisePreferences : {})
    .filter(([id]) => validExerciseIds.has(id))
    .map(([id, preference]) => [id, {
      loadMode: Domain.LOAD_MODES.includes(preference?.loadMode) ? preference.loadMode : null,
      repMode: Domain.REP_MODES.includes(preference?.repMode) ? preference.repMode : null,
      measurementMode: Domain.MEASUREMENT_MODES.includes(preference?.measurementMode) ? preference.measurementMode : null,
      effectiveFrom: isValidDateKey(preference?.effectiveFrom) ? preference.effectiveFrom : null,
    }]));
  const routines = (Array.isArray(raw?.routines) ? raw.routines : []).slice(-100).map((routine, index) => ({
    id: String(routine?.id || `routine-${index}-${simpleHash(routine?.name || "")}`).slice(0, 160),
    name: String(routine?.name || `Routine ${index + 1}`).trim().slice(0, 80),
    notes: String(routine?.notes || "").slice(0, 1000),
    weekdays: Array.isArray(routine?.weekdays)
      ? [...new Set(routine.weekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
      : [],
    entries: (Array.isArray(routine?.entries) ? routine.entries : [])
      .filter((entry) => validExerciseIds.has(entry?.exerciseId))
      .slice(0, MAX_MANUAL_EXERCISES)
      .map((entry) => ({
        exerciseId: entry.exerciseId,
        targetSets: Math.max(1, Math.min(MAX_MANUAL_SETS_PER_EXERCISE, Math.round(nullableNumber(entry.targetSets) || 3))),
        targetRir: nullableNumber(entry.targetRir),
        notes: String(entry.notes || "").slice(0, 500),
      })),
    createdAt: routine?.createdAt && !Number.isNaN(new Date(routine.createdAt).getTime()) ? String(routine.createdAt) : null,
  })).filter((routine) => routine.name && routine.entries.length);
  return {
    ...raw,
    schemaVersion: SCHEMA_VERSION,
    profile,
    targets,
    customExercises: retainedCustomExercises,
    routines,
    importAliases,
    exercisePreferences,
    favoriteExercises: Array.isArray(raw?.favoriteExercises)
      ? [...new Set(raw.favoriteExercises.filter((id) => validExerciseIds.has(id)))].slice(0, 500)
      : [],
    libraryPreferences: {
      availableOnly: raw?.libraryPreferences?.availableOnly !== false,
      density: raw?.libraryPreferences?.density === "compact" ? "compact" : "comfortable",
      sort: ["recent", "alphabetical", "catalog"].includes(raw?.libraryPreferences?.sort)
        ? raw.libraryPreferences.sort
        : "recent",
    },
    importBatches: Array.isArray(raw?.importBatches) ? raw.importBatches.slice(-MAX_IMPORT_HISTORY).map((batch, index) => ({
      id: String(batch?.id || `import-${index}`).slice(0, 160),
      importedAt: batch?.importedAt && !Number.isNaN(new Date(batch.importedAt).getTime()) ? String(batch.importedAt) : null,
      fileName: String(batch?.fileName || "Imported file").slice(0, 255),
      source: batch?.source === "fitatu-csv" || String(batch?.id || "").startsWith("fitatu-import-") ? "fitatu-csv" : "hevy-csv",
      kind: batch?.kind === "nutrition" || batch?.source === "fitatu-csv" ? "nutrition" : "workouts",
      workoutCount: Math.max(0, Math.round(nullableNumber(batch?.workoutCount) ?? 0)),
      dayCount: Math.max(0, Math.round(nullableNumber(batch?.dayCount) ?? 0)),
      scope: batch?.scope === "recent" ? "recent" : "all",
      mode: batch?.mode === "replace" ? "replace" : "merge",
      added: Math.max(0, Math.round(nullableNumber(batch?.added) ?? batch?.workoutCount ?? 0)),
      updated: Math.max(0, Math.round(nullableNumber(batch?.updated) ?? 0)),
      unchanged: Math.max(0, Math.round(nullableNumber(batch?.unchanged) ?? 0)),
      conflicted: Math.max(0, Math.round(nullableNumber(batch?.conflicted) ?? 0)),
      rejected: Math.max(0, Math.round(nullableNumber(batch?.rejected) ?? 0)),
      affectedDates: Array.isArray(batch?.affectedDates) ? batch.affectedDates.filter(isValidDateKey).slice(0, 1000) : [],
    })) : [],
    bodyMetrics: Array.isArray(raw?.bodyMetrics) ? normalizeBodyMetrics(raw.bodyMetrics) : [],
    nutritionDays: normalizeNutritionDays(raw?.nutritionDays),
    recoveryCheckins: Array.isArray(raw?.recoveryCheckins) ? normalizeRecoveryCheckins(raw.recoveryCheckins) : [],
    integrations: {
      ...(raw?.integrations || {}),
      garmin: {
        status: raw?.integrations?.garmin?.status === "connected" ? "connected" : "setup-required",
        lastSyncAt: raw?.integrations?.garmin?.lastSyncAt && !Number.isNaN(new Date(raw.integrations.garmin.lastSyncAt).getTime()) ? String(raw.integrations.garmin.lastSyncAt) : null,
      },
      fitatu: {
        status: raw?.nutritionDays?.length || raw?.integrations?.fitatu?.status === "imported" ? "imported" : "not-imported",
        lastImportAt: raw?.integrations?.fitatu?.lastImportAt && !Number.isNaN(new Date(raw.integrations.fitatu.lastImportAt).getTime())
          ? String(raw.integrations.fitatu.lastImportAt)
          : null,
        lastFileName: raw?.integrations?.fitatu?.lastFileName ? String(raw.integrations.fitatu.lastFileName).slice(0, 255) : null,
      },
    },
    appMeta: {
      lastBackupAt: raw?.appMeta?.lastBackupAt && !Number.isNaN(new Date(raw.appMeta.lastBackupAt).getTime()) ? String(raw.appMeta.lastBackupAt) : null,
      lastSavedAt: raw?.appMeta?.lastSavedAt && !Number.isNaN(new Date(raw.appMeta.lastSavedAt).getTime()) ? String(raw.appMeta.lastSavedAt) : null,
    },
    workouts,
  };
}

const storageState = {
  available: true,
  persistent: true,
  loadError: null,
  recoveryAvailable: false,
  pendingMigration: false,
};
let pendingMigrationPayload = null;

function loadData() {
  let rawText = null;
  let saved = null;
  try {
    rawText = localStorage.getItem(STORAGE_KEY);
    saved = rawText ? JSON.parse(rawText) : null;
  } catch (error) {
    console.warn("Could not read Liftwise data", error);
    storageState.loadError = "Stored data could not be parsed. A raw recovery copy is available.";
    storageState.recoveryAvailable = Boolean(rawText);
    try {
      if (rawText) localStorage.setItem(CORRUPT_KEY, rawText);
    } catch (storageError) {
      storageState.available = false;
      storageState.persistent = false;
    }
  }
  if (saved?.profile && Array.isArray(saved?.workouts)) {
    try {
      const migrated = migrateData(structuredClone(saved));
      const validationError = validateBackupShape(migrated);
      if (validationError) throw new Error(validationError);
      if (Number(saved.schemaVersion) !== SCHEMA_VERSION) {
        localStorage.setItem(RECOVERY_KEY, rawText);
        storageState.recoveryAvailable = true;
        storageState.pendingMigration = true;
        pendingMigrationPayload = migrated;
      }
      return migrated;
    } catch (error) {
      console.warn("Liftwise migration failed", error);
      storageState.loadError = `Stored data could not be migrated safely: ${error.message}`;
      storageState.recoveryAvailable = Boolean(rawText);
      try {
        if (rawText) localStorage.setItem(CORRUPT_KEY, rawText);
      } catch (storageError) {
        storageState.available = false;
        storageState.persistent = false;
      }
    }
  }
  const starter = migrateData(createStarterData());
  if (!storageState.loadError) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(starter));
    } catch (error) {
      storageState.available = false;
      storageState.persistent = false;
      storageState.loadError = "Browser storage is unavailable. New data will not survive a reload.";
      console.warn("Liftwise is running without persistent browser storage", error);
    }
  }
  return starter;
}

let data = loadData();
let selectedWeekOffset = 0;
let workoutFilter = "all";
let libraryFilter = "All";
let suggestionPlan = [];
let pendingCsvImport = null;
let pendingCsvImportScope = null;
let pendingFitatuImport = null;
let selectedBodyMuscle = null;
let editingWorkoutId = null;
let editingBodyMetricId = null;
let workoutEditorDirty = false;
let workoutDraftTimer = null;
let activeView = "dashboard";
let workoutPage = 1;
let libraryPage = 1;
let workoutSearch = "";
let workoutSourceFilter = "all";
let workoutMissingRirOnly = false;
let workoutDateFrom = "";
let workoutDateTo = "";
let libraryMuscleFilter = "All";
let libraryEquipmentFilter = "All";
const dialogReturnFocus = new Map();

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

function saveData() {
  try {
    data.appMeta ||= {};
    data.appMeta.lastSavedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    storageState.available = true;
    storageState.persistent = true;
    return true;
  } catch (error) {
    console.error("Could not save Liftwise data", error);
    storageState.persistent = false;
    storageState.loadError = "Browser storage rejected the latest write. Export a backup before continuing.";
    return false;
  }
}
function parseDate(value) { return new Date(`${value}T12:00:00`); }
function toDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function dayStart(date = new Date()) { const copy = new Date(date); copy.setHours(0, 0, 0, 0); return copy; }
function getMonday(date = new Date()) { const copy = dayStart(date); const diff = (copy.getDay() + 6) % 7; copy.setDate(copy.getDate() - diff); return copy; }
function getSelectedWeekStart() { const start = getMonday(); start.setDate(start.getDate() + selectedWeekOffset * 7); return start; }
function addDays(date, amount) { const copy = new Date(date); copy.setDate(copy.getDate() + amount); return copy; }
function currentLocale() { return data?.profile?.locale === "pl" ? "pl-PL" : "en"; }
function formatNumber(value) { return new Intl.NumberFormat(currentLocale(), { maximumFractionDigits: 1 }).format(value); }
function weightUnit() { return data?.profile?.units === "lb" ? "lb" : "kg"; }
function kgToUnit(value, unit = weightUnit()) { return unit === "lb" ? precision(Number(value) * 2.2046226218) : Number(value); }
function kgToDisplay(value) { return kgToUnit(value, weightUnit()); }
function unitValueToKg(value, unit = weightUnit()) {
  const parsed = nullableNumber(value);
  if (parsed === null) return null;
  return unit === "lb" ? Math.round((parsed / 2.2046226218) * 100) / 100 : parsed;
}
function displayToKg(value) { return unitValueToKg(value, weightUnit()); }
function formatKg(value) { return `${formatNumber(kgToDisplay(value))} ${weightUnit()}`; }
function formatDuration(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(value / 60);
  const remainder = value % 60;
  return minutes ? `${minutes}:${String(remainder).padStart(2, "0")}` : `${remainder}s`;
}
function formatDate(value, options = { month: "short", day: "numeric" }) { return new Intl.DateTimeFormat(currentLocale(), options).format(parseDate(value)); }
function titleCase(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
function getGoalName(goal) { return ({ hypertrophy: "Build muscle", strength: "Build strength", general: "General fitness" })[goal] || "General fitness"; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[character]); }
function normalizeExerciseName(value) {
  return Domain.normalizeText(value);
}
function simpleHash(value) {
  return Domain.hash(value);
}

function getTodayRecoveryCheckin() {
  const today = toDateInput(new Date());
  return (data.recoveryCheckins || []).find((checkin) => checkin.date === today) || null;
}

function getRecoveryContext(checkin = getTodayRecoveryCheckin()) {
  if (!checkin) {
    return {
      level: "unknown",
      label: "Not checked",
      title: "Add today’s context",
      summary: "A 20-second check-in keeps set targets from automatically becoming “do more” advice on a low-recovery day.",
      factors: [],
      coachingOverride: false,
    };
  }
  const factors = [
    `${formatNumber(checkin.sleepHours)} h sleep`,
    `${checkin.energy}/5 energy`,
    `${checkin.soreness}/5 soreness`,
    `${checkin.stress}/5 stress`,
  ];
  if (checkin.painConcern) {
    return {
      level: "stop",
      label: "Pause & assess",
      title: "Pain concern overrides the plan",
      summary: "Avoid painful movements and do not use an automated volume target to push through new or unusual pain. Seek qualified care when needed.",
      factors: [...factors, "Pain concern flagged"],
      coachingOverride: true,
    };
  }
  const lowRecovery = checkin.sleepHours < 5 || checkin.energy <= 1 || checkin.soreness >= 5 || checkin.stress >= 5;
  if (lowRecovery) {
    return {
      level: "low",
      label: "Recovery first",
      title: "Reduce today’s training stress",
      summary: "Consider rest or a short, easier session. Liftwise will hold volume additions and leave more reps in reserve today.",
      factors,
      coachingOverride: true,
    };
  }
  const caution = checkin.sleepHours < 7 || checkin.energy <= 2 || checkin.soreness >= 4 || checkin.stress >= 4;
  if (caution) {
    return {
      level: "caution",
      label: "Use caution",
      title: "Keep today flexible",
      summary: "Keep volume and load stable, avoid grinding reps, and trim optional work if technique or performance falls.",
      factors,
      coachingOverride: true,
    };
  }
  return {
    level: "ready",
    label: "Ready as planned",
    title: "Recovery supports the plan",
    summary: "Proceed with the planned session while keeping technique, the intended RIR, and repeatable performance in charge.",
    factors,
    coachingOverride: false,
  };
}

function getBodyMetricHistory() {
  return [...(data.bodyMetrics || [])].sort((a, b) => {
    const dateDifference = parseDate(b.date) - parseDate(a.date);
    if (dateDifference) return dateDifference;
    return new Date(b.recordedAt || 0) - new Date(a.recordedAt || 0);
  });
}
function bodyMetricPreference(candidate, current) {
  const sourceScore = candidate.source === "manual" ? 2 : 1;
  const currentScore = current.source === "manual" ? 2 : 1;
  if (sourceScore !== currentScore) return sourceScore - currentScore;
  return new Date(candidate.recordedAt || 0) - new Date(current.recordedAt || 0);
}
function getDailyBodyMetricSeries(field) {
  const byDate = new Map();
  (data.bodyMetrics || []).forEach((metric) => {
    const value = metric[field];
    if (!Number.isFinite(value)) return;
    const current = byDate.get(metric.date);
    if (!current || bodyMetricPreference(metric, current.metric) >= 0) byDate.set(metric.date, { date: metric.date, value, metric });
  });
  return [...byDate.values()].sort((a, b) => parseDate(a.date) - parseDate(b.date));
}
function formatMetricValue(value, unit) { return Number.isFinite(value) ? `${formatNumber(value)}${unit}` : "—"; }
function getMetricDelta(series, unit) {
  if (!series.length) return "No entries yet";
  const latest = series[series.length - 1];
  const asOf = `As of ${formatDate(latest.date)}`;
  if (series.length === 1) return `${asOf} · first entry`;
  const previous = series[series.length - 2];
  const difference = precision(latest.value - previous.value);
  const priorValues = series.slice(Math.max(0, series.length - 8), -1).map((item) => item.value);
  const rollingAverage = priorValues.reduce((total, value) => total + value, 0) / Math.max(priorValues.length, 1);
  const versusAverage = precision(latest.value - rollingAverage);
  return `${asOf} · ${difference > 0 ? "+" : ""}${formatNumber(difference)}${unit} vs previous · ${versusAverage > 0 ? "+" : ""}${formatNumber(versusAverage)}${unit} vs recent average`;
}
function buildBodyTrendChart(series, unit, label, color) {
  if (!series.length) return `<div class="body-chart-empty">Log ${label.toLowerCase()} to start a trend.</div>`;
  const shown = series.slice(-120);
  const values = shown.map((item) => item.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = Math.max((rawMax - rawMin) * .15, unit === "%" ? .2 : .5);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const width = 520;
  const height = 145;
  const left = 34;
  const right = 12;
  const top = 16;
  const bottom = 30;
  const firstTime = parseDate(shown[0].date).getTime();
  const lastTime = parseDate(shown[shown.length - 1].date).getTime();
  const x = (index) => {
    if (shown.length === 1 || firstTime === lastTime) return width / 2;
    const time = parseDate(shown[index].date).getTime();
    return left + ((time - firstTime) / (lastTime - firstTime)) * (width - left - right);
  };
  const y = (value) => top + ((max - value) / Math.max(max - min, .001)) * (height - top - bottom);
  const points = shown.map((item, index) => `${x(index).toFixed(1)},${y(item.value).toFixed(1)}`).join(" ");
  const circles = shown.map((item, index) => {
    const accessible = `${formatDate(item.date)} · ${formatMetricValue(item.value, unit)}`;
    return `<circle cx="${x(index).toFixed(1)}" cy="${y(item.value).toFixed(1)}" r="4" fill="${color}" tabindex="0" role="img" aria-label="${escapeHtml(accessible)}"><title>${escapeHtml(accessible)}</title></circle>`;
  }).join("");
  const tableRows = shown.map((item) => `<tr><td>${escapeHtml(formatDate(item.date, { year: "numeric", month: "short", day: "numeric" }))}</td><td>${escapeHtml(formatMetricValue(item.value, unit))}</td></tr>`).join("");
  return `<svg class="body-trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(`${label} progression`)}"><line x1="${left}" x2="${width - right}" y1="${top}" y2="${top}" class="body-grid-line"/><line x1="${left}" x2="${width - right}" y1="${height - bottom}" y2="${height - bottom}" class="body-grid-line"/><polyline fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${points}"/>${circles}<text x="0" y="${top + 4}" class="body-axis-label">${formatMetricValue(rawMax, unit)}</text><text x="0" y="${height - bottom + 4}" class="body-axis-label">${formatMetricValue(rawMin, unit)}</text><text x="${left}" y="${height - 7}" class="body-axis-label">${escapeHtml(formatDate(shown[0].date))}</text><text x="${width - right}" y="${height - 7}" text-anchor="end" class="body-axis-label">${escapeHtml(formatDate(shown[shown.length - 1].date))}</text></svg><details class="chart-data-table"><summary>View chart data</summary><table><thead><tr><th>Date</th><th>${escapeHtml(label)}</th></tr></thead><tbody>${tableRows}</tbody></table></details>`;
}
function getAllExercises() { return [...exerciseLibrary, ...(data.customExercises || [])]; }
function getExercise(id) { return byExerciseId[id] || (data.customExercises || []).find((exercise) => exercise.id === id); }
function findLibraryExerciseByName(name) {
  const normalized = normalizeExerciseName(name);
  if (!normalized) return null;
  const exact = exerciseLibrary.find((exercise) => normalizeExerciseName(exercise.name) === normalized);
  return exact || byExerciseId[HEVY_ALIASES[normalized]] || null;
}
function findExerciseByName(name) {
  const normalized = normalizeExerciseName(name);
  if (!normalized) return null;
  const libraryMatch = findLibraryExerciseByName(name);
  if (libraryMatch) return libraryMatch;
  return (data.customExercises || []).find((exercise) => (
    normalizeExerciseName(exercise.name) === normalized
    || (exercise.aliases || []).some((alias) => normalizeExerciseName(alias) === normalized)
  )) || null;
}
function defaultMeasurementMode(exercise) {
  if (Domain.MEASUREMENT_MODES.includes(exercise?.measurementMode)) return exercise.measurementMode;
  if (exercise?.id === "plank-hold") return "duration";
  return "load_reps";
}
function defaultRepMode(exercise) {
  if (Domain.REP_MODES.includes(exercise?.repMode)) return exercise.repMode;
  return /single|one-arm|one arm|unilateral/i.test(`${exercise?.pattern || ""} ${exercise?.name || ""}`) ? "per_side" : "total";
}
function defaultLoadMode(exercise) {
  if (Domain.LOAD_MODES.includes(exercise?.loadMode)) return exercise.loadMode;
  if (!exercise || (!(exercise.equipment || []).length && !(exercise.equipmentAny || []).length)) return "none";
  if (["pull-up", "dip"].includes(exercise.id)) return "added_bodyweight";
  if ((exercise.equipment || []).includes("dumbbells") || (exercise.equipmentAny || []).includes("dumbbells")) return "per_hand";
  return "total";
}
function exerciseConventions(exerciseId, entry = null) {
  const exercise = getExercise(exerciseId);
  const preference = data.exercisePreferences?.[exerciseId] || {};
  return {
    measurementMode: Domain.MEASUREMENT_MODES.includes(entry?.measurementMode)
      ? entry.measurementMode
      : preference.measurementMode || defaultMeasurementMode(exercise),
    loadMode: Domain.LOAD_MODES.includes(entry?.loadMode)
      ? entry.loadMode
      : preference.loadMode || defaultLoadMode(exercise),
    repMode: Domain.REP_MODES.includes(entry?.repMode)
      ? entry.repMode
      : preference.repMode || defaultRepMode(exercise),
  };
}
function loadModeLabel(mode) {
  return ({
    total: "Total external load",
    per_hand: "Load per dumbbell / hand",
    added_bodyweight: "Added bodyweight load",
    assistance: "Assistance (less is harder)",
    none: "No external load",
  })[mode] || "Total external load";
}
function repModeLabel(mode) { return mode === "per_side" ? "Reps per side" : "Total reps"; }
function measurementModeLabel(mode) {
  return ({
    load_reps: "Load + reps",
    reps: "Reps only",
    duration: "Duration",
    distance_duration: "Distance + time",
  })[mode] || "Load + reps";
}
function equipmentLabel(id) { return EQUIPMENT_OPTIONS.find((item) => item.id === id)?.label || id; }
function isMachineExercise(exercise) { return Boolean(exercise?.machine || exercise?.equipment?.includes("machine")); }
function isExerciseAvailable(exercise) {
  if (!exercise) return false;
  const equipment = data.profile?.equipment || DEFAULT_EQUIPMENT;
  const required = exercise.equipment || [];
  const alternatives = exercise.equipmentAny || [];
  const hasRequiredEquipment = required.every((item) => equipment[item] !== false);
  const hasAlternativeEquipment = !alternatives.length || alternatives.some((item) => equipment[item] !== false);
  return hasRequiredEquipment && hasAlternativeEquipment;
}
function getAvailableExercises() { return getAllExercises().filter(isExerciseAvailable); }
function exerciseEquipmentText(exercise) {
  const required = (exercise?.equipment || []).map(equipmentLabel);
  const alternatives = (exercise?.equipmentAny || []).map(equipmentLabel);
  if (alternatives.length) required.push(alternatives.join(" or "));
  if (required.length) return required.join(" + ");
  return exercise?.type === "Custom" ? "Custom / user-defined" : "Bodyweight";
}
function unavailableExerciseReason(exercise) {
  if (isExerciseAvailable(exercise)) return "Available in your setup";
  const equipment = data.profile?.equipment || DEFAULT_EQUIPMENT;
  const missing = (exercise?.equipment || []).filter((item) => equipment[item] === false).map(equipmentLabel);
  const alternatives = exercise?.equipmentAny || [];
  if (alternatives.length && !alternatives.some((item) => equipment[item] !== false)) missing.push(alternatives.map(equipmentLabel).join(" or "));
  return missing.length ? `Needs ${missing.join(" + ")}` : "Not available in your setup";
}
function availableEquipmentText() {
  return EQUIPMENT_OPTIONS.filter((item) => data.profile?.equipment?.[item.id] !== false).map((item) => item.label).join(" · ");
}
function getWorkingSets(entry) { return (entry.sets || []).filter((set) => String(set.type || "normal").toLowerCase() !== "warmup"); }
function getQualifiedWorkingSets(entry) {
  const fallback = exerciseConventions(entry.exerciseId, entry).measurementMode;
  return getWorkingSets(entry).filter((set) => Domain.isQualifiedSet(set, fallback));
}
function getProgressionSets(entry) {
  const qualified = getQualifiedWorkingSets(entry);
  const normalSets = qualified.filter((set) => String(set.type || "normal").toLowerCase() === "normal");
  return normalSets.length ? normalSets : qualified;
}
function getEntryPerformance(entry) {
  let sets = getProgressionSets(entry);
  if (!sets.length) return null;
  const fallbackMode = exerciseConventions(entry.exerciseId, entry).measurementMode;
  const measurementMode = Domain.setMeasurementMode(sets[0], fallbackMode);
  sets = sets.filter((set) => Domain.setMeasurementMode(set, fallbackMode) === measurementMode);
  const conventions = exerciseConventions(entry.exerciseId, entry);
  const setScore = (set) => {
    if (measurementMode === "duration") return (set.durationSeconds || 0) * (1 + (set.weightKg || 0) / 100);
    if (measurementMode === "distance_duration") {
      const paceBonus = set.durationSeconds > 0 ? (set.distanceMeters || 0) / set.durationSeconds : 0;
      return (set.distanceMeters || 0) + paceBonus;
    }
    const load = set.weightKg || 0;
    const loadScore = conventions.loadMode === "assistance" ? 1 / Math.max(load, 0.1) : load;
    return load > 0 ? loadScore * (1 + (set.reps || 0) / 30) : (set.reps || 0);
  };
  const topSet = sets.reduce((best, set) => {
    return setScore(set) > setScore(best) ? set : best;
  }, sets[0]);
  const repValues = sets.map((set) => set.reps).filter(Number.isFinite);
  return {
    sets: sets.length,
    reps: topSet.reps ?? 0,
    weight: topSet.weightKg ?? 0,
    durationSeconds: topSet.durationSeconds ?? null,
    distanceMeters: topSet.distanceMeters ?? null,
    paceSecondsPerKm: topSet.durationSeconds > 0 && topSet.distanceMeters > 0
      ? topSet.durationSeconds / (topSet.distanceMeters / 1000)
      : null,
    measurementMode,
    loadMode: conventions.loadMode,
    repMode: conventions.repMode,
    rir: topSet.rir,
    rpe: topSet.rpe,
    minReps: repValues.length ? Math.min(...repValues) : 0,
    maxReps: repValues.length ? Math.max(...repValues) : 0,
    minRir: sets.every((set) => Number.isFinite(set.rir)) ? Math.min(...sets.map((set) => set.rir)) : null,
    allEffortLogged: sets.every((set) => Number.isFinite(set.rir)),
    loadConsistent: sets.every((set) => (set.weightKg || 0) === (sets[0].weightKg || 0)),
  };
}
function getSessionVolume(workout) {
  return workout.entries.reduce((total, entry) => total + getEntryVolume(entry), 0);
}
function getSessionSets(workout) { return workout.entries.reduce((total, entry) => total + getQualifiedWorkingSets(entry).length, 0); }
function getEntryVolume(entry) {
  const conventions = exerciseConventions(entry.exerciseId, entry);
  return getWorkingSets(entry).reduce((total, set) => (
    total + Domain.normalizedSetVolume(set, conventions.loadMode, conventions.repMode)
  ), 0);
}
function getWorkoutTimestamp(workout) {
  const timestamp = workout.startTime ? new Date(workout.startTime) : parseDate(workout.date);
  return Number.isNaN(timestamp.getTime()) ? parseDate(workout.date).getTime() : timestamp.getTime();
}
function getExerciseSessions(exerciseId) {
  const sessions = [];
  data.workouts.forEach((workout) => {
    const matchingEntries = workout.entries.filter((entry) => entry.exerciseId === exerciseId);
    if (!matchingEntries.length) return;
    const entry = {
      ...matchingEntries[0],
      sets: matchingEntries.flatMap((item) => item.sets || []),
      exerciseNotes: matchingEntries.map((item) => item.exerciseNotes).filter(Boolean).join(" · "),
    };
    const performance = getEntryPerformance(entry);
    if (performance) sessions.push({ workout, entry, performance });
  });
  return sessions.sort((a, b) => getWorkoutTimestamp(b.workout) - getWorkoutTimestamp(a.workout));
}
function performanceScore(performance) {
  if (!performance) return 0;
  if (performance.measurementMode === "duration") return performance.durationSeconds || 0;
  if (performance.measurementMode === "distance_duration") return performance.distanceMeters || 0;
  if (performance.loadMode === "assistance" && performance.weight > 0) {
    return (performance.reps || 0) * 1000 / performance.weight;
  }
  return performance.weight > 0 ? performance.weight * (1 + performance.reps / 30) : performance.reps;
}
function getPerformanceComparison(current, previous) {
  if (!current) return { label: "No working sets", className: "flat" };
  if (!previous) return { label: "First logged session", className: "flat" };
  if (current.measurementMode !== previous.measurementMode || current.loadMode !== previous.loadMode || current.repMode !== previous.repMode) {
    return { label: "Convention changed · no comparison", className: "flat" };
  }
  if (current.measurementMode === "duration") {
    const delta = (current.durationSeconds || 0) - (previous.durationSeconds || 0);
    return { label: delta === 0 ? "Same duration" : `${delta > 0 ? "+" : ""}${formatNumber(delta)} sec`, className: delta > 0 ? "" : "flat" };
  }
  if (current.measurementMode === "distance_duration") {
    const delta = (current.distanceMeters || 0) - (previous.distanceMeters || 0);
    return { label: delta === 0 ? "Same distance" : `${delta > 0 ? "+" : ""}${formatNumber(delta)} m`, className: delta > 0 ? "" : "flat" };
  }
  if (current.loadMode === "assistance" && current.reps === previous.reps) {
    const delta = previous.weight - current.weight;
    return { label: delta === 0 ? "Same assistance" : `${delta > 0 ? "−" : "+"}${formatKg(Math.abs(delta))} assistance`, className: delta > 0 ? "" : "flat" };
  }
  if (current.weight === previous.weight && current.reps === previous.reps) return { label: "Same top set", className: "flat" };
  if (current.weight === previous.weight) {
    const repsDelta = current.reps - previous.reps;
    return { label: `${repsDelta > 0 ? "+" : ""}${repsDelta} rep${Math.abs(repsDelta) === 1 ? "" : "s"} at same load`, className: repsDelta > 0 ? "" : "flat" };
  }
  const loadDelta = current.weight - previous.weight;
  if (current.reps >= previous.reps && loadDelta > 0) return { label: `+${formatKg(loadDelta)} with same-or-more reps`, className: "" };
  const scoreDelta = Math.round(((performanceScore(current) - performanceScore(previous)) / Math.max(performanceScore(previous), 1)) * 100);
  return { label: `${scoreDelta >= 0 ? "+" : ""}${scoreDelta}% top-set estimate`, className: scoreDelta > 0 ? "" : "flat" };
}
function getSessionsInRange(start, end) { return data.workouts.filter((workout) => { const date = parseDate(workout.date); return date >= start && date < end; }); }
function sortRecent(workouts) { return [...workouts].sort((a, b) => parseDate(b.date) - parseDate(a.date)); }

function muscleTotals(workouts) {
  const totals = Object.fromEntries(MUSCLES.map((muscle) => [muscle, 0]));
  workouts.forEach((workout) => workout.entries.forEach((entry) => {
    const exercise = getExercise(entry.exerciseId);
    if (!exercise) return;
    const workingSetCount = getQualifiedWorkingSets(entry).length;
    exercise.primary.forEach((muscle) => { totals[muscle] += workingSetCount; });
    exercise.secondary.forEach((muscle) => { totals[muscle] += workingSetCount * 0.5; });
  }));
  return totals;
}

function getWeekData(offset = selectedWeekOffset) {
  const start = getMonday();
  start.setDate(start.getDate() + offset * 7);
  const end = addDays(start, 7);
  const previousStart = addDays(start, -7);
  const workouts = getSessionsInRange(start, end);
  const previous = getSessionsInRange(previousStart, start);
  return { start, end, previousStart, workouts, previous, totals: muscleTotals(workouts) };
}

function getExerciseHistory(exerciseId) {
  return getExerciseSessions(exerciseId).map(({ workout, performance }) => ({
    ...performance,
    date: workout.date,
    workoutName: workout.name,
    workoutId: workout.id,
    startTime: workout.startTime || null,
  }));
}

function configuredLoadIncrement() {
  const value = Number(data.profile?.loadIncrementKg);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_LOAD_INCREMENT_KG;
}
function roundedToIncrement(value, increment = configuredLoadIncrement()) {
  return precision(Math.round(value / increment) * increment);
}
function roundedDownToIncrement(value, increment = configuredLoadIncrement()) {
  return precision(Math.floor(value / increment) * increment);
}
function daysBetweenDateKeys(later, earlier) {
  return Math.abs(parseDate(later) - parseDate(earlier)) / 86400000;
}
function performanceLabel(performance) {
  if (performance.measurementMode === "duration") {
    const load = performance.weight > 0 ? ` at ${formatKg(performance.weight)}` : "";
    return `${formatNumber(performance.durationSeconds || 0)} sec${load}`;
  }
  if (performance.measurementMode === "distance_duration") {
    const duration = performance.durationSeconds > 0 ? ` in ${formatDuration(performance.durationSeconds)}` : "";
    return `${formatNumber(performance.distanceMeters || 0)} m${duration}`;
  }
  const load = performance.weight > 0 ? formatKg(performance.weight) : "bodyweight";
  const effort = Number.isFinite(performance.rir) ? ` @ ${formatNumber(performance.rir)} RIR` : "";
  return `${load} × ${formatNumber(performance.reps)}${effort}`;
}

function getProgressDecision(exerciseId) {
  const exercise = getExercise(exerciseId);
  const history = getExerciseHistory(exerciseId);
  if (!exercise || !history.length) return null;
  const latest = history[0];
  const previous = history[1];
  const [low, high] = exercise.range;
  if (latest.measurementMode === "duration" || latest.measurementMode === "distance_duration") {
    const metric = latest.measurementMode === "duration"
      ? `${formatNumber(latest.durationSeconds || 0)} sec`
      : `${formatNumber(latest.distanceMeters || 0)} m${latest.durationSeconds ? ` in ${formatDuration(latest.durationSeconds)}` : ""}`;
    const comparison = getPerformanceComparison(latest, previous);
    return {
      exercise,
      latest,
      previous,
      low,
      high,
      action: previous ? "Repeat or improve slightly" : "Log once more",
      description: previous
        ? `Keep the same measurement mode and aim for a small, controlled improvement from ${metric}.`
        : `Repeat this movement once more before using a trend-based suggestion.`,
      why: `Latest result: ${metric}. ${comparison.label}. Timed and distance work is compared only with the same measurement mode and load convention.`,
      rule: "Mode-specific progression",
      prescribedWeight: latest.weight,
      prescribedReps: null,
    };
  }
  if (latest.loadMode === "assistance") {
    const recentComparable = previous
      && previous.measurementMode === latest.measurementMode
      && previous.loadMode === "assistance"
      && daysBetweenDateKeys(latest.date, previous.date) <= PROGRESSION_COMPARISON_DAYS;
    const reachedTop = latest.minReps >= high && latest.allEffortLogged && latest.minRir >= 1;
    const reducedAssistance = recentComparable && latest.weight < previous.weight && latest.reps >= previous.reps;
    const canReduceAgain = reachedTop
      && recentComparable
      && previous.minReps >= high
      && previous.allEffortLogged
      && previous.minRir >= 1
      && previous.weight === latest.weight;
    const nextAssistance = Math.max(0, precision(latest.weight - configuredLoadIncrement()));
    if (!latest.allEffortLogged) {
      return {
        exercise, latest, previous, low, high,
        action: "Hold + log RIR",
        description: `Repeat ${formatKg(latest.weight)} assistance and log RIR for each normal working set.`,
        why: "Assistance is inverse load: less assistance is harder. RIR is required before recommending another reduction.",
        rule: "Assistance progression",
        prescribedWeight: latest.weight,
        prescribedReps: Math.min(high, latest.minReps + 1),
      };
    }
    if (canReduceAgain) {
      return {
        exercise, latest, previous, low, high,
        action: "Reduce assistance",
        description: nextAssistance > 0
          ? `Use ${formatKg(nextAssistance)} assistance next time and rebuild from ${low} controlled reps.`
          : `Move to unassisted bodyweight work and rebuild from ${low} controlled reps.`,
        why: `The range ceiling was cleared twice at ${formatKg(latest.weight)} assistance with reserve. Less assistance—not more—is the progression.`,
        rule: "Assistance double progression",
        prescribedWeight: nextAssistance,
        prescribedReps: low,
      };
    }
    return {
      exercise, latest, previous, low, high,
      action: reducedAssistance ? "Hold new assistance" : reachedTop ? "Confirm once" : "Add a rep",
      description: reducedAssistance
        ? `Keep ${formatKg(latest.weight)} assistance and consolidate the harder setting before reducing it again.`
        : reachedTop
          ? `Repeat ${formatKg(latest.weight)} assistance once more; reduce assistance only after a second complete result.`
          : `Keep ${formatKg(latest.weight)} assistance and add a clean rep toward ${high}.`,
      why: `Latest top set: ${performanceLabel(latest)}. For assisted work a lower assistance value is harder, so load advice is intentionally reversed.`,
      rule: "Assistance progression",
      prescribedWeight: latest.weight,
      prescribedReps: Math.min(high, latest.minReps + 1),
    };
  }
  const increment = configuredLoadIncrement();
  const hasEffort = latest.allEffortLogged;
  const recentPair = history.length >= 2 && daysBetweenDateKeys(history[0].date, history[1].date) <= PROGRESSION_COMPARISON_DAYS;
  const comparablePair = recentPair
    && history[0].weight === history[1].weight
    && history[0].sets === history[1].sets;
  const clearsTop = (entry) => entry.minReps >= high && entry.allEffortLogged && entry.minRir >= 1 && entry.loadConsistent;
  const atTopWithReserve = clearsTop(latest);
  const repeatedTopCompletion = comparablePair && history.slice(0, 2).every(clearsTop);
  const repeatedFloorMiss = comparablePair && history.slice(0, 2).every((entry) => entry.maxReps < low && entry.allEffortLogged && entry.minRir <= 0);
  const priorText = previous ? ` Prior top set: ${performanceLabel(previous)}.` : " This is the first logged appearance.";
  let action = "Hold";
  let description = `Repeat ${latest.weight > 0 ? formatKg(latest.weight) : "bodyweight"} and add one clean rep to each set that is still below ${high}.`;
  let why = `Latest top set: ${performanceLabel(latest)} across ${latest.sets} progression set${latest.sets === 1 ? "" : "s"}. Rep range: ${low}–${high}.${priorText} Rule: keep the load and set count stable until every normal working set reaches the range ceiling with reserve in two recent appearances.`;
  let rule = "Rep-first progression";
  let prescribedWeight = latest.weight;
  let prescribedReps = Math.min(high, latest.minReps + 1);

  if (!hasEffort) {
    action = "Hold + log RIR";
    description = `Repeat the load and log RIR or RPE for every normal working set before making an effort-based load change.`;
    why = `Latest session: ${performanceLabel(latest)} top set across ${latest.sets} progression set${latest.sets === 1 ? "" : "s"}. At least one set has no RIR/RPE, so the effort safeguard cannot be checked.`;
    rule = "Effort data required";
  } else if (repeatedFloorMiss && latest.weight > 0) {
    let proposedLoad = roundedDownToIncrement(latest.weight * 0.95, increment);
    if (proposedLoad >= latest.weight) proposedLoad = precision(latest.weight - increment);
    proposedLoad = Math.max(0, proposedLoad);
    const reduction = precision(latest.weight - proposedLoad);
    action = "Reduce load";
    description = proposedLoad > 0
      ? `Use ${formatKg(proposedLoad)} next time (−${formatKg(reduction)}) and rebuild from ${low} reps.`
      : `Use the next lighter load available and rebuild from ${low} clean reps.`;
    if (proposedLoad > 0) prescribedWeight = proposedLoad;
    prescribedReps = low;
    why = `The latest two same-load, same-set-count appearances, ${daysBetweenDateKeys(history[0].date, history[1].date)} days apart, both stayed below ${low} reps at 0 RIR. Rule: two comparable recent hard misses → take at least one configured load step down.`;
    rule = "Two hard misses";
  } else if (repeatedFloorMiss) {
    action = "Regress variation";
    description = `Use an easier version or assistance and rebuild toward ${low} clean reps before progressing.`;
    why = `Latest two comparable top sets were ${performanceLabel(history[0])} and ${performanceLabel(history[1])}; both missed the ${low}-rep floor at 0 RIR. Rule: two hard bodyweight misses at the same set count → make the variation easier rather than forcing more volume.`;
    rule = "Two hard misses";
  } else if (repeatedTopCompletion && latest.weight > 0) {
    action = "Increase load";
    description = `Add exactly ${formatKg(increment)} next time, then work back up from ${low} reps.`;
    prescribedWeight = precision(latest.weight + increment);
    prescribedReps = low;
    why = `Every normal working set reached at least ${high} reps with ≥1 RIR at the same load and set count in two recent appearances. Rule: confirm the range ceiling twice under comparable conditions, then add your configured ${formatKg(increment)} load increment.`;
    rule = "Double progression";
  } else if (repeatedTopCompletion) {
    action = "Increase difficulty";
    description = `Keep the movement at bodyweight, add a slower eccentric or a pause, and work from ${low} controlled reps again.`;
    why = `Every normal working set reached at least ${high} reps with ≥1 RIR at the same set count in two recent appearances. Rule: for bodyweight work, confirm twice under comparable conditions and then increase difficulty without unplanned external load.`;
    rule = "Bodyweight progression";
    prescribedReps = low;
  } else if (atTopWithReserve) {
    action = "Confirm once";
    description = `Repeat this load once more. If every normal working set again reaches ${high}+ reps with at least 1 RIR, progress next time.`;
    why = `This is the first recent appearance where all ${latest.sets} normal working sets cleared the range ceiling with reserve. Rule: one repeat helps avoid progressing from a noisy single session.`;
    rule = "Double progression";
  } else if (previous && latest.weight > previous.weight && latest.reps >= previous.reps) {
    action = "Hold + add a rep";
    description = `Keep this load and aim for ${Math.min(high, latest.reps + 1)} reps before another increase.`;
    why = `Latest top set: ${performanceLabel(latest)} versus ${performanceLabel(previous)}. Load increased without losing reps. Rule: retain the new load and earn another rep before the next jump.`;
    rule = "Consolidate new load";
  } else if (latest.rir <= 0 && latest.reps <= low) {
    action = "Hold";
    description = `Repeat this load and prioritize a cleaner set before adding reps or volume.`;
    why = `Latest top set: ${performanceLabel(latest)} is at the hard end of the ${low}–${high} range. Rule: a floor-level set at 0 RIR is repeated, not loaded further.`;
    rule = "Technique and recovery guardrail";
  } else if (!previous) {
    action = "Log once more";
    description = `Repeat the load and log one more session so the next decision can compare two appearances.`;
    why = `Latest top set: ${performanceLabel(latest)}. Rule: one observation establishes a baseline; two appearances are needed for a progression comparison.`;
    rule = "Need comparison";
  }
  return { exercise, latest, previous, low, high, action, description, why, rule, prescribedWeight, prescribedReps };
}

function getSwapCandidate() {
  const unavailableHistory = exerciseLibrary
    .filter((exercise) => !isExerciseAvailable(exercise) && getExerciseHistory(exercise.id).length)
    .sort((a, b) => getWorkoutTimestamp(getExerciseSessions(b.id)[0].workout) - getWorkoutTimestamp(getExerciseSessions(a.id)[0].workout));
  for (const exercise of unavailableHistory) {
    const substitute = getExercise(exercise.homeReplacementId || exercise.swapId);
    if (substitute && isExerciseAvailable(substitute)) {
      return { exercise, substitute, kind: "equipment", reason: `${exercise.name} needs ${unavailableExerciseReason(exercise).replace(/^Needs\s*/, "")}.`, why: `Rule: an exercise with logged history that is unavailable in your profile is replaced with its closest mapped home option.` };
    }
  }
  for (const exercise of getAvailableExercises()) {
    const history = getExerciseHistory(exercise.id).slice(0, 3);
    const substitute = getExercise(exercise.swapId);
    if (history.length < 3 || !substitute || !isExerciseAvailable(substitute)) continue;
    const [low] = exercise.range;
    const repeatedlyBelowRange = history.every((entry) => entry.reps < low && Number.isFinite(entry.rir) && entry.rir <= 1);
    const noProgressAtHardEffort = history.every((entry) => entry.weight === history[0].weight && entry.reps === history[0].reps && Number.isFinite(entry.rir) && entry.rir <= 1);
    if (repeatedlyBelowRange || noProgressAtHardEffort) {
      return {
        exercise,
        substitute,
        kind: "stall",
        reason: repeatedlyBelowRange
          ? `Three recent logs stayed below the ${low}-rep floor at hard effort.`
          : "Three recent hard logs repeated without a load or rep improvement.",
        why: `Rule: three hard appearances with either no rep-floor success or no rep/load movement earns one controlled alternative trial—not a claim that the alternative is universally better.`,
      };
    }
  }
  return null;
}

function isCurrentWeek() { return selectedWeekOffset === 0; }
function targetFor(muscle) { return data.targets[muscle] || [6, 12]; }
function precision(value) { return Math.round(value * 10) / 10; }

function getFocusMuscles(totals) {
  return MUSCLES.map((muscle) => {
    const [low, high] = targetFor(muscle);
    const current = precision(totals[muscle]);
    return { muscle, current, low, high, deficit: Math.max(0, low - current), excess: Math.max(0, current - high) };
  });
}

function getMuscleCoverageEvidence(muscle, workouts) {
  let directSets = 0;
  let secondaryCredit = 0;
  const sessionIds = new Set();
  workouts.forEach((workout) => workout.entries.forEach((entry) => {
    const exercise = getExercise(entry.exerciseId);
    if (!exercise) return;
    const workingSets = getQualifiedWorkingSets(entry).length;
    if (!workingSets) return;
    if (exercise.primary.includes(muscle)) {
      directSets += workingSets;
      sessionIds.add(workout.id);
    }
    if (exercise.secondary.includes(muscle)) {
      secondaryCredit += workingSets * 0.5;
      sessionIds.add(workout.id);
    }
  }));
  return { directSets, secondaryCredit: precision(secondaryCredit), effectiveSets: precision(directSets + secondaryCredit), sessions: sessionIds.size };
}

function getVolumeDecision(item, workouts, previousWorkouts = []) {
  const evidence = getMuscleCoverageEvidence(item.muscle, workouts);
  const evidenceText = `${formatNumber(evidence.directSets)} direct + ${formatNumber(evidence.secondaryCredit)} secondary credit across ${evidence.sessions} session${evidence.sessions === 1 ? "" : "s"} = ${formatNumber(evidence.effectiveSets)} effective sets`;
  const previousEvidence = previousWorkouts.length ? getMuscleCoverageEvidence(item.muscle, previousWorkouts) : null;
  const trendText = previousEvidence ? ` Previous week: ${formatNumber(previousEvidence.effectiveSets)} effective sets across ${previousEvidence.sessions} session${previousEvidence.sessions === 1 ? "" : "s"}.` : " No prior-week sessions are logged for comparison.";
  if (item.deficit > 0) {
    const amount = Math.min(MAX_VOLUME_ADJUSTMENT_SETS, Math.max(1, Math.ceil(item.deficit)));
    return {
      muscle: item.muscle,
      type: "focus",
      direction: "increase",
      amount,
      title: `Add ${amount} ${item.muscle.toLowerCase()} set${amount === 1 ? "" : "s"}`,
      stat: `${formatNumber(item.current)} / ${item.low}–${item.high} effective sets`,
      text: `Add ${amount} direct working set${amount === 1 ? "" : "s"} across your next one or two sessions, then reassess next week.`,
      why: `${evidenceText}.${trendText} Your selected minimum is ${item.low}, so the gap is ${formatNumber(item.deficit)}. Rule: when current work is below the minimum, add the smaller of the rounded-up gap and the ${MAX_VOLUME_ADJUSTMENT_SETS}-set adjustment cap.`,
      filter: item.muscle,
    };
  }
  if (item.excess > 0) {
    const amount = Math.min(MAX_VOLUME_ADJUSTMENT_SETS, Math.max(1, Math.ceil(item.excess)));
    return {
      muscle: item.muscle,
      type: "reduce",
      direction: "decrease",
      amount,
      title: `Review ${formatNumber(item.excess)} ${item.muscle.toLowerCase()} set${item.excess === 1 ? "" : "s"} above plan`,
      stat: `${formatNumber(item.current)} / ${item.low}–${item.high} planned effective sets`,
      text: `Do not add more automatically. If recovery, time, or set quality is suffering, trim or reallocate up to ${amount} set${amount === 1 ? "" : "s"}; otherwise monitor progress.`,
      why: `${evidenceText}.${trendText} This is ${formatNumber(item.excess)} above your selected planning range. That range is not a physiological ceiling; the rule prompts a review rather than claiming the extra work is harmful.`,
      filter: item.muscle,
    };
  }
  return {
    muscle: item.muscle,
    type: "switch",
    direction: "maintain",
    amount: 0,
    title: `Maintain ${item.muscle.toLowerCase()} volume`,
    stat: `${formatNumber(item.current)} / ${item.low}–${item.high} effective sets`,
    text: "Keep the current number of working sets and focus on repeatable technique or rep progression.",
    why: `${evidenceText}.${trendText} This sits inside your selected ${item.low}–${item.high} range. Rule: in-range volume is maintained rather than increased or reduced automatically.`,
    filter: item.muscle,
  };
}

function getRollingMuscleMapWindow() {
  const end = addDays(dayStart(new Date()), 1);
  const start = addDays(end, -MUSCLE_MAP_WINDOW_DAYS);
  const previousStart = addDays(start, -MUSCLE_MAP_WINDOW_DAYS);
  return {
    start,
    end,
    previousStart,
    workouts: getSessionsInRange(start, end),
    previous: getSessionsInRange(previousStart, start),
  };
}

function formatMuscleMapPeriod(window) {
  const finalDay = addDays(window.end, -1);
  return `Rolling ${MUSCLE_MAP_WINDOW_DAYS} days · ${formatDate(toDateInput(window.start))}–${formatDate(toDateInput(finalDay))}`;
}

function isDateOnOrAfter(value, date) {
  return parseDate(value).getTime() >= date.getTime();
}

function didTopSetImprove(current, previous) {
  if (!current || !previous) return false;
  const sameLoad = current.weight === previous.weight;
  const sameReps = current.reps === previous.reps;
  if (sameLoad && current.reps > previous.reps) return true;
  if (current.weight > previous.weight && current.reps >= previous.reps) return true;
  if (performanceScore(current) >= performanceScore(previous) * 1.02) return true;
  return sameLoad && sameReps
    && Number.isFinite(current.rir)
    && Number.isFinite(previous.rir)
    && current.rir >= previous.rir + 1;
}

function getDirectMuscleProgressSignals(muscle, today = dayStart(new Date())) {
  const progressCutoff = addDays(today, -(MUSCLE_MAP_PROGRESS_LOOKBACK_DAYS - 1));
  const stallCutoff = addDays(today, -(MUSCLE_MAP_STALL_LOOKBACK_DAYS - 1));
  return getAllExercises()
    .filter((exercise) => Array.isArray(exercise.primary) && exercise.primary.includes(muscle))
    .map((exercise) => {
      const history = getExerciseHistory(exercise.id);
      const comparisons = history.slice(0, -1).map((current, index) => ({ current, previous: history[index + 1] }));
      const recentImprovement = comparisons.some(({ current, previous }) => isDateOnOrAfter(current.date, progressCutoff) && didTopSetImprove(current, previous));
      const recentThree = history.slice(0, 3);
      const oldest = recentThree[2];
      const spanDays = oldest ? Math.round((parseDate(recentThree[0].date) - parseDate(oldest.date)) / 86400000) : 0;
      const allHard = recentThree.length === 3 && recentThree.every((entry) => Number.isFinite(entry.rir) && entry.rir <= 1);
      const noProgressAcrossThree = recentThree.length === 3
        && !didTopSetImprove(recentThree[0], recentThree[1])
        && !didTopSetImprove(recentThree[1], recentThree[2]);
      const stalled = recentThree.length === 3
        && oldest
        && isDateOnOrAfter(oldest.date, stallCutoff)
        && spanDays >= MUSCLE_MAP_STALL_MIN_SPAN_DAYS
        && allHard
        && noProgressAcrossThree;
      return { exercise, history, recentImprovement, recentThree, spanDays, stalled };
    });
}

function getMuscleMapStatus(muscle, window) {
  const [low, high] = targetFor(muscle);
  const evidence = getMuscleCoverageEvidence(muscle, window.workouts);
  const previousEvidence = getMuscleCoverageEvidence(muscle, window.previous);
  const current = evidence.effectiveSets;
  const item = { muscle, current, low, high, deficit: Math.max(0, low - current), excess: Math.max(0, current - high) };
  const decision = getVolumeDecision(item, window.workouts, window.previous);
  const signals = getDirectMuscleProgressSignals(muscle);
  const recentImprovementSignals = signals.filter((signal) => signal.recentImprovement);
  const stalledSignals = signals.filter((signal) => signal.stalled);
  const directWorkInWindow = signals.some((signal) => signal.history[0] && isDateOnOrAfter(signal.history[0].date, window.start));
  const coverageText = `${formatNumber(current)} / ${low}–${high} effective sets`;
  const evidenceText = `${formatNumber(evidence.directSets)} direct + ${formatNumber(evidence.secondaryCredit)} secondary credit across ${evidence.sessions} session${evidence.sessions === 1 ? "" : "s"}`;
  const previousText = `${formatNumber(previousEvidence.effectiveSets)} effective sets in the prior ${MUSCLE_MAP_WINDOW_DAYS} days`;
  const inRange = current >= low && current <= high;
  const red = current >= low
    && previousEvidence.effectiveSets >= low
    && directWorkInWindow
    && stalledSignals.length > 0
    && recentImprovementSignals.length === 0;

  if (red) {
    const stalledNames = stalledSignals.map((signal) => signal.exercise.name).join(" and ");
    return {
      muscle,
      tone: "red",
      label: "Logged performance stalled",
      coverageText,
      evidence,
      previousEvidence,
      decision,
      signals,
      stalledSignals,
      why: `${evidenceText}; ${previousText}. ${stalledNames} has three hard direct appearances across at least ${MUSCLE_MAP_STALL_MIN_SPAN_DAYS} days with no rep, load, estimated top-set, or RIR improvement. No direct ${muscle.toLowerCase()} movement improved in the last ${MUSCLE_MAP_PROGRESS_LOOKBACK_DAYS} days.`,
      action: "Keep volume stable for now and review the stalled lift’s load, recovery, technique, or variation before adding more sets.",
    };
  }

  if (current < low) {
    return {
      muscle,
      tone: "yellow",
      label: evidence.sessions ? "Needs more work" : "No recent work",
      coverageText,
      evidence,
      previousEvidence,
      decision,
      signals,
      stalledSignals,
      why: `${evidenceText}. Your rolling ${MUSCLE_MAP_WINDOW_DAYS}-day total is ${formatNumber(item.deficit)} effective set${item.deficit === 1 ? "" : "s"} below the selected minimum of ${low}. Yellow means coverage needs attention; it is not a claim that the muscle is failing.`,
      action: decision.text,
    };
  }

  if (current > high) {
    return {
      muscle,
      tone: "yellow",
      label: "Review volume",
      coverageText,
      evidence,
      previousEvidence,
      decision,
      signals,
      stalledSignals,
      why: `${evidenceText}. Your rolling ${MUSCLE_MAP_WINDOW_DAYS}-day total is ${formatNumber(item.excess)} effective set${item.excess === 1 ? "" : "s"} above the selected maximum of ${high}. Yellow is used for a volume review; red is reserved for a verified logged progression stall.`,
      action: decision.text,
    };
  }

  if (inRange && recentImprovementSignals.length) {
    const names = recentImprovementSignals.map((signal) => signal.exercise.name).join(" and ");
    return {
      muscle,
      tone: "green",
      label: "On track",
      coverageText,
      evidence,
      previousEvidence,
      decision,
      signals,
      stalledSignals,
      why: `${evidenceText}. This is inside your selected ${low}–${high} range, and ${names} has a positive direct top-set comparison in the last ${MUSCLE_MAP_PROGRESS_LOOKBACK_DAYS} days.`,
      action: decision.text,
    };
  }

  return {
    muscle,
    tone: "yellow",
    label: "Build a baseline",
    coverageText,
    evidence,
    previousEvidence,
    decision,
    signals,
    stalledSignals,
    why: `${evidenceText}. Volume is in range, but green also needs a positive direct top-set comparison in the last ${MUSCLE_MAP_PROGRESS_LOOKBACK_DAYS} days. Missing RIR or too few comparable direct sessions stays yellow rather than being called a stall.`,
    action: "Keep the work repeatable and log load, reps, and RIR so the next direct comparison can be evaluated.",
  };
}

function getRecentMuscleExerciseRows(muscle, limit = 4) {
  const rows = [];
  const seenExerciseIds = new Set();
  const workouts = [...data.workouts].sort((a, b) => getWorkoutTimestamp(b) - getWorkoutTimestamp(a));
  workouts.forEach((workout) => workout.entries.forEach((entry) => {
    if (rows.length >= limit || seenExerciseIds.has(entry.exerciseId)) return;
    const exercise = getExercise(entry.exerciseId);
    if (!exercise) return;
    const isDirect = Array.isArray(exercise.primary) && exercise.primary.includes(muscle);
    const isSupporting = Array.isArray(exercise.secondary) && exercise.secondary.includes(muscle);
    if (!isDirect && !isSupporting) return;
    const performance = getEntryPerformance(entry);
    if (!performance) return;
    const sessions = getExerciseSessions(exercise.id);
    const sessionIndex = sessions.findIndex((session) => session.workout.id === workout.id);
    const previous = sessionIndex >= 0 ? sessions[sessionIndex + 1]?.performance || null : null;
    rows.push({ exercise, workout, entry, performance, role: isDirect ? "Direct" : "Supporting", comparison: getPerformanceComparison(performance, previous) });
    seenExerciseIds.add(entry.exerciseId);
  }));
  return rows;
}

function renderBodyMuscleMap() {
  const map = $("#bodyMuscleMap");
  const detail = $("#muscleMapDetail");
  if (!map || !detail) return;
  const window = getRollingMuscleMapWindow();
  const statuses = Object.fromEntries(MUSCLES.map((muscle) => [muscle, getMuscleMapStatus(muscle, window)]));
  const rankedMuscles = [...MUSCLES].sort((first, second) => {
    const firstStatus = statuses[first];
    const secondStatus = statuses[second];
    const priority = { red: 0, yellow: 1, green: 2 };
    return priority[firstStatus.tone] - priority[secondStatus.tone]
      || (secondStatus.decision.amount || 0) - (firstStatus.decision.amount || 0)
      || first.localeCompare(second);
  });
  if (!MUSCLES.includes(selectedBodyMuscle)) selectedBodyMuscle = rankedMuscles[0] || MUSCLES[0];
  const selected = statuses[selectedBodyMuscle];
  $$("[data-muscle-region]", map).forEach((region) => {
    const muscle = region.dataset.muscleRegion;
    const status = statuses[muscle];
    region.classList.remove("status-green", "status-yellow", "status-red", "is-selected");
    region.classList.add(`status-${status.tone}`);
    region.classList.toggle("is-selected", muscle === selectedBodyMuscle);
    region.setAttribute("aria-pressed", String(muscle === selectedBodyMuscle));
    region.setAttribute("aria-label", `${muscle}: ${status.label}. ${status.coverageText}. Select to view recent exercises.`);
  });
  const period = $("#muscleMapPeriod");
  if (period) period.textContent = formatMuscleMapPeriod(window);
  const summary = $("#muscleMapSummary");
  if (summary) {
    const counts = Object.values(statuses).reduce((total, status) => ({ ...total, [status.tone]: total[status.tone] + 1 }), { green: 0, yellow: 0, red: 0 });
    summary.textContent = `${counts.green} on track · ${counts.yellow} need attention · ${counts.red} stalled`;
  }
  const rows = getRecentMuscleExerciseRows(selected.muscle);
  const rowMarkup = rows.length
    ? rows.map((row) => {
      const comparisonClass = row.comparison.className === "flat" ? "flat" : "improved";
      const credit = row.role === "Direct" ? "1.0 credit / set" : "0.5 credit / set";
      return `<button type="button" class="muscle-exercise-row" data-open-exercise-history="${escapeHtml(row.exercise.id)}"><span class="exercise-badge">${escapeHtml(row.exercise.short || "•")}</span><span class="muscle-exercise-main"><strong>${escapeHtml(row.exercise.name)}</strong><small>${escapeHtml(formatDate(row.workout.date))} · ${escapeHtml(row.role)} · ${getQualifiedWorkingSets(row.entry).length} working sets · ${credit}</small><small>${escapeHtml(performanceLabel(row.performance))}</small></span><span class="muscle-exercise-change ${comparisonClass}">${escapeHtml(row.comparison.label)}</span></button>`;
    }).join("")
    : `<p class="muscle-detail-empty">No mapped working sets for ${escapeHtml(selected.muscle.toLowerCase())} are logged yet.</p>`;
  const stallDetail = selected.stalledSignals.length
    ? `<p class="muscle-stall-note"><strong>Stall check:</strong> ${escapeHtml(selected.stalledSignals.map((signal) => `${signal.exercise.name} (${signal.spanDays} days across 3 hard appearances)`).join(" · "))}</p>`
    : "";
  detail.innerHTML = `<div class="muscle-detail-status"><div><p class="eyebrow">SELECTED MUSCLE</p><h2>${escapeHtml(selected.muscle)}</h2></div><span class="muscle-status-pill ${selected.tone}">${escapeHtml(selected.label)}</span></div><p class="muscle-detail-coverage">${escapeHtml(selected.coverageText)}</p><p class="muscle-detail-why"><strong>WHY</strong> ${escapeHtml(selected.why)}</p>${stallDetail}<div class="muscle-next-action"><span>NEXT ACTION</span><p>${escapeHtml(selected.action)}</p></div><div class="muscle-recent-heading"><p class="eyebrow">RECENT RELATED EXERCISES</p><span>Click a row for full history</span></div><div class="muscle-exercise-list">${rowMarkup}</div><button type="button" class="secondary-button compact muscle-library-button" data-library-filter="${escapeHtml(selected.muscle)}">Browse compatible ${escapeHtml(selected.muscle.toLowerCase())} exercises →</button><p class="muscle-map-disclaimer">Status reflects logged training coverage and exercise performance—not a direct measurement of muscle growth.</p>`;
}

function selectBodyMuscle(muscle) {
  if (!MUSCLES.includes(muscle)) return;
  selectedBodyMuscle = muscle;
  renderBodyMuscleMap();
}

const TRANSLATIONS = {
  en: {
    overview: "Overview", workouts: "Workouts", insights: "Coach insights", body: "Body metrics", library: "Exercise library",
    data: "Data & backup", backup: "Backup JSON", export: "Export CSV", import: "Import file", log: "Log workout",
    workoutHeading: "Your workouts", workoutSubtitle: "Every logged working set feeds your training insights.",
    coachHeading: "Make the next set count.", bodyHeading: "See the trend, not one weigh-in.", libraryHeading: "Useful, not magical.",
    searchExercise: "Find an exercise", priority: "PRIORITY WORK FOR YOUR NEXT SESSION",
  },
  pl: {
    overview: "Przegląd", workouts: "Treningi", insights: "Wskazówki", body: "Pomiary ciała", library: "Ćwiczenia",
    data: "Dane i kopia", backup: "Kopia JSON", export: "Eksport CSV", import: "Importuj plik", log: "Dodaj trening",
    workoutHeading: "Twoje treningi", workoutSubtitle: "Każda zapisana seria robocza zasila analizę treningu.",
    coachHeading: "Wykorzystaj kolejną serię.", bodyHeading: "Patrz na trend, nie pojedynczy pomiar.", libraryHeading: "Praktycznie, bez magii.",
    searchExercise: "Znajdź ćwiczenie", priority: "PRIORYTETY NA NASTĘPNY TRENING",
  },
};

function t(key) {
  const locale = data?.profile?.locale === "pl" ? "pl" : "en";
  return TRANSLATIONS[locale][key] || TRANSLATIONS.en[key] || key;
}

function applyLocale() {
  const locale = data?.profile?.locale === "pl" ? "pl" : "en";
  document.documentElement.lang = locale;
  const nav = {
    dashboard: ["⌁", t("overview")],
    workouts: ["◫", t("workouts")],
    insights: ["◒", t("insights")],
    body: ["◌", t("body")],
    library: ["◇", t("library")],
  };
  Object.entries(nav).forEach(([view, [icon, label]]) => {
    const button = $(`.nav-item[data-view="${view}"]`);
    if (button) button.innerHTML = `<span class="nav-icon">${icon}</span> ${escapeHtml(label)}`;
  });
  if ($("#dataCenterButton")) $("#dataCenterButton").textContent = t("data");
  if ($("#backupButton")) $("#backupButton").textContent = t("backup");
  if ($("#exportCsvButton")) $("#exportCsvButton").textContent = t("export");
  if ($("#importFileButton")) $("#importFileButton").textContent = t("import");
  $$("[data-open-import-choice]").forEach((button) => { button.textContent = t("import"); });
  ["newWorkoutButton", "newWorkoutButton2"].forEach((id) => {
    const button = $(`#${id}`);
    if (button) button.innerHTML = `<span>＋</span> ${escapeHtml(t("log"))}`;
  });
  const workoutHeading = $("#workouts h1");
  if (workoutHeading) workoutHeading.textContent = t("workoutHeading");
  const workoutSubtitle = $("#workouts .page-heading .subtle");
  if (workoutSubtitle) workoutSubtitle.textContent = t("workoutSubtitle");
  if ($("#insights h1")) $("#insights h1").textContent = t("coachHeading");
  if ($("#body h1")) $("#body h1").textContent = t("bodyHeading");
  if ($("#library h1")) $("#library h1").textContent = t("libraryHeading");
  if ($("#exerciseSearch")) $("#exerciseSearch").placeholder = t("searchExercise");
  const priorityLabel = $("#nextSessionCard .eyebrow");
  if (priorityLabel) priorityLabel.textContent = t("priority");
}

function renderTopBar() {
  const now = new Date();
  $("#todayLabel").textContent = new Intl.DateTimeFormat(currentLocale(), { weekday: "long", month: "short", day: "numeric" }).format(now);
  const hour = now.getHours();
  $("#welcomeHeading").textContent = data.profile.locale === "pl"
    ? `${hour < 12 ? "Dzień dobry" : hour < 18 ? "Dobre popołudnie" : "Dobry wieczór"}, ${data.profile.name}.`
    : `Good ${hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}, ${data.profile.name}.`;
  $(".mini-profile strong").textContent = `${data.profile.name}'s training`;
  $(".mini-profile span").textContent = `${getGoalName(data.profile.goal)} · ${data.profile.days} days · ${data.profile.equipment?.machine ? "gym access" : "home gym"}`;
  $(".avatar").textContent = data.profile.name.slice(0, 1).toUpperCase();
}

function renderWeekHeader(week) {
  const range = `${new Intl.DateTimeFormat(currentLocale(), { month: "short", day: "numeric" }).format(week.start)} – ${new Intl.DateTimeFormat(currentLocale(), { month: "short", day: "numeric" }).format(addDays(week.start, 6))}`;
  $("#weekRange").textContent = isCurrentWeek() ? "This week" : range;
  $("#nextWeek").disabled = selectedWeekOffset >= 0;
  $("#nextWeek").style.opacity = selectedWeekOffset >= 0 ? ".35" : "1";
  const earliest = data.workouts.length
    ? getMonday(parseDate([...data.workouts].sort((a, b) => parseDate(a.date) - parseDate(b.date))[0].date))
    : getMonday();
  const selectedStart = getSelectedWeekStart();
  $("#prevWeek").disabled = selectedStart <= earliest;
  $("#prevWeek").title = selectedStart <= earliest ? "This is the earliest recorded week" : "Previous week";
}

function getComparablePreviousWorkouts(week) {
  if (!isCurrentWeek()) return week.previous;
  const elapsedDays = Math.min(7, Math.max(1, Math.floor((dayStart(new Date()) - week.start) / 86400000) + 1));
  return getSessionsInRange(week.previousStart, addDays(week.previousStart, elapsedDays));
}

function getEffortSummary(workouts) {
  const sets = workouts.flatMap((workout) => workout.entries.flatMap(getQualifiedWorkingSets));
  const withRir = sets.filter((set) => Number.isFinite(set.rir));
  return {
    total: sets.length,
    logged: withRir.length,
    nearFailure: withRir.filter((set) => set.rir >= 0 && set.rir <= 3).length,
    failure: withRir.filter((set) => set.rir <= 0).length,
  };
}

function renderStats(week) {
  const sets = week.workouts.reduce((total, workout) => total + getSessionSets(workout), 0);
  const focus = getFocusMuscles(week.totals);
  const targetHit = focus.filter((item) => item.current >= item.low && item.current <= item.high).length;
  const planned = Number(data.profile.days);
  const effort = getEffortSummary(week.workouts);
  const effortCoverage = effort.total ? Math.round((effort.logged / effort.total) * 100) : 0;
  const cards = [
    { label: "SESSIONS", value: `${week.workouts.length} / ${planned}`, detail: week.workouts.length >= planned ? "Weekly rhythm complete" : `${Math.max(0, planned - week.workouts.length)} planned remaining` },
    { label: "WORKING SETS", value: sets || "—", detail: sets ? "Warm-ups excluded; timed and distance work included" : "Log a session to start" },
    { label: "EFFORT CONTEXT", value: effort.total ? `${effortCoverage}%` : "—", detail: effort.logged ? `${effort.nearFailure} of ${effort.logged} logged sets at 0–3 RIR` : "Log RIR for safer progression", warning: effort.total > 0 && effortCoverage < 70 },
    { label: "MUSCLE TARGETS", value: `${targetHit} / ${MUSCLES.length}`, detail: targetHit >= 6 ? "Coverage is building" : "A few areas need work", warning: targetHit < 4 },
  ];
  $("#statGrid").innerHTML = cards.map((card) => `<article class="stat-card"><span class="stat-label">${card.label}</span><strong class="stat-value">${card.value}</strong><span class="stat-detail ${card.warning ? "warning" : ""}">${card.detail}</span></article>`).join("");
}

function renderSetChart(week) {
  const daily = DAYS.map((label, index) => {
    const date = addDays(week.start, index);
    const key = toDateInput(date);
    const sessions = week.workouts.filter((workout) => workout.date === key);
    return { label, date, sets: sessions.reduce((sum, workout) => sum + getSessionSets(workout), 0), sessions: sessions.length };
  });
  const max = Math.max(...daily.map((item) => item.sets), 1);
  const chart = $("#setChart");
  chart.innerHTML = daily.map((item) => {
    const height = item.sets ? Math.max(10, Math.round((item.sets / max) * 120)) : 3;
    const setLabel = `${item.sets} working set${item.sets === 1 ? "" : "s"}`;
    const accessible = `${item.label}: ${item.sets ? setLabel : "No working sets"}, ${item.sessions} session${item.sessions === 1 ? "" : "s"}`;
    return `<div class="bar-day" tabindex="0" role="img" aria-label="${escapeHtml(accessible)}"><div class="bar-value ${item.sets ? "has-data" : ""}" style="height:${height}px"><span class="bar-tooltip">${item.sets ? setLabel : "No working sets"}</span></div><span class="bar-label">${item.label}</span></div>`;
  }).join("");
  chart.setAttribute("aria-label", daily.map((item) => `${item.label}: ${item.sets} working set${item.sets === 1 ? "" : "s"}`).join("; "));
  const totalSets = daily.reduce((sum, item) => sum + item.sets, 0);
  const previousSets = getComparablePreviousWorkouts(week).reduce((sum, workout) => sum + getSessionSets(workout), 0);
  const change = previousSets ? Math.round(((totalSets - previousSets) / previousSets) * 100) : 0;
  $("#setDelta").textContent = previousSets ? `${change >= 0 ? "+" : ""}${change}%` : "New";
  $("#setDeltaLabel").textContent = isCurrentWeek() ? "vs. same days last week" : "vs. previous week";
  $("#setTotalLabel").textContent = totalSets ? `${totalSets} working set${totalSets === 1 ? "" : "s"}` : "No working sets yet";
}

function renderNutrition(latestWeight) {
  const days = [...(data.nutritionDays || [])].sort((first, second) => first.date.localeCompare(second.date));
  const latest = days.at(-1);
  const recent = days.slice(-7);
  const status = $("#fitatuImportStatus");
  if (status) {
    status.textContent = days.length ? `${days.length} DAY${days.length === 1 ? "" : "S"}` : "NO DATA";
    status.className = `status-pill ${days.length ? "" : "neutral"}`;
  }
  const average = (field) => {
    const values = recent.map((day) => day[field]).filter(Number.isFinite);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };
  const summary = $("#nutritionSummary");
  if (summary) {
    const cards = [
      ["AVG CALORIES", average("caloriesKcal"), "kcal"],
      ["AVG PROTEIN", average("proteinG"), "g"],
      ["AVG CARBS", average("carbsG"), "g"],
      ["AVG FAT", average("fatG"), "g"],
    ];
    summary.innerHTML = cards.map(([label, value, unit]) => (
      `<article><span>${label}</span><strong>${value === null ? "—" : `${escapeHtml(formatNumber(Math.round(value * 10) / 10))} ${unit}`}</strong><small>${recent.length ? `Latest ${recent.length} imported day${recent.length === 1 ? "" : "s"}` : "Import a Fitatu CSV"}</small></article>`
    )).join("");
  }
  const history = $("#nutritionHistory");
  if (history) {
    history.innerHTML = days.length
      ? days.slice(-14).reverse().map((day) => (
        `<article class="nutrition-day-row"><time datetime="${escapeHtml(day.date)}">${escapeHtml(formatDate(day.date, { month: "short", day: "numeric" }))}</time>`
          + `<span><small>Calories</small>${day.caloriesKcal === null ? "—" : `${escapeHtml(formatNumber(day.caloriesKcal))} kcal`}</span>`
          + `<span><small>Protein</small>${day.proteinG === null ? "—" : `${escapeHtml(formatNumber(day.proteinG))} g`}</span>`
          + `<span><small>Carbs</small>${day.carbsG === null ? "—" : `${escapeHtml(formatNumber(day.carbsG))} g`}</span>`
          + `<span><small>Fat</small>${day.fatG === null ? "—" : `${escapeHtml(formatNumber(day.fatG))} g`}</span></article>`
      )).join("")
      : `<div class="nutrition-empty">No Fitatu nutrition imported yet. Export CSV in Fitatu and select it here or through Import file.</div>`;
  }
  const proteinLabel = $("#dailyProteinLabel");
  if (latest?.proteinG !== null && latest?.proteinG !== undefined) {
    if (proteinLabel) proteinLabel.textContent = "LATEST FITATU PROTEIN";
    $("#dailyProteinTarget").textContent = `${formatNumber(latest.proteinG)} g`;
    if (latestWeight) {
      const startingPoint = latestWeight.value * 1.6;
      const percentage = startingPoint ? Math.round((latest.proteinG / startingPoint) * 100) : 0;
      $("#dailyProteinDetail").textContent = `${formatDate(latest.date)} · ${percentage}% of the 1.6 g/kg starting point`;
    } else {
      $("#dailyProteinDetail").textContent = `${formatDate(latest.date)} · log weight to add body-weight context`;
    }
  } else if (proteinLabel) {
    proteinLabel.textContent = "PROTEIN STARTING POINT";
  }
}

function renderBodyMetrics() {
  const weightSeries = getDailyBodyMetricSeries("weightKg");
  const bodyFatSeries = getDailyBodyMetricSeries("bodyFatPercent");
  const windowValue = $("#bodyChartWindow")?.value || "90";
  const cutoff = windowValue === "all" ? null : addDays(dayStart(new Date()), -Number(windowValue));
  const inWindow = (series) => cutoff ? series.filter((item) => parseDate(item.date) >= cutoff) : series;
  const chartWeightSeries = inWindow(weightSeries).map((item) => ({ ...item, value: kgToDisplay(item.value) }));
  const chartBodyFatSeries = inWindow(bodyFatSeries);
  const latestWeight = weightSeries.at(-1);
  const latestBodyFat = bodyFatSeries.at(-1);
  const setText = (id, value) => { const element = $(`#${id}`); if (element) element.textContent = value; };
  const setHtml = (id, value) => { const element = $(`#${id}`); if (element) element.innerHTML = value; };
  setText("bodyCurrentWeight", latestWeight ? formatKg(latestWeight.value) : "—");
  setText("bodyWeightDelta", getMetricDelta(weightSeries.map((item) => ({ ...item, value: kgToDisplay(item.value) })), ` ${weightUnit()}`));
  setText("bodyCurrentFat", latestBodyFat ? formatMetricValue(latestBodyFat.value, "%") : "—");
  setText("bodyFatDelta", getMetricDelta(bodyFatSeries, "%"));
  if (latestWeight) {
    const proteinStart = Math.round(latestWeight.value * 1.6);
    const proteinLow = Math.round(latestWeight.value * 1.4);
    const proteinHigh = Math.round(latestWeight.value * 2);
    setText("dailyProteinTarget", `${proteinStart} g`);
    setText("dailyProteinDetail", `${proteinLow}–${proteinHigh} g practical range at ${formatNumber(latestWeight.value)} kg`);
  } else {
    setText("dailyProteinTarget", "—");
    setText("dailyProteinDetail", "Log weight to estimate 1.6 g/kg/day");
  }
  renderNutrition(latestWeight);
  setHtml("weightTrendChart", buildBodyTrendChart(chartWeightSeries, ` ${weightUnit()}`, "Weight", "#8cb91a"));
  setHtml("fatTrendChart", buildBodyTrendChart(chartBodyFatSeries, "%", "Body-fat", "#d38a34"));
  const history = getBodyMetricHistory();
  setText("bodyMetricCount", `${history.length} measurement${history.length === 1 ? "" : "s"}`);
  setHtml("bodyMetricHistory", history.length
    ? history.map((metric) => {
      const source = metric.source === "garmin" ? "Garmin" : "Manual";
      const mainValue = metric.weightKg !== null ? formatKg(metric.weightKg) : "Body-fat check-in";
      const condition = ({ "morning-fasted": "Morning / fasted", morning: "Morning", evening: "Evening", other: "Other conditions" })[metric.condition] || "";
      const detail = [condition, metric.note || `${source} check-in`].filter(Boolean).join(" · ");
      const bodyFat = metric.bodyFatPercent !== null ? `${formatMetricValue(metric.bodyFatPercent, "%")} fat` : "—";
      return `<article class="body-metric-row"><div class="body-metric-date">${escapeHtml(formatDate(metric.date))}<br><span>${escapeHtml(source)}</span></div><div class="body-metric-main"><strong>${escapeHtml(mainValue)}</strong><span>${escapeHtml(detail)}</span></div><div class="body-metric-values">${escapeHtml(bodyFat)}</div><button type="button" class="text-button compact" data-edit-body-metric="${escapeHtml(metric.id)}">Edit</button><button type="button" class="delete-body-metric" data-delete-body-metric="${escapeHtml(metric.id)}" aria-label="Delete measurement from ${escapeHtml(metric.date)}">×</button></article>`;
    }).join("")
    : `<div class="empty-state">No body measurements yet.<br><button class="primary-button" type="button" data-open-body-metric>Log your first measurement</button></div>`);
  const garminStatus = $("#garminStatus");
  if (garminStatus) {
    const state = data.integrations?.garmin?.status;
    garminStatus.textContent = state === "connected" ? "Connected" : "Setup required";
    garminStatus.className = `status-pill ${state === "connected" ? "" : "warning"}`;
  }
  const connected = data.integrations?.garmin?.status === "connected";
  const modalStatus = $("#garminModalStatus");
  if (modalStatus) modalStatus.className = `garmin-setup-status ${connected ? "connected" : ""}`;
  setText("garminModalIcon", connected ? "✓" : "!");
  setText("garminModalTitle", connected ? "Connection status recorded" : "Not connected");
  setText("garminModalCopy", connected
    ? "A Garmin connection is recorded in this local data, but this static app cannot refresh it yet."
    : "No Garmin account has been authorized in Liftwise.");
  setText("garminModalDescription", connected
    ? "Stored Garmin measurements can be displayed here. A secure server-side integration is still required before Liftwise can authorize or sync your account."
    : "Garmin Connect does not provide an in-browser connection that this static app can safely complete on its own. A future integration needs a server-side OAuth flow, encrypted token storage, and an approved Garmin API connection.");
  const setupList = $("#garminSetupList");
  if (setupList) setupList.hidden = connected;
  setText("garminConnectButton", connected ? "View connection details" : "View Garmin setup");
}

function renderRecovery() {
  const context = getRecoveryContext();
  const card = $("#recoveryCard");
  if (!card) return;
  card.className = `card recovery-card ${context.level}`;
  $("#recoveryTitle").textContent = context.title;
  $("#recoverySummary").textContent = context.summary;
  const status = $("#recoveryStatus");
  status.textContent = context.label;
  status.className = `status-pill ${context.level === "caution" ? "warning" : ["low", "stop"].includes(context.level) ? "low" : context.level === "unknown" ? "neutral" : ""}`;
  $("#recoveryFactors").innerHTML = context.factors.length
    ? context.factors.map((factor) => `<span>${escapeHtml(factor)}</span>`).join("")
    : `<span>Sleep</span><span>Energy</span><span>Soreness</span><span>Stress</span>`;
  $("#recoveryCheckinButton").textContent = context.level === "unknown" ? "Check readiness" : "Update check-in";
}

function renderRecoveryHistory() {
  const container = $("#recoveryHistory");
  if (!container) return;
  const cutoff = addDays(dayStart(new Date()), -29);
  const checkins = [...(data.recoveryCheckins || [])]
    .filter((checkin) => parseDate(checkin.date) >= cutoff)
    .sort((a, b) => parseDate(b.date) - parseDate(a.date));
  container.innerHTML = checkins.length ? checkins.map((checkin) => {
    const workouts = data.workouts.filter((workout) => workout.date === checkin.date);
    return `<article class="recovery-history-row"><time>${escapeHtml(formatDate(checkin.date, { month: "short", day: "numeric" }))}</time><div><strong>${formatNumber(checkin.sleepHours)} h sleep · ${checkin.energy}/5 energy</strong><span>${checkin.soreness}/5 soreness · ${checkin.stress}/5 stress${checkin.painConcern ? " · pain concern" : ""}</span>${checkin.note ? `<small>${escapeHtml(checkin.note)}</small>` : ""}</div><span>${workouts.length ? `${workouts.length} workout${workouts.length === 1 ? "" : "s"} logged` : "Rest / no workout logged"}</span></article>`;
  }).join("") : `<div class="empty-state">No recovery check-ins in the last 30 days.</div>`;
}

function renderRhythm(week) {
  const completed = week.workouts.length;
  const goal = Math.max(1, Number(data.profile.days));
  const ratio = Math.min(completed / goal, 1);
  $("#workoutCount").textContent = completed;
  $("#rhythmRing").style.strokeDashoffset = String(301.6 * (1 - ratio));
  const pill = $("#rhythmPill");
  pill.className = "status-pill";
  if (ratio >= 1) pill.textContent = "Complete";
  else if (ratio >= .6) pill.textContent = "On track";
  else { pill.textContent = "Build momentum"; pill.classList.add("warning"); }
  const remaining = Math.max(0, goal - completed);
  $("#rhythmCopy").innerHTML = completed >= goal ? "Your planned sessions are logged. <strong>Prioritize recovery and quality.</strong>" : `<strong>${remaining} session${remaining === 1 ? "" : "s"} remaining</strong> to meet your weekly rhythm.`;
  const todayKey = toDateInput(new Date());
  $("#weeklyDots").innerHTML = DAYS.map((label, index) => {
    const date = addDays(week.start, index);
    const key = toDateInput(date);
    const done = week.workouts.some((workout) => workout.date === key);
    const accessibleLabel = `${new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric" }).format(date)}: ${done ? "session logged" : "no session logged"}${key === todayKey ? ", today" : ""}`;
    return `<span class="day-dot ${done ? "done" : ""} ${key === todayKey ? "today" : ""}" aria-label="${escapeHtml(accessibleLabel)}" title="${escapeHtml(accessibleLabel)}">${label.slice(0, 1)}</span>`;
  }).join("");
}

function renderMuscleCoverage(week) {
  const focus = getFocusMuscles(week.totals);
  $("#muscleCoverage").innerHTML = focus.map((item) => {
    const scale = Math.max(item.high * 1.2, item.current, 1);
    const rate = Math.min(100, (item.current / scale) * 100);
    const bandStart = Math.min(100, (item.low / scale) * 100);
    const bandEnd = Math.min(100, (item.high / scale) * 100);
    const className = item.excess ? "over" : item.current < item.low ? "under" : "target";
    const status = item.excess ? "above range" : item.current < item.low ? "below range" : "in target range";
    const statusText = item.deficit ? `${formatNumber(item.deficit)} short` : item.excess ? `${formatNumber(item.excess)} above plan` : "in range";
    const aria = `${item.muscle}: ${formatNumber(item.current)} effective sets, ${statusText}, selected planning range ${item.low} to ${item.high}`;
    return `<div class="muscle-row" aria-label="${escapeHtml(aria)}"><span class="muscle-name">${item.muscle}</span><div class="muscle-track" title="${escapeHtml(aria)}"><span class="muscle-plan-band" style="left:${bandStart}%;width:${Math.max(1, bandEnd - bandStart)}%"></span><div class="muscle-fill ${className}" style="width:${rate}%"></div></div><span class="muscle-sets"><strong>${formatNumber(item.current)}</strong><small>${escapeHtml(statusText)}</small></span></div>`;
  }).join("");
}

function getTrackedExerciseIds(limit = 5) {
  const ids = [];
  sortRecent(data.workouts).forEach((workout) => workout.entries.forEach((entry) => {
    if (ids.length >= limit || ids.includes(entry.exerciseId) || !isExerciseAvailable(getExercise(entry.exerciseId))) return;
    ids.push(entry.exerciseId);
  }));
  ["bench-press", "db-bench", "pull-up", "one-arm-db-row", "rdl", "split-squat", "ohp"].forEach((id) => {
    if (ids.length < limit && !ids.includes(id) && isExerciseAvailable(getExercise(id)) && getExerciseHistory(id).length) ids.push(id);
  });
  return ids;
}

function renderProgressList() {
  const items = getTrackedExerciseIds(4).map((id) => getProgressDecision(id)).filter(Boolean);
  $("#progressList").innerHTML = items.map((item) => {
    const previousValue = item.previous ? performanceScore(item.previous) : performanceScore(item.latest);
    const currentValue = performanceScore(item.latest);
    const diff = Math.round(((currentValue - previousValue) / Math.max(previousValue, 1)) * 100);
    const diffText = !item.previous ? "Logged" : diff > 0 ? `+${diff}%` : diff < 0 ? `${diff}%` : "Steady";
    const effort = ["load_reps", "reps"].includes(item.latest.measurementMode)
      ? ` · ${Number.isFinite(item.latest.rir) ? `${formatNumber(item.latest.rir)} RIR` : "effort not logged"}`
      : "";
    return `<div class="progress-item"><span class="exercise-badge">${escapeHtml(item.exercise.short)}</span><div class="progress-main"><strong>${escapeHtml(item.exercise.name)}</strong><span>${escapeHtml(performanceLabel(item.latest))}${escapeHtml(effort)}</span></div><span class="progress-number ${diff <= 0 ? "flat" : ""}">${diffText}</span></div>`;
  }).join("");
}

function daysSinceDirectMuscleWork(muscle) {
  const dates = [];
  data.workouts.forEach((workout) => workout.entries.forEach((entry) => {
    const exercise = getExercise(entry.exerciseId);
    if (exercise?.primary?.includes(muscle) && getQualifiedWorkingSets(entry).length) dates.push(workout.date);
  }));
  if (!dates.length) return null;
  const latest = dates.sort((a, b) => parseDate(b) - parseDate(a))[0];
  return Math.max(0, Math.floor((dayStart(new Date()) - dayStart(parseDate(latest))) / 86400000));
}

function bestExerciseForMuscle(muscle, excludedIds = []) {
  return getAvailableExercises()
    .filter((exercise) => exercise.primary?.includes(muscle) && !excludedIds.includes(exercise.id))
    .map((exercise, libraryIndex) => {
      const sessions = getExerciseSessions(exercise.id);
      return {
        exercise,
        familiar: sessions.length > 0 ? 1 : 0,
        lastUsed: sessions[0] ? getWorkoutTimestamp(sessions[0].workout) : 0,
        libraryIndex,
      };
    })
    .sort((a, b) => b.familiar - a.familiar || b.lastUsed - a.lastUsed || a.libraryIndex - b.libraryIndex)[0]?.exercise || null;
}

function buildSuggestionPlan(totals) {
  const allFocus = getFocusMuscles(totals);
  const withRecovery = allFocus.map((item) => ({ ...item, daysSinceDirect: daysSinceDirectMuscleWork(item.muscle) }));
  const deficits = withRecovery.filter((item) => item.deficit > 0).sort((a, b) => {
    const aRecent = a.daysSinceDirect !== null && a.daysSinceDirect < 2 ? 1 : 0;
    const bRecent = b.daysSinceDirect !== null && b.daysSinceDirect < 2 ? 1 : 0;
    return aRecent - bRecent || b.deficit - a.deficit || a.current - b.current;
  });
  const maintenance = [...withRecovery].sort((a, b) => (a.current / Math.max(a.high, 1)) - (b.current / Math.max(b.high, 1)));
  const priorityPool = deficits.length ? deficits : maintenance;
  const priorities = priorityPool.slice(0, 2);
  const first = priorities[0]?.muscle || "Back";
  const second = priorities[1]?.muscle || null;
  const exercisePlans = [];
  priorities.forEach((priority) => {
    const exercise = bestExerciseForMuscle(priority.muscle, exercisePlans.map((plan) => plan.exerciseId))
      || bestExerciseForMuscle(priority.muscle);
    if (!exercise) return;
    const setCount = priority.deficit > 0
      ? Math.min(MAX_VOLUME_ADJUSTMENT_SETS, Math.max(1, Math.ceil(priority.deficit)))
      : 2;
    const existing = exercisePlans.find((plan) => plan.exerciseId === exercise.id);
    if (existing) {
      existing.muscles.push(priority.muscle);
      existing.sets = Math.max(existing.sets, setCount);
    } else {
      exercisePlans.push({ exerciseId: exercise.id, sets: setCount, muscles: [priority.muscle] });
    }
  });
  return {
    first,
    second,
    exercises: exercisePlans.map((plan) => plan.exerciseId),
    exercisePlans,
    priorities,
    allFocus: withRecovery,
    hasDeficits: deficits.length > 0,
    equipment: availableEquipmentText(),
  };
}

function renderNextSession() {
  const planningWeek = getWeekData(0);
  suggestionPlan = buildSuggestionPlan(planningWeek.totals);
  const { first, second, exercises } = suggestionPlan;
  const recovery = getRecoveryContext();
  const scheduledRoutine = (data.routines || []).find((routine) => routine.weekdays?.includes(new Date().getDay()));
  suggestionPlan.routineId = scheduledRoutine?.id || null;
  suggestionPlan.recovery = recovery;
  suggestionPlan.targetRir = recovery.level === "low" ? 4 : recovery.level === "caution" ? 3 : 2;
  if (recovery.level === "low" || recovery.level === "caution") {
    suggestionPlan.exercisePlans = suggestionPlan.exercisePlans.map((plan) => ({ ...plan, sets: Math.min(2, plan.sets) }));
  }
  const movement = first === "Back" || first === "Biceps" ? "Pull" : ["Quads", "Hamstrings", "Glutes", "Calves"].includes(first) ? "Lower" : "Upper";
  $("#nextSessionName").textContent = recovery.level === "stop"
    ? "Pause — assess pain first"
    : recovery.level === "low"
      ? "Recovery — reduce today’s stress"
      : recovery.level === "caution"
        ? `${movement} — quality focus`
        : `${movement} — ${first.toLowerCase()} focus`;
  const names = exercises.map((id) => getExercise(id)?.name).filter(Boolean);
  const useButton = $("#startSuggestedWorkout");
  useButton.disabled = !exercises.length || recovery.level === "stop";
  useButton.textContent = recovery.level === "stop" ? "Suggested session paused" : recovery.level === "low" ? "Review lighter session →" : "Review session →";
  useButton.title = recovery.level === "stop"
    ? "A pain concern pauses automated workout suggestions"
    : exercises.length ? "Open a compatible suggested session" : "No compatible movements are available in your equipment profile";
  if (recovery.level === "stop") {
    $("#nextSessionSummary").innerHTML = `<strong>New or unusual pain overrides coverage gaps.</strong> Avoid painful work and get appropriate assessment when needed. You can still log a manually adapted session.`;
  } else if (recovery.coachingOverride) {
    const cautiousPlan = suggestionPlan.exercisePlans.map((plan) => `${plan.sets} set${plan.sets === 1 ? "" : "s"} of ${escapeHtml(getExercise(plan.exerciseId)?.name || "the selected movement")}`).join(" and ");
    $("#nextSessionSummary").innerHTML = `<strong>${escapeHtml(recovery.label)}:</strong> ${escapeHtml(recovery.summary)} ${names.length ? `If you train, keep it to ${cautiousPlan}.` : ""}`;
  } else {
    const priorityNames = [first, second].filter(Boolean);
    const plannedMovements = suggestionPlan.exercisePlans.map((plan) => `${plan.sets} quality set${plan.sets === 1 ? "" : "s"} of ${escapeHtml(getExercise(plan.exerciseId)?.name || "the selected movement")}`).join(" · ");
    $("#nextSessionSummary").innerHTML = suggestionPlan.hasDeficits
      ? `<strong>Target ${priorityNames.length === 1 ? "the current-week gap" : "two current-week gaps"}:</strong> ${priorityNames.map(escapeHtml).join(" and ")}. ${names.length ? plannedMovements : "No compatible movement is enabled for this focus; update your equipment profile."}`
      : `<strong>Your selected ranges are covered.</strong> Use a maintenance session with familiar compatible movements for ${[first, second].filter(Boolean).map((muscle) => escapeHtml(muscle.toLowerCase())).join(" and ")}, keeping quality and recovery in charge.`;
  }
  if (scheduledRoutine && recovery.level !== "stop") {
    $("#nextSessionName").textContent = scheduledRoutine.name;
    $("#nextSessionSummary").innerHTML = `<strong>Your scheduled routine stays in charge.</strong> ${escapeHtml(scheduledRoutine.name)} contains ${scheduledRoutine.entries.length} exercise${scheduledRoutine.entries.length === 1 ? "" : "s"}. Current coverage priorities are ${[first, second].filter(Boolean).map(escapeHtml).join(" and ") || "maintenance"}; treat them as optional adjustments, not replacements.`;
    useButton.textContent = `Start ${scheduledRoutine.name} →`;
    useButton.disabled = false;
  }
  const focus = getFocusMuscles(planningWeek.totals).filter((item) => item.deficit > 0).sort((a, b) => b.deficit - a.deficit);
  const subtitle = recovery.coachingOverride
    ? `${recovery.label}: today’s self-report is holding volume additions.`
    : focus.length ? `${focus[0].muscle} is ${formatNumber(focus[0].deficit)} effective sets below your weekly starting range. Build it with repeatable, good-form work.` : "All current muscle groups are within your targets. Keep the next session enjoyable and recover well.";
  $("#dashboardSubtitle").textContent = subtitle;
}

function renderDemoBanner() {
  const banner = $("#demoBanner");
  if (!banner) return;
  const count = data.workouts.filter((workout) => String(workout.id).startsWith("seed-")).length;
  banner.hidden = count === 0;
  const detail = $("span", banner);
  if (detail) detail.textContent = `${count} sample session${count === 1 ? "" : "s"} illustrate the coaching logic but are not your training history.`;
}

function clearDemoWorkouts() {
  const demoCount = data.workouts.filter((workout) => String(workout.id).startsWith("seed-")).length;
  if (!demoCount) return;
  if (!window.confirm(`Remove ${demoCount} demo workout${demoCount === 1 ? "" : "s"} and keep any workouts you logged or imported?`)) return;
  const previous = data.workouts;
  data.workouts = data.workouts.filter((workout) => !String(workout.id).startsWith("seed-"));
  if (!saveData()) {
    data.workouts = previous;
    showToast("The demo workouts could not be removed from browser storage.");
    return;
  }
  renderAll();
  showToast("Demo workouts removed. Your log is ready.");
}

function renderDashboard() {
  const week = getWeekData();
  renderDemoBanner();
  renderWeekHeader(week);
  renderStats(week);
  renderSetChart(week);
  renderRhythm(week);
  renderMuscleCoverage(week);
  renderProgressList();
  renderRecovery();
  renderNextSession();
}

function getFilteredWorkouts() {
  let recent = sortRecent(data.workouts);
  const today = dayStart();
  if (workoutFilter === "week") recent = recent.filter((workout) => {
    const date = parseDate(workout.date);
    return date >= getMonday() && date < addDays(getMonday(), 7);
  });
  if (workoutFilter === "month") {
    const monthAgo = addDays(today, -30);
    recent = recent.filter((workout) => parseDate(workout.date) >= monthAgo);
  }
  const query = normalizeExerciseName(workoutSearch);
  if (query) recent = recent.filter((workout) => (
    normalizeExerciseName(workout.name).includes(query)
    || workout.entries.some((entry) => normalizeExerciseName(exerciseDisplayName(entry)).includes(query))
  ));
  if (workoutSourceFilter !== "all") {
    recent = recent.filter((workout) => (
      workoutSourceFilter === "manual"
        ? !workout.source || workout.source === "manual"
        : workout.source && workout.source !== "manual"
    ));
  }
  if (workoutMissingRirOnly) {
    recent = recent.filter((workout) => workout.entries.some((entry) => (
      getWorkingSets(entry).some((set) => !Number.isFinite(set.rir))
    )));
  }
  if (workoutDateFrom) recent = recent.filter((workout) => workout.date >= workoutDateFrom);
  if (workoutDateTo) recent = recent.filter((workout) => workout.date <= workoutDateTo);
  return recent;
}

function persistViewState() {
  try {
    sessionStorage.setItem(VIEW_STATE_KEY, JSON.stringify({
      activeView,
      workoutFilter,
      workoutSearch,
      workoutSourceFilter,
      workoutMissingRirOnly,
      workoutDateFrom,
      workoutDateTo,
    }));
  } catch (error) {
    console.warn("View state could not be stored", error);
  }
}

function renderRoutines() {
  const list = $("#routineList");
  const section = $("#routineSection");
  if (!list || !section) return;
  const routines = data.routines || [];
  section.hidden = !routines.length;
  list.innerHTML = routines.map((routine) => {
    const unavailable = routine.entries.filter((entry) => !isExerciseAvailable(getExercise(entry.exerciseId))).length;
    const exerciseNames = routine.entries.map((entry) => getExercise(entry.exerciseId)?.name || "Unknown").join(" · ");
    const todayAssigned = routine.weekdays.includes(new Date().getDay());
    const assignedDays = routine.weekdays.map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]).join(", ");
    return `<article class="routine-card"><div><strong>${escapeHtml(routine.name)}</strong><span>${routine.entries.length} exercises · ${escapeHtml(exerciseNames)}</span><small>${assignedDays ? `Scheduled: ${escapeHtml(assignedDays)}` : "No weekly assignment"}${unavailable ? ` · ${unavailable} unavailable` : ""}</small></div><button type="button" class="text-button compact" data-toggle-routine-today="${escapeHtml(routine.id)}">${todayAssigned ? "Remove today" : "Assign today"}</button><button type="button" class="secondary-button compact" data-start-routine="${escapeHtml(routine.id)}">Start</button><button type="button" class="icon-button" data-delete-routine="${escapeHtml(routine.id)}" aria-label="Delete ${escapeHtml(routine.name)}">×</button></article>`;
  }).join("");
}

function renderWorkouts() {
  const workouts = getFilteredWorkouts();
  const days = Domain.groupWorkoutsByDay(workouts);
  const visibleDays = days.slice(0, workoutPage * WORKOUT_PAGE_SIZE);
  $("#workoutCountLabel").textContent = `${workouts.length} session${workouts.length === 1 ? "" : "s"} across ${days.length} day${days.length === 1 ? "" : "s"}`;
  renderRoutines();
  if (!workouts.length) {
    $("#workoutList").innerHTML = `<div class="empty-state">No sessions in this period.<br><button class="primary-button" data-open-workout>Log your first workout</button></div>`;
    return;
  }
  $("#workoutList").innerHTML = visibleDays.map((day) => {
    const date = parseDate(day.date);
    const exerciseNames = day.entries.slice(0, 5).map((entry) => escapeHtml(exerciseDisplayName(entry))).join(" · ");
    const extra = day.entries.length > 5 ? ` +${day.entries.length - 5}` : "";
    const totalDuration = day.sessions.reduce((total, workout) => total + (nullableNumber(workout.duration) || 0), 0);
    const totalSets = day.sessions.reduce((total, workout) => total + getSessionSets(workout), 0);
    const sessionRows = day.sessions.map((workout) => {
      const source = !workout.source || workout.source === "manual" ? "Manual" : "Imported";
      return `<div class="day-session-row"><button class="workout-main" data-open-workout="${escapeHtml(workout.id)}" aria-label="View ${escapeHtml(workout.name)} details"><strong>${escapeHtml(workout.name)}</strong><span>${source} · ${formatNumber(workout.duration || 0)} min · ${getSessionSets(workout)} sets</span></button><button class="delete-session" data-delete-workout="${escapeHtml(workout.id)}" title="Delete session" aria-label="Delete ${escapeHtml(workout.name)}">×</button></div>`;
    }).join("");
    return `<article class="workout-day-card"><header><div class="workout-date"><strong>${date.getDate()}</strong>${new Intl.DateTimeFormat(currentLocale(), { month: "short" }).format(date)}</div><div><strong>${escapeHtml(new Intl.DateTimeFormat(currentLocale(), { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(date))}</strong><span>${day.sessions.length} session${day.sessions.length === 1 ? "" : "s"} · ${day.entries.length} unique exercise${day.entries.length === 1 ? "" : "s"}</span></div><span>${formatNumber(totalDuration)} min · ${totalSets} sets</span></header><p class="day-exercise-summary">${exerciseNames}${extra}</p><div class="day-session-list">${sessionRows}</div></article>`;
  }).join("") + (visibleDays.length < days.length ? `<button type="button" class="secondary-button load-more-button" data-load-more-workouts>Load more days</button>` : "");
  persistViewState();
}

function exerciseDisplayName(entry) {
  return getExercise(entry.exerciseId)?.name || entry.sourceExerciseName || "Unknown exercise";
}

function setChipMarkup(set, index) {
  const setType = String(set.type || "normal").toLowerCase();
  const isWarmup = setType === "warmup";
  const isDropSet = setType === "dropset";
  const load = set.weightKg && set.weightKg > 0 ? formatKg(set.weightKg) : "Bodyweight";
  const reps = Number.isFinite(set.reps) ? `× ${formatNumber(set.reps)}` : "";
  const effort = Number.isFinite(set.rir)
    ? set.effortSource === "derived-from-rpe"
      ? `${formatNumber(set.rir)} RIR (estimated from RPE ${formatNumber(set.rawRpe ?? set.rpe)})`
      : set.effortSource === "manual"
        ? `${formatNumber(set.rir)} RIR (manual)`
        : `${formatNumber(set.rir)} RIR (imported)`
    : set.effortSource === "manual-cleared" ? "RIR intentionally cleared" : "";
  const duration = Number.isFinite(set.durationSeconds) ? formatDuration(set.durationSeconds) : "";
  const distance = Number.isFinite(set.distanceMeters) ? `${formatNumber(set.distanceMeters)}m` : "";
  const extras = [effort, duration, distance].filter(Boolean).join(" · ");
  return `<span class="set-chip ${isWarmup ? "warmup" : isDropSet ? "dropset" : ""}"><span class="set-type">S${index + 1}${isWarmup ? " warm-up" : isDropSet ? " drop" : ""}</span><strong>${load} ${reps}</strong>${extras ? `<span>${extras}</span>` : ""}</span>`;
}

function rirSetEditorMarkup(set, entryIndex, setIndex) {
  const setType = String(set.type || "normal").toLowerCase();
  const typeLabel = setType === "warmup" ? " · warm-up" : setType === "dropset" ? " · drop set" : "";
  const load = set.weightKg && set.weightKg > 0 ? formatKg(set.weightKg) : "Bodyweight";
  const reps = Number.isFinite(set.reps) ? ` × ${formatNumber(set.reps)}` : "";
  const sourceLabel = set.effortSource === "derived-from-rpe"
    ? `Estimated from imported RPE ${formatNumber(set.rawRpe ?? set.rpe)}`
    : set.effortSource === "manual"
      ? "Manual override"
      : set.effortSource === "imported-rir"
        ? "Imported RIR"
        : set.effortSource === "manual-cleared"
          ? "Intentionally cleared"
          : "RIR missing";
  const value = Number.isFinite(set.rir) ? String(set.rir) : "";
  return `<div class="rir-set-row" data-rir-missing="${Number.isFinite(set.rir) ? "false" : "true"}"><div class="rir-set-summary"><span>S${setIndex + 1}${typeLabel}</span><strong>${load}${reps}</strong><small>${escapeHtml(sourceLabel)}</small></div><label><span>RIR</span><input type="text" inputmode="decimal" value="${escapeHtml(value)}" data-rir-original="${escapeHtml(value)}" data-rir-entry="${entryIndex}" data-rir-set="${setIndex}" aria-label="Set ${setIndex + 1} RIR"></label></div>`;
}

function getPreviousExerciseSession(exerciseId, workoutId) {
  const sessions = getExerciseSessions(exerciseId);
  const index = sessions.findIndex((session) => session.workout.id === workoutId);
  return index >= 0 ? sessions[index + 1] || null : null;
}

function openWorkoutDetails(workoutId, editRir = false) {
  const workout = data.workouts.find((item) => item.id === workoutId);
  if (!workout) return;
  closeModal("exerciseHistoryModal");
  $("#workoutDetailTitle").textContent = workout.name;
  const longDate = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(parseDate(workout.date));
  const rawDuration = nullableNumber(workout.duration);
  const duration = rawDuration !== null && rawDuration >= 0 ? `${formatNumber(rawDuration)} min` : "Not logged";
  const entryMarkup = workout.entries.map((entry, entryIndex) => {
    const exercise = getExercise(entry.exerciseId);
    const performance = getEntryPerformance(entry);
    const previous = getPreviousExerciseSession(entry.exerciseId, workout.id)?.performance || null;
    const comparison = getPerformanceComparison(performance, previous);
    const range = performance?.measurementMode === "duration"
      ? "Timed hold"
      : performance?.measurementMode === "distance_duration"
        ? "Distance and duration"
        : exercise?.range ? `${exercise.range[0]}–${exercise.range[1]} reps` : "Imported exercise";
    const topSet = performance ? performanceLabel(performance) : "No working set";
    const workingCount = getQualifiedWorkingSets(entry).length;
    const setMarkup = editRir
      ? `<div class="rir-set-editor-list">${(entry.sets || []).map((set, setIndex) => rirSetEditorMarkup(set, entryIndex, setIndex)).join("") || `<span class="muted">No logged sets</span>`}</div>`
      : `<div class="set-list">${(entry.sets || []).map((set, index) => setChipMarkup(set, index)).join("") || `<span class="muted">No logged sets</span>`}</div>`;
    return `<article class="logged-exercise"><div class="logged-exercise-head"><div><h3>${escapeHtml(exerciseDisplayName(entry))}</h3><p class="logged-exercise-meta">${workingCount} working set${workingCount === 1 ? "" : "s"} · ${formatKg(getEntryVolume(entry))} volume · ${range}</p></div><span class="entry-progression ${comparison.className}">${escapeHtml(comparison.label)}<br><small>${topSet} top set</small></span></div>${setMarkup}${entry.exerciseNotes ? `<p class="logged-exercise-meta">Note: ${escapeHtml(entry.exerciseNotes)}</p>` : ""}<div class="entry-actions"><button type="button" class="entry-history-button" data-open-exercise-history="${escapeHtml(entry.exerciseId)}">View all ${escapeHtml(exerciseDisplayName(entry))} sessions →</button></div></article>`;
  }).join("");
  const imported = Boolean(workout.source && workout.source !== "manual");
  const actionMarkup = editRir
    ? `<span class="read-only-note">Only changed RIR fields are saved. Imported load, reps, RPE, and set type stay untouched.</span><label class="inline-check"><input type="checkbox" data-rir-missing-filter> Only missing RIR</label><button type="button" class="secondary-button compact" data-rir-copy-down>Apply focused value below</button><button type="button" class="secondary-button compact" data-cancel-rir-workout="${escapeHtml(workout.id)}">Cancel</button><button type="button" class="primary-button compact" data-save-rir-workout="${escapeHtml(workout.id)}">Save RIR</button>`
    : `${imported ? `<span class="read-only-note">Imported load and reps stay read-only · RIR can be added here</span>` : `<button type="button" class="secondary-button compact" data-edit-workout="${escapeHtml(workout.id)}">Edit session details</button>`}<button type="button" class="secondary-button compact" data-repeat-workout="${escapeHtml(workout.id)}">Repeat workout</button><button type="button" class="secondary-button compact" data-save-routine="${escapeHtml(workout.id)}">Save as routine</button><button type="button" class="secondary-button compact" data-edit-rir-workout="${escapeHtml(workout.id)}">Add / edit RIR</button>`;
  const recovery = workout.recoverySnapshot || (data.recoveryCheckins || []).find((item) => item.date === workout.date);
  const recoveryMarkup = recovery
    ? `<div class="workout-recovery-context"><strong>Recovery context</strong><span>${formatNumber(recovery.sleepHours)} h sleep · ${recovery.energy}/5 energy · ${recovery.soreness}/5 soreness · ${recovery.stress}/5 stress${recovery.painConcern ? " · pain concern flagged" : ""}</span></div>`
    : "";
  $("#workoutDetailContent").innerHTML = `<div class="session-detail-summary"><div class="session-detail-stat"><span>DATE</span><strong>${escapeHtml(longDate)}</strong></div><div class="session-detail-stat"><span>DURATION</span><strong>${escapeHtml(duration)}</strong></div><div class="session-detail-stat"><span>WORKING SETS</span><strong>${getSessionSets(workout)}</strong></div><div class="session-detail-stat"><span>NORMALIZED LOAD VOLUME</span><strong>${formatKg(getSessionVolume(workout))}</strong></div></div><div class="session-detail-actions">${actionMarkup}</div>${recoveryMarkup}${workout.notes ? `<p class="session-notes">${escapeHtml(workout.notes)}</p>` : ""}<div class="logged-exercise-list">${entryMarkup}</div>`;
  openModal("workoutDetailModal");
  if (editRir) {
    const firstInput = $("[data-rir-entry]", $("#workoutDetailContent"));
    if (firstInput) requestAnimationFrame(() => firstInput.focus());
  }
}

function saveWorkoutRir(workoutId) {
  const workout = data.workouts.find((item) => item.id === workoutId);
  const content = $("#workoutDetailContent");
  if (!workout || !content) return;
  const inputs = $$("[data-rir-entry][data-rir-set]", content);
  const updates = [];
  for (const input of inputs) {
    const rawValue = input.value.trim();
    const touched = rawValue !== String(input.dataset.rirOriginal ?? "");
    if (!touched) continue;
    const value = nullableNumber(rawValue);
    if (rawValue && (value === null || value < 0 || value > 10 || Math.abs(value * 2 - Math.round(value * 2)) > 0.00001)) {
      input.focus();
      showToast("RIR must be blank or a value from 0 to 10 in 0.5 steps.");
      return;
    }
    const entryIndex = Number(input.dataset.rirEntry);
    const setIndex = Number(input.dataset.rirSet);
    if (!Number.isInteger(entryIndex) || !Number.isInteger(setIndex) || !workout.entries[entryIndex]?.sets?.[setIndex]) {
      showToast("This workout changed before RIR could be saved. Reopen it and try again.");
      return;
    }
    updates.push({ entryIndex, setIndex, rawValue });
  }
  if (!updates.length) {
    openWorkoutDetails(workoutId);
    showToast("No RIR values changed.");
    return;
  }
  const previousEntries = workout.entries;
  const previousUpdatedAt = workout.updatedAt;
  workout.entries = workout.entries.map((entry) => ({
    ...entry,
    sets: (entry.sets || []).map((set) => ({ ...set })),
  }));
  updates.forEach(({ entryIndex, setIndex, rawValue }) => {
    workout.entries[entryIndex].sets[setIndex] = Domain.updateManualRir(
      workout.entries[entryIndex].sets[setIndex],
      rawValue,
      true,
    );
  });
  workout.updatedAt = new Date().toISOString();
  if (!saveData()) {
    workout.entries = previousEntries;
    workout.updatedAt = previousUpdatedAt;
    showToast("Storage is full. The RIR changes were not saved.");
    return;
  }
  renderAll();
  openWorkoutDetails(workoutId);
  showToast("RIR changes saved.");
}

function historyMetric(performance) {
  if (performance.measurementMode === "duration") return { value: performance.durationSeconds || 0, label: "Top duration (sec)", unit: " sec", estimated: false };
  if (performance.measurementMode === "distance_duration") return { value: performance.distanceMeters || 0, label: "Top distance (m)", unit: " m", estimated: false };
  if (performance.loadMode === "assistance") return { value: performance.weight || 0, label: "Assistance load (lower is harder)", unit: ` ${weightUnit()}`, estimated: false, lowerIsBetter: true };
  if (performance.weight > 0) return { value: performance.weight * (1 + performance.reps / 30), label: "Estimated top-set strength", unit: ` ${weightUnit()}`, estimated: true };
  return { value: performance.reps || 0, label: "Top-set repetitions", unit: " reps", estimated: false };
}

function buildExerciseProgressChart(sessions) {
  if (!sessions.length) return `<div class="empty-state">No comparable sets for this filter.</div>`;
  const chronological = [...sessions].reverse();
  const firstMetric = historyMetric(chronological[0].performance);
  const comparable = chronological.filter((session) => {
    const metric = historyMetric(session.performance);
    return metric.label === firstMetric.label;
  });
  const values = comparable.map((session) => historyMetric(session.performance).value);
  const width = 620;
  const height = 180;
  const padding = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = (index) => comparable.length === 1 ? width / 2 : padding + index * ((width - padding * 2) / (comparable.length - 1));
  const y = (value) => height - padding - ((value - min) / Math.max(max - min, 0.001)) * (height - padding * 2);
  const points = values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  let best = firstMetric.lowerIsBetter ? Infinity : -Infinity;
  const circles = comparable.map((session, index) => {
    const metric = historyMetric(session.performance);
    const isRecord = firstMetric.lowerIsBetter ? metric.value < best : metric.value > best;
    if (isRecord) best = metric.value;
    const displayValue = firstMetric.unit.includes("lb") ? kgToDisplay(metric.value) : metric.value;
    const label = `${formatDate(session.workout.date)} · ${formatNumber(displayValue)}${firstMetric.unit}${isRecord ? " · personal record" : ""}`;
    return `<circle cx="${x(index).toFixed(1)}" cy="${y(metric.value).toFixed(1)}" r="${isRecord ? 5 : 4}" class="${isRecord ? "exercise-chart-pr" : ""}" tabindex="0" role="img" aria-label="${escapeHtml(label)}"><title>${escapeHtml(label)}</title></circle>`;
  }).join("");
  const table = comparable.slice().reverse().map((session) => {
    const metric = historyMetric(session.performance);
    const displayValue = firstMetric.unit.includes("lb") ? kgToDisplay(metric.value) : metric.value;
    return `<tr><td>${escapeHtml(formatDate(session.workout.date))}</td><td>${escapeHtml(performanceLabel(session.performance))}</td><td>${formatNumber(displayValue)}${escapeHtml(firstMetric.unit)}</td><td>${formatKg(getEntryVolume(session.entry))}</td><td>${Number.isFinite(session.performance.rir) ? `${formatNumber(session.performance.rir)} RIR` : "—"}</td></tr>`;
  }).join("");
  return `<div class="exercise-progress-chart"><div class="chart-heading"><strong>${escapeHtml(firstMetric.label)}</strong>${firstMetric.estimated ? `<span>Estimate, not measured 1RM</span>` : ""}</div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(firstMetric.label)}"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="3"/>${circles}</svg><details class="chart-data-table" open><summary>Progress data</summary><table><thead><tr><th>Date</th><th>Top set</th><th>${escapeHtml(firstMetric.label)}</th><th>Normalized volume</th><th>Effort</th></tr></thead><tbody>${table}</tbody></table></details></div>`;
}

function openExerciseHistory(exerciseId, setFilter = "normal") {
  const exercise = getExercise(exerciseId);
  const rawSessions = getExerciseSessions(exerciseId);
  let effectiveFilter = setFilter;
  const filteredSessions = (filter) => rawSessions.map((session) => {
    const filteredSets = filter === "all"
      ? session.entry.sets
      : session.entry.sets.filter((set) => String(set.type || "normal").toLowerCase() === filter);
    const entry = { ...session.entry, sets: filteredSets };
    return { ...session, entry, performance: getEntryPerformance(entry) };
  }).filter((session) => session.performance);
  let sessions = filteredSessions(effectiveFilter);
  if (exercise && rawSessions.length && !sessions.length && effectiveFilter === "normal") {
    effectiveFilter = "all";
    sessions = filteredSessions(effectiveFilter);
  }
  if (!exercise || !sessions.length) { showToast("There is no working-set history for this exercise yet."); return; }
  closeModal("workoutDetailModal");
  $("#exerciseHistoryTitle").textContent = exercise.name;
  const repRecords = new Map();
  rawSessions.forEach((session) => getProgressionSets(session.entry).forEach((set) => {
    if (!Number.isFinite(set.reps) || !Number.isFinite(set.weightKg)) return;
    repRecords.set(set.reps, Math.max(repRecords.get(set.reps) || 0, set.weightKg));
  }));
  const records = [...repRecords.entries()].sort((a, b) => a[0] - b[0]).slice(-8).map(([reps, weight]) => `<span>${reps} reps · ${formatKg(weight)}</span>`).join("");
  $("#exerciseHistoryContent").innerHTML = `<div class="history-toolbar"><p class="plan-intro">Charts compare only the same measurement and load conventions. Estimated strength is labelled explicitly.</p><label>Sets<select data-history-set-filter="${escapeHtml(exerciseId)}"><option value="normal" ${effectiveFilter === "normal" ? "selected" : ""}>Normal sets</option><option value="dropset" ${effectiveFilter === "dropset" ? "selected" : ""}>Drop sets</option><option value="all" ${effectiveFilter === "all" ? "selected" : ""}>All non-warm-up sets</option></select></label></div>${buildExerciseProgressChart(sessions)}${records ? `<div class="rep-records"><strong>Best load by rep count</strong>${records}</div>` : ""}<div class="history-list">${sessions.map((session, index) => {
    const previous = sessions[index + 1]?.performance || null;
    const comparison = getPerformanceComparison(session.performance, previous);
    const topSet = performanceLabel(session.performance);
    const effort = Number.isFinite(session.performance.rir) ? `${formatNumber(session.performance.rir)} RIR` : "effort not logged";
    return `<button type="button" class="history-row" data-open-workout="${escapeHtml(session.workout.id)}"><span class="history-date">${formatDate(session.workout.date)}</span><span class="history-main"><strong>${escapeHtml(session.workout.name)}</strong><span>${topSet} · ${session.performance.sets} working sets · ${effort}</span></span><span class="history-delta ${comparison.className}">${escapeHtml(comparison.label)}</span></button>`;
  }).join("")}</div>`;
  openModal("exerciseHistoryModal");
}

function openSessionPlanExplanation() {
  const plan = suggestionPlan;
  if (!plan?.allFocus) return;
  const week = getWeekData(0);
  const recovery = plan.recovery || getRecoveryContext();
  const priorityRows = plan.priorities.map((item, index) => {
    const decision = getVolumeDecision(item, week.workouts, week.previous);
    const selectedPlan = plan.exercisePlans?.find((exercisePlan) => exercisePlan.muscles.includes(item.muscle));
    const recentText = item.daysSinceDirect === null ? "no prior direct work" : item.daysSinceDirect === 0 ? "trained today" : `last direct work ${item.daysSinceDirect} day${item.daysSinceDirect === 1 ? "" : "s"} ago`;
    const decisionText = recovery.coachingOverride && decision.direction === "increase" ? recovery.summary : decision.text;
    const planLabel = recovery.level === "stop"
      ? "paused"
      : selectedPlan ? `${selectedPlan.sets} planned set${selectedPlan.sets === 1 ? "" : "s"}` : "maintain";
    return `<div class="priority-row"><span class="priority-rank">0${index + 1}</span><div class="priority-main"><strong>${item.muscle}</strong><span>${formatNumber(item.current)} effective sets toward a ${item.low}–${item.high} planning range · ${escapeHtml(recentText)} · ${escapeHtml(decisionText)}</span></div><span class="priority-gap">${escapeHtml(planLabel)}</span></div>`;
  }).join("");
  const allRows = [...plan.allFocus].sort((a, b) => b.deficit - a.deficit || a.current - b.current).map((item) => `<div class="priority-row"><span class="priority-rank">•</span><div class="priority-main"><strong>${item.muscle}</strong><span>${formatNumber(item.current)} effective sets · planning range ${item.low}–${item.high}</span></div><span class="priority-gap">${item.deficit ? `${formatNumber(item.deficit)} short` : item.excess ? `${formatNumber(item.excess)} above plan` : "in range"}</span></div>`).join("");
  $("#sessionPlanDetail").innerHTML = `<p class="plan-intro">The next-session plan always uses the current week, even while you browse an older report. Liftwise first ranks gaps to your selected planning minimum, softly deprioritizes muscles trained in the last 48 hours, then chooses one familiar compatible movement per priority. Today’s recovery state is <strong>${escapeHtml(recovery.label)}</strong>.</p><div class="plan-rule-list"><div class="plan-rule"><span>DIRECT WORK</span><strong>1.0 set credit</strong></div><div class="plan-rule"><span>SECONDARY WORK</span><strong>0.5 set credit</strong></div><div class="plan-rule"><span>WARM-UPS</span><strong>Excluded</strong></div><div class="plan-rule"><span>VOLUME CHANGE</span><strong>Max ${MAX_VOLUME_ADJUSTMENT_SETS} direct sets</strong></div><div class="plan-rule"><span>RECOVERY GATE</span><strong>${escapeHtml(recovery.coachingOverride ? "Hold additions" : "Plan unchanged")}</strong></div></div><p class="eyebrow">SELECTED PRIORITIES</p><div class="priority-list">${priorityRows}</div><p class="eyebrow" style="margin-top:20px">ALL MUSCLE COVERAGE</p><div class="priority-list">${allRows}</div><p class="plan-caveat">The recovery gate uses a transparent self-report heuristic, not a validated readiness score. Liftwise still cannot assess technique, diagnose pain, or know your complete program. Your actual program and qualified medical or coaching advice override it.</p>`;
  openModal("sessionPlanModal");
}

function renderInsights() {
  const week = getWeekData();
  const focus = getFocusMuscles(week.totals);
  const volumeDecisions = focus.map((item) => getVolumeDecision(item, week.workouts, week.previous));
  const increases = volumeDecisions.filter((item) => item.direction === "increase").sort((a, b) => b.amount - a.amount || a.muscle.localeCompare(b.muscle));
  const decreases = volumeDecisions.filter((item) => item.direction === "decrease").sort((a, b) => b.amount - a.amount || a.muscle.localeCompare(b.muscle));
  const maintains = volumeDecisions.filter((item) => item.direction === "maintain").sort((a, b) => a.muscle.localeCompare(b.muscle));
  const cards = [];
  const recovery = isCurrentWeek() ? getRecoveryContext() : getRecoveryContext(null);
  if (recovery.coachingOverride) {
    cards.push({
      type: recovery.level === "caution" ? "reduce" : "switch",
      icon: recovery.level === "stop" ? "!" : "↻",
      title: recovery.title,
      stat: recovery.factors.join(" · "),
      text: recovery.summary,
      why: "Rule: a caution, low-recovery, or pain check-in pauses automatic set additions for today. This is a conservative user-controlled heuristic, not a medical readiness score.",
      action: "Update recovery check",
      recovery: true,
    });
  } else {
    increases.slice(0, 2).forEach((decision) => cards.push({ ...decision, icon: "↑", action: "Open matching exercises" }));
  }
  if (decreases[0]) cards.push({ ...decreases[0], icon: "↓", action: "Adjust target", target: true });
  else if (maintains[0]) cards.push({ ...maintains[0], icon: "✓", action: "Open matching exercises" });
  else cards.push({ type: "switch", icon: "✓", title: "Log a first working set", stat: "No recent working sets", text: "Volume decisions need at least one logged non-warm-up set.", why: "Rule: without current-week work there is no effective-set total to compare with your selected range.", action: "How targets work", research: true });
  const swap = getSwapCandidate();
  cards.push(swap
    ? { type: "switch", icon: "⇄", title: swap.kind === "equipment" ? `Replace ${swap.exercise.name}` : `Trial ${swap.substitute.name}`, stat: `${swap.exercise.name} → ${swap.substitute.name}`, text: swap.kind === "equipment" ? `Use ${swap.substitute.name} for the same broad training role in your current home setup.` : `A swap is a controlled trial, not an upgrade. Try ${swap.substitute.name} for 3–4 exposures and compare comfort, technique, and progression.`, why: `${swap.reason} ${swap.why}`, action: "Explore the home option", filter: swap.substitute.name }
    : { type: "switch", icon: "↔", title: "No forced exercise swap", stat: "No equipment conflict or 3-session hard stall", text: "Keep movements you can perform comfortably and progress. Change one only when equipment, comfort, goals, or a real multi-session stall provides a clear reason.", why: "Rule: the app only proposes a swap for an unavailable logged movement or three hard, stagnant appearances with an available mapped alternative.", action: "Browse practical alternatives", filter: "Horizontal pull" });
  $("#insightGrid").innerHTML = cards.map((card) => `<article class="insight-card ${escapeHtml(card.type || "switch")}"><div class="insight-icon">${escapeHtml(card.icon)}</div><h3>${escapeHtml(card.title)}</h3><span class="small-stat">${escapeHtml(card.stat)}</span><p>${escapeHtml(card.text)}</p><p class="insight-why"><strong>WHY</strong> ${escapeHtml(card.why)}</p><button class="insight-action" ${card.filter ? `data-library-filter="${escapeHtml(card.filter)}"` : ""} ${card.target ? "data-open-targets" : ""} ${card.research ? "data-open-research" : ""} ${card.recovery ? "data-open-recovery" : ""}>${escapeHtml(card.action)} →</button></article>`).join("");

  const tracked = getTrackedExerciseIds(5).map((id) => getProgressDecision(id)).filter(Boolean);
  $("#progressionContext").textContent = recovery.coachingOverride ? `${recovery.label} overrides today` : "Based on recent comparable logs";
  $("#progressionTable").innerHTML = tracked.length ? tracked.map((item) => {
    const tagClass = item.action.startsWith("Reduce") || item.action.startsWith("Regress") ? "decrease" : item.action.startsWith("Hold") || item.action.startsWith("Log") || item.action.startsWith("Confirm") ? "hold" : "";
    const modeLabel = item.latest.measurementMode === "duration"
      ? "timed progression"
      : item.latest.measurementMode === "distance_duration"
        ? "distance progression"
        : `${item.low}–${item.high} rep range`;
    const effort = ["load_reps", "reps"].includes(item.latest.measurementMode)
      ? (Number.isFinite(item.latest.rir) ? `${formatNumber(item.latest.rir)} RIR` : "effort not logged")
      : "mode-matched comparison";
    return `<div class="progression-row"><div class="progression-exercise"><strong>${escapeHtml(item.exercise.name)}</strong><span>${escapeHtml(modeLabel)} · ${escapeHtml(item.rule)}</span></div><span class="progression-data">${escapeHtml(performanceLabel(item.latest))}<br>${escapeHtml(effort)} · ${formatDate(item.latest.date)}</span><p class="progression-action">${escapeHtml(item.description)}<span class="progression-why"><strong>WHY</strong> ${escapeHtml(item.why)}</span></p><span class="action-tag ${tagClass}">${escapeHtml(item.action)}</span></div>`;
  }).join("") : `<div class="empty-state">Log an available exercise to receive a progression prompt.</div>`;
  renderBodyMuscleMap();
  renderRecoveryHistory();
}

function renderLibrary() {
  const allExercises = getAllExercises();
  const muscleSelect = $("#libraryMuscle");
  if (muscleSelect && muscleSelect.options.length <= 1) {
    muscleSelect.innerHTML = `<option value="All">All muscles</option>${MUSCLES.map((muscle) => `<option value="${escapeHtml(muscle)}">${escapeHtml(muscle)}</option>`).join("")}`;
  }
  if (muscleSelect) muscleSelect.value = libraryMuscleFilter;
  const equipmentSelect = $("#libraryEquipment");
  if (equipmentSelect && equipmentSelect.options.length <= 1) {
    equipmentSelect.innerHTML = `<option value="All">All equipment</option><option value="bodyweight">Bodyweight</option>${EQUIPMENT_OPTIONS.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join("")}`;
  }
  if (equipmentSelect) equipmentSelect.value = libraryEquipmentFilter;
  if ($("#librarySort")) $("#librarySort").value = data.libraryPreferences?.sort || "recent";
  if ($("#libraryAvailableOnly")) $("#libraryAvailableOnly").checked = data.libraryPreferences?.availableOnly !== false;
  if ($("#libraryDensity")) $("#libraryDensity").textContent = data.libraryPreferences?.density === "compact" ? "Comfortable cards" : "Compact cards";
  const machinesShown = Boolean(data.profile?.showMachineExercises);
  const availableOnly = $("#libraryAvailableOnly")?.checked ?? data.libraryPreferences?.availableOnly !== false;
  const favoritesOnly = Boolean($("#libraryFavoritesOnly")?.checked);
  const sortMode = $("#librarySort")?.value || data.libraryPreferences?.sort || "recent";
  const visibleExercises = allExercises.filter((exercise) => (
    (!availableOnly || isExerciseAvailable(exercise))
    && (!isMachineExercise(exercise) || isExerciseAvailable(exercise) || machinesShown)
    && (libraryMuscleFilter === "All" || exercise.primary.includes(libraryMuscleFilter) || exercise.secondary.includes(libraryMuscleFilter))
    && (libraryEquipmentFilter === "All"
      || (libraryEquipmentFilter === "bodyweight" && !(exercise.equipment || []).length && !(exercise.equipmentAny || []).length)
      || (exercise.equipment || []).includes(libraryEquipmentFilter)
      || (exercise.equipmentAny || []).includes(libraryEquipmentFilter))
    && (!favoritesOnly || (data.favoriteExercises || []).includes(exercise.id))
  ));
  const patterns = ["All", ...new Set(visibleExercises.map((exercise) => exercise.pattern))];
  if (!patterns.includes(libraryFilter)) libraryFilter = "All";
  const patternButtons = patterns.map((pattern) => `<button class="filter-chip ${pattern === libraryFilter ? "active" : ""}" data-library-chip="${escapeHtml(pattern)}">${escapeHtml(pattern)}</button>`).join("");
  const machineButton = `<button class="filter-chip machine-toggle ${machinesShown ? "active" : ""}" data-toggle-machines aria-pressed="${machinesShown}">${machinesShown ? "Machine: shown" : "Machine: off"}</button>`;
  $("#libraryFilters").innerHTML = `${patternButtons}${machineButton}`;
  const search = normalizeExerciseName($("#exerciseSearch").value);
  let filtered = visibleExercises.filter((exercise) => {
    const matchesPattern = libraryFilter === "All" || exercise.pattern === libraryFilter;
    const matchesSearch = !search || normalizeExerciseName(`${exercise.name} ${(exercise.aliases || []).join(" ")} ${exercise.pattern} ${exercise.primary.join(" ")} ${exercise.secondary.join(" ")} ${exerciseEquipmentText(exercise)}`).includes(search);
    return matchesPattern && matchesSearch;
  });
  const catalogOrder = new Map(allExercises.map((exercise, index) => [exercise.id, index]));
  filtered = filtered.sort((first, second) => {
    if (sortMode === "alphabetical") return first.name.localeCompare(second.name);
    if (sortMode === "catalog") return catalogOrder.get(first.id) - catalogOrder.get(second.id);
    const firstLast = getExerciseSessions(first.id)[0]?.workout ? getWorkoutTimestamp(getExerciseSessions(first.id)[0].workout) : 0;
    const secondLast = getExerciseSessions(second.id)[0]?.workout ? getWorkoutTimestamp(getExerciseSessions(second.id)[0].workout) : 0;
    return secondLast - firstLast || first.name.localeCompare(second.name);
  });
  const shown = filtered.slice(0, libraryPage * LIBRARY_PAGE_SIZE);
  const grid = $("#exerciseGrid");
  grid.classList.toggle("compact-density", data.libraryPreferences?.density === "compact");
  grid.innerHTML = shown.length ? shown.map((exercise) => {
    const available = isExerciseAvailable(exercise);
    const favorite = (data.favoriteExercises || []).includes(exercise.id);
    const muscleTags = [...exercise.primary, ...exercise.secondary].map((muscle) => `<span class="muscle-tag">${escapeHtml(muscle)}</span>`);
    muscleTags.push(`<span class="muscle-tag equipment-tag">${escapeHtml(exerciseEquipmentText(exercise))}</span>`);
    if (isMachineExercise(exercise)) muscleTags.push(`<span class="muscle-tag machine-tag">Machine</span>`);
    if (!available) muscleTags.push(`<span class="muscle-tag unavailable-tag">${escapeHtml(unavailableExerciseReason(exercise))}</span>`);
    const action = available
      ? `<button class="add-from-library" data-add-exercise="${escapeHtml(exercise.id)}">Add to workout +</button>`
      : `<button class="add-from-library" disabled title="${escapeHtml(unavailableExerciseReason(exercise))}">Unavailable in profile</button>`;
    const customAction = exercise.type === "Custom" ? `<button type="button" class="text-button compact" data-edit-custom-exercise="${escapeHtml(exercise.id)}">Manage</button>` : "";
    return `<article class="exercise-card ${available ? "" : "unavailable"}"><div class="library-exercise-top"><span class="movement-dot">${escapeHtml(exercise.icon)}</span><span class="difficulty">${escapeHtml(exercise.difficulty)}<br>${escapeHtml(exercise.type)}</span><button type="button" class="favorite-button ${favorite ? "active" : ""}" data-favorite-exercise="${escapeHtml(exercise.id)}" aria-pressed="${favorite}" aria-label="${favorite ? "Remove from" : "Add to"} favorites">★</button></div><h3>${escapeHtml(exercise.name)}</h3><p>${escapeHtml(exercise.note)}</p><div class="muscle-tags">${muscleTags.join("") || `<span class="muscle-tag">Needs muscle mapping</span>`}</div><div class="library-card-actions">${customAction}${action}</div></article>`;
  }).join("") : `<div class="empty-state">No compatible exercise matches that search. Update your equipment profile if something is missing.</div>`;
  const loadMore = $("#libraryLoadMore");
  if (loadMore) loadMore.hidden = shown.length >= filtered.length;
  data.libraryPreferences = { ...data.libraryPreferences, availableOnly, sort: sortMode };
}

function toggleFavoriteExercise(exerciseId) {
  if (!getExercise(exerciseId)) return;
  const favorites = new Set(data.favoriteExercises || []);
  if (favorites.has(exerciseId)) favorites.delete(exerciseId);
  else favorites.add(exerciseId);
  const previous = data.favoriteExercises;
  data.favoriteExercises = [...favorites];
  if (!saveData()) data.favoriteExercises = previous;
  renderLibrary();
}

function openCustomExerciseManager(exerciseId) {
  const exercise = (data.customExercises || []).find((item) => item.id === exerciseId);
  if (!exercise) return;
  $("#customExerciseId").value = exercise.id;
  $("#customExerciseName").value = exercise.name;
  $("#customExerciseMeasurement").value = exercise.measurementMode || "load_reps";
  $("#customExerciseLoadMode").value = exercise.loadMode || "total";
  $("#customExerciseRepMode").value = exercise.repMode || "total";
  $("#customExerciseAliases").value = (exercise.aliases || []).join("\n");
  $("#customPrimaryMuscles").innerHTML = MUSCLES.map((muscle) => `<label><input type="checkbox" value="${escapeHtml(muscle)}" ${exercise.primary.includes(muscle) ? "checked" : ""}>${escapeHtml(muscle)}</label>`).join("");
  $("#customSecondaryMuscles").innerHTML = MUSCLES.map((muscle) => `<label><input type="checkbox" value="${escapeHtml(muscle)}" ${exercise.secondary.includes(muscle) ? "checked" : ""}>${escapeHtml(muscle)}</label>`).join("");
  $("#customExerciseMergeTarget").innerHTML = `<option value="">Do not merge</option>${exerciseLibrary.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")}`;
  const usage = data.workouts.reduce((total, workout) => total + workout.entries.filter((entry) => entry.exerciseId === exerciseId).length, 0);
  $("#customExerciseUsage").textContent = usage
    ? `Used in ${usage} workout entr${usage === 1 ? "y" : "ies"}. Delete is disabled until history is merged or remapped.`
    : "Not used in workout history; it can be deleted safely.";
  $("#deleteCustomExerciseButton").disabled = usage > 0;
  openModal("customExerciseModal");
}

function saveCustomExercise(event) {
  event.preventDefault();
  const id = $("#customExerciseId").value;
  const index = data.customExercises.findIndex((exercise) => exercise.id === id);
  if (index < 0) return;
  const name = $("#customExerciseName").value.trim().slice(0, 100);
  if (!name) {
    showToast("Add an exercise name.");
    return;
  }
  const duplicate = getAllExercises().find((exercise) => exercise.id !== id && normalizeExerciseName(exercise.name) === normalizeExerciseName(name));
  if (duplicate) {
    showToast(`“${duplicate.name}” already uses that name. Merge into it instead.`);
    return;
  }
  const primary = $$("input:checked", $("#customPrimaryMuscles")).map((input) => input.value);
  const secondary = $$("input:checked", $("#customSecondaryMuscles")).map((input) => input.value).filter((muscle) => !primary.includes(muscle));
  const mergeTarget = $("#customExerciseMergeTarget").value;
  const before = JSON.stringify(data);
  if (mergeTarget) {
    const target = getExercise(mergeTarget);
    const affected = data.workouts.reduce((total, workout) => total + workout.entries.filter((entry) => entry.exerciseId === id).length, 0);
    if (!target || !window.confirm(`Merge “${name}” into “${target?.name}” across ${affected} workout entr${affected === 1 ? "y" : "ies"}? Sets will be preserved and duplicate exercise rows in each session will be combined.`)) return;
    data.workouts = data.workouts.map((workout) => ({
      ...workout,
      entries: mergeEntriesByExerciseId(workout.entries.map((entry) => entry.exerciseId === id ? { ...entry, exerciseId: mergeTarget } : entry)),
    }));
    Object.entries(data.importAliases || {}).forEach(([alias, exerciseId]) => {
      if (exerciseId === id) data.importAliases[alias] = mergeTarget;
    });
    data.favoriteExercises = [...new Set((data.favoriteExercises || []).map((exerciseId) => exerciseId === id ? mergeTarget : exerciseId))];
    delete data.exercisePreferences[id];
    data.customExercises.splice(index, 1);
  } else {
    data.customExercises[index] = normalizeCustomExercise({
      ...data.customExercises[index],
      name,
      primary,
      secondary,
      measurementMode: $("#customExerciseMeasurement").value,
      loadMode: $("#customExerciseLoadMode").value,
      repMode: $("#customExerciseRepMode").value,
      aliases: $("#customExerciseAliases").value.split(/\r?\n/).map((alias) => alias.trim()).filter(Boolean),
      pattern: data.customExercises[index].pattern === "Imported" ? "Custom" : data.customExercises[index].pattern,
      difficulty: primary.length ? "User mapped" : "Unmapped",
      note: primary.length
        ? "A user-defined movement with explicit muscle and measurement mapping."
        : "A user-defined movement. Map muscles to include it in coverage.",
    }, index);
  }
  if (!saveData()) {
    data = JSON.parse(before);
    showToast("The custom exercise change could not be saved.");
    return;
  }
  closeModal("customExerciseModal");
  renderAll();
  showToast(mergeTarget ? "Exercise history merged." : "Custom exercise updated.");
}

function deleteCustomExercise() {
  const id = $("#customExerciseId").value;
  const exercise = (data.customExercises || []).find((item) => item.id === id);
  if (!exercise) return;
  const used = data.workouts.some((workout) => workout.entries.some((entry) => entry.exerciseId === id));
  if (used) {
    showToast("Merge or remap workout history before deleting this exercise.");
    return;
  }
  if (!window.confirm(`Delete unused custom exercise “${exercise.name}”?`)) return;
  const previous = data.customExercises;
  data.customExercises = data.customExercises.filter((item) => item.id !== id);
  if (!saveData()) {
    data.customExercises = previous;
    showToast("The custom exercise could not be deleted.");
    return;
  }
  closeModal("customExerciseModal");
  renderLibrary();
  renderExerciseSuggestions();
  showToast("Custom exercise deleted.");
}

function renderView(view = activeView) {
  if (view === "dashboard") renderDashboard();
  if (view === "workouts") renderWorkouts();
  if (view === "insights") renderInsights();
  if (view === "body") renderBodyMetrics();
  if (view === "library") renderLibrary();
}

function renderAll({ force = false } = {}) {
  renderTopBar();
  renderStorageRecoveryBanner();
  if (force) {
    renderDashboard();
    renderWorkouts();
    renderInsights();
    renderBodyMetrics();
    renderLibrary();
  } else {
    renderView(activeView);
  }
}

function openModal(id) {
  const modal = $(`#${id}`);
  if (!modal || modal.open || modal.hasAttribute("open")) return false;
  dialogReturnFocus.set(id, document.activeElement);
  if (typeof modal.showModal === "function") {
    modal.showModal();
  } else {
    modal.setAttribute("open", "");
    modal.classList.add("modal-fallback-open");
  }
  return true;
}

function closeModal(id, { force = false } = {}) {
  const modal = $(`#${id}`);
  if (!modal || (!modal.open && !modal.hasAttribute("open"))) return false;
  if (id === "workoutModal" && workoutEditorDirty && !force) {
    saveWorkoutDraft();
    if (!window.confirm("Close the workout editor? Your current draft will be kept and offered next time.")) return false;
  }
  if (typeof modal.close === "function" && !modal.classList.contains("modal-fallback-open")) {
    modal.close();
  } else {
    modal.removeAttribute("open");
    modal.classList.remove("modal-fallback-open");
    const returnFocus = dialogReturnFocus.get(id);
    dialogReturnFocus.delete(id);
    if (returnFocus?.isConnected) requestAnimationFrame(() => returnFocus.focus({ preventScroll: true }));
  }
  return true;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("show"), 4500);
}

function renderExerciseSuggestions() {
  const list = $("#exerciseSuggestions");
  if (!list) return;
  list.innerHTML = [...getAvailableExercises()]
    .sort((first, second) => first.name.localeCompare(second.name))
    .map((exercise) => {
      const range = exercise.range || [8, 12];
      const detail = exercise.primary?.length
        ? `${range[0]}–${range[1]} reps · ${exercise.primary.join(", ")}`
        : `${range[0]}–${range[1]} reps · custom`;
      return `<option value="${escapeHtml(exercise.name)}" label="${escapeHtml(detail)}"></option>`;
    })
    .join("");
}

function latestSetTemplates(exerciseId, count = 3, targetRir = null) {
  const exercise = getExercise(exerciseId);
  const latestSession = getExerciseSessions(exerciseId)[0];
  const latestSets = latestSession ? getProgressionSets(latestSession.entry) : [];
  const decision = latestSession ? getProgressDecision(exerciseId) : null;
  const [low, high] = exercise?.range || [8, 12];
  const resetAtPrescription = ["Increase load", "Reduce load", "Increase difficulty", "Regress variation"].includes(decision?.action);
  const addRepPerSet = ["Rep-first progression", "Consolidate new load"].includes(decision?.rule);
  const conventions = exerciseConventions(exerciseId);
  return Array.from({ length: count }, (_, index) => {
    const previous = latestSets[index] || latestSets.at(-1) || null;
    const previousWeight = previous?.weightKg ?? decision?.latest?.weight ?? 0;
    const previousReps = previous?.reps ?? low;
    return {
      type: "normal",
      weightKg: resetAtPrescription ? decision?.prescribedWeight ?? previousWeight : previousWeight,
      reps: resetAtPrescription
        ? decision?.prescribedReps ?? low
        : addRepPerSet ? Math.min(high, previousReps + 1) : previousReps,
      rir: null,
      targetRir: nullableNumber(targetRir),
      measurementMode: previous?.measurementMode || conventions.measurementMode,
      durationSeconds: previous?.durationSeconds ?? null,
      distanceMeters: previous?.distanceMeters ?? null,
    };
  });
}

function readSetEditorRow(row) {
  return {
    type: $("[data-set-field=type]", row).value,
    measurementMode: $("[data-set-field=mode]", row).value,
    weightKg: displayToKg($("[data-set-field=weight]", row).value),
    reps: nullableNumber($("[data-set-field=reps]", row).value),
    durationSeconds: nullableNumber($("[data-set-field=duration]", row).value),
    distanceMeters: nullableNumber($("[data-set-field=distance]", row).value),
    rir: nullableNumber($("[data-set-field=rir]", row).value),
    rirManual: true,
  };
}

function refreshSetModeRow(row) {
  const mode = $("[data-set-field=mode]", row)?.value || "load_reps";
  row.dataset.measurementMode = mode;
  const fields = {
    weight: mode === "load_reps" || mode === "distance_duration",
    reps: mode === "load_reps" || mode === "reps",
    duration: mode === "duration" || mode === "distance_duration",
    distance: mode === "distance_duration",
  };
  Object.entries(fields).forEach(([field, visible]) => {
    const input = $(`[data-set-field=${field}]`, row);
    const label = input?.closest("label");
    if (!input || !label) return;
    label.hidden = !visible;
    input.required = visible && field !== "weight";
  });
}

function refreshSetEditorRows(entry) {
  $$(".set-editor-row", entry).forEach((row, index) => {
    $(".set-number", row).textContent = `S${index + 1}`;
    $$("label", row).forEach((label) => {
      const fieldName = label.dataset.fieldLabel;
      const hidden = $(".sr-only", label);
      if (hidden && fieldName) hidden.textContent = `Set ${index + 1} ${fieldName}`;
    });
    $(".remove-set", row).setAttribute("aria-label", `Remove set ${index + 1}`);
  });
}

function addSetEditorRow(entry, setData = {}, focus = false) {
  const targetRir = nullableNumber(setData?.targetRir);
  const entryMode = $("[data-entry-field=measurement]", entry)?.value || exerciseConventions($("[name=exerciseId]", entry)?.value).measurementMode;
  const set = normalizeSet({ ...setData, measurementMode: setData.measurementMode || entryMode }, 0, { source: "manual" });
  const row = document.createElement("div");
  row.className = `set-editor-row ${set.type === "warmup" ? "warmup" : ""}`;
  row.innerHTML = `<span class="set-number">S1</span>
    <label data-field-label="type"><span class="sr-only">Set type</span><select data-set-field="type" aria-label="Set type"><option value="normal" ${set.type === "normal" ? "selected" : ""}>Working</option><option value="warmup" ${set.type === "warmup" ? "selected" : ""}>Warm-up</option><option value="dropset" ${set.type === "dropset" ? "selected" : ""}>Drop set</option></select></label>
    <label data-field-label="measurement mode"><span class="sr-only">Measurement mode</span><select data-set-field="mode" aria-label="Measurement mode">${Domain.MEASUREMENT_MODES.map((mode) => `<option value="${mode}" ${set.measurementMode === mode ? "selected" : ""}>${measurementModeLabel(mode)}</option>`).join("")}</select></label>
    <label data-field-label="load"><span class="sr-only">Load in ${weightUnit()}</span><input data-set-field="weight" type="text" inputmode="decimal" value="${escapeHtml(kgToDisplay(set.weightKg ?? 0))}" /></label>
    <label data-field-label="repetitions"><span class="sr-only">Repetitions</span><input data-set-field="reps" type="number" min="0" max="100" inputmode="numeric" value="${escapeHtml(set.reps ?? "")}" /></label>
    <label data-field-label="duration in seconds"><span class="sr-only">Duration in seconds</span><input data-set-field="duration" type="text" inputmode="decimal" value="${escapeHtml(set.durationSeconds ?? "")}" placeholder="seconds" /></label>
    <label data-field-label="distance in metres"><span class="sr-only">Distance in metres</span><input data-set-field="distance" type="text" inputmode="decimal" value="${escapeHtml(set.distanceMeters ?? "")}" placeholder="metres" /></label>
    <label data-field-label="reps in reserve"><span class="sr-only">Reps in reserve</span><input data-set-field="rir" type="text" inputmode="decimal" value="${escapeHtml(set.rir ?? "")}" placeholder="${targetRir === null ? "—" : `Target ${escapeHtml(targetRir)}`}" /></label>
    <button class="remove-set" type="button" aria-label="Remove set">×</button>`;
  $("[data-set-field=type]", row).addEventListener("change", (event) => row.classList.toggle("warmup", event.target.value === "warmup"));
  $("[data-set-field=mode]", row).addEventListener("change", () => refreshSetModeRow(row));
  $(".remove-set", row).addEventListener("click", () => {
    if ($$(".set-editor-row", entry).length <= 1) {
      showToast("Keep at least one set in the exercise.");
      return;
    }
    row.remove();
    refreshSetEditorRows(entry);
  });
  $(".set-editor-list", entry).append(row);
  refreshSetModeRow(row);
  refreshSetEditorRows(entry);
  if (focus) ($("[data-set-field=reps]:not([hidden])", row) || $("[data-set-field=duration]", row)).focus();
}

function updateExerciseEntryContext(entry) {
  const exerciseId = $("[name=exerciseId]", entry).value;
  const exercise = getExercise(exerciseId);
  const typedName = $("[name=exerciseName]", entry).value.trim();
  const latest = getExerciseSessions(exerciseId)[0];
  const hint = $(".exercise-history-hint", entry);
  if (!exercise) {
    hint.textContent = typedName
      ? "New custom exercise · it will be saved and suggested next time"
      : "Start typing to search the list, or enter your own exercise name";
  } else if (latest) {
    const decision = getProgressDecision(exerciseId);
    const nextLoad = decision?.prescribedWeight > 0 ? formatKg(decision.prescribedWeight) : "bodyweight";
    hint.textContent = `Last: ${performanceLabel(latest.performance)} · Next: ${nextLoad} × ${decision?.prescribedReps ?? latest.performance.reps} (${decision?.action || "hold"})`;
  } else {
    hint.textContent = `No prior log · start in the ${exercise?.range?.[0] || 8}–${exercise?.range?.[1] || 12} rep range`;
  }
  $(".set-rest-guidance", entry).textContent = exercise?.type === "Compound"
    ? "Rest long enough to preserve reps and technique—often 2–3 min for compound work."
    : exercise
      ? "Rest long enough to preserve reps and technique—often 60–120 sec for isolation work."
      : "A custom name is saved without muscle mapping; it can still build its own exercise history.";
}

function syncExerciseNameEntry(entry, { canonicalize = false, refreshSets = false } = {}) {
  const nameInput = $("[name=exerciseName]", entry);
  const idInput = $("[name=exerciseId]", entry);
  const previousId = idInput.value;
  const exercise = findExerciseByName(nameInput.value);
  idInput.value = exercise?.id || "";
  if (canonicalize && exercise) nameInput.value = exercise.name;
  nameInput.classList.toggle("is-custom", Boolean(nameInput.value.trim() && !exercise));
  $(".remove-exercise", entry).setAttribute("aria-label", `Remove ${nameInput.value.trim() || "exercise"}`);
  if (refreshSets && exercise && exercise.id !== previousId) {
    const rows = $$(".set-editor-row", entry);
    const templates = latestSetTemplates(exercise.id, rows.length, nullableNumber(entry.dataset.targetRir));
    const conventions = exerciseConventions(exercise.id);
    $("[data-entry-field=measurement]", entry).value = conventions.measurementMode;
    $("[data-entry-field=load-mode]", entry).value = conventions.loadMode;
    $("[data-entry-field=rep-mode]", entry).value = conventions.repMode;
    rows.forEach((row, index) => {
      const template = templates[index];
      if ($("[data-set-field=type]", row).value === "warmup") return;
      $("[data-set-field=mode]", row).value = template.measurementMode || conventions.measurementMode;
      $("[data-set-field=weight]", row).value = String(kgToDisplay(template.weightKg));
      $("[data-set-field=reps]", row).value = template.reps === null ? "" : String(template.reps);
      $("[data-set-field=duration]", row).value = template.durationSeconds ?? "";
      $("[data-set-field=distance]", row).value = template.distanceMeters ?? "";
      $("[data-set-field=rir]", row).value = "";
      $("[data-set-field=rir]", row).placeholder = template.targetRir === null ? "—" : `Target ${template.targetRir}`;
      refreshSetModeRow(row);
    });
  }
  updateExerciseEntryContext(entry);
}

function addExerciseEntry(prefill = {}) {
  const fallbackExercise = getAvailableExercises()[0] || getExercise("bench-press");
  const defaultExercise = prefill.exerciseId && getExercise(prefill.exerciseId) ? prefill.exerciseId : fallbackExercise?.id;
  const exercise = getExercise(defaultExercise) || fallbackExercise;
  const displayedExerciseName = prefill.exerciseName || exercise?.name || "";
  const conventions = exerciseConventions(defaultExercise, prefill);
  const entry = document.createElement("div");
  entry.className = "exercise-entry";
  entry.innerHTML = `<div class="exercise-entry-top"><label class="exercise-select-label">Exercise<input class="exercise-name-input" name="exerciseName" type="text" list="exerciseSuggestions" autocomplete="off" maxlength="100" placeholder="Start typing or enter your own name" value="${escapeHtml(displayedExerciseName)}" required><input name="exerciseId" type="hidden" value="${escapeHtml(prefill.exerciseId || exercise?.id || "")}"><span class="exercise-history-hint"></span></label><button class="remove-exercise" type="button" aria-label="Remove ${escapeHtml(displayedExerciseName || "exercise")}">×</button></div>
    <div class="exercise-conventions">
      <label>Default measurement<select data-entry-field="measurement">${Domain.MEASUREMENT_MODES.map((mode) => `<option value="${mode}" ${conventions.measurementMode === mode ? "selected" : ""}>${measurementModeLabel(mode)}</option>`).join("")}</select></label>
      <label>Load convention<select data-entry-field="load-mode">${Domain.LOAD_MODES.map((mode) => `<option value="${mode}" ${conventions.loadMode === mode ? "selected" : ""}>${loadModeLabel(mode)}</option>`).join("")}</select></label>
      <label>Rep convention<select data-entry-field="rep-mode">${Domain.REP_MODES.map((mode) => `<option value="${mode}" ${conventions.repMode === mode ? "selected" : ""}>${repModeLabel(mode)}</option>`).join("")}</select></label>
    </div>
    <div class="set-editor-head" aria-hidden="true"><span>SET</span><span>TYPE</span><span>MODE</span><span>LOAD ${weightUnit().toUpperCase()}</span><span>REPS</span><span>TIME</span><span>DISTANCE</span><span>RIR</span><span></span></div>
    <div class="set-editor-list"></div>
    <div class="set-editor-actions"><button class="copy-set secondary-button compact" type="button">＋ Copy last set</button><span class="set-rest-guidance"></span></div>`;
  $(".remove-exercise", entry).addEventListener("click", () => { if ($$(".exercise-entry").length > 1) entry.remove(); else showToast("Keep at least one exercise in the session."); });
  $("#exerciseEntries").append(entry);
  const targetRir = nullableNumber(prefill.rir);
  entry.dataset.targetRir = targetRir === null ? "" : String(targetRir);
  const requestedCount = Math.min(
    MAX_MANUAL_SETS_PER_EXERCISE,
    Math.max(1, Math.round(nullableNumber(prefill.sets) ?? 3)),
  );
  const initialSets = Array.isArray(prefill.sets)
    ? prefill.sets.slice(0, MAX_MANUAL_SETS_PER_EXERCISE)
    : latestSetTemplates(defaultExercise, requestedCount, targetRir).map((set) => ({
      ...set,
      weightKg: nullableNumber(prefill.weightKg ?? prefill.weight) ?? set.weightKg,
      reps: nullableNumber(prefill.reps) ?? set.reps,
    }));
  initialSets.forEach((set) => addSetEditorRow(entry, set));
  $("[data-entry-field=measurement]", entry).addEventListener("change", (event) => {
    $$(".set-editor-row", entry).forEach((row) => {
      $("[data-set-field=mode]", row).value = event.target.value;
      refreshSetModeRow(row);
    });
  });
  $(".copy-set", entry).addEventListener("click", () => {
    const rows = $$(".set-editor-row", entry);
    if (rows.length >= MAX_MANUAL_SETS_PER_EXERCISE) {
      showToast(`An exercise can contain up to ${MAX_MANUAL_SETS_PER_EXERCISE} sets.`);
      return;
    }
    addSetEditorRow(entry, readSetEditorRow(rows.at(-1)), true);
  });
  $("[name=exerciseName]", entry).addEventListener("input", () => syncExerciseNameEntry(entry, { refreshSets: true }));
  $("[name=exerciseName]", entry).addEventListener("change", () => syncExerciseNameEntry(entry, { canonicalize: true, refreshSets: true }));
  syncExerciseNameEntry(entry);
}

function prepareWorkoutModal(prefill = [], session = null, options = {}) {
  editingWorkoutId = session?.id || null;
  const form = $("#workoutForm");
  form.reset();
  form.dataset.origin = options.origin || (session ? "edit" : prefill.length ? "prefill" : "blank");
  const today = toDateInput(new Date());
  $("#sessionDate").max = today;
  $("#sessionDate").value = options.date || session?.date || today;
  $("#sessionName").value = options.name ?? session?.name ?? (prefill.length ? "Suggested session" : "");
  $("#sessionDuration").value = String(options.duration ?? session?.duration ?? 60);
  $("#sessionNotes").value = options.notes ?? session?.notes ?? "";
  $("#workoutModalEyebrow").textContent = session ? "EDIT SESSION" : "NEW SESSION";
  $("#workoutModalTitle").textContent = session ? "Correct your workout" : "Log your workout";
  $("#workoutSubmitButton").innerHTML = session ? "Save changes <span>→</span>" : "Save workout <span>→</span>";
  $("#exerciseEntries").innerHTML = "";
  renderExerciseSuggestions();
  const fallback = getAvailableExercises()[0] || getExercise("bench-press");
  const rows = prefill.length ? prefill : [{ exerciseId: fallback?.id, sets: 3 }];
  rows.forEach((entry) => addExerciseEntry(entry));
  workoutEditorDirty = false;
}

function serializeWorkoutDraft() {
  return {
    savedAt: new Date().toISOString(),
    editingWorkoutId,
    origin: $("#workoutForm")?.dataset.origin || "blank",
    date: $("#sessionDate")?.value || toDateInput(new Date()),
    name: $("#sessionName")?.value || "",
    duration: $("#sessionDuration")?.value || "60",
    notes: $("#sessionNotes")?.value || "",
    entries: $$(".exercise-entry").map((entry) => ({
      exerciseId: $("[name=exerciseId]", entry)?.value || "",
      exerciseName: $("[name=exerciseName]", entry)?.value || "",
      measurementMode: $("[data-entry-field=measurement]", entry)?.value || "load_reps",
      loadMode: $("[data-entry-field=load-mode]", entry)?.value || "total",
      repMode: $("[data-entry-field=rep-mode]", entry)?.value || "total",
      sets: $$(".set-editor-row", entry).map(readSetEditorRow),
    })),
  };
}

function saveWorkoutDraft() {
  if (!workoutEditorDirty || !$("#workoutModal")?.open) return;
  try {
    localStorage.setItem(WORKOUT_DRAFT_KEY, JSON.stringify(serializeWorkoutDraft()));
  } catch (error) {
    console.warn("Workout draft could not be saved", error);
  }
}

function scheduleWorkoutDraft() {
  workoutEditorDirty = true;
  clearTimeout(workoutDraftTimer);
  workoutDraftTimer = setTimeout(saveWorkoutDraft, 350);
}

function clearWorkoutDraft() {
  clearTimeout(workoutDraftTimer);
  try { localStorage.removeItem(WORKOUT_DRAFT_KEY); } catch (error) { console.warn(error); }
}

function getWorkoutDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(WORKOUT_DRAFT_KEY));
    return draft?.entries?.length ? draft : null;
  } catch (error) {
    clearWorkoutDraft();
    return null;
  }
}

function openWorkout(prefill = [], options = {}) {
  if (!prefill.length && !options.skipDraft) {
    const draft = getWorkoutDraft();
    if (draft) {
      const resume = window.confirm(`Resume the workout draft saved ${new Intl.DateTimeFormat(currentLocale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(draft.savedAt))}? Choose Cancel to discard it and start fresh.`);
      if (resume) {
        const session = draft.editingWorkoutId ? data.workouts.find((workout) => workout.id === draft.editingWorkoutId) : null;
        prepareWorkoutModal(draft.entries, session, {
          origin: draft.origin,
          date: draft.date,
          name: draft.name,
          duration: draft.duration,
          notes: draft.notes,
        });
        workoutEditorDirty = true;
        openModal("workoutModal");
        return;
      }
      clearWorkoutDraft();
    }
  }
  prepareWorkoutModal(prefill, null, options);
  openModal("workoutModal");
}

function cleanRepeatedSet(set) {
  return normalizeSet({
    ...set,
    rawRpe: null,
    explicitImportedRir: null,
    manualRir: null,
    manualRirCleared: false,
    rpe: null,
    rir: null,
    rirManual: false,
    effortSource: "missing",
  }, set.index, { source: "manual" });
}

function repeatWorkout(workoutId) {
  const workout = data.workouts.find((item) => item.id === workoutId);
  if (!workout) return;
  const prefill = workout.entries.map((entry) => ({
    exerciseId: entry.exerciseId,
    measurementMode: entry.measurementMode,
    loadMode: entry.loadMode,
    repMode: entry.repMode,
    sets: (entry.sets || []).map(cleanRepeatedSet),
  }));
  closeModal("workoutDetailModal");
  openWorkout(prefill, { origin: "repeat", name: workout.name, duration: workout.duration, skipDraft: true });
}

function saveWorkoutAsRoutine(workoutId) {
  const workout = data.workouts.find((item) => item.id === workoutId);
  if (!workout) return;
  const name = window.prompt("Routine name", workout.name);
  if (!name?.trim()) return;
  const routine = {
    id: `routine-${Date.now()}`,
    name: name.trim().slice(0, 80),
    notes: "",
    weekdays: [],
    createdAt: new Date().toISOString(),
    entries: workout.entries.map((entry) => ({
      exerciseId: entry.exerciseId,
      targetSets: Math.max(1, (entry.sets || []).length),
      targetRir: null,
      notes: "",
    })),
  };
  const previous = [...(data.routines || [])];
  data.routines = [...previous, routine].slice(-100);
  if (!saveData()) {
    data.routines = previous;
    showToast("The routine could not be saved.");
    return;
  }
  closeModal("workoutDetailModal");
  renderAll();
  showToast(`Routine “${routine.name}” saved.`);
}

function startRoutine(routineId) {
  const routine = (data.routines || []).find((item) => item.id === routineId);
  if (!routine) return;
  const unavailable = routine.entries.filter((entry) => !isExerciseAvailable(getExercise(entry.exerciseId)));
  if (unavailable.length && !window.confirm(`${unavailable.length} routine exercise${unavailable.length === 1 ? " is" : "s are"} outside your current equipment profile. Open the routine with those exercises flagged anyway?`)) return;
  const prefill = routine.entries.map((entry) => ({
    exerciseId: entry.exerciseId,
    sets: entry.targetSets,
    rir: entry.targetRir,
  }));
  openWorkout(prefill, { origin: "routine", name: routine.name, skipDraft: true });
}

function deleteRoutine(routineId) {
  const routine = (data.routines || []).find((item) => item.id === routineId);
  if (!routine || !window.confirm(`Delete routine “${routine.name}”? Workout history will not change.`)) return;
  const previous = data.routines;
  data.routines = data.routines.filter((item) => item.id !== routineId);
  if (!saveData()) {
    data.routines = previous;
    showToast("The routine could not be deleted.");
    return;
  }
  renderRoutines();
  showToast("Routine deleted.");
}

function toggleRoutineToday(routineId) {
  const routine = (data.routines || []).find((item) => item.id === routineId);
  if (!routine) return;
  const day = new Date().getDay();
  routine.weekdays = routine.weekdays.includes(day) ? routine.weekdays.filter((item) => item !== day) : [...routine.weekdays, day].sort();
  if (!saveData()) {
    showToast("The routine schedule could not be saved.");
    return;
  }
  renderRoutines();
  if (activeView === "dashboard") renderDashboard();
}

function openWorkoutForEdit(workoutId) {
  const workout = data.workouts.find((item) => item.id === workoutId);
  if (!workout) return;
  if (workout.source && workout.source !== "manual") {
    showToast("Imported workouts stay read-only; correct them in the source export and re-import.");
    return;
  }
  if (workout.entries.length > MAX_MANUAL_EXERCISES || workout.entries.some((entry) => entry.sets.length > MAX_MANUAL_SETS_PER_EXERCISE)) {
    showToast("This historical session exceeds the manual editor limit, so Liftwise will not truncate it.");
    return;
  }
  const prefill = workout.entries.map((entry) => ({
    exerciseId: entry.exerciseId,
    measurementMode: entry.measurementMode,
    loadMode: entry.loadMode,
    repMode: entry.repMode,
    sets: entry.sets,
  }));
  closeModal("workoutDetailModal");
  prepareWorkoutModal(prefill, workout);
  openModal("workoutModal");
}

function openRecoveryCheckin() {
  const existing = getTodayRecoveryCheckin();
  $("#recoverySleep").value = existing ? String(existing.sleepHours) : "7.5";
  $("#recoveryEnergy").value = String(existing?.energy || 3);
  $("#recoverySoreness").value = String(existing?.soreness || 2);
  $("#recoveryStress").value = String(existing?.stress || 3);
  $("#recoveryPainConcern").checked = Boolean(existing?.painConcern);
  $("#recoveryNote").value = existing?.note || "";
  openModal("recoveryModal");
}

function saveRecoveryCheckin(event) {
  event.preventDefault();
  const today = toDateInput(new Date());
  const candidate = normalizeRecoveryCheckin({
    id: getTodayRecoveryCheckin()?.id || `recovery-${Date.now()}`,
    date: today,
    sleepHours: $("#recoverySleep").value,
    energy: $("#recoveryEnergy").value,
    soreness: $("#recoverySoreness").value,
    stress: $("#recoveryStress").value,
    painConcern: $("#recoveryPainConcern").checked,
    note: $("#recoveryNote").value.trim(),
    recordedAt: new Date().toISOString(),
  });
  if (!candidate) {
    showToast("Check the recovery values before saving.");
    return;
  }
  const previous = [...(data.recoveryCheckins || [])];
  data.recoveryCheckins = [...previous.filter((checkin) => checkin.date !== today), candidate];
  if (!saveData()) {
    data.recoveryCheckins = previous;
    showToast("Storage is full. The check-in was not saved.");
    return;
  }
  closeModal("recoveryModal");
  renderAll();
  showToast("Today’s recovery context is saved.");
}

function openBodyMetricLog(metricId = null) {
  const form = $("#bodyMetricForm");
  if (!form) return;
  form.reset();
  editingBodyMetricId = typeof metricId === "string" ? metricId : null;
  const existing = editingBodyMetricId ? (data.bodyMetrics || []).find((metric) => metric.id === editingBodyMetricId) : null;
  const today = toDateInput(new Date());
  $("#metricDate").max = today;
  $("#metricDate").value = existing?.date || today;
  $("#metricWeightKg").value = existing?.weightKg !== null && existing?.weightKg !== undefined ? String(kgToDisplay(existing.weightKg)) : "";
  $("#metricBodyFat").value = existing?.bodyFatPercent ?? "";
  $("#metricCondition").value = existing?.condition || "";
  $("#metricNote").value = existing?.note || "";
  $("#metricWeightLabel").firstChild.textContent = `Weight (${weightUnit()})`;
  $("#bodyMetricModalTitle").textContent = existing ? "Edit body metrics" : "Log body metrics";
  $("#bodyMetricSubmitButton").innerHTML = existing ? "Save changes <span>→</span>" : "Save measurement <span>→</span>";
  openModal("bodyMetricModal");
}

function saveBodyMetric(event) {
  event.preventDefault();
  const date = $("#metricDate").value;
  const weightKg = displayToKg($("#metricWeightKg").value);
  const bodyFatPercent = nullableNumber($("#metricBodyFat").value);
  if (!isValidDateKey(date) || date > toDateInput(new Date()) || (weightKg === null && bodyFatPercent === null)) {
    showToast("Add a date and at least weight or body fat.");
    return;
  }
  if ((weightKg !== null && (weightKg < 20 || weightKg > 500)) || (bodyFatPercent !== null && (bodyFatPercent < 1 || bodyFatPercent > 100))) {
    showToast("Use a weight between 20–500 kg and body fat between 1–100%.");
    return;
  }
  const sameDayManual = !editingBodyMetricId
    ? (data.bodyMetrics || []).find((metric) => metric.date === date && metric.source === "manual")
    : null;
  let targetId = editingBodyMetricId;
  if (sameDayManual) {
    if (!window.confirm("A manual measurement already exists on this date. Replace that entry? Choose Cancel to keep both unchanged.")) return;
    targetId = sameDayManual.id;
  }
  const previous = [...data.bodyMetrics];
  const existingIndex = targetId ? data.bodyMetrics.findIndex((metric) => metric.id === targetId) : -1;
  const record = {
    ...(existingIndex >= 0 ? data.bodyMetrics[existingIndex] : {}),
    id: targetId || `body-${Date.now()}`,
    date,
    weightKg,
    bodyFatPercent,
    source: "manual",
    sourceId: null,
    condition: $("#metricCondition").value,
    note: $("#metricNote").value.trim().slice(0, 500),
    recordedAt: new Date().toISOString(),
  };
  if (existingIndex >= 0) data.bodyMetrics[existingIndex] = record;
  else data.bodyMetrics.push(record);
  if (!saveData()) { data.bodyMetrics = previous; showToast("Storage is full. Export a backup before adding more data."); return; }
  editingBodyMetricId = null;
  closeModal("bodyMetricModal");
  renderAll();
  showToast(existingIndex >= 0 ? "Body measurement updated." : "Body measurement saved.");
}

function deleteBodyMetric(id) {
  const metric = (data.bodyMetrics || []).find((item) => item.id === id);
  if (!metric) return;
  if (!window.confirm(`Delete the measurement from ${formatDate(metric.date)}? This cannot be undone.`)) return;
  const previous = data.bodyMetrics;
  data.bodyMetrics = data.bodyMetrics.filter((item) => item.id !== id);
  if (!saveData()) { data.bodyMetrics = previous; showToast("Storage is full. The measurement was not deleted."); return; }
  renderAll();
  showToast("Body measurement deleted.");
}

function openGarminSetup() {
  const link = $("#garminDeveloperLink");
  if (link) link.href = GARMIN_DEVELOPER_PROGRAM_URL;
  openModal("garminSetupModal");
}

function saveWorkout(event) {
  event.preventDefault();
  const rows = $$(".exercise-entry");
  const date = $("#sessionDate").value;
  const name = $("#sessionName").value.trim().slice(0, 80);
  const duration = nullableNumber($("#sessionDuration").value);
  if (!isValidDateKey(date) || date > toDateInput(new Date()) || !name || duration === null || duration < 1 || duration > 300) {
    showToast("Add a valid date, session name, and duration.");
    return;
  }
  if (!rows.length || rows.length > MAX_MANUAL_EXERCISES) {
    showToast(`A workout needs 1–${MAX_MANUAL_EXERCISES} exercises.`);
    return;
  }
  const entryDrafts = rows.map((row) => {
    const exerciseName = $("[name=exerciseName]", row).value.trim().slice(0, 100);
    const exercise = findExerciseByName(exerciseName);
    const measurementMode = $("[data-entry-field=measurement]", row).value;
    const loadMode = $("[data-entry-field=load-mode]", row).value;
    const repMode = $("[data-entry-field=rep-mode]", row).value;
    return {
      exerciseName,
      exercise,
      exerciseId: exercise?.id || "",
      duplicateKey: exercise ? `exercise:${exercise.id}` : `custom:${normalizeExerciseName(exerciseName)}`,
      measurementMode,
      loadMode,
      repMode,
      sets: $$(".set-editor-row", row).map((setRow, index) => normalizeSet({ ...readSetEditorRow(setRow), index }, index, { source: "manual" })),
    };
  });
  if (entryDrafts.some((entry) => !entry.exerciseName || !entry.duplicateKey.replace("custom:", ""))) {
    showToast("Choose an exercise or enter a name for every set list.");
    return;
  }
  const exerciseKeys = entryDrafts.map((entry) => entry.duplicateKey);
  if (new Set(exerciseKeys).size !== exerciseKeys.length) {
    showToast("Combine duplicate exercises into one set list.");
    return;
  }
  const invalidSet = entryDrafts.some((entry) => !entry.sets.length || entry.sets.length > MAX_MANUAL_SETS_PER_EXERCISE || entry.sets.some((set) => {
    const mode = Domain.setMeasurementMode(set, entry.measurementMode);
    const needsReps = mode === "load_reps" || mode === "reps";
    const needsDuration = mode === "duration" || mode === "distance_duration";
    const needsDistance = mode === "distance_duration";
    const needsLoad = mode === "load_reps" || mode === "distance_duration";
    return (
      (needsReps && (!Number.isFinite(set.reps) || set.reps < 0 || set.reps > 100))
      || (needsLoad && (!Number.isFinite(set.weightKg) || set.weightKg < 0 || set.weightKg > 2000))
      || (needsDuration && (!Number.isFinite(set.durationSeconds) || set.durationSeconds <= 0 || set.durationSeconds > 86400))
      || (needsDistance && (!Number.isFinite(set.distanceMeters) || set.distanceMeters <= 0 || set.distanceMeters > 10_000_000))
      || (set.rir !== null && (!Number.isFinite(set.rir) || set.rir < 0 || set.rir > 10 || Math.abs(set.rir * 2 - Math.round(set.rir * 2)) > 0.00001))
    );
  }));
  if (invalidSet) {
    showToast("Check each set’s measurement mode, values, and optional RIR.");
    return;
  }
  if (entryDrafts.some((entry) => !getQualifiedWorkingSets(entry).length)) {
    showToast("Each exercise needs at least one non-warm-up set.");
    return;
  }
  const existingIndex = editingWorkoutId ? data.workouts.findIndex((workout) => workout.id === editingWorkoutId) : -1;
  const existing = existingIndex >= 0 ? data.workouts[existingIndex] : null;
  const existingExerciseIds = new Set((existing?.entries || []).map((entry) => entry.exerciseId));
  if (entryDrafts.some((entry) => entry.exercise && !isExerciseAvailable(entry.exercise) && !existingExerciseIds.has(entry.exercise.id))) {
    showToast("That exercise is not enabled in your equipment profile.");
    return;
  }
  const previousCustomExercises = [...data.customExercises];
  const previousExercisePreferences = structuredClone(data.exercisePreferences || {});
  const entries = entryDrafts.map((entry) => {
    const exerciseId = entry.exercise?.id || customExerciseFor(entry.exerciseName, "manual");
    data.exercisePreferences ||= {};
    data.exercisePreferences[exerciseId] = {
      measurementMode: entry.measurementMode,
      loadMode: entry.loadMode,
      repMode: entry.repMode,
      effectiveFrom: date,
    };
    return {
      exerciseId,
      measurementMode: entry.measurementMode,
      loadMode: entry.loadMode,
      repMode: entry.repMode,
      sets: entry.sets,
    };
  });
  const recoverySnapshot = date === toDateInput(new Date()) ? getTodayRecoveryCheckin() : existing?.recoverySnapshot || null;
  const workoutRecord = {
    ...(existing || {}),
    id: existing?.id || `workout-${Date.now()}`,
    source: existing?.source || "manual",
    date,
    name,
    duration,
    notes: $("#sessionNotes").value.trim().slice(0, 2000),
    entries,
    recoverySnapshot: recoverySnapshot ? structuredClone(recoverySnapshot) : null,
    updatedAt: new Date().toISOString(),
  };
  const previousWorkouts = [...data.workouts];
  if (existingIndex >= 0) data.workouts[existingIndex] = workoutRecord;
  else data.workouts.push(workoutRecord);
  if (!saveData()) {
    data.workouts = previousWorkouts;
    data.customExercises = previousCustomExercises;
    data.exercisePreferences = previousExercisePreferences;
    showToast("Storage is full. Export a backup before saving this workout.");
    return;
  }
  const wasEditing = existingIndex >= 0;
  editingWorkoutId = null;
  clearWorkoutDraft();
  workoutEditorDirty = false;
  closeModal("workoutModal", { force: true });
  renderAll();
  showToast(wasEditing ? "Workout changes saved." : "Workout saved — great work.");
}

function renderEquipmentChecklist() {
  $("#equipmentChecklist").innerHTML = EQUIPMENT_OPTIONS.map((item) => `<label class="equipment-option ${item.id === "machine" ? "machine-option" : ""}"><input type="checkbox" name="equipment-${escapeHtml(item.id)}" ${data.profile.equipment?.[item.id] !== false ? "checked" : ""} />${escapeHtml(item.label)}</label>`).join("");
}

function saveProfile(event) {
  event.preventDefault();
  const equipment = Object.fromEntries(EQUIPMENT_OPTIONS.map((item) => [item.id, Boolean($(`[name="equipment-${item.id}"]`)?.checked)]));
  const loadIncrement = unitValueToKg($("#profileLoadIncrement").value, $("#profileForm").dataset.displayUnit || weightUnit());
  const previous = data.profile;
  data.profile = {
    ...data.profile,
    name: $("#profileName").value.trim() || "Athlete",
    goal: $("#profileGoal").value,
    days: Number($("#profileDays").value),
    experience: $("#profileExperience").value,
    equipment,
    equipmentProfileVersion: EQUIPMENT_PROFILE_VERSION,
    loadIncrementKg: Number.isFinite(loadIncrement) && loadIncrement >= 0.5 && loadIncrement <= 10 ? loadIncrement : DEFAULT_LOAD_INCREMENT_KG,
    locale: $("#profileLocale").value === "pl" ? "pl" : "en",
    units: $("#profileUnits").value === "lb" ? "lb" : "kg",
  };
  if (!saveData()) {
    data.profile = previous;
    showToast("The profile could not be saved to browser storage.");
    return;
  }
  closeModal("profileModal"); applyLocale(); renderAll({ force: true }); showToast("Training profile saved.");
}

function openProfile() {
  $("#profileForm").dataset.displayUnit = weightUnit();
  $("#profileName").value = data.profile.name;
  $("#profileGoal").value = data.profile.goal;
  $("#profileDays").value = String(data.profile.days);
  $("#profileExperience").value = data.profile.experience;
  $("#profileLoadIncrement").value = String(kgToDisplay(data.profile.loadIncrementKg || DEFAULT_LOAD_INCREMENT_KG));
  $("#profileLoadIncrementLabel").firstChild.textContent = `Smallest load jump (${weightUnit()})`;
  $("#profileLocale").value = data.profile.locale || "en";
  $("#profileUnits").value = data.profile.units || "kg";
  renderEquipmentChecklist();
  openModal("profileModal");
}

function openTargets() {
  $("#targetsFields").innerHTML = MUSCLES.map((muscle) => { const [low, high] = targetFor(muscle); return `<div class="target-field"><span>${muscle}</span><label>Min<input name="${muscle}-min" type="number" min="0" max="40" value="${low}" required /></label><label>Max<input name="${muscle}-max" type="number" min="1" max="50" value="${high}" required /></label></div>`; }).join("");
  openModal("targetsModal");
}

function saveTargets(event) {
  event.preventDefault();
  const nextTargets = {};
  for (const muscle of MUSCLES) {
    const low = Number($(`[name="${muscle}-min"]`).value);
    const high = Number($(`[name="${muscle}-max"]`).value);
    if (!Number.isFinite(low) || !Number.isFinite(high) || !Number.isInteger(low) || !Number.isInteger(high) || low < 0 || high < Math.max(1, low) || high > 50) { showToast("Each planning range needs a valid whole-number min and max."); return; }
    nextTargets[muscle] = [low, high];
  }
  const previous = data.targets;
  data.targets = nextTargets;
  if (!saveData()) {
    data.targets = previous;
    showToast("The planning ranges could not be saved to browser storage.");
    return;
  }
  closeModal("targetsModal"); renderAll(); showToast("Muscle planning ranges updated.");
}

function deleteWorkout(id) {
  const workout = data.workouts.find((item) => item.id === id);
  if (!workout) return;
  if (!window.confirm(`Delete “${workout.name}” from ${formatDate(workout.date)}? This cannot be undone.`)) return;
  const previous = data.workouts;
  data.workouts = data.workouts.filter((item) => item.id !== id);
  if (!saveData()) {
    data.workouts = previous;
    showToast("The workout could not be deleted from browser storage.");
    return;
  }
  renderAll(); showToast("Workout deleted.");
}

function downloadText(filename, contents, type) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportBackup() {
  data.appMeta ||= {};
  data.appMeta.lastBackupAt = new Date().toISOString();
  saveData();
  downloadText(`liftwise-backup-${toDateInput(new Date())}.json`, JSON.stringify(data, null, 2), "application/json");
  renderDataCenter();
  showToast("JSON backup exported.");
}

function formatBytes(bytes) {
  const value = Math.max(0, Number(bytes) || 0);
  if (value < 1000) return `${value} B`;
  if (value < 1_000_000) return `${formatNumber(value / 1000)} KB`;
  return `${formatNumber(value / 1_000_000)} MB`;
}

function showPersistentStatus(message = "") {
  const element = $("#persistentStatus");
  if (!element) return;
  element.hidden = !message;
  element.textContent = message;
}

function renderStorageRecoveryBanner() {
  const banner = $("#storageRecoveryBanner");
  if (!banner) return;
  banner.hidden = !storageState.loadError;
  $("#storageRecoveryMessage").textContent = storageState.loadError || "";
}

function renderDataCenter() {
  const content = $("#dataCenterContent");
  if (!content) return;
  const serialized = JSON.stringify(data);
  const setCount = data.workouts.reduce((total, workout) => total + workout.entries.reduce((entryTotal, entry) => entryTotal + (entry.sets || []).length, 0), 0);
  const latestImport = (data.importBatches || []).at(-1);
  let undoAvailable = false;
  try { undoAvailable = Boolean(JSON.parse(localStorage.getItem(IMPORT_UNDO_KEY))?.snapshot); } catch (error) { undoAvailable = false; }
  const importHistory = [...(data.importBatches || [])].reverse().map((batch) => {
    const isFitatu = batch.source === "fitatu-csv" || batch.kind === "nutrition";
    const source = isFitatu ? "Fitatu nutrition" : "Hevy workouts";
    const unit = isFitatu ? "days" : "sessions";
    return `<article class="import-history-row"><div><strong>${escapeHtml(batch.fileName)}</strong><span>${escapeHtml(source)} · ${batch.importedAt ? escapeHtml(new Intl.DateTimeFormat(currentLocale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(batch.importedAt))) : "Unknown time"} · ${escapeHtml(batch.mode || "merge")}</span></div><span>${batch.added || 0} ${unit} added · ${batch.updated || 0} updated · ${batch.unchanged || 0} unchanged${batch.conflicted ? ` · ${batch.conflicted} conflicts` : ""}</span></article>`;
  }).join("");
  const fitatuIntegration = data.integrations?.fitatu || {};
  content.innerHTML = `
    <div class="data-health-grid">
      <article><span>Persistence</span><strong class="${storageState.persistent ? "ok" : "warning"}">${storageState.persistent ? "Available" : "Unavailable"}</strong></article>
      <article><span>App shell</span><strong>${navigator.onLine ? "Online · offline cache ready after first load" : "Offline"}</strong></article>
      <article><span>Stored data</span><strong>${formatBytes(new Blob([serialized]).size)}</strong></article>
      <article><span>Workout sessions</span><strong>${data.workouts.length}</strong></article>
      <article><span>Stored sets</span><strong>${setCount}</strong></article>
      <article><span>Fitatu nutrition days</span><strong>${(data.nutritionDays || []).length}</strong></article>
      <article><span>Last JSON backup</span><strong>${data.appMeta?.lastBackupAt ? escapeHtml(new Intl.DateTimeFormat(currentLocale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.appMeta.lastBackupAt))) : "Not recorded"}</strong></article>
      <article><span>Last import</span><strong>${latestImport ? `${latestImport.added || 0} added / ${latestImport.updated || 0} updated` : "None"}</strong></article>
    </div>
    <div class="data-center-actions">
      <button type="button" class="primary-button compact" data-backup-json>Backup JSON</button>
      <button type="button" class="secondary-button compact" data-export-csv>Export CSV</button>
      <button type="button" class="secondary-button compact" data-undo-import ${undoAvailable ? "" : "disabled"}>Undo last import</button>
      <button type="button" class="secondary-button compact" data-download-recovery ${storageState.recoveryAvailable ? "" : "disabled"}>Download recovery copy</button>
    </div>
    <section class="integration-summary"><div><strong>Fitatu CSV</strong><span>${fitatuIntegration.lastImportAt ? `Last import ${escapeHtml(new Intl.DateTimeFormat(currentLocale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(fitatuIntegration.lastImportAt)))} · ${escapeHtml(fitatuIntegration.lastFileName || "CSV")}` : "Import daily calories and macros from a Fitatu CSV export. Data is parsed and stored locally."}</span></div><div class="integration-actions"><button type="button" class="text-button compact" data-import-fitatu>Import CSV</button><button type="button" class="text-button compact" data-clear-fitatu ${(data.nutritionDays || []).length ? "" : "disabled"}>Clear</button></div></section>
    <section class="integration-summary"><div><strong>Garmin Connect</strong><span>Integration is deferred until a secure backend and approved API access exist. Manual measurements remain available.</span></div><button type="button" class="text-button compact" data-open-garmin>Details</button></section>
    <section class="import-history"><h3>Import history</h3>${importHistory || `<p class="muted">No imports recorded yet.</p>`}</section>`;
  if (navigator.storage?.estimate) {
    navigator.storage.estimate().then((estimate) => {
      const note = $("#storageEstimate");
      if (note) note.textContent = `Browser storage: ${formatBytes(estimate.usage)} used of approximately ${formatBytes(estimate.quota)}.`;
    }).catch(() => {});
  }
}

function openDataCenter() {
  renderDataCenter();
  openModal("dataCenterModal");
}

function downloadRecoveryCopy() {
  let raw = null;
  try {
    raw = localStorage.getItem(CORRUPT_KEY) || localStorage.getItem(RECOVERY_KEY);
  } catch (error) {
    raw = null;
  }
  if (!raw) {
    showToast("No recovery copy is available.");
    return;
  }
  downloadText(`liftwise-recovery-${toDateInput(new Date())}.json`, raw, "application/json");
}

function restoreRecoveryCopy() {
  let raw = null;
  try { raw = localStorage.getItem(RECOVERY_KEY); } catch (error) { raw = null; }
  if (!raw) {
    showToast("No previous-version snapshot is available.");
    return;
  }
  try {
    const restoredRaw = JSON.parse(raw);
    const restored = migrateData(restoredRaw);
    const validationError = validateBackupShape(restored);
    if (validationError) throw new Error(validationError);
    if (!window.confirm("Restore the previous-version snapshot? The current in-memory data will be replaced.")) return;
    data = restored;
    storageState.loadError = null;
    storageState.recoveryAvailable = true;
    if (!saveData()) throw new Error("The restored snapshot could not be persisted.");
    renderAll({ force: true });
    renderStorageRecoveryBanner();
    showPersistentStatus("Previous-version recovery snapshot restored.");
  } catch (error) {
    showToast(`Recovery failed: ${error.message}`);
  }
}

function startFreshAfterRecovery() {
  if (!window.confirm("Start with fresh demo data? Download the recovery copy first if you may need it later.")) return;
  data = migrateData(createStarterData());
  storageState.loadError = null;
  if (!saveData()) {
    showToast("Fresh data could not be persisted.");
    return;
  }
  renderAll({ force: true });
  renderStorageRecoveryBanner();
  showPersistentStatus("Fresh local data started. Existing recovery copies were retained.");
}

function commitPendingMigration() {
  if (!pendingMigrationPayload) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingMigrationPayload));
    pendingMigrationPayload = null;
    storageState.pendingMigration = false;
  } catch (error) {
    storageState.persistent = false;
    storageState.loadError = "Migrated data rendered successfully but could not be persisted. The previous-version snapshot is still available.";
  }
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function workoutTimes(workout) {
  let start = workout.startTime ? new Date(workout.startTime) : parseDate(workout.date);
  if (Number.isNaN(start.getTime())) start = new Date();
  if (!workout.startTime) start.setHours(12, 0, 0, 0);
  let end = workout.endTime ? new Date(workout.endTime) : new Date(start.getTime() + (Number(workout.duration) || 0) * 60000);
  if (Number.isNaN(end.getTime())) end = new Date(start);
  return { start: start.toISOString(), end: end.toISOString() };
}

function exportCsv() {
  const headers = ["title", "start_time", "end_time", "description", "exercise_title", "superset_id", "exercise_notes", "set_index", "set_type", "weight_kg", "reps", "distance_km", "duration_seconds", "rpe", "rir", "measurement_mode", "load_mode", "rep_mode", "effort_source"];
  const rows = [headers];
  sortRecent(data.workouts).reverse().forEach((workout) => {
    const times = workoutTimes(workout);
    workout.entries.forEach((entry) => {
      const exercise = getExercise(entry.exerciseId);
      const exerciseTitle = exercise?.name || entry.sourceExerciseName || "Unknown exercise";
      (entry.sets || []).forEach((set, setIndex) => {
        const rawRpe = set.rawRpe ?? set.rpe ?? "";
        const explicitRir = set.manualRirCleared
          ? ""
          : set.manualRir ?? set.explicitImportedRir ?? (set.effortSource === "manual" ? set.rir : "");
        rows.push([
          workout.name,
          times.start,
          times.end,
          workout.notes || "",
          exerciseTitle,
          entry.supersetId ?? "",
          entry.exerciseNotes || "",
          setIndex + 1,
          set.type || "normal",
          set.weightKg ?? "",
          set.reps ?? "",
          Number.isFinite(set.distanceMeters) ? set.distanceMeters / 1000 : "",
          set.durationSeconds ?? "",
          rawRpe,
          explicitRir,
          set.measurementMode || entry.measurementMode || defaultMeasurementMode(exercise),
          entry.loadMode || exerciseConventions(entry.exerciseId, entry).loadMode,
          entry.repMode || exerciseConventions(entry.exerciseId, entry).repMode,
          set.effortSource || "missing",
        ]);
      });
    });
  });
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  downloadText(`liftwise-workouts-${toDateInput(new Date())}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
  showToast(`${data.workouts.length} workouts exported to CSV.`);
}

function normalizeCsvHeader(value) {
  return Domain.normalizeCsvHeader(value);
}

function parseCsv(text) {
  const { rows } = Domain.parseDelimitedRows(text, MAX_CSV_ROWS + 1);
  if (rows.length < 2) throw new Error("The CSV does not contain workout rows.");
  const headers = rows.shift().map(normalizeCsvHeader);
  if (new Set(headers).size !== headers.length) throw new Error("The CSV contains duplicate column names.");
  const records = rows.map((values, rowIndex) => ({
    ...Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
    __rowNumber: rowIndex + 2,
    __columnMismatch: values.length !== headers.length,
  }));
  return { headers, records };
}

function recordValue(record, ...keys) {
  for (const key of keys) {
    const value = record[normalizeCsvHeader(key)];
    if (value !== undefined && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function parseImportDate(value) {
  const input = String(value || "").trim();
  const hevyDate = input.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hevyDate) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const month = months.indexOf(hevyDate[2].toLowerCase());
    if (month >= 0) return new Date(Number(hevyDate[3]), month, Number(hevyDate[1]), Number(hevyDate[4]), Number(hevyDate[5]), Number(hevyDate[6] || 0));
  }
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function localDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function findExerciseMatch(sourceTitle) {
  const normalized = normalizeExerciseName(sourceTitle);
  const remembered = data.importAliases?.[`hevy:${normalized}`];
  if (remembered && getExercise(remembered)) return remembered;
  const libraryMatch = findLibraryExerciseByName(sourceTitle);
  if (libraryMatch) return libraryMatch.id;
  return (data.customExercises || []).find((exercise) => normalizeExerciseName(exercise.name) === normalized)?.id || null;
}

function parseHevyCsv(text, fileName) {
  if (new Blob([text]).size > MAX_CSV_BYTES) throw new Error(`The CSV exceeds the ${Math.round(MAX_CSV_BYTES / 1_000_000)} MB safety limit.`);
  const { headers, records } = parseCsv(text);
  const hasTitle = headers.some((header) => ["title", "workout_title", "workout_name"].includes(header));
  const hasStart = headers.some((header) => ["start_time", "date"].includes(header));
  const hasExercise = headers.some((header) => ["exercise_title", "exercise_name"].includes(header));
  if (!hasTitle || !hasStart || !hasExercise) throw new Error("This does not look like a Hevy workout CSV. Expected title, start_time, and exercise_title columns.");

  const usesPounds = headers.includes("weight_lbs") || headers.includes("weight_lb");
  const usesKilograms = headers.includes("weight_kg");
  const usesGenericWeight = !usesPounds && !usesKilograms && headers.includes("weight");
  const warnings = [];
  const rejectedRows = [];
  const convertedRows = [];
  if (usesPounds) warnings.push("Weights were detected in pounds and will be converted to kilograms.");
  if (usesGenericWeight) warnings.push("The file has a generic weight column. Liftwise will treat it as kilograms.");

  const workoutMap = new Map();
  const exerciseCounts = new Map();
  const readNumber = (record, label, keys, minimum, maximum) => {
    const raw = recordValue(record, ...keys);
    if (!raw) return { value: null };
    const value = nullableNumber(raw);
    if (value === null) return { value: null, error: `${label} is not a number` };
    if (value < minimum || value > maximum) return { value: null, error: `${label} must be ${minimum}–${maximum}` };
    return { value };
  };
  records.forEach((record, rowIndex) => {
    const reasons = [];
    const title = recordValue(record, "title", "workout_title", "workout_name") || "Imported workout";
    const sourceTitle = recordValue(record, "exercise_title", "exercise_name");
    const startRaw = recordValue(record, "start_time", "date");
    const start = parseImportDate(startRaw);
    if (record.__columnMismatch) reasons.push("column count does not match the header");
    if (!sourceTitle) reasons.push("exercise title is missing");
    if (!start) reasons.push("start date is invalid");
    if (start && localDateInput(start) > toDateInput(new Date())) reasons.push("future workout dates are not accepted");
    const endRaw = recordValue(record, "end_time");
    const end = endRaw ? parseImportDate(endRaw) : null;
    if (endRaw && !end) reasons.push("end date is invalid");
    if (start && end && end < start) reasons.push("end time is before start time");
    if (start && end && (end - start) / 60000 > 1440) reasons.push("workout duration exceeds 1,440 minutes");
    const kg = readNumber(record, "weight_kg", ["weight_kg"], 0, 2000);
    const pounds = readNumber(record, "weight_lbs", ["weight_lbs", "weight_lb"], 0, 4409.25);
    const generic = readNumber(record, "weight", ["weight"], 0, 2000);
    const reps = readNumber(record, "reps", ["reps"], 0, 100);
    const rpe = readNumber(record, "RPE", ["rpe"], 0, 10);
    const explicitRir = readNumber(record, "RIR", ["rir"], 0, 10);
    const distanceKm = readNumber(record, "distance_km", ["distance_km"], 0, 10_000);
    const distanceMiles = readNumber(record, "distance_miles", ["distance_miles"], 0, 6213.71);
    const durationSeconds = readNumber(record, "duration_seconds", ["duration_seconds", "seconds"], 0, 86_400);
    const sourceSetIndex = readNumber(record, "set_index", ["set_index", "set_order"], 0, MAX_STORED_SETS_PER_EXERCISE);
    const measurementMode = recordValue(record, "measurement_mode");
    const loadMode = recordValue(record, "load_mode");
    const repMode = recordValue(record, "rep_mode");
    if (measurementMode && !Domain.MEASUREMENT_MODES.includes(measurementMode)) reasons.push("measurement_mode is invalid");
    if (loadMode && !Domain.LOAD_MODES.includes(loadMode)) reasons.push("load_mode is invalid");
    if (repMode && !Domain.REP_MODES.includes(repMode)) reasons.push("rep_mode is invalid");
    [kg, pounds, generic, reps, rpe, explicitRir, distanceKm, distanceMiles, durationSeconds, sourceSetIndex]
      .forEach((result) => { if (result.error) reasons.push(result.error); });
    if (reasons.length) {
      rejectedRows.push({
        rowNumber: record.__rowNumber || rowIndex + 2,
        exercise: sourceTitle || "—",
        workout: title,
        reasons: [...new Set(reasons)],
      });
      return;
    }
    const workoutKey = `${start.toISOString()}|${title}`;
    const sourceIdentity = `hevy:${simpleHash(workoutKey)}`;
    if (!workoutMap.has(workoutKey)) {
      workoutMap.set(workoutKey, {
        sourceKey: sourceIdentity,
        sourceIdentity,
        date: localDateInput(start),
        name: title,
        startTime: start.toISOString(),
        endTime: end?.toISOString() || null,
        duration: end ? Math.max(0, Math.round((end - start) / 60000)) : 0,
        notes: recordValue(record, "description", "workout_notes"),
        entries: new Map(),
      });
    }
    const workout = workoutMap.get(workoutKey);
    if (!workout.endTime && end) {
      workout.endTime = end.toISOString();
      workout.duration = Math.max(0, Math.round((end - start) / 60000));
    }
    if (!workout.notes) workout.notes = recordValue(record, "description", "workout_notes");
    const entryKey = normalizeExerciseName(sourceTitle);
    if (!workout.entries.has(entryKey)) {
      workout.entries.set(entryKey, {
        sourceExerciseName: sourceTitle,
        exerciseNotes: recordValue(record, "exercise_notes", "notes"),
        supersetId: recordValue(record, "superset_id") || null,
        measurementMode: measurementMode || null,
        loadMode: loadMode || null,
        repMode: repMode || null,
        sets: [],
      });
    }
    const entry = workout.entries.get(entryKey);
    const weightKg = kg.value ?? (pounds.value !== null ? Math.round(pounds.value * 0.45359237 * 100) / 100 : generic.value);
    if (pounds.value !== null) convertedRows.push(record.__rowNumber || rowIndex + 2);
    const index = sourceSetIndex.value ?? entry.sets.length;
    entry.sets.push(normalizeSet({
      index,
      type: recordValue(record, "set_type") || "normal",
      weightKg,
      reps: reps.value,
      rawRpe: rpe.value,
      explicitImportedRir: explicitRir.value,
      distanceMeters: distanceKm.value !== null ? distanceKm.value * 1000 : distanceMiles.value !== null ? distanceMiles.value * 1609.344 : null,
      durationSeconds: durationSeconds.value,
      measurementMode: measurementMode || undefined,
      sourceSetId: `${sourceIdentity}:${entryKey}:${index}`,
    }, rowIndex, { source: "hevy-csv" }));
    exerciseCounts.set(sourceTitle, (exerciseCounts.get(sourceTitle) || 0) + 1);
  });

  const workouts = [...workoutMap.values()].map((workout) => ({ ...workout, entries: [...workout.entries.values()] }));
  if (!workouts.length) throw new Error("No valid workouts were found in the CSV.");
  const exercises = [...exerciseCounts.entries()]
    .map(([sourceTitle, setCount]) => ({ sourceTitle, setCount, matchId: findExerciseMatch(sourceTitle) }))
    .sort((a, b) => a.sourceTitle.localeCompare(b.sourceTitle));
  const dates = workouts.map((workout) => parseDate(workout.date)).sort((a, b) => a - b);
  return {
    fileName,
    workouts,
    exercises,
    warnings,
    rejectedRows,
    convertedRows,
    acceptedRowCount: records.length - rejectedRows.length,
    totalRowCount: records.length,
    setCount: exercises.reduce((total, exercise) => total + exercise.setCount, 0),
    dateRange: `${new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(dates[0])} – ${new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(dates[dates.length - 1])}`,
  };
}

function parseFitatuCsv(text, fileName) {
  if (new Blob([text]).size > MAX_CSV_BYTES) throw new Error(`The CSV exceeds the ${Math.round(MAX_CSV_BYTES / 1_000_000)} MB safety limit.`);
  const parsed = Domain.parseFitatuExport(text, {
    maxRows: MAX_CSV_ROWS,
    today: toDateInput(new Date()),
  });
  const days = parsed.days.map((day) => {
    const normalized = normalizeNutritionDay(day);
    return {
      ...normalized,
      importedAt: null,
      contentFingerprint: nutritionDayFingerprint(normalized),
    };
  }).filter(Boolean);
  const warnings = [];
  if (parsed.headerRowNumber > 1) warnings.push(`${parsed.headerRowNumber - 1} metadata row${parsed.headerRowNumber === 2 ? "" : "s"} before the Fitatu table were skipped.`);
  if (parsed.delimiter === ";") warnings.push("A semicolon-separated Fitatu export was detected.");
  if (parsed.delimiter === "\t") warnings.push("A tab-separated Fitatu export was detected.");
  const summarizedDays = days.filter((day) => day.aggregation !== "items").length;
  if (summarizedDays) warnings.push(`${summarizedDays} day${summarizedDays === 1 ? "" : "s"} used Fitatu total rows so food items were not counted twice.`);
  if (parsed.rejectedRows.length) warnings.push(`${parsed.rejectedRows.length} invalid or future row${parsed.rejectedRows.length === 1 ? " was" : "s were"} rejected.`);
  return {
    fileName,
    days,
    warnings,
    rejectedRows: parsed.rejectedRows,
    acceptedRowCount: parsed.acceptedRowCount,
    totalRowCount: parsed.totalRowCount,
    dateRange: formatImportScopeDateRange(days),
  };
}

function formatImportScopeDateRange(workouts) {
  const dates = workouts.map((workout) => parseDate(workout.date)).sort((first, second) => first - second);
  if (!dates.length) return "No dates";
  const formatter = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });
  const first = formatter.format(dates[0]);
  const last = formatter.format(dates.at(-1));
  return first === last ? first : `${first} – ${last}`;
}

function buildCsvImportScope(pending, range = "all") {
  let workouts = pending.workouts;
  if (range === "recent" && workouts.length) {
    const latest = Math.max(...workouts.map((workout) => parseDate(workout.date).getTime()));
    const firstIncluded = latest - 6 * 24 * 60 * 60 * 1000;
    workouts = workouts.filter((workout) => {
      const timestamp = parseDate(workout.date).getTime();
      return timestamp >= firstIncluded && timestamp <= latest;
    });
  }
  const exerciseCounts = new Map();
  workouts.forEach((workout) => workout.entries.forEach((entry) => {
    exerciseCounts.set(entry.sourceExerciseName, (exerciseCounts.get(entry.sourceExerciseName) || 0) + (entry.sets || []).length);
  }));
  const exercises = [...exerciseCounts.entries()]
    .map(([sourceTitle, setCount]) => ({ sourceTitle, setCount, matchId: findExerciseMatch(sourceTitle) }))
    .sort((first, second) => first.sourceTitle.localeCompare(second.sourceTitle));
  const warnings = [...pending.warnings];
  const unmatched = exercises.filter((exercise) => !exercise.matchId).length;
  if (unmatched) warnings.push(`${unmatched} exercise${unmatched === 1 ? "" : "s"} need mapping or will be kept as custom exercises.`);
  if (pending.rejectedRows?.length) warnings.push(`${pending.rejectedRows.length} invalid row${pending.rejectedRows.length === 1 ? " was" : "s were"} rejected. Review the error report before importing valid rows.`);
  if (pending.convertedRows?.length) warnings.push(`${pending.convertedRows.length} row${pending.convertedRows.length === 1 ? "" : "s"} converted from pounds to kilograms.`);
  return {
    range,
    workouts,
    exercises,
    warnings,
    rejectedRows: pending.rejectedRows || [],
    acceptedRowCount: workouts.reduce((total, workout) => total + workout.entries.reduce((entryTotal, entry) => entryTotal + entry.sets.length, 0), 0),
    totalRowCount: pending.totalRowCount || pending.acceptedRowCount || 0,
    setCount: exercises.reduce((total, exercise) => total + exercise.setCount, 0),
    dateRange: formatImportScopeDateRange(workouts),
  };
}

function captureCsvImportMappings() {
  if (!pendingCsvImport || !pendingCsvImportScope) return;
  pendingCsvImport.mappingSelections ||= {};
  $$("[data-mapping-index]", $("#exerciseMappings")).forEach((select, index) => {
    const exercise = pendingCsvImportScope.exercises[index];
    if (exercise) pendingCsvImport.mappingSelections[exercise.sourceTitle] = select.value;
  });
}

function provisionalCustomExerciseId(sourceTitle) {
  const normalized = normalizeExerciseName(sourceTitle);
  const existing = (data.customExercises || []).find((exercise) => normalizeExerciseName(exercise.name) === normalized);
  return existing?.id || `custom-${simpleHash(normalized)}`;
}

function mappedImportWorkout(workout, mappings, createCustom = false) {
  const entries = mergeEntriesByExerciseId(workout.entries.map((entry) => {
    const selected = mappings[entry.sourceExerciseName];
    const exerciseId = selected === "__custom__"
      ? createCustom ? customExerciseFor(entry.sourceExerciseName) : provisionalCustomExerciseId(entry.sourceExerciseName)
      : selected;
    return {
      ...entry,
      exerciseId,
      sets: entry.sets.map((set, index) => normalizeSet(set, index, { source: "hevy-csv" })),
    };
  }));
  const imported = {
    ...workout,
    id: `hevy-${simpleHash(workout.sourceIdentity || workout.sourceKey)}`,
    source: "hevy-csv",
    sourceIdentity: workout.sourceIdentity || workout.sourceKey,
    sourceKeys: [workout.sourceIdentity || workout.sourceKey],
    entries,
  };
  imported.contentFingerprint = Domain.contentFingerprint(imported);
  return imported;
}

function existingSourceWorkout(identity) {
  return data.workouts.find((workout) => (
    workout.sourceIdentity === identity
    || workoutSourceKeys(workout).includes(identity)
  )) || null;
}

function buildCsvImportPlan(scope, mappings, mode = "merge", createCustom = false) {
  const changes = [];
  scope.workouts.forEach((workout) => {
    const incoming = mappedImportWorkout(workout, mappings, createCustom);
    const existing = mode === "replace" ? null : existingSourceWorkout(incoming.sourceIdentity);
    if (existing?.legacyMerged && workoutSourceKeys(existing).length > 1) {
      changes.push({
        status: "conflicted",
        date: incoming.date,
        existing,
        incoming,
        reason: "This source session is inside a legacy collapsed day and cannot be updated safely.",
      });
      return;
    }
    const comparison = Domain.compareSourceWorkout(existing, incoming);
    changes.push({ ...comparison, date: incoming.date });
  });
  const counts = { added: 0, updated: 0, unchanged: 0, conflicted: 0 };
  changes.forEach((change) => { counts[change.status] += 1; });
  return { changes, counts };
}

function currentImportMappings(scope = pendingCsvImportScope) {
  return Object.fromEntries((scope?.exercises || []).map((exercise) => {
    const selected = pendingCsvImport?.mappingSelections?.[exercise.sourceTitle] || exercise.matchId || "__custom__";
    return [exercise.sourceTitle, selected];
  }));
}

function renderImportDiff() {
  const container = $("#importDiff");
  if (!container || !pendingCsvImportScope) return;
  captureCsvImportMappings();
  const mode = $('[name="importMode"]:checked')?.value || "merge";
  const plan = buildCsvImportPlan(pendingCsvImportScope, currentImportMappings(), mode, false);
  const summary = [
    ["New", plan.counts.added],
    ["Updated", plan.counts.updated],
    ["Unchanged", plan.counts.unchanged],
    ["Conflicts", plan.counts.conflicted],
  ];
  const rows = plan.changes.slice(0, 30).map((change) => (
    `<li class="import-diff-${escapeHtml(change.status)}"><span>${escapeHtml(formatDate(change.date, { year: "numeric", month: "short", day: "numeric" }))}</span><strong>${escapeHtml(change.incoming.name)}</strong><em>${escapeHtml(change.status)}</em>${change.reason ? `<small>${escapeHtml(change.reason)}</small>` : ""}</li>`
  )).join("");
  container.innerHTML = `<div class="import-diff-counts">${summary.map(([label, value]) => `<span><strong>${value}</strong>${label}</span>`).join("")}</div><ul>${rows}</ul>${plan.changes.length > 30 ? `<p class="muted">Showing the first 30 of ${plan.changes.length} affected source sessions.</p>` : ""}`;
}

function renderImportPreview(initial = false) {
  const pending = pendingCsvImport;
  if (!pending) return;
  if (!initial) captureCsvImportMappings();
  const range = $('[name="importRange"]:checked')?.value || "all";
  const scope = buildCsvImportScope(pending, range);
  pendingCsvImportScope = scope;
  const unmatched = scope.exercises.filter((exercise) => !exercise.matchId).length;
  $("#importSummary").innerHTML = [
    ["Workouts", scope.workouts.length],
    ["Sets", scope.setCount],
    ["Exercises", scope.exercises.length],
    ["Date range", scope.dateRange],
    ["Rejected rows", scope.rejectedRows.length],
  ].map(([label, value]) => `<div class="import-summary-card"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  $("#importWarnings").innerHTML = scope.warnings.map((warning) => `<div class="import-warning">${escapeHtml(warning)}</div>`).join("");
  $("#mappingCount").textContent = unmatched ? `${unmatched} to review` : "All matched";
  const availableOptions = getAllExercises().map((exercise) => `<option value="${escapeHtml(exercise.id)}">${escapeHtml(exercise.name)}</option>`).join("");
  $("#exerciseMappings").innerHTML = scope.exercises.map((exercise, index) => {
    const options = `<option value="__custom__">Keep as custom (no muscle insights)</option>${availableOptions}`;
    return `<div class="mapping-row"><div class="mapping-source"><strong title="${escapeHtml(exercise.sourceTitle)}">${escapeHtml(exercise.sourceTitle)}</strong><span>${exercise.setCount} set${exercise.setCount === 1 ? "" : "s"}</span></div><span class="mapping-arrow">→</span><select data-mapping-index="${index}" aria-label="Map ${escapeHtml(exercise.sourceTitle)}">${options}</select></div>`;
  }).join("");
  $$("[data-mapping-index]", $("#exerciseMappings")).forEach((select, index) => {
    const exercise = scope.exercises[index];
    select.value = pending.mappingSelections?.[exercise.sourceTitle] || exercise.matchId || "__custom__";
    select.addEventListener("change", () => {
      captureCsvImportMappings();
      renderImportDiff();
    });
  });
  const partialConfirmation = $("#acceptValidRowsOnly");
  const partialConfirmationWrap = $("#acceptValidRowsOnlyWrap");
  if (partialConfirmationWrap) partialConfirmationWrap.hidden = !scope.rejectedRows.length;
  if (partialConfirmation && !scope.rejectedRows.length) partialConfirmation.checked = false;
  renderImportDiff();
  const recentScope = buildCsvImportScope(pending, "recent");
  $("#recentImportRangeDetail").textContent = `${recentScope.dateRange} · ${recentScope.workouts.length} workout${recentScope.workouts.length === 1 ? "" : "s"}`;
  if (initial) {
    const onlyDemo = data.workouts.length > 0 && data.workouts.every((workout) => String(workout.id).startsWith("seed-"));
    $("#replaceImportLabel").textContent = onlyDemo ? "Replace demo workouts" : "Replace current workouts";
    const mode = $(`[name="importMode"][value="${onlyDemo ? "replace" : "merge"}"]`);
    if (mode) mode.checked = true;
    renderImportDiff();
    openModal("importModal");
  }
}

function buildFitatuImportPlan(pending = pendingFitatuImport, mode = "merge") {
  const changes = (pending?.days || []).map((day) => {
    const incoming = normalizeNutritionDay(day);
    const existing = mode === "replace"
      ? null
      : (data.nutritionDays || []).find((item) => item.sourceIdentity === incoming.sourceIdentity || item.date === incoming.date);
    if (!existing) return { status: "added", incoming, existing: null };
    const before = existing.contentFingerprint || nutritionDayFingerprint(existing);
    const after = nutritionDayFingerprint(incoming);
    if (before === after) return { status: "unchanged", incoming: { ...incoming, id: existing.id }, existing };
    return { status: "updated", incoming: { ...incoming, id: existing.id }, existing };
  });
  const counts = { added: 0, updated: 0, unchanged: 0 };
  changes.forEach((change) => { counts[change.status] += 1; });
  return { changes, counts };
}

function renderFitatuImportPreview(initial = false) {
  if (!pendingFitatuImport) return;
  const mode = $('[name="fitatuImportMode"]:checked')?.value || "merge";
  const plan = buildFitatuImportPlan(pendingFitatuImport, mode);
  $("#fitatuImportSummary").innerHTML = [
    ["Nutrition days", pendingFitatuImport.days.length],
    ["Source rows", pendingFitatuImport.acceptedRowCount],
    ["Date range", pendingFitatuImport.dateRange],
    ["Rejected rows", pendingFitatuImport.rejectedRows.length],
    ["Changes", plan.counts.added + plan.counts.updated],
  ].map(([label, value]) => `<div class="import-summary-card"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  $("#fitatuImportWarnings").innerHTML = pendingFitatuImport.warnings
    .map((warning) => `<div class="import-warning">${escapeHtml(warning)}</div>`).join("");
  const summary = [
    ["New", plan.counts.added],
    ["Updated", plan.counts.updated],
    ["Unchanged", plan.counts.unchanged],
    ["Rejected", pendingFitatuImport.rejectedRows.length],
  ];
  const rows = plan.changes.slice(0, 30).map((change) => {
    const calories = change.incoming.caloriesKcal === null ? "calories unavailable" : `${formatNumber(change.incoming.caloriesKcal)} kcal`;
    const protein = change.incoming.proteinG === null ? "protein unavailable" : `${formatNumber(change.incoming.proteinG)} g protein`;
    return `<li class="import-diff-${escapeHtml(change.status)}"><span>${escapeHtml(formatDate(change.incoming.date, { year: "numeric", month: "short", day: "numeric" }))}</span><strong>${escapeHtml(`${calories} · ${protein}`)}</strong><em>${escapeHtml(change.status)}</em></li>`;
  }).join("");
  $("#fitatuImportDiff").innerHTML = `<div class="import-diff-counts">${summary.map(([label, value]) => `<span><strong>${value}</strong>${label}</span>`).join("")}</div><ul>${rows}</ul>${plan.changes.length > 30 ? `<p class="muted">Showing the first 30 of ${plan.changes.length} nutrition days.</p>` : ""}`;
  $("#downloadFitatuImportErrors").hidden = !pendingFitatuImport.rejectedRows.length;
  $("#acceptFitatuValidRowsOnlyWrap").hidden = !pendingFitatuImport.rejectedRows.length;
  if (!pendingFitatuImport.rejectedRows.length) $("#acceptFitatuValidRowsOnly").checked = false;
  if (initial) {
    const merge = $('[name="fitatuImportMode"][value="merge"]');
    if (merge) merge.checked = true;
    openModal("fitatuImportModal");
  }
}

function customExerciseFor(sourceTitle, origin = "import") {
  const cleanName = String(sourceTitle || "").trim().slice(0, 100);
  const normalized = normalizeExerciseName(cleanName);
  const existing = (data.customExercises || []).find((exercise) => normalizeExerciseName(exercise.name) === normalized);
  if (existing) return existing.id;
  const baseId = `custom-${simpleHash(normalized)}`;
  let id = baseId;
  let suffix = 2;
  while (getExercise(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  data.customExercises.push({
    id,
    name: cleanName,
    short: cleanName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "EX",
    primary: [],
    secondary: [],
    pattern: origin === "manual" ? "Custom" : "Imported",
    type: "Custom",
    difficulty: "Unmapped",
    range: [8, 12],
    icon: "＋",
    note: origin === "manual"
      ? "A user-defined movement. Its workout history is tracked, but it is not included in muscle coverage."
      : "Imported from Hevy. Remap it to a Liftwise movement to include it in muscle coverage.",
    equipment: [],
    equipmentAny: [],
    machine: false,
    swapId: "",
    measurementMode: "load_reps",
    loadMode: "total",
    repMode: "total",
    aliases: [],
  });
  return id;
}

function combineUniqueText(first, second, separator = " · ") {
  const values = [first, second].map((value) => String(value || "").trim()).filter(Boolean);
  return [...new Set(values)].join(separator).slice(0, 2000);
}

function workoutSourceKeys(workout) {
  return [...new Set([
    workout?.sourceIdentity,
    workout?.sourceKey,
    ...(Array.isArray(workout?.sourceKeys) ? workout.sourceKeys : []),
  ].filter(Boolean).map(String))];
}

function workoutsShareSource(first, second) {
  const firstKeys = new Set(workoutSourceKeys(first));
  if (workoutSourceKeys(second).some((key) => firstKeys.has(key))) return true;
  return Boolean(
    first?.startTime
    && second?.startTime
    && first.startTime === second.startTime
    && normalizeExerciseName(first.name) === normalizeExerciseName(second.name)
  );
}

function comparableSetKey(set, fallbackIndex = 0) {
  const normalized = normalizeSet(set, fallbackIndex);
  const index = Number.isFinite(normalized.index) ? normalized.index : fallbackIndex;
  const type = String(normalized.type || "normal").toLowerCase();
  const weight = normalized.weightKg ?? 0;
  const reps = normalized.reps ?? "";
  const distance = normalized.distanceMeters ?? "";
  const duration = normalized.durationSeconds ?? "";
  return `${index}|${type}|${weight}|${reps}|${distance}|${duration}`;
}

function mergeMatchingExerciseSets(existingSets, incomingSets) {
  const merged = existingSets.map((set, index) => normalizeSet(set, index));
  const availableMatches = new Map();
  merged.forEach((set, index) => {
    const key = comparableSetKey(set, index);
    if (!availableMatches.has(key)) availableMatches.set(key, []);
    availableMatches.get(key).push(index);
  });
  incomingSets.forEach((set, index) => {
    const incoming = normalizeSet(set, index);
    const key = comparableSetKey(incoming, index);
    const matchingIndexes = availableMatches.get(key);
    const matchingIndex = matchingIndexes?.shift();
    if (matchingIndex === undefined) {
      merged.push(incoming);
      return;
    }
    const existing = merged[matchingIndex];
    const manualRirSet = existing.rirManual ? existing : incoming.rirManual ? incoming : null;
    merged[matchingIndex] = normalizeSet({
      ...incoming,
      index: existing.index,
      type: existing.type || incoming.type,
      weightKg: existing.weightKg ?? incoming.weightKg,
      reps: existing.reps ?? incoming.reps,
      rir: manualRirSet ? manualRirSet.rir : existing.rir ?? incoming.rir,
      rirManual: Boolean(manualRirSet),
      rpe: existing.rpe ?? incoming.rpe,
      distanceMeters: existing.distanceMeters ?? incoming.distanceMeters,
      durationSeconds: existing.durationSeconds ?? incoming.durationSeconds,
    }, matchingIndex);
  });
  return merged;
}

function mergeEntriesByExerciseId(entries, { mergeMatchingSets = false } = {}) {
  const merged = new Map();
  entries.forEach((rawEntry) => {
    if (!rawEntry?.exerciseId) return;
    const entry = {
      ...rawEntry,
      sets: (rawEntry.sets || []).map((set, index) => normalizeSet(set, index)),
    };
    if (!merged.has(entry.exerciseId)) {
      merged.set(entry.exerciseId, entry);
      return;
    }
    const existing = merged.get(entry.exerciseId);
    existing.sets = mergeMatchingSets
      ? mergeMatchingExerciseSets(existing.sets, entry.sets)
      : [...existing.sets, ...entry.sets];
    existing.exerciseNotes = combineUniqueText(existing.exerciseNotes, entry.exerciseNotes);
    existing.sourceExerciseNames = [...new Set([
      ...(Array.isArray(existing.sourceExerciseNames) ? existing.sourceExerciseNames : []),
      existing.sourceExerciseName,
      ...(Array.isArray(entry.sourceExerciseNames) ? entry.sourceExerciseNames : []),
      entry.sourceExerciseName,
    ].filter(Boolean))];
    if (!existing.sourceExerciseName) existing.sourceExerciseName = entry.sourceExerciseName;
    if (!existing.supersetId) existing.supersetId = entry.supersetId;
  });
  return [...merged.values()].map((entry) => ({
    ...entry,
    sets: entry.sets.map((set, index) => ({ ...set, index })),
  }));
}

function mergeWorkoutIntoDay(target, incoming, appendEntries = true) {
  const targetIsManual = target.source === "manual" || (!target.source && !String(target.id || "").startsWith("seed-"));
  const incomingIsHevy = incoming.source === "hevy-csv";
  const preserveManualEffort = appendEntries && targetIsManual && incomingIsHevy;
  if (appendEntries) {
    target.entries = mergeEntriesByExerciseId(
      [...(target.entries || []), ...(incoming.entries || [])],
      { mergeMatchingSets: preserveManualEffort },
    );
  }
  else target.entries = mergeEntriesByExerciseId(target.entries || []);
  target.notes = combineUniqueText(target.notes, incoming.notes, "\n");
  if (appendEntries) target.duration = Math.min(1440, (Number(target.duration) || 0) + (Number(incoming.duration) || 0));
  const starts = [target.startTime, incoming.startTime].filter(Boolean).sort();
  const ends = [target.endTime, incoming.endTime].filter(Boolean).sort();
  target.startTime = starts[0] || null;
  target.endTime = ends.at(-1) || null;
  const sourceKeys = [...new Set([...workoutSourceKeys(target), ...workoutSourceKeys(incoming)])];
  target.sourceKeys = sourceKeys;
  if (!target.sourceKey && sourceKeys.length === 1) target.sourceKey = sourceKeys[0];
  target.importBatchIds = [...new Set([
    ...(Array.isArray(target.importBatchIds) ? target.importBatchIds : []),
    target.importBatchId,
    ...(Array.isArray(incoming.importBatchIds) ? incoming.importBatchIds : []),
    incoming.importBatchId,
  ].filter(Boolean))];
  target.updatedAt = new Date().toISOString();
  return target;
}

function consolidateWorkoutDate(date) {
  const workouts = data.workouts.filter((workout) => workout.date === date);
  if (!workouts.length) return null;
  const target = workouts.find((workout) => !workout.source || workout.source === "manual") || workouts[0];
  target.entries = mergeEntriesByExerciseId(target.entries || []);
  workouts.forEach((workout) => {
    if (workout === target) return;
    mergeWorkoutIntoDay(target, workout, !workoutsShareSource(target, workout));
  });
  if (workouts.length > 1) {
    data.workouts = data.workouts.filter((workout) => workout.date !== date || workout === target);
  }
  return target;
}

function commitCsvImport(event) {
  event.preventDefault();
  if (!pendingCsvImport) return;
  captureCsvImportMappings();
  const importScope = pendingCsvImportScope || buildCsvImportScope(pendingCsvImport, $('[name="importRange"]:checked')?.value || "all");
  if (importScope.rejectedRows.length && !$("#acceptValidRowsOnly")?.checked) {
    showToast("Review the rejected rows and confirm that only valid rows should be imported.");
    $("#acceptValidRowsOnly")?.focus();
    return;
  }
  const oversizedWorkout = importScope.workouts.find((workout) => (
    workout.entries.length > MAX_STORED_EXERCISES_PER_WORKOUT
    || workout.entries.some((entry) => entry.sets.length > MAX_STORED_SETS_PER_EXERCISE)
  ));
  if (oversizedWorkout) {
    showToast(`“${oversizedWorkout.name}” exceeds the safe import limit. Split that workout before importing.`);
    return;
  }
  const beforeImport = JSON.stringify(data);
  const mode = $('[name="importMode"]:checked')?.value || "merge";
  const batchId = `hevy-import-${Date.now()}`;
  const mappings = currentImportMappings(importScope);
  if (mode === "replace" && data.workouts.length && !window.confirm("Replace all current workout sessions? Profile, routines, body metrics, and preferences will be kept. Exporting a JSON backup first is recommended.")) return;
  try {
    localStorage.setItem(IMPORT_UNDO_KEY, JSON.stringify({
      batchId,
      createdAt: new Date().toISOString(),
      snapshot: beforeImport,
    }));
  } catch (error) {
    console.warn("Could not create import undo snapshot", error);
  }
  const plan = buildCsvImportPlan(importScope, mappings, mode, true);
  if (mode === "replace") data.workouts = [];
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let conflicted = 0;
  const affectedDates = new Set();
  plan.changes.forEach((change) => {
    if (change.status === "conflicted") {
      conflicted += 1;
      return;
    }
    if (change.status === "unchanged") {
      unchanged += 1;
      return;
    }
    const imported = {
      ...change.incoming,
      importBatchId: batchId,
      importBatchIds: [...new Set([...(change.existing?.importBatchIds || []), change.existing?.importBatchId, batchId].filter(Boolean))],
      updatedAt: new Date().toISOString(),
    };
    if (change.status === "updated") {
      const existingIndex = data.workouts.findIndex((workout) => workout.id === change.existing.id);
      if (existingIndex >= 0) data.workouts[existingIndex] = imported;
      else data.workouts.push(imported);
      updated += 1;
    } else {
      data.workouts.push(imported);
      added += 1;
    }
    affectedDates.add(imported.date);
  });
  data.importAliases ||= {};
  Object.entries(mappings).forEach(([sourceTitle, exerciseId]) => {
    if (exerciseId !== "__custom__" && getExercise(exerciseId)) {
      data.importAliases[`hevy:${normalizeExerciseName(sourceTitle)}`] = exerciseId;
    }
  });
  const oversizedMergedWorkout = data.workouts.find((workout) => (
    workout.entries.length > MAX_STORED_EXERCISES_PER_WORKOUT
    || workout.entries.some((entry) => entry.sets.length > MAX_STORED_SETS_PER_EXERCISE)
  ));
  if (oversizedMergedWorkout) {
    data = JSON.parse(beforeImport);
    showToast(`Merging “${oversizedMergedWorkout.name}” would exceed the safe per-day limit. Existing data was left unchanged.`);
    return;
  }
  data.importBatches ||= [];
  data.importBatches.push({
    id: batchId,
    importedAt: new Date().toISOString(),
    fileName: pendingCsvImport.fileName,
    source: "hevy-csv",
    kind: "workouts",
    workoutCount: added + updated,
    dayCount: 0,
    scope: importScope.range,
    mode,
    added,
    updated,
    unchanged,
    conflicted,
    rejected: importScope.rejectedRows.length,
    affectedDates: [...affectedDates],
  });
  data.importBatches = data.importBatches.slice(-MAX_IMPORT_HISTORY);
  const validationError = validateBackupShape(data);
  if (validationError) {
    data = JSON.parse(beforeImport);
    showToast(`The import was rolled back: ${validationError}`);
    return;
  }
  if (!saveData()) {
    data = JSON.parse(beforeImport);
    showToast("The import is too large for browser storage. Your existing data was left unchanged.");
    return;
  }
  closeModal("importModal");
  pendingCsvImport = null;
  pendingCsvImportScope = null;
  renderAll();
  const importedText = `${added} added · ${updated} updated · ${unchanged} unchanged`;
  showPersistentStatus(`${importedText}${conflicted ? ` · ${conflicted} conflict${conflicted === 1 ? "" : "s"}` : ""}. Undo is available in Data & Backup.`);
  showToast(importedText);
}

function commitFitatuImport(event) {
  event.preventDefault();
  if (!pendingFitatuImport) return;
  if (pendingFitatuImport.rejectedRows.length && !$("#acceptFitatuValidRowsOnly")?.checked) {
    showToast("Review the rejected Fitatu rows and confirm that only valid rows should be imported.");
    $("#acceptFitatuValidRowsOnly")?.focus();
    return;
  }
  const mode = $('[name="fitatuImportMode"]:checked')?.value || "merge";
  if (mode === "replace" && (data.nutritionDays || []).length
    && !window.confirm("Replace all previously imported Fitatu nutrition? Workouts, body measurements, and profile data will be kept.")) return;
  const beforeImport = JSON.stringify(data);
  const batchId = `fitatu-import-${Date.now()}`;
  try {
    localStorage.setItem(IMPORT_UNDO_KEY, JSON.stringify({
      batchId,
      createdAt: new Date().toISOString(),
      snapshot: beforeImport,
    }));
  } catch (error) {
    console.warn("Could not create Fitatu import undo snapshot", error);
  }
  const plan = buildFitatuImportPlan(pendingFitatuImport, mode);
  if (mode === "replace") data.nutritionDays = [];
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  const importedAt = new Date().toISOString();
  const affectedDates = [];
  plan.changes.forEach((change) => {
    if (change.status === "unchanged") {
      unchanged += 1;
      return;
    }
    const incoming = normalizeNutritionDay({
      ...change.incoming,
      importBatchId: batchId,
      importedAt,
    });
    const existingIndex = data.nutritionDays.findIndex((day) => day.id === change.existing?.id || day.date === incoming.date);
    if (change.status === "updated" && existingIndex >= 0) {
      data.nutritionDays[existingIndex] = incoming;
      updated += 1;
    } else {
      data.nutritionDays.push(incoming);
      added += 1;
    }
    affectedDates.push(incoming.date);
  });
  data.nutritionDays = normalizeNutritionDays(data.nutritionDays);
  data.integrations ||= {};
  data.integrations.fitatu = {
    status: "imported",
    lastImportAt: importedAt,
    lastFileName: pendingFitatuImport.fileName,
  };
  data.importBatches ||= [];
  data.importBatches.push({
    id: batchId,
    importedAt,
    fileName: pendingFitatuImport.fileName,
    source: "fitatu-csv",
    kind: "nutrition",
    workoutCount: 0,
    dayCount: added + updated,
    scope: "all",
    mode,
    added,
    updated,
    unchanged,
    conflicted: 0,
    rejected: pendingFitatuImport.rejectedRows.length,
    affectedDates,
  });
  data.importBatches = data.importBatches.slice(-MAX_IMPORT_HISTORY);
  const validationError = validateBackupShape(data);
  if (validationError) {
    data = JSON.parse(beforeImport);
    showToast(`The Fitatu import was rolled back: ${validationError}`);
    return;
  }
  if (!saveData()) {
    data = JSON.parse(beforeImport);
    showToast("The Fitatu import is too large for browser storage. Existing data was left unchanged.");
    return;
  }
  closeModal("fitatuImportModal");
  pendingFitatuImport = null;
  renderAll();
  const importedText = `${added} nutrition day${added === 1 ? "" : "s"} added · ${updated} updated · ${unchanged} unchanged`;
  showPersistentStatus(`${importedText}. Undo is available in Data & Backup.`);
  showToast(importedText);
}

function undoLastImport() {
  let record = null;
  try {
    record = JSON.parse(localStorage.getItem(IMPORT_UNDO_KEY));
  } catch (error) {
    showToast("The import undo snapshot could not be read.");
    return;
  }
  if (!record?.snapshot) {
    showToast("There is no recent import to undo.");
    return;
  }
  if (!window.confirm("Undo the most recent import and restore the exact pre-import data snapshot?")) return;
  try {
    const restored = JSON.parse(record.snapshot);
    const validationError = validateBackupShape(restored);
    if (validationError) throw new Error(validationError);
    const previous = data;
    data = migrateData(restored);
    if (!saveData()) {
      data = previous;
      throw new Error("Browser storage rejected the restored snapshot.");
    }
    localStorage.removeItem(IMPORT_UNDO_KEY);
    renderAll();
    renderDataCenter();
    showPersistentStatus("The most recent import was undone and the pre-import snapshot was restored.");
  } catch (error) {
    showToast(`Import undo failed: ${error.message}`);
  }
}

function downloadImportErrorReport() {
  const rows = pendingCsvImport?.rejectedRows || [];
  if (!rows.length) {
    showToast("This import has no rejected rows.");
    return;
  }
  const csv = [
    ["row", "workout", "exercise", "reasons"],
    ...rows.map((row) => [row.rowNumber, row.workout, row.exercise, row.reasons.join("; ")]),
  ].map((row) => row.map(csvCell).join(",")).join("\r\n");
  downloadText(`liftwise-import-errors-${toDateInput(new Date())}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
}

function downloadFitatuImportErrorReport() {
  const rows = pendingFitatuImport?.rejectedRows || [];
  if (!rows.length) {
    showToast("This Fitatu import has no rejected rows.");
    return;
  }
  const csv = [
    ["row", "date", "item", "reasons"],
    ...rows.map((row) => [row.rowNumber, row.date, row.item, row.reasons.join("; ")]),
  ].map((row) => row.map(csvCell).join(",")).join("\r\n");
  downloadText(`liftwise-fitatu-import-errors-${toDateInput(new Date())}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
}

function clearFitatuNutrition() {
  if (!(data.nutritionDays || []).length) {
    showToast("There is no Fitatu nutrition to remove.");
    return;
  }
  if (!window.confirm(`Remove ${(data.nutritionDays || []).length} imported Fitatu nutrition days? Workouts and body measurements will be kept.`)) return;
  const previousDays = data.nutritionDays;
  const previousIntegration = data.integrations?.fitatu;
  data.nutritionDays = [];
  data.integrations.fitatu = { status: "not-imported", lastImportAt: null, lastFileName: null };
  if (!saveData()) {
    data.nutritionDays = previousDays;
    data.integrations.fitatu = previousIntegration;
    showToast("Fitatu nutrition could not be removed from browser storage.");
    return;
  }
  renderAll();
  renderDataCenter();
  showToast("Fitatu nutrition removed.");
}

function isPlainRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function backupNumberIsValid(value, minimum, maximum, allowNull = true) {
  if ((value === null || value === undefined || value === "") && allowNull) return true;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum;
}

function validateBackupShape(raw) {
  if (!isPlainRecord(raw)) return "The backup root must be an object.";
  if (!isPlainRecord(raw.profile) || typeof raw.profile.name !== "string" || !backupNumberIsValid(raw.profile.days, 2, 6, false)) {
    return "The backup has an invalid training profile.";
  }
  if (!isPlainRecord(raw.targets) || MUSCLES.some((muscle) => {
    const range = raw.targets[muscle];
    return !Array.isArray(range)
      || range.length !== 2
      || !Number.isInteger(Number(range[0]))
      || !Number.isInteger(Number(range[1]))
      || Number(range[0]) < 0
      || Number(range[0]) > 40
      || Number(range[1]) < Math.max(1, Number(range[0]))
      || Number(range[1]) > 50;
  })) {
    return "The backup has invalid or missing muscle planning ranges.";
  }
  if (!Array.isArray(raw.workouts) || raw.workouts.length > MAX_BACKUP_WORKOUTS) {
    return `The backup must contain no more than ${MAX_BACKUP_WORKOUTS} workouts.`;
  }
  const customExercises = raw.customExercises ?? [];
  if (!Array.isArray(customExercises) || customExercises.length > MAX_BACKUP_CUSTOM_EXERCISES) {
    return `The backup must contain no more than ${MAX_BACKUP_CUSTOM_EXERCISES} custom exercises.`;
  }
  const exerciseIds = new Set(Object.keys(byExerciseId));
  for (const exercise of customExercises) {
    if (!isPlainRecord(exercise)
      || typeof exercise.id !== "string" || !exercise.id || exercise.id.length > 120 || exerciseIds.has(exercise.id)
      || typeof exercise.name !== "string" || !exercise.name.trim() || exercise.name.length > 100
      || !Array.isArray(exercise.primary) || !exercise.primary.every((muscle) => MUSCLES.includes(muscle))
      || !Array.isArray(exercise.secondary) || !exercise.secondary.every((muscle) => MUSCLES.includes(muscle))
      || !Array.isArray(exercise.range) || exercise.range.length !== 2
      || !backupNumberIsValid(exercise.range[0], 1, 100, false)
      || !backupNumberIsValid(exercise.range[1], Number(exercise.range[0]), 100, false)
      || (exercise.equipment !== undefined && !Array.isArray(exercise.equipment))
      || (exercise.equipmentAny !== undefined && !Array.isArray(exercise.equipmentAny))) {
      return "The backup contains an invalid or duplicate custom exercise.";
    }
    exerciseIds.add(exercise.id);
  }
  const nutritionDays = raw.nutritionDays ?? [];
  if (!Array.isArray(nutritionDays) || nutritionDays.length > MAX_BACKUP_NUTRITION_DAYS) {
    return `The backup must contain no more than ${MAX_BACKUP_NUTRITION_DAYS} nutrition days.`;
  }
  const nutritionDates = new Set();
  for (const day of nutritionDays) {
    if (!isPlainRecord(day)
      || typeof day.id !== "string" || !day.id || day.id.length > 160
      || !isValidDateKey(day.date) || day.date > toDateInput(new Date()) || nutritionDates.has(day.date)
      || !backupNumberIsValid(day.caloriesKcal, 0, 20000)
      || !backupNumberIsValid(day.proteinG, 0, 3000)
      || !backupNumberIsValid(day.carbsG, 0, 3000)
      || !backupNumberIsValid(day.fatG, 0, 3000)
      || !backupNumberIsValid(day.fiberG, 0, 1000)) {
      return "The backup contains an invalid or duplicate nutrition day.";
    }
    nutritionDates.add(day.date);
  }
  const workoutIds = new Set();
  let totalSets = 0;
  for (const workout of raw.workouts) {
    if (!isPlainRecord(workout)
      || typeof workout.id !== "string" || !workout.id || workout.id.length > 160 || workoutIds.has(workout.id)
      || typeof workout.name !== "string" || !workout.name.trim() || workout.name.length > 80
      || !isValidDateKey(workout.date) || workout.date > toDateInput(new Date())
      || !backupNumberIsValid(workout.duration, 0, 1440)
      || !Array.isArray(workout.entries) || workout.entries.length > MAX_STORED_EXERCISES_PER_WORKOUT) {
      return "The backup contains an invalid workout record.";
    }
    workoutIds.add(workout.id);
    for (const entry of workout.entries) {
      if (!isPlainRecord(entry) || typeof entry.exerciseId !== "string" || !exerciseIds.has(entry.exerciseId)) {
        return `“${workout.name}” contains an unknown or invalid exercise.`;
      }
      if (Array.isArray(entry.sets)) {
        if (entry.sets.length > MAX_STORED_SETS_PER_EXERCISE) {
          return `“${workout.name}” exceeds the ${MAX_STORED_SETS_PER_EXERCISE}-set safety limit for one exercise.`;
        }
        totalSets += entry.sets.length;
        for (const set of entry.sets) {
          if (!isPlainRecord(set)
            || !backupNumberIsValid(set.weightKg ?? set.weight, 0, 2000)
            || !backupNumberIsValid(set.reps, 0, 100)
            || !backupNumberIsValid(set.rir, 0, 10)
            || !backupNumberIsValid(set.rpe, 0, 10)
            || !backupNumberIsValid(set.rawRpe, 0, 10)
            || !backupNumberIsValid(set.explicitImportedRir, 0, 10)
            || !backupNumberIsValid(set.manualRir, 0, 10)
            || !backupNumberIsValid(set.distanceMeters, 0, 10_000_000)
            || !backupNumberIsValid(set.durationSeconds, 0, 86_400)
            || (set.measurementMode !== undefined && !Domain.MEASUREMENT_MODES.includes(set.measurementMode))) {
            return `“${workout.name}” contains an invalid set.`;
          }
        }
      } else if (!backupNumberIsValid(entry.sets, 1, MAX_STORED_SETS_PER_EXERCISE, false)) {
        return `“${workout.name}” has an invalid legacy set count.`;
      } else {
        totalSets += Number(entry.sets);
      }
      if (totalSets > 1_000_000) return "The backup contains too many sets to restore safely.";
    }
  }
  return null;
}

function importJsonBackup(contents) {
  if (contents.length > MAX_BACKUP_BYTES) throw new Error("That backup is too large to restore safely.");
  const raw = JSON.parse(contents);
  const validationError = validateBackupShape(raw);
  if (validationError) throw new Error(`Invalid Liftwise backup: ${validationError}`);
  const imported = migrateData(raw);
  if (!window.confirm(`Replace the current data with this Liftwise backup containing ${imported.workouts.length} workouts?`)) return;
  const previous = data;
  data = imported;
  try {
    renderAll();
  } catch (error) {
    data = previous;
    renderAll();
    throw new Error("The backup could not be rendered safely.");
  }
  if (!saveData()) {
    data = previous;
    renderAll();
    throw new Error("The backup is too large for browser storage.");
  }
  showToast("Liftwise backup restored.");
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const importKind = event.target.id === "fitatuImportInput"
    ? "meal"
    : event.target.id === "backupImportInput" ? "backup" : "workout";
  const maximumBytes = importKind === "backup" ? MAX_BACKUP_BYTES : MAX_CSV_BYTES;
  if (file.size > maximumBytes) {
    showToast(`That file exceeds the ${Math.round(maximumBytes / 1_000_000)} MB safety limit.`);
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const contents = String(reader.result || "");
      if (importKind === "backup") {
        importJsonBackup(contents);
      } else if (importKind === "meal") {
        pendingFitatuImport = parseFitatuCsv(contents, file.name);
        renderFitatuImportPreview(true);
      } else {
        pendingCsvImport = { ...parseHevyCsv(contents, file.name), mappingSelections: {} };
        pendingCsvImportScope = null;
        const entireFileOption = $('[name="importRange"][value="all"]');
        if (entireFileOption) entireFileOption.checked = true;
        renderImportPreview(true);
      }
    } catch (error) {
      console.error(error);
      showToast(error.message || "That file could not be imported.");
    }
    event.target.value = "";
  };
  reader.onerror = () => { showToast("The selected file could not be read."); event.target.value = ""; };
  reader.readAsText(file);
}

function switchView(view) {
  if (!["dashboard", "workouts", "insights", "body", "library"].includes(view)) return;
  activeView = view;
  $$(".view").forEach((section) => section.classList.toggle("active-view", section.id === view));
  $$(".nav-item").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  renderView(view);
  persistViewState();
  history.replaceState(null, "", `#${view}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
  const heading = $(`#${view} h1`);
  if (heading) {
    heading.setAttribute("tabindex", "-1");
    requestAnimationFrame(() => heading.focus({ preventScroll: true }));
  }
}

function setupInformationArchitecture() {
  const host = $("#muscleStatusHost");
  const muscleGrid = $(".body-muscle-grid");
  if (host && muscleGrid && muscleGrid.parentElement !== host) host.append(muscleGrid);
}

function restoreViewState() {
  let state = {};
  try { state = JSON.parse(sessionStorage.getItem(VIEW_STATE_KEY)) || {}; } catch (error) { state = {}; }
  const hashView = location.hash.replace("#", "");
  activeView = ["dashboard", "workouts", "insights", "body", "library"].includes(hashView)
    ? hashView
    : ["dashboard", "workouts", "insights", "body", "library"].includes(state.activeView) ? state.activeView : "dashboard";
  workoutFilter = ["all", "week", "month"].includes(state.workoutFilter) ? state.workoutFilter : "all";
  workoutSearch = String(state.workoutSearch || "");
  workoutSourceFilter = ["all", "manual", "imported"].includes(state.workoutSourceFilter) ? state.workoutSourceFilter : "all";
  workoutMissingRirOnly = Boolean(state.workoutMissingRirOnly);
  workoutDateFrom = isValidDateKey(state.workoutDateFrom) ? state.workoutDateFrom : "";
  workoutDateTo = isValidDateKey(state.workoutDateTo) ? state.workoutDateTo : "";
  if ($("#workoutSearch")) $("#workoutSearch").value = workoutSearch;
  if ($("#workoutSourceFilter")) $("#workoutSourceFilter").value = workoutSourceFilter;
  if ($("#workoutMissingRir")) $("#workoutMissingRir").checked = workoutMissingRirOnly;
  if ($("#workoutDateFrom")) $("#workoutDateFrom").value = workoutDateFrom;
  if ($("#workoutDateTo")) $("#workoutDateTo").value = workoutDateTo;
  $$("button[data-filter]", $("#workoutFilter")).forEach((button) => button.classList.toggle("active", button.dataset.filter === workoutFilter));
  $$(".view").forEach((section) => section.classList.toggle("active-view", section.id === activeView));
  $$(".nav-item").forEach((button) => {
    const selected = button.dataset.view === activeView;
    button.classList.toggle("active", selected);
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
}

function bindEvents() {
  bindImportChooser({ openModal, closeModal });
  $$(".nav-item, .view-switch").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
  $(".brand").addEventListener("click", (event) => { event.preventDefault(); switchView("dashboard"); });
  $("#newWorkoutButton").addEventListener("click", () => openWorkout());
  $("#newWorkoutButton2").addEventListener("click", () => openWorkout());
  $("#dataCenterButton").addEventListener("click", openDataCenter);
  $("#clearDemoButton").addEventListener("click", clearDemoWorkouts);
  $("#mobileProfileButton").addEventListener("click", openProfile);
  $("#mobileResearchButton").addEventListener("click", () => openModal("researchModal"));
  $("#recoveryCheckinButton").addEventListener("click", openRecoveryCheckin);
  $("#recoveryForm").addEventListener("submit", saveRecoveryCheckin);
  $("#newMetricButton").addEventListener("click", openBodyMetricLog);
  $("#newMetricButton2").addEventListener("click", openBodyMetricLog);
  $("#bodyMetricForm").addEventListener("submit", saveBodyMetric);
  $("#bodyChartWindow").addEventListener("change", renderBodyMetrics);
  $("#garminConnectButton").addEventListener("click", openGarminSetup);
  $("#addExerciseRow").addEventListener("click", () => {
    if ($$(".exercise-entry").length >= MAX_MANUAL_EXERCISES) { showToast(`A workout can contain up to ${MAX_MANUAL_EXERCISES} exercises.`); return; }
    addExerciseEntry();
  });
  $("#workoutForm").addEventListener("submit", saveWorkout);
  $("#workoutForm").addEventListener("input", scheduleWorkoutDraft);
  $("#workoutForm").addEventListener("change", scheduleWorkoutDraft);
  $("#profileButton").addEventListener("click", openProfile);
  $("#profileForm").addEventListener("submit", saveProfile);
  $("#profileUnits").addEventListener("change", (event) => {
    const form = $("#profileForm");
    const currentKg = unitValueToKg($("#profileLoadIncrement").value, form.dataset.displayUnit || weightUnit());
    const nextUnit = event.target.value;
    $("#profileLoadIncrement").value = String(kgToUnit(currentKg, nextUnit));
    $("#profileLoadIncrementLabel").firstChild.textContent = `Smallest load jump (${nextUnit})`;
    form.dataset.displayUnit = nextUnit;
  });
  $("#adjustTargetsButton").addEventListener("click", openTargets);
  $("#targetsForm").addEventListener("submit", saveTargets);
  $("#researchButton").addEventListener("click", () => openModal("researchModal"));
  $("#backupButton").addEventListener("click", exportBackup);
  $("#exportCsvButton").addEventListener("click", exportCsv);
  $("#importInput")?.addEventListener("change", importData);
  $("#backupImportInput")?.addEventListener("change", importData);
  $("#fitatuImportInput")?.addEventListener("change", importData);
  $("#csvImportForm").addEventListener("submit", commitCsvImport);
  $("#fitatuImportForm").addEventListener("submit", commitFitatuImport);
  $$('[name="importRange"]').forEach((input) => input.addEventListener("change", () => renderImportPreview(false)));
  $$('[name="importMode"]').forEach((input) => input.addEventListener("change", renderImportDiff));
  $$('[name="fitatuImportMode"]').forEach((input) => input.addEventListener("change", () => renderFitatuImportPreview(false)));
  $("#downloadImportErrors").addEventListener("click", downloadImportErrorReport);
  $("#downloadFitatuImportErrors").addEventListener("click", downloadFitatuImportErrorReport);
  $("#prevWeek").addEventListener("click", () => { if (!$("#prevWeek").disabled) { selectedWeekOffset--; renderDashboard(); if (activeView === "insights") renderInsights(); } });
  $("#nextWeek").addEventListener("click", () => { if (selectedWeekOffset < 0) { selectedWeekOffset++; renderDashboard(); renderInsights(); } });
  $("#whySessionButton").addEventListener("click", openSessionPlanExplanation);
  $("#startSuggestedWorkout").addEventListener("click", () => {
    if (suggestionPlan.recovery?.level === "stop") { showToast("The automated plan is paused because today’s check-in flagged pain."); return; }
    if (suggestionPlan.routineId) { startRoutine(suggestionPlan.routineId); return; }
    const rows = (suggestionPlan.exercisePlans || [])
      .filter((plan) => isExerciseAvailable(getExercise(plan.exerciseId)))
      .map((plan) => ({ exerciseId: plan.exerciseId, sets: plan.sets, rir: suggestionPlan.targetRir ?? 2 }));
    if (!rows.length) { showToast("No compatible movements are available for this suggestion. Check your equipment profile."); return; }
    openWorkout(rows);
  });
  $("#workoutFilter").addEventListener("click", (event) => { const button = event.target.closest("button[data-filter]"); if (!button) return; workoutFilter = button.dataset.filter; workoutPage = 1; $$("button", $("#workoutFilter")).forEach((item) => item.classList.toggle("active", item === button)); renderWorkouts(); });
  $("#workoutSearch").addEventListener("input", (event) => { workoutSearch = event.target.value; workoutPage = 1; renderWorkouts(); });
  $("#workoutSourceFilter").addEventListener("change", (event) => { workoutSourceFilter = event.target.value; workoutPage = 1; renderWorkouts(); });
  $("#workoutMissingRir").addEventListener("change", (event) => { workoutMissingRirOnly = event.target.checked; workoutPage = 1; renderWorkouts(); });
  $("#workoutDateFrom").addEventListener("change", (event) => { workoutDateFrom = event.target.value; workoutPage = 1; renderWorkouts(); });
  $("#workoutDateTo").addEventListener("change", (event) => { workoutDateTo = event.target.value; workoutPage = 1; renderWorkouts(); });
  $("#resetWorkoutFilters").addEventListener("click", () => {
    workoutSearch = ""; workoutSourceFilter = "all"; workoutMissingRirOnly = false; workoutDateFrom = ""; workoutDateTo = ""; workoutFilter = "all"; workoutPage = 1;
    $("#workoutSearch").value = ""; $("#workoutSourceFilter").value = "all"; $("#workoutMissingRir").checked = false; $("#workoutDateFrom").value = ""; $("#workoutDateTo").value = "";
    $$("button[data-filter]", $("#workoutFilter")).forEach((button) => button.classList.toggle("active", button.dataset.filter === "all"));
    renderWorkouts();
  });
  $("#exerciseSearch").addEventListener("input", () => { libraryPage = 1; renderLibrary(); });
  $("#libraryMuscle").addEventListener("change", (event) => { libraryMuscleFilter = event.target.value; libraryPage = 1; renderLibrary(); });
  $("#libraryEquipment").addEventListener("change", (event) => { libraryEquipmentFilter = event.target.value; libraryPage = 1; renderLibrary(); });
  $("#librarySort").addEventListener("change", (event) => { data.libraryPreferences.sort = event.target.value; libraryPage = 1; saveData(); renderLibrary(); });
  $("#libraryAvailableOnly").addEventListener("change", (event) => { data.libraryPreferences.availableOnly = event.target.checked; libraryPage = 1; saveData(); renderLibrary(); });
  $("#libraryFavoritesOnly").addEventListener("change", () => { libraryPage = 1; renderLibrary(); });
  $("#libraryDensity").addEventListener("click", () => { data.libraryPreferences.density = data.libraryPreferences.density === "compact" ? "comfortable" : "compact"; saveData(); renderLibrary(); });
  $("#libraryLoadMore").addEventListener("click", () => { libraryPage += 1; renderLibrary(); });
  $("#customExerciseForm").addEventListener("submit", saveCustomExercise);
  $("#deleteCustomExerciseButton").addEventListener("click", deleteCustomExercise);
  document.addEventListener("click", (event) => {
    const close = event.target.closest("[data-close-modal]"); if (close) closeModal(close.dataset.closeModal);
    const muscleRegion = event.target.closest("[data-muscle-region]"); if (muscleRegion) selectBodyMuscle(muscleRegion.dataset.muscleRegion);
    const deleteButton = event.target.closest("[data-delete-workout]"); if (deleteButton) deleteWorkout(deleteButton.dataset.deleteWorkout);
    const deleteMetricButton = event.target.closest("[data-delete-body-metric]"); if (deleteMetricButton) deleteBodyMetric(deleteMetricButton.dataset.deleteBodyMetric);
    const editMetricButton = event.target.closest("[data-edit-body-metric]"); if (editMetricButton) openBodyMetricLog(editMetricButton.dataset.editBodyMetric);
    if (event.target.closest("[data-open-body-metric]")) openBodyMetricLog();
    const openButton = event.target.closest("[data-open-workout]");
    if (openButton) {
      const workoutId = openButton.dataset.openWorkout;
      if (workoutId) openWorkoutDetails(workoutId);
      else openWorkout();
    }
    const editButton = event.target.closest("[data-edit-workout]"); if (editButton) openWorkoutForEdit(editButton.dataset.editWorkout);
    const editRirButton = event.target.closest("[data-edit-rir-workout]"); if (editRirButton) openWorkoutDetails(editRirButton.dataset.editRirWorkout, true);
    const saveRirButton = event.target.closest("[data-save-rir-workout]"); if (saveRirButton) saveWorkoutRir(saveRirButton.dataset.saveRirWorkout);
    const cancelRirButton = event.target.closest("[data-cancel-rir-workout]"); if (cancelRirButton) openWorkoutDetails(cancelRirButton.dataset.cancelRirWorkout);
    const repeatButton = event.target.closest("[data-repeat-workout]"); if (repeatButton) repeatWorkout(repeatButton.dataset.repeatWorkout);
    const saveRoutineButton = event.target.closest("[data-save-routine]"); if (saveRoutineButton) saveWorkoutAsRoutine(saveRoutineButton.dataset.saveRoutine);
    const startRoutineButton = event.target.closest("[data-start-routine]"); if (startRoutineButton) startRoutine(startRoutineButton.dataset.startRoutine);
    const deleteRoutineButton = event.target.closest("[data-delete-routine]"); if (deleteRoutineButton) deleteRoutine(deleteRoutineButton.dataset.deleteRoutine);
    const toggleRoutineButton = event.target.closest("[data-toggle-routine-today]"); if (toggleRoutineButton) toggleRoutineToday(toggleRoutineButton.dataset.toggleRoutineToday);
    if (event.target.closest("[data-load-more-workouts]")) { workoutPage += 1; renderWorkouts(); }
    const missingRirFilter = event.target.closest("[data-rir-missing-filter]");
    if (missingRirFilter) {
      $$(".rir-set-row", $("#workoutDetailContent")).forEach((row) => { row.hidden = missingRirFilter.checked && row.dataset.rirMissing !== "true"; });
    }
    if (event.target.closest("[data-rir-copy-down]")) {
      const active = document.activeElement?.matches?.("[data-rir-entry]") ? document.activeElement : $("[data-rir-entry]", $("#workoutDetailContent"));
      if (active) {
        const inputs = $$("[data-rir-entry]", $("#workoutDetailContent"));
        const start = inputs.indexOf(active);
        inputs.slice(Math.max(0, start)).forEach((input) => {
          if (!input.closest(".rir-set-row")?.hidden) {
            input.value = active.value;
            input.dispatchEvent(new Event("input", { bubbles: true }));
          }
        });
      }
    }
    const historyButton = event.target.closest("[data-open-exercise-history]"); if (historyButton) openExerciseHistory(historyButton.dataset.openExerciseHistory);
    const libraryChip = event.target.closest("[data-library-chip]");
    if (libraryChip) { libraryFilter = libraryChip.dataset.libraryChip; renderLibrary(); }
    const machineToggle = event.target.closest("[data-toggle-machines]");
    if (machineToggle) {
      const previous = data.profile.showMachineExercises;
      data.profile.showMachineExercises = !previous;
      if (!saveData()) {
        data.profile.showMachineExercises = previous;
        showToast("The library preference could not be saved.");
      }
      renderLibrary();
    }
    const filterButton = event.target.closest("[data-library-filter]");
    if (filterButton) { const muscle = filterButton.dataset.libraryFilter; libraryFilter = "All"; $("#exerciseSearch").value = muscle; renderLibrary(); switchView("library"); }
    const targetButton = event.target.closest("[data-open-targets]"); if (targetButton) openTargets();
    const researchButton = event.target.closest("[data-open-research]"); if (researchButton) openModal("researchModal");
    if (event.target.closest("[data-open-recovery]")) openRecoveryCheckin();
    const addButton = event.target.closest("[data-add-exercise]"); if (addButton) openWorkout([{ exerciseId: addButton.dataset.addExercise, sets: 3 }]);
    const favoriteButton = event.target.closest("[data-favorite-exercise]"); if (favoriteButton) toggleFavoriteExercise(favoriteButton.dataset.favoriteExercise);
    const editCustomButton = event.target.closest("[data-edit-custom-exercise]"); if (editCustomButton) openCustomExerciseManager(editCustomButton.dataset.editCustomExercise);
    if (event.target.closest("[data-open-data-center]")) openDataCenter();
    if (event.target.closest("[data-backup-json]")) exportBackup();
    if (event.target.closest("[data-export-csv]")) exportCsv();
    if (event.target.closest("[data-undo-import]")) undoLastImport();
    if (event.target.closest("[data-download-recovery]")) downloadRecoveryCopy();
    if (event.target.closest("[data-restore-recovery]")) restoreRecoveryCopy();
    if (event.target.closest("[data-start-fresh]")) startFreshAfterRecovery();
    if (event.target.closest("[data-open-garmin]")) openGarminSetup();
    if (event.target.closest("[data-import-fitatu]")) {
      closeModal("dataCenterModal");
      $("#fitatuImportInput").click();
    }
    if (event.target.closest("[data-clear-fitatu]")) clearFitatuNutrition();
  });
  document.addEventListener("keydown", (event) => {
    if (event.target.matches?.("[data-rir-entry]") && ["ArrowDown", "ArrowUp"].includes(event.key)) {
      const inputs = $$("[data-rir-entry]", $("#workoutDetailContent")).filter((input) => !input.closest(".rir-set-row")?.hidden);
      const index = inputs.indexOf(event.target);
      const next = inputs[index + (event.key === "ArrowDown" ? 1 : -1)];
      if (next) {
        event.preventDefault();
        next.focus();
        next.select();
      }
      return;
    }
    const muscleRegion = event.target.closest?.("[data-muscle-region]");
    if (!muscleRegion || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    selectBodyMuscle(muscleRegion.dataset.muscleRegion);
  });
  document.addEventListener("change", (event) => {
    const historyFilter = event.target.closest?.("[data-history-set-filter]");
    if (historyFilter) openExerciseHistory(historyFilter.dataset.historySetFilter, historyFilter.value);
  });
  $$("dialog").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeModal(dialog.id);
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeModal(dialog.id);
    });
    dialog.addEventListener("close", () => {
      const returnFocus = dialogReturnFocus.get(dialog.id);
      dialogReturnFocus.delete(dialog.id);
      if (returnFocus?.isConnected) requestAnimationFrame(() => returnFocus.focus({ preventScroll: true }));
    });
  });
  window.addEventListener("beforeunload", (event) => {
    if (!workoutEditorDirty) return;
    saveWorkoutDraft();
    event.preventDefault();
    event.returnValue = "";
  });
}

setupInformationArchitecture();
restoreViewState();
applyLocale();
renderAll({ force: true });
commitPendingMigration();
bindEvents();
window.addEventListener("offline", () => showPersistentStatus("Liftwise is offline. The installed app shell and local data remain available."));
window.addEventListener("online", () => showPersistentStatus("Liftwise is back online."));
