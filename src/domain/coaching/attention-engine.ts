import type {
  AttentionEngineInput,
  AttentionEngineResult,
  CoachingAction,
  WeeklyGap,
} from "./types";

const MAX_WEEKLY_FOCUS = 3;
const RECENT_WORK_DEPRIORITIZATION_HOURS = 48;

function gapSize(gap: WeeklyGap): number {
  return Math.max(0, gap.minimumSets - gap.currentSets);
}

function rankedGaps(gaps: WeeklyGap[]): WeeklyGap[] {
  return [...gaps]
    .filter((gap) => gapSize(gap) > 0 && gap.availableExerciseCount > 0)
    .sort((first, second) => {
      const firstRecent = (first.recentDirectWorkHours ?? Number.POSITIVE_INFINITY)
        < RECENT_WORK_DEPRIORITIZATION_HOURS;
      const secondRecent = (second.recentDirectWorkHours ?? Number.POSITIVE_INFINITY)
        < RECENT_WORK_DEPRIORITIZATION_HOURS;
      if (firstRecent !== secondRecent) return firstRecent ? 1 : -1;
      const difference = gapSize(second) - gapSize(first);
      if (difference !== 0) return difference;
      return first.muscle.localeCompare(second.muscle);
    });
}

function gapAction(gap: WeeklyGap): CoachingAction {
  const missingSets = gapSize(gap);
  return {
    id: `weekly-gap:${gap.muscle}`,
    kind: "weekly-gap",
    title: `Add ${missingSets} weighted set${missingSets === 1 ? "" : "s"} for ${gap.muscle}`,
    reason: `${gap.muscle} has ${gap.currentSets} weighted sets against your ${gap.minimumSets}–${gap.maximumSets} weekly range.`,
    evidence: gap.evidence,
    primaryActionLabel: "Use in a workout",
    alternativeActionLabel: "Choose another day",
    muscle: gap.muscle,
    ruleId: "attention.weekly-gap",
  };
}

function maintenanceAction(): CoachingAction {
  return {
    id: "maintenance",
    kind: "maintenance",
    title: "Continue your current plan",
    reason: "No safety, recovery, schedule, data, or coverage issue currently needs to take priority.",
    evidence: "enough-evidence",
    primaryActionLabel: "Choose a workout",
    alternativeActionLabel: "Review the week",
    ruleId: "attention.maintenance",
  };
}

export function buildAttentionPlan(input: AttentionEngineInput): AttentionEngineResult {
  const trace: string[] = [];
  const gaps = rankedGaps(input.weeklyGaps);
  const weeklyFocus: CoachingAction[] = gaps.map(gapAction);

  input.performanceReviews.forEach((review) => {
    weeklyFocus.push({
      id: `performance:${review.exerciseId}`,
      kind: "performance-review",
      title: `Review ${review.exerciseName}`,
      reason: review.reason,
      evidence: review.evidence,
      primaryActionLabel: "Review exercise",
      alternativeActionLabel: "Keep current",
      ruleId: "attention.performance-review",
    });
  });

  input.abovePlanMuscles.forEach((review) => {
    weeklyFocus.push({
      id: `above-plan:${review.muscle}`,
      kind: "above-plan-review",
      title: `Review ${review.muscle} volume`,
      reason: `${review.currentSets} weighted sets are above your configured maximum of ${review.maximumSets}.`,
      evidence: "enough-evidence",
      primaryActionLabel: "Review target",
      alternativeActionLabel: "Keep current",
      muscle: review.muscle,
      ruleId: "attention.above-plan-review",
    });
  });

  let primary: CoachingAction;
  if (input.painConcern) {
    trace.push("attention.safety");
    primary = {
      id: "safety:pain",
      kind: "safety",
      title: "Pause the generated workout",
      reason: input.painNote?.trim()
        ? `You reported a pain concern: ${input.painNote.trim()}`
        : "You reported a pain concern in today's recovery check-in.",
      evidence: "enough-evidence",
      primaryActionLabel: "Review pain response",
      alternativeActionLabel: "Edit check-in",
      ruleId: "attention.safety",
    };
  } else if (input.recoveryCaution) {
    trace.push("attention.recovery");
    primary = {
      id: "recovery:caution",
      kind: "recovery",
      title: "Use a reduced session today",
      reason: input.recoveryReason?.trim() || "Today's recovery check-in supports reducing work and keeping more repetitions in reserve.",
      evidence: "enough-evidence",
      primaryActionLabel: "Review reduced session",
      alternativeActionLabel: "Choose recovery",
      ruleId: "attention.recovery",
    };
  } else if (input.scheduledRoutine) {
    trace.push("attention.planned-session");
    const duration = input.scheduledRoutine.estimatedMinutes
      ? ` · about ${input.scheduledRoutine.estimatedMinutes} min`
      : "";
    primary = {
      id: `routine:${input.scheduledRoutine.id}`,
      kind: "planned-session",
      title: `Train ${input.scheduledRoutine.name}${duration}`,
      reason: gaps[0]
        ? `${gaps[0].muscle} is the largest current weekly gap that is not deprioritized by recent direct work.`
        : "This routine is scheduled today and no higher-priority constraint is active.",
      evidence: gaps[0]?.evidence ?? "enough-evidence",
      primaryActionLabel: "Start workout",
      alternativeActionLabel: "Adjust session",
      routineId: input.scheduledRoutine.id,
      ruleId: "attention.planned-session",
    };
  } else if (input.missingBaseline && input.missingBaseline.count > 0) {
    trace.push("attention.data-quality");
    primary = {
      id: "data-quality:baseline",
      kind: "data-quality",
      title: "Establish a useful baseline",
      reason: input.missingBaseline.description,
      evidence: "need-data",
      primaryActionLabel: "Log baseline",
      alternativeActionLabel: "Choose a routine",
      ruleId: "attention.data-quality",
    };
  } else if (gaps[0]) {
    trace.push("attention.weekly-gap");
    primary = gapAction(gaps[0]);
  } else if (input.performanceReviews[0]) {
    trace.push("attention.performance-review");
    const review = input.performanceReviews[0];
    primary = {
      id: `performance:${review.exerciseId}`,
      kind: "performance-review",
      title: `Review ${review.exerciseName}`,
      reason: review.reason,
      evidence: review.evidence,
      primaryActionLabel: "Review exercise",
      alternativeActionLabel: "Keep current",
      ruleId: "attention.performance-review",
    };
  } else if (input.abovePlanMuscles[0]) {
    trace.push("attention.above-plan-review");
    const review = input.abovePlanMuscles[0];
    primary = {
      id: `above-plan:${review.muscle}`,
      kind: "above-plan-review",
      title: `Review ${review.muscle} volume`,
      reason: `${review.currentSets} weighted sets are above your configured maximum of ${review.maximumSets}.`,
      evidence: "enough-evidence",
      primaryActionLabel: "Review target",
      alternativeActionLabel: "Keep current",
      muscle: review.muscle,
      ruleId: "attention.above-plan-review",
    };
  } else {
    trace.push("attention.maintenance");
    primary = maintenanceAction();
  }

  const deduplicatedFocus = weeklyFocus
    .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    .filter((item) => item.id !== primary.id)
    .slice(0, MAX_WEEKLY_FOCUS);

  return {
    primary,
    weeklyFocus: deduplicatedFocus,
    ruleTrace: trace,
  };
}
