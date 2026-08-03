import { EXERCISE_CATALOG } from "../../domain/exercises/catalog";
import { MUSCLES, type LiftwiseData } from "../../domain/models/schema";
import { buildTodayViewModel } from "../today/selectors";

type ProgressPageProps = {
  data: LiftwiseData;
};

export function ProgressPage({ data }: ProgressPageProps) {
  const view = buildTodayViewModel(data);
  const rows = MUSCLES.map((muscle) => {
    const [minimum, maximum] = data.targets[muscle];
    const value = view.weeklyDose[muscle];
    const status = value < minimum ? "Below range" : value > maximum ? "Review above range" : "In range";
    return { muscle, minimum, maximum, value, status };
  }).sort((first, second) => {
    const firstGap = Math.max(0, first.minimum - first.value);
    const secondGap = Math.max(0, second.minimum - second.value);
    return secondGap - firstGap || first.muscle.localeCompare(second.muscle);
  });
  const maxScale = Math.max(...rows.map((row) => Math.max(row.maximum, row.value)), 1);
  const exerciseAppearances = new Map<string, number>();
  data.workouts.forEach((workout) => {
    new Set(workout.entries.map((entry) => entry.exerciseId)).forEach((id) => {
      exerciseAppearances.set(id, (exerciseAppearances.get(id) ?? 0) + 1);
    });
  });
  const topExercises = [...exerciseAppearances.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Progress</p>
          <h1>Decisions before diagnostics</h1>
          <p className="page-intro">
            Coverage is a planning model. It is not a direct measurement of muscle growth.
          </p>
        </div>
      </header>
      <section className="page-section" aria-labelledby="muscle-coverage-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Current week</p>
            <h2 id="muscle-coverage-title">Muscle coverage</h2>
          </div>
          <span className="evidence-badge evidence-enough-evidence">
            {view.weekWorkouts.length ? `${view.weekWorkouts.length} logged sessions` : "Need data"}
          </span>
        </div>
        <div className="muscle-bars" role="list">
          {rows.map((row) => (
            <div className="muscle-bar-row" role="listitem" key={row.muscle}>
              <div className="muscle-bar-label">
                <strong>{row.muscle}</strong>
                <span>{row.value} / {row.minimum}–{row.maximum} weighted sets</span>
              </div>
              <div className="muscle-track" aria-hidden="true">
                <span
                  className="target-band"
                  style={{
                    left: `${(row.minimum / maxScale) * 100}%`,
                    width: `${((row.maximum - row.minimum) / maxScale) * 100}%`,
                  }}
                />
                <span
                  className="actual-bar"
                  style={{ width: `${Math.min(100, (row.value / maxScale) * 100)}%` }}
                />
              </div>
              <span className={`status-text status-${row.status.toLowerCase().replaceAll(" ", "-")}`}>
                {row.status}
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="page-section" aria-labelledby="familiar-exercises-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Exercise evidence</p>
            <h2 id="familiar-exercises-title">Most established baselines</h2>
          </div>
        </div>
        {topExercises.length ? (
          <div className="familiar-grid">
            {topExercises.map(([id, count]) => (
              <article key={id}>
                <strong>{EXERCISE_CATALOG.find((exercise) => exercise.id === id)?.name ?? id}</strong>
                <span>{count} completed appearance{count === 1 ? "" : "s"}</span>
                <small>{count >= 3 ? "Enough history for a cautious review" : "Emerging baseline"}</small>
              </article>
            ))}
          </div>
        ) : <p className="empty-copy">Log workouts to establish exercise baselines.</p>}
      </section>
    </div>
  );
}
