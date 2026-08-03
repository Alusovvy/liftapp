import type { Routine } from "../models/schema";

export type OptimizationObjective =
  | "save_time"
  | "simplify"
  | "add_variety"
  | "equipment"
  | "prioritize"
  | "comfort";

export type OptimizationOpportunityKind =
  | "same_role"
  | "similar_role"
  | "equipment_alternative"
  | "time_saving_tradeoff"
  | "coverage_change"
  | "controlled_trial";

export type CoverageChange = {
  label: string;
  before: number;
  after: number;
  unit: "direct sets" | "secondary weighted sets" | "planned sets";
  tone: "preserved" | "gained" | "lost" | "changed";
};

export type RoutineEntryChange = {
  exerciseId: string;
  exerciseName: string;
  targetSets: number;
};

export type OptimizationOpportunity = {
  id: string;
  kind: OptimizationOpportunityKind;
  label: string;
  title: string;
  summary: string;
  routineId: string;
  sourceEntries: RoutineEntryChange[];
  proposedEntries: RoutineEntryChange[];
  preserved: string[];
  changed: string[];
  coverage: CoverageChange[];
  evidence: "routine-only" | "usage-confirmed" | "trial-ready";
  ruleIds: string[];
  caveats: string[];
};

export type DoNotCombineObservation = {
  id: string;
  exerciseIds: [string, string];
  title: string;
  reason: string;
};

export type OptimizationAnalysisInput = {
  routine: Routine;
  objective: OptimizationObjective;
  equipment: Record<string, boolean>;
  protectedExerciseIds?: string[];
  suppressedOpportunityIds?: string[];
  suppressedRelationshipIds?: string[];
  completedAppearances?: Record<string, number>;
};

export type OptimizationAnalysisResult = {
  opportunities: OptimizationOpportunity[];
  doNotCombine: DoNotCombineObservation[];
  analyzedRoutineId: string;
  ruleTrace: string[];
};
