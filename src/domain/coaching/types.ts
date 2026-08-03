import type { Muscle } from "../models/schema";

export type EvidenceState = "need-data" | "emerging" | "enough-evidence";

export type CoachingActionKind =
  | "safety"
  | "recovery"
  | "planned-session"
  | "data-quality"
  | "weekly-gap"
  | "performance-review"
  | "above-plan-review"
  | "maintenance";

export type CoachingAction = {
  id: string;
  kind: CoachingActionKind;
  title: string;
  reason: string;
  evidence: EvidenceState;
  primaryActionLabel: string;
  alternativeActionLabel?: string;
  muscle?: Muscle;
  routineId?: string;
  ruleId: string;
};

export type WeeklyGap = {
  muscle: Muscle;
  currentSets: number;
  minimumSets: number;
  maximumSets: number;
  recentDirectWorkHours?: number;
  availableExerciseCount: number;
  evidence: EvidenceState;
};

export type PerformanceReview = {
  exerciseId: string;
  exerciseName: string;
  reason: string;
  evidence: EvidenceState;
};

export type AttentionEngineInput = {
  painConcern: boolean;
  painNote?: string;
  recoveryCaution: boolean;
  recoveryReason?: string;
  scheduledRoutine?: {
    id: string;
    name: string;
    estimatedMinutes?: number;
  };
  missingBaseline?: {
    count: number;
    description: string;
  };
  weeklyGaps: WeeklyGap[];
  performanceReviews: PerformanceReview[];
  abovePlanMuscles: Array<{
    muscle: Muscle;
    currentSets: number;
    maximumSets: number;
  }>;
};

export type AttentionEngineResult = {
  primary: CoachingAction;
  weeklyFocus: CoachingAction[];
  ruleTrace: string[];
};
