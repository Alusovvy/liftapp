import { useState } from "react";
import type { LiftwiseData, Muscle } from "../../domain/models/schema";
import {
  buildPrimaryExerciseSuggestions,
  type MuscleExerciseContribution,
} from "./muscle-map-rows";

type MuscleExerciseBreakdownProps = {
  data: LiftwiseData;
  muscle: Muscle;
  contributions: MuscleExerciseContribution[];
};

export function MuscleExerciseBreakdown({
  data,
  muscle,
  contributions,
}: MuscleExerciseBreakdownProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const loggedExerciseIds = new Set(contributions.map((item) => item.exerciseId));
  const suggestions = showSuggestions
    ? buildPrimaryExerciseSuggestions(data, muscle, loggedExerciseIds)
    : [];

  return (
    <div className="muscle-exercise-breakdown" aria-live="polite">
      <div className="muscle-exercise-breakdown-header">
        <h3>{muscle}: exercises logged this week</h3>
        <button
          type="button"
          className="text-button"
          aria-pressed={showSuggestions}
          onClick={() => setShowSuggestions((current) => !current)}
        >
          {showSuggestions ? "Hide suggestions" : "Suggest primary"}
        </button>
      </div>
      {contributions.length ? (
        <ul>
          {contributions.map((item) => (
            <li key={item.exerciseId}>
              <span className="muscle-exercise-name">{item.name}</span>
              <span className={`muscle-exercise-role role-${item.role}`}>
                {item.role === "primary" ? "Primary" : "Secondary"}
              </span>
              <span className="muscle-exercise-sets">
                {item.sets} set{item.sets === 1 ? "" : "s"} · {item.credit} credited
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-copy">
          No logged exercise is credited toward {muscle} this week. If you expected one here, check
          whether it needs muscle mapping in the Library.
        </p>
      )}
      {showSuggestions ? (
        <div className="muscle-exercise-suggestions">
          <h4>Suggested {muscle} primary exercises</h4>
          {suggestions.length ? (
            <ul>
              {suggestions.map((item) => (
                <li key={item.exerciseId}>
                  <span className="muscle-exercise-name">{item.name}</span>
                  <span className="muscle-exercise-sets">
                    {item.pattern} · {item.equipmentLabel}
                  </span>
                  <span
                    className={
                      item.available ? "suggestion-availability yes" : "suggestion-availability no"
                    }
                  >
                    {item.available ? "Available" : "Needs equipment"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-copy">
              Every catalog exercise with {muscle} as a primary target is already logged this week.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
