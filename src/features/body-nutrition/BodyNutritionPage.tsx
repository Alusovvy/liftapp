import type { LiftwiseData, NutritionDay } from "../../domain/models/schema";
import { localDateKey } from "../today/selectors";

type BodyNutritionPageProps = {
  data: LiftwiseData;
};

function recentDateKeys(days: number): string[] {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - index);
    return localDateKey(date);
  });
}

function average(days: NutritionDay[], key: keyof Pick<
  NutritionDay,
  "caloriesKcal" | "proteinG" | "carbsG" | "fatG" | "fiberG"
>): number | null {
  const values = days.map((day) => day[key]).filter((value): value is number => typeof value === "number");
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function BodyNutritionPage({ data }: BodyNutritionPageProps) {
  const latestBody = [...data.bodyMetrics].sort((a, b) => b.date.localeCompare(a.date))[0];
  const dateSet = new Set(recentDateKeys(7));
  const recentNutrition = data.nutritionDays.filter((day) => dateSet.has(day.date));
  const latestNutrition = [...data.nutritionDays].sort((a, b) => b.date.localeCompare(a.date))[0];
  const nutritionMetrics = [
    ["Calories", average(recentNutrition, "caloriesKcal"), "kcal"],
    ["Protein", average(recentNutrition, "proteinG"), "g"],
    ["Carbohydrates", average(recentNutrition, "carbsG"), "g"],
    ["Fat", average(recentNutrition, "fatG"), "g"],
    ["Fiber", average(recentNutrition, "fiberG"), "g"],
  ] as const;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Body & nutrition</p>
          <h1>Context without judgment</h1>
          <p className="page-intro">
            Measurements and Fitatu imports stay descriptive unless you explicitly configure a goal.
          </p>
        </div>
      </header>
      <section className="body-context-grid">
        <article className="context-card">
          <p className="card-kicker">Latest body measurement</p>
          {latestBody ? (
            <>
              <strong className="context-value">
                {typeof latestBody.weightKg === "number"
                  ? `${latestBody.weightKg} kg`
                  : `${latestBody.bodyFatPercent ?? "—"}% body fat`}
              </strong>
              <span>{latestBody.date}</span>
              <p>
                {typeof latestBody.bodyFatPercent === "number" && typeof latestBody.weightKg === "number"
                  ? `${latestBody.bodyFatPercent}% body fat recorded`
                  : typeof latestBody.weightKg === "number"
                    ? "Body-fat percentage not recorded"
                    : "Weight not recorded"}
              </p>
            </>
          ) : (
            <>
              <strong>No measurement yet</strong>
              <p>Add a measurement when it is useful; it is not required for training decisions.</p>
            </>
          )}
          <a className="button button-secondary" href="./index.html">Manage measurements</a>
        </article>
        <article className="context-card">
          <p className="card-kicker">Recent nutrition</p>
          <strong className="context-value">{recentNutrition.length} of 7 days</strong>
          <span>imported in the current rolling window</span>
          <p>
            {latestNutrition ? `Latest day: ${latestNutrition.date}` : "No Fitatu nutrition imported"}
          </p>
          <a className="button button-secondary" href="./index.html">Import Fitatu file</a>
        </article>
      </section>
      <section className="page-section" aria-labelledby="nutrition-average-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Rolling context</p>
            <h2 id="nutrition-average-title">Recent-day average</h2>
          </div>
          <span>{recentNutrition.length} complete day{recentNutrition.length === 1 ? "" : "s"}</span>
        </div>
        <dl className="nutrition-grid">
          {nutritionMetrics.map(([label, value, unit]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value ?? "—"} {value === null ? "" : unit}</dd>
            </div>
          ))}
        </dl>
        <p className="method-note">
          Missing days are excluded, never treated as zero. These values describe imported records
          and do not prescribe calories or macronutrients.
        </p>
      </section>
    </div>
  );
}
