import type { LiftwiseData } from "../models/schema";

export type BodyTrendMetric = "weightKg" | "bodyFatPercent";
export type BodyTrendWindow = 30 | 90 | "all";
export type BodyTrendDirection = "insufficient" | "stable" | "increased" | "decreased";

export type BodyTrendPoint = {
  id: string;
  date: string;
  value: number;
  smoothedValue: number;
  reviewReason: string | null;
};

export type BodyTrend = {
  metric: BodyTrendMetric;
  unit: "kg" | "%";
  window: BodyTrendWindow;
  points: BodyTrendPoint[];
  direction: BodyTrendDirection;
  weeklyChange: number | null;
  spanDays: number;
  method: string;
};

function utcDay(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00.000Z`).getTime();
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

const TRAILING_AVERAGE_WINDOW_DAYS = 7;

// Damps single-day water/glycogen noise; only recorded points are averaged, missing days are never interpolated.
function trailingAverages(points: { date: string; value: number }[]): number[] {
  return points.map((point, index) => {
    const windowStart = utcDay(point.date) - (TRAILING_AVERAGE_WINDOW_DAYS - 1) * 86_400_000;
    const windowValues = points
      .slice(0, index + 1)
      .filter((candidate) => utcDay(candidate.date) >= windowStart)
      .map((candidate) => candidate.value);
    return rounded(windowValues.reduce((sum, value) => sum + value, 0) / windowValues.length);
  });
}

function reviewReason(
  metric: BodyTrendMetric,
  previous: { date: string; value: number } | undefined,
  current: { date: string; value: number },
): string | null {
  if (!previous) return null;
  const days = Math.max(1, Math.round((utcDay(current.date) - utcDay(previous.date)) / 86_400_000));
  if (days > 7) return null;
  const difference = Math.abs(current.value - previous.value);
  if (metric === "weightKg" && difference / previous.value > 0.1) {
    return `Review this entry: weight changed by more than 10% within ${days} day${days === 1 ? "" : "s"}.`;
  }
  if (metric === "bodyFatPercent" && difference > 8) {
    return `Review this entry: body-fat percentage changed by more than 8 points within ${days} day${days === 1 ? "" : "s"}.`;
  }
  return null;
}

export function buildBodyTrend(
  data: LiftwiseData,
  metric: BodyTrendMetric,
  window: BodyTrendWindow,
): BodyTrend {
  const all = data.bodyMetrics
    .flatMap((measurement) => {
      const value = measurement[metric];
      return typeof value === "number"
        ? [{ id: measurement.id, date: measurement.date, value }]
        : [];
    })
    .sort((left, right) => left.date.localeCompare(right.date));
  const latest = all.at(-1);
  const cutoff =
    latest && window !== "all"
      ? utcDay(latest.date) - (window - 1) * 86_400_000
      : Number.NEGATIVE_INFINITY;
  const selected = all.filter((point) => utcDay(point.date) >= cutoff);
  const smoothed = trailingAverages(selected);
  const points: BodyTrendPoint[] = selected.map((point, index) => ({
    ...point,
    smoothedValue: smoothed[index]!,
    reviewReason: reviewReason(metric, selected[index - 1], point),
  }));
  const spanDays =
    points.length > 1
      ? Math.round((utcDay(points.at(-1)!.date) - utcDay(points[0]!.date)) / 86_400_000)
      : 0;
  const method = `Median change between consecutive recorded measurements; ${
    window === "all" ? "all available history" : `${window}-day window`
  }. Each point also shows a trailing ${TRAILING_AVERAGE_WINDOW_DAYS}-day average of recorded values to reduce day-to-day noise such as water or glycogen shifts. No missing days are interpolated.`;

  if (points.length < 3 || spanDays < 14) {
    return {
      metric,
      unit: metric === "weightKg" ? "kg" : "%",
      window,
      points,
      direction: "insufficient",
      weeklyChange: null,
      spanDays,
      method,
    };
  }

  const slopes = points.slice(1).map((point, index) => {
    const previous = points[index]!;
    const days = Math.max(1, (utcDay(point.date) - utcDay(previous.date)) / 86_400_000);
    return ((point.value - previous.value) / days) * 7;
  });
  const weeklyChange = rounded(median(slopes));
  const stableThreshold = metric === "weightKg" ? 0.1 : 0.15;
  const direction: BodyTrendDirection =
    Math.abs(weeklyChange) < stableThreshold
      ? "stable"
      : weeklyChange > 0
        ? "increased"
        : "decreased";

  return {
    metric,
    unit: metric === "weightKg" ? "kg" : "%",
    window,
    points,
    direction,
    weeklyChange,
    spanDays,
    method,
  };
}
