import { useMemo, useState } from "react";
import {
  buildBodyTrend,
  type BodyTrendMetric,
  type BodyTrendWindow,
} from "../../domain/body/body-trend";
import type { LiftwiseData, NutritionDay } from "../../domain/models/schema";
import { localDateKey } from "../today/selectors";

type BodyNutritionPageProps = {
  data: LiftwiseData;
  onOpenImport: () => void;
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

const metricLabels: Record<BodyTrendMetric, string> = {
  weightKg: "Weight",
  bodyFatPercent: "Body fat",
};

export function BodyNutritionPage({ data, onOpenImport }: BodyNutritionPageProps) {
  const [metric, setMetric] = useState<BodyTrendMetric>("weightKg");
  const [window, setWindow] = useState<BodyTrendWindow>(90);
  const trend = useMemo(() => buildBodyTrend(data, metric, window), [data, metric, window]);
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
  const latestNutritionMetrics = latestNutrition ? [
    ["Calories", latestNutrition.caloriesKcal, "kcal"],
    ["Protein", latestNutrition.proteinG, "g"],
    ["Carbohydrates", latestNutrition.carbsG, "g"],
    ["Fat", latestNutrition.fatG, "g"],
    ["Fiber", latestNutrition.fiberG, "g"],
  ] as const : [];
  const trendTitle = trend.direction === "insufficient"
    ? "Not enough data for a trend"
    : `${metricLabels[metric]} ${trend.direction}`;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Body & nutrition</p>
          <h1>Context without judgment</h1>
          <p className="page-intro">
            Measurements and Fitatu records stay descriptive. Missing days are never treated as zero.
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
              <p>Add a measurement when useful; it is not required for training decisions.</p>
            </>
          )}
          <a className="button button-secondary" href="./index.html">Manage measurements</a>
        </article>
        <article className="context-card nutrition-completeness-card">
          <p className="card-kicker">Recent nutrition</p>
          <strong className="context-value">{recentNutrition.length} of 7 days</strong>
          <span>imported in the current rolling window</span>
          <p>
            {latestNutrition ? `Latest recorded day: ${latestNutrition.date}` : "No Fitatu nutrition imported"}
          </p>
          <button className="button button-secondary" type="button" onClick={onOpenImport}>
            Open Fitatu import
          </button>
        </article>
      </section>

      <section className="page-section body-trend-section" aria-labelledby="body-trend-title">
        <header className="body-trend-header">
          <div>
            <p className="eyebrow">Recorded measurements</p>
            <h2 id="body-trend-title">{trendTitle}</h2>
            <p>
              {trend.weeklyChange === null
                ? `${trend.points.length} recorded point${trend.points.length === 1 ? "" : "s"} across ${trend.spanDays} days. Three points spanning 14 days are required.`
                : `Median recorded change: ${trend.weeklyChange > 0 ? "+" : ""}${trend.weeklyChange} ${trend.unit} per week.`}
            </p>
          </div>
          <div className="body-trend-controls">
            <label>
              <span>Measurement</span>
              <select value={metric} onChange={(event) => setMetric(event.target.value as BodyTrendMetric)}>
                <option value="weightKg">Weight</option>
                <option value="bodyFatPercent">Body fat</option>
              </select>
            </label>
            <label>
              <span>Window</span>
              <select
                value={String(window)}
                onChange={(event) => setWindow(
                  event.target.value === "all" ? "all" : Number(event.target.value) as 30 | 90,
                )}
              >
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="all">All history</option>
              </select>
            </label>
          </div>
        </header>

        {trend.points.length ? (
          <div className="body-point-list" role="list" aria-label={`${metricLabels[metric]} raw measurements`}>
            {trend.points.map((point) => (
              <div role="listitem" key={point.id} className={point.reviewReason ? "needs-review" : ""}>
                <time dateTime={point.date}>{point.date}</time>
                <strong>{point.value} {trend.unit}</strong>
                <span>{point.reviewReason ?? "Recorded value"}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="positive-empty">
            <strong>No {metricLabels[metric].toLowerCase()} values in this window.</strong>
            <p>Other body measurements remain untouched.</p>
          </div>
        )}
        <p className="method-note">{trend.method}</p>
      </section>

      <section className="page-section" aria-labelledby="nutrition-average-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Rolling context</p>
            <h2 id="nutrition-average-title">Recent nutrition · {recentNutrition.length} of 7 days imported</h2>
          </div>
          <span>
            {data.integrations.fitatu.lastImportAt
              ? `Latest import ${new Date(data.integrations.fitatu.lastImportAt).toLocaleString()}`
              : "No import timestamp"}
          </span>
        </div>
        <h3 className="nutrition-subheading">Average across recorded days</h3>
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

        <div className="latest-nutrition-day">
          <div>
            <p className="eyebrow">Most recent recorded day</p>
            <h3>{latestNutrition?.date ?? "No recorded day"}</h3>
            {latestNutrition ? (
              <span>Source: {latestNutrition.source} · {latestNutrition.sourceRowCount} source rows</span>
            ) : null}
          </div>
          {latestNutrition ? (
            <dl>
              {latestNutritionMetrics.map(([label, value, unit]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value ?? "—"} {value === null ? "" : unit}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </section>
    </div>
  );
}
