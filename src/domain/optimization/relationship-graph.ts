export type SameRoleGroup = {
  id: string;
  exerciseIds: string[];
  roleLabel: string;
  caveats: string[];
};

export const SAME_ROLE_GROUPS: SameRoleGroup[] = [
  {
    id: "elbow-flexion-standard",
    exerciseIds: ["curl", "concentration-curl", "barbell-curl"],
    roleLabel: "direct elbow-flexion",
    caveats: ["Grip, support, unilateral practice, and exercise-specific strength can change."],
  },
  {
    id: "dumbbell-squat",
    exerciseIds: ["goblet-squat", "db-squat"],
    roleLabel: "bilateral dumbbell squat",
    caveats: ["Dumbbell position and comfortable loading can differ."],
  },
  {
    id: "vertical-press",
    exerciseIds: ["ohp", "db-shoulder-press"],
    roleLabel: "vertical press",
    caveats: ["Barbell/dumbbell use and exercise-specific strength can change."],
  },
  {
    id: "horizontal-row",
    exerciseIds: ["one-arm-db-row", "chest-row"],
    roleLabel: "horizontal pull",
    caveats: ["Unilateral practice, torso support, grip, and lower-back demand can change."],
  },
  {
    id: "lateral-raise",
    exerciseIds: ["lateral-raise", "db-lateral-raise"],
    roleLabel: "direct shoulder-abduction",
    caveats: ["Equipment and resistance profile change."],
  },
  {
    id: "rear-delt-fly",
    exerciseIds: ["rear-delt-fly", "db-rear-delt-fly"],
    roleLabel: "rear-delt isolation",
    caveats: ["Chest support, equipment, and resistance profile change."],
  },
];

export const DO_NOT_COMBINE: Array<{
  exerciseIds: [string, string];
  reason: string;
}> = [
  {
    exerciseIds: ["one-arm-db-row", "pull-up"],
    reason: "They share broad back and biceps tags but preserve distinct horizontal and vertical pulling roles.",
  },
  {
    exerciseIds: ["rdl", "leg-curl"],
    reason: "The Romanian deadlift is a hip hinge; the leg curl trains knee flexion directly.",
  },
  {
    exerciseIds: ["goblet-squat", "rdl"],
    reason: "The squat and hip-hinge roles are distinct even though both involve the lower body.",
  },
  {
    exerciseIds: ["ohp", "db-lateral-raise"],
    reason: "A compound vertical press and a direct shoulder-isolation movement do not preserve the same role.",
  },
  {
    exerciseIds: ["db-bench", "db-chest-fly"],
    reason: "A compound horizontal press and chest isolation do not preserve the same movement role.",
  },
  {
    exerciseIds: ["plank", "crunch"],
    reason: "Anti-rotation and trunk flexion are distinct trunk-training roles.",
  },
];

export type TimeSavingRelationship = {
  id: string;
  compoundExerciseId: string;
  isolationExerciseId: string;
  directMuscleLabel: string;
  caveat: string;
};

export const TIME_SAVING_RELATIONSHIPS: TimeSavingRelationship[] = [
  {
    id: "row-instead-of-curl",
    compoundExerciseId: "one-arm-db-row",
    isolationExerciseId: "curl",
    directMuscleLabel: "Biceps",
    caveat: "Keep direct curls when biceps development or curl strength is a priority.",
  },
  {
    id: "bench-instead-of-extension",
    compoundExerciseId: "db-bench",
    isolationExerciseId: "db-triceps-extension",
    directMuscleLabel: "Triceps",
    caveat: "Keep direct extensions when triceps development or elbow-extension strength is a priority.",
  },
];
