import type {
  LiftwiseData,
  OptimizationPreferences,
  Routine,
  RoutineRevision,
} from "../models/schema";
import type { CoverageChange, OptimizationOpportunity, RoutineEntryChange } from "./types";

export class StaleRoutineRevisionError extends Error {
  constructor() {
    super(
      "The routine changed after this preview was created. Review the updated plan before applying.",
    );
    this.name = "StaleRoutineRevisionError";
  }
}

export class RoutineRevisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoutineRevisionError";
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function copyRoutine(routine: Routine): Routine {
  return structuredClone(routine);
}

export function routineRevisionToken(routine: Routine): string {
  return JSON.stringify(canonicalize(routine));
}

function nextRevision(data: LiftwiseData, routineId: string): number {
  return (
    data.routineRevisions
      .filter((revision) => revision.routineId === routineId)
      .reduce((highest, revision) => Math.max(highest, revision.revision), 0) + 1
  );
}

function replacementEntry(
  current: Routine,
  proposal: RoutineEntryChange,
  firstSourceId: string,
): Routine["entries"][number] {
  const existing = current.entries.find((entry) => entry.exerciseId === proposal.exerciseId);
  const source = existing ?? current.entries.find((entry) => entry.exerciseId === firstSourceId);
  return {
    exerciseId: proposal.exerciseId,
    targetSets: proposal.targetSets,
    targetRir: source?.targetRir ?? 3,
    notes: existing?.notes ?? "",
  };
}

export function routineAfterOpportunity(
  routine: Routine,
  opportunity: OptimizationOpportunity,
  proposedEntries = opportunity.proposedEntries,
): Routine {
  if (opportunity.routineId !== routine.id) {
    throw new RoutineRevisionError("The opportunity does not belong to this routine.");
  }
  if (!proposedEntries.length) {
    throw new RoutineRevisionError("A routine proposal must contain at least one exercise.");
  }
  if (
    proposedEntries.some(
      ({ targetSets }) => !Number.isInteger(targetSets) || targetSets < 1 || targetSets > 20,
    )
  ) {
    throw new RoutineRevisionError("Proposed sets must be whole numbers between 1 and 20.");
  }

  const sourceIds = new Set(opportunity.sourceEntries.map(({ exerciseId }) => exerciseId));
  const firstSourceId = opportunity.sourceEntries[0]?.exerciseId;
  if (!firstSourceId || !routine.entries.some(({ exerciseId }) => sourceIds.has(exerciseId))) {
    throw new RoutineRevisionError("The source exercises are no longer present in this routine.");
  }

  const firstSourceIndex = routine.entries.findIndex(({ exerciseId }) => sourceIds.has(exerciseId));
  const untouched = routine.entries.filter(({ exerciseId }) => !sourceIds.has(exerciseId));
  const replacements = proposedEntries.map((proposal) =>
    replacementEntry(routine, proposal, firstSourceId),
  );
  const insertionIndex = routine.entries
    .slice(0, firstSourceIndex)
    .filter(({ exerciseId }) => !sourceIds.has(exerciseId)).length;
  const entries = [...untouched];
  entries.splice(insertionIndex, 0, ...replacements);

  return {
    ...copyRoutine(routine),
    entries,
  };
}

export function coverageForProposedEntries(
  opportunity: OptimizationOpportunity,
  proposedEntries: RoutineEntryChange[],
): CoverageChange[] {
  const proposedSets = proposedEntries.reduce((total, entry) => total + entry.targetSets, 0);
  if (opportunity.kind === "same_role" || opportunity.kind === "equipment_alternative") {
    return opportunity.coverage.map((item) => ({
      ...item,
      after: proposedSets,
      tone:
        proposedSets === item.before ? "preserved" : proposedSets > item.before ? "gained" : "lost",
    }));
  }
  if (opportunity.kind === "time_saving_tradeoff") {
    const compoundSets = proposedEntries[0]?.targetSets ?? 0;
    return opportunity.coverage.map((item, index) => {
      if (index === 0) {
        return {
          ...item,
          after: compoundSets,
          tone:
            compoundSets === item.before
              ? "preserved"
              : compoundSets > item.before
                ? "gained"
                : "lost",
        };
      }
      if (index === 2) {
        return {
          ...item,
          after: compoundSets * 0.5,
          tone: "changed",
        };
      }
      return item;
    });
  }
  return opportunity.coverage;
}

export type ApplyRoutineOpportunityInput = {
  data: LiftwiseData;
  opportunity: OptimizationOpportunity;
  expectedRoutineToken: string;
  proposedEntries?: RoutineEntryChange[];
  now?: string;
};

export type RoutineRevisionResult = {
  data: LiftwiseData;
  revision: RoutineRevision;
};

export function applyRoutineOpportunity({
  data,
  opportunity,
  expectedRoutineToken,
  proposedEntries,
  now = new Date().toISOString(),
}: ApplyRoutineOpportunityInput): RoutineRevisionResult {
  const routineIndex = data.routines.findIndex(({ id }) => id === opportunity.routineId);
  const current = data.routines[routineIndex];
  if (!current) throw new RoutineRevisionError("The source routine no longer exists.");
  if (routineRevisionToken(current) !== expectedRoutineToken) {
    throw new StaleRoutineRevisionError();
  }

  const before = copyRoutine(current);
  const after = routineAfterOpportunity(current, opportunity, proposedEntries);
  const revisionNumber = nextRevision(data, current.id);
  const revision: RoutineRevision = {
    id: `${current.id}:revision:${revisionNumber}`,
    routineId: current.id,
    revision: revisionNumber,
    createdAt: now,
    action: "apply",
    sourceOpportunityId: opportunity.id,
    revertsRevisionId: null,
    before,
    after: copyRoutine(after),
  };
  const routines = [...data.routines];
  routines[routineIndex] = after;

  return {
    revision,
    data: {
      ...data,
      routines,
      routineRevisions: [...data.routineRevisions, revision],
    },
  };
}

export function undoRoutineRevision(
  data: LiftwiseData,
  revisionId: string,
  now = new Date().toISOString(),
): RoutineRevisionResult {
  const original = data.routineRevisions.find(({ id }) => id === revisionId);
  if (!original) throw new RoutineRevisionError("The revision to undo was not found.");
  const routineIndex = data.routines.findIndex(({ id }) => id === original.routineId);
  const current = data.routines[routineIndex];
  if (!current) throw new RoutineRevisionError("The revised routine no longer exists.");
  if (routineRevisionToken(current) !== routineRevisionToken(original.after)) {
    throw new StaleRoutineRevisionError();
  }

  const restored = copyRoutine(original.before);
  const revisionNumber = nextRevision(data, current.id);
  const undoRevision: RoutineRevision = {
    id: `${current.id}:revision:${revisionNumber}`,
    routineId: current.id,
    revision: revisionNumber,
    createdAt: now,
    action: "undo",
    sourceOpportunityId: original.sourceOpportunityId,
    revertsRevisionId: original.id,
    before: copyRoutine(current),
    after: copyRoutine(restored),
  };
  const routines = [...data.routines];
  routines[routineIndex] = restored;

  return {
    revision: undoRevision,
    data: {
      ...data,
      routines,
      routineRevisions: [...data.routineRevisions, undoRevision],
    },
  };
}

export function withOptimizationPreferences(
  data: LiftwiseData,
  update: (current: OptimizationPreferences) => OptimizationPreferences,
): LiftwiseData {
  return {
    ...data,
    optimizationPreferences: update(structuredClone(data.optimizationPreferences)),
  };
}

export function snoozeUntilSixWeeksFrom(now = new Date()): string {
  const until = new Date(now);
  until.setDate(until.getDate() + 42);
  return until.toISOString();
}
