import {
  EXERCISE_BY_ID,
  isExerciseAvailable,
  type ExerciseCatalogItem,
} from "../exercises/catalog";
import type { Routine } from "../models/schema";
import {
  DO_NOT_COMBINE,
  SAME_ROLE_GROUPS,
  TIME_SAVING_RELATIONSHIPS,
} from "./relationship-graph";
import type {
  DoNotCombineObservation,
  OptimizationAnalysisInput,
  OptimizationAnalysisResult,
  OptimizationOpportunity,
  RoutineEntryChange,
} from "./types";

const MAX_VISIBLE_OPPORTUNITIES = 3;
const MAX_AUTOMATIC_CONSOLIDATED_SETS = 4;

function entryChange(entry: Routine["entries"][number]): RoutineEntryChange {
  return {
    exerciseId: entry.exerciseId,
    exerciseName: EXERCISE_BY_ID.get(entry.exerciseId)?.name ?? entry.exerciseId,
    targetSets: entry.targetSets,
  };
}

function hasEnoughUsage(
  exerciseIds: string[],
  completedAppearances: Record<string, number>,
): boolean {
  return exerciseIds.every((id) => (completedAppearances[id] ?? 0) >= 3);
}

function evidenceFor(
  exerciseIds: string[],
  completedAppearances: Record<string, number>,
): OptimizationOpportunity["evidence"] {
  return hasEnoughUsage(exerciseIds, completedAppearances) ? "usage-confirmed" : "routine-only";
}

function sameRoleOpportunities(
  input: OptimizationAnalysisInput,
  protectedIds: Set<string>,
): OptimizationOpportunity[] {
  if (!["simplify", "save_time"].includes(input.objective)) return [];
  const byExerciseId = new Map(input.routine.entries.map((entry) => [entry.exerciseId, entry]));
  const appearances = input.completedAppearances ?? {};

  return SAME_ROLE_GROUPS.flatMap((group) => {
    const matching = group.exerciseIds
      .map((id) => byExerciseId.get(id))
      .filter((entry): entry is Routine["entries"][number] => Boolean(entry));
    if (matching.length < 2 || matching.some((entry) => protectedIds.has(entry.exerciseId))) return [];

    const [retained, removed] = matching;
    if (!retained || !removed) return [];
    const targetSets = retained.targetSets + removed.targetSets;
    if (targetSets > MAX_AUTOMATIC_CONSOLIDATED_SETS) return [];

    const retainedExercise = EXERCISE_BY_ID.get(retained.exerciseId);
    if (!retainedExercise || !isExerciseAvailable(retainedExercise, input.equipment)) return [];

    return [{
      id: `same-role:${input.routine.id}:${group.id}:${retained.exerciseId}`,
      kind: "same_role" as const,
      label: "Similar planned role",
      title: `Use one ${group.roleLabel} variation instead of two`,
      summary: `Keep ${retainedExercise.name} and consolidate ${targetSets} already planned sets into one exercise.`,
      routineId: input.routine.id,
      sourceEntries: matching.map(entryChange),
      proposedEntries: [{
        exerciseId: retained.exerciseId,
        exerciseName: retainedExercise.name,
        targetSets,
      }],
      preserved: [
        `${targetSets} direct planned sets`,
        `${group.roleLabel} role`,
        "Current weekly frequency",
      ],
      changed: [
        `${EXERCISE_BY_ID.get(removed.exerciseId)?.name ?? removed.exerciseId} is removed from this routine`,
        "One exercise setup is removed",
        "Exercise-specific practice becomes less varied",
      ],
      coverage: [{
        label: `${retainedExercise.primary.join(" + ")} direct work`,
        before: targetSets,
        after: targetSets,
        unit: "direct sets" as const,
        tone: "preserved" as const,
      }],
      evidence: evidenceFor(matching.map((entry) => entry.exerciseId), appearances),
      ruleIds: ["optimization.same-role", `relationship.${group.id}`],
      caveats: group.caveats,
    }];
  });
}

function replacementExercise(
  exercise: ExerciseCatalogItem,
  equipment: Record<string, boolean>,
): ExerciseCatalogItem | null {
  const candidateId = exercise.homeReplacementId || exercise.swapId;
  const candidate = EXERCISE_BY_ID.get(candidateId);
  return candidate && isExerciseAvailable(candidate, equipment) ? candidate : null;
}

function equipmentOpportunities(
  input: OptimizationAnalysisInput,
  protectedIds: Set<string>,
): OptimizationOpportunity[] {
  const appearances = input.completedAppearances ?? {};
  return input.routine.entries.flatMap((entry) => {
    const exercise = EXERCISE_BY_ID.get(entry.exerciseId);
    if (!exercise || isExerciseAvailable(exercise, input.equipment) || protectedIds.has(entry.exerciseId)) return [];
    const replacement = replacementExercise(exercise, input.equipment);
    if (!replacement) return [];

    return [{
      id: `equipment:${input.routine.id}:${exercise.id}:${replacement.id}`,
      kind: "equipment_alternative" as const,
      label: "Equipment alternative",
      title: `Replace ${exercise.name}`,
      summary: `${replacement.name} is available with your current equipment and fills the closest reviewed broad role.`,
      routineId: input.routine.id,
      sourceEntries: [entryChange(entry)],
      proposedEntries: [{
        exerciseId: replacement.id,
        exerciseName: replacement.name,
        targetSets: entry.targetSets,
      }],
      preserved: [
        `${entry.targetSets} planned sets`,
        `${replacement.pattern} training role`,
      ],
      changed: [
        `Equipment changes from ${exercise.equipment.join(" + ") || "bodyweight"} to ${replacement.equipment.join(" + ") || "bodyweight"}`,
        "Exercise-specific strength and technique practice change",
      ],
      coverage: [{
        label: `${replacement.primary.join(" + ")} direct work`,
        before: entry.targetSets,
        after: entry.targetSets,
        unit: "direct sets" as const,
        tone: "preserved" as const,
      }],
      evidence: evidenceFor([entry.exerciseId], appearances),
      ruleIds: ["optimization.equipment-alternative"],
      caveats: ["This is a similar broad role, not proof of an identical strength or hypertrophy effect."],
    }];
  });
}

function timeSavingOpportunities(
  input: OptimizationAnalysisInput,
  protectedIds: Set<string>,
): OptimizationOpportunity[] {
  if (input.objective !== "save_time") return [];
  const byExerciseId = new Map(input.routine.entries.map((entry) => [entry.exerciseId, entry]));
  const appearances = input.completedAppearances ?? {};

  return TIME_SAVING_RELATIONSHIPS.flatMap((relationship) => {
    const compound = byExerciseId.get(relationship.compoundExerciseId);
    const isolation = byExerciseId.get(relationship.isolationExerciseId);
    if (!compound || !isolation || protectedIds.has(isolation.exerciseId)) return [];
    const compoundExercise = EXERCISE_BY_ID.get(compound.exerciseId);
    const isolationExercise = EXERCISE_BY_ID.get(isolation.exerciseId);
    if (!compoundExercise || !isolationExercise) return [];
    const proposedSets = Math.min(MAX_AUTOMATIC_CONSOLIDATED_SETS, compound.targetSets + 1);

    return [{
      id: `time-saving:${input.routine.id}:${relationship.id}`,
      kind: "time_saving_tradeoff" as const,
      label: "Saves time; changes direct work",
      title: `Use more ${compoundExercise.name} and remove ${isolationExercise.name}`,
      summary: "This removes one exercise setup, but it does not preserve the same direct isolation work.",
      routineId: input.routine.id,
      sourceEntries: [entryChange(compound), entryChange(isolation)],
      proposedEntries: [{
        exerciseId: compound.exerciseId,
        exerciseName: compoundExercise.name,
        targetSets: proposedSets,
      }],
      preserved: [`${compoundExercise.pattern} role`],
      changed: [
        `${relationship.directMuscleLabel} direct work decreases from ${isolation.targetSets} sets to 0`,
        `${compoundExercise.name} increases from ${compound.targetSets} to ${proposedSets} sets`,
        "One exercise setup is removed",
      ],
      coverage: [
        {
          label: `${compoundExercise.primary.join(" + ")} direct work`,
          before: compound.targetSets,
          after: proposedSets,
          unit: "direct sets" as const,
          tone: proposedSets > compound.targetSets ? "gained" as const : "preserved" as const,
        },
        {
          label: `${relationship.directMuscleLabel} direct work`,
          before: isolation.targetSets,
          after: 0,
          unit: "direct sets" as const,
          tone: "lost" as const,
        },
        {
          label: `${relationship.directMuscleLabel} secondary work`,
          before: compound.targetSets * 0.5,
          after: proposedSets * 0.5,
          unit: "secondary weighted sets" as const,
          tone: "changed" as const,
        },
      ],
      evidence: evidenceFor([compound.exerciseId, isolation.exerciseId], appearances),
      ruleIds: ["optimization.time-saving-tradeoff", `relationship.${relationship.id}`],
      caveats: [
        relationship.caveat,
        "Secondary weighted sets are a planning heuristic and are not biologically equivalent to direct sets.",
      ],
    }];
  });
}

function doNotCombineObservations(routine: Routine): DoNotCombineObservation[] {
  const ids = new Set(routine.entries.map((entry) => entry.exerciseId));
  return DO_NOT_COMBINE
    .filter(({ exerciseIds }) => exerciseIds.every((id) => ids.has(id)))
    .map(({ exerciseIds, reason }) => {
      const first = EXERCISE_BY_ID.get(exerciseIds[0])?.name ?? exerciseIds[0];
      const second = EXERCISE_BY_ID.get(exerciseIds[1])?.name ?? exerciseIds[1];
      return {
        id: `do-not-combine:${exerciseIds.join(":")}`,
        exerciseIds,
        title: `Keep ${first} and ${second} distinct`,
        reason,
      };
    });
}

export function analyzeRoutineOptimization(
  input: OptimizationAnalysisInput,
): OptimizationAnalysisResult {
  const protectedIds = new Set(input.protectedExerciseIds ?? []);
  const suppressedIds = new Set(input.suppressedOpportunityIds ?? []);
  const ruleTrace: string[] = [];

  const candidates = [
    ...equipmentOpportunities(input, protectedIds),
    ...sameRoleOpportunities(input, protectedIds),
    ...timeSavingOpportunities(input, protectedIds),
  ].filter((opportunity) => !suppressedIds.has(opportunity.id));

  if (candidates.some((opportunity) => opportunity.kind === "equipment_alternative")) {
    ruleTrace.push("optimization.equipment-alternative");
  }
  if (candidates.some((opportunity) => opportunity.kind === "same_role")) {
    ruleTrace.push("optimization.same-role");
  }
  if (candidates.some((opportunity) => opportunity.kind === "time_saving_tradeoff")) {
    ruleTrace.push("optimization.time-saving-tradeoff");
  }
  if (candidates.length === 0) ruleTrace.push("optimization.keep-current");

  return {
    opportunities: candidates.slice(0, MAX_VISIBLE_OPPORTUNITIES),
    doNotCombine: doNotCombineObservations(input.routine),
    analyzedRoutineId: input.routine.id,
    ruleTrace,
  };
}
