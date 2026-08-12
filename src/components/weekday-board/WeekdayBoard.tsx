import { WeekNav } from "../navigation/WeekNav";
import type { WeekdayColumn } from "./weekday-board";

type WeekdayBoardProps = {
  days: WeekdayColumn[];
  weekLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  previousDisabled: boolean;
  nextDisabled: boolean;
};

export function WeekdayBoard({
  days,
  weekLabel,
  onPrevious,
  onNext,
  previousDisabled,
  nextDisabled,
}: WeekdayBoardProps) {
  return (
    <div className="weekday-board">
      <WeekNav
        label={weekLabel}
        onPrevious={onPrevious}
        onNext={onNext}
        previousDisabled={previousDisabled}
        nextDisabled={nextDisabled}
      />
      <div className="weekday-board-grid" role="region" aria-label="Days this week" tabIndex={0}>
        {days.map((day) => (
          <div
            className={`weekday-board-column ${day.isToday ? "is-today" : ""}`}
            key={day.dateKey}
          >
            <p className="weekday-board-date">{day.label}</p>
            {day.workouts.length ? (
              day.workouts.map((workout) => (
                <div className="weekday-board-workout" key={workout.id}>
                  <strong>{workout.name}</strong>
                  <ul>
                    {workout.exerciseNames.map((name, index) => (
                      <li key={index}>{name}</li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="weekday-board-empty">Rest day</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
