import type { LiftwiseData } from "../models/schema";
import { buildBodyTrend, type BodyTrendWindow } from "./body-trend";

export type EnergyBalanceStatus = "need-weight-trend" | "need-nutrition-data" | "estimated";

export type EnergyBalanceEstimate = {
  status: EnergyBalanceStatus;
  estimatedMaintenanceKcal: number | null;
  averageIntakeKcal: number | null;
  weeklyWeightChangeKg: number | null;
  windowStart: string | null;
  windowEnd: string | null;
  nutritionDaysInWindow: number;
  requiredNutritionDays: number;
  method: string;
};

const DEFAULT_WINDOW: BodyTrendWindow = 30;
const REQUIRED_NUTRITION_DAYS = 7;

// Common approximation for the energy equivalent of 1 kg of body-mass change; it does not separate fat from water/lean mass.
const KCAL_PER_KG_BODY_MASS = 7700;

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function estimateEnergyBalance(
  data: LiftwiseData,
  window: BodyTrendWindow = DEFAULT_WINDOW,
): EnergyBalanceEstimate {
  const trend = buildBodyTrend(data, "weightKg", window);

  if (trend.weeklyChange === null || trend.points.length === 0) {
    return {
      status: "need-weight-trend",
      estimatedMaintenanceKcal: null,
      averageIntakeKcal: null,
      weeklyWeightChangeKg: null,
      windowStart: null,
      windowEnd: null,
      nutritionDaysInWindow: 0,
      requiredNutritionDays: REQUIRED_NUTRITION_DAYS,
      method:
        "Needs at least three weight measurements spanning fourteen days before a weight trend is available.",
    };
  }

  const windowStart = trend.points[0]!.date;
  const windowEnd = trend.points.at(-1)!.date;
  const nutritionInWindow = data.nutritionDays.filter(
    (day): day is typeof day & { caloriesKcal: number } =>
      day.date >= windowStart && day.date <= windowEnd && typeof day.caloriesKcal === "number",
  );

  if (nutritionInWindow.length < REQUIRED_NUTRITION_DAYS) {
    return {
      status: "need-nutrition-data",
      estimatedMaintenanceKcal: null,
      averageIntakeKcal: null,
      weeklyWeightChangeKg: trend.weeklyChange,
      windowStart,
      windowEnd,
      nutritionDaysInWindow: nutritionInWindow.length,
      requiredNutritionDays: REQUIRED_NUTRITION_DAYS,
      method: `Needs at least ${REQUIRED_NUTRITION_DAYS} imported nutrition days inside the ${windowStart} to ${windowEnd} weight-trend window; ${nutritionInWindow.length} recorded so far.`,
    };
  }

  const averageIntakeKcal =
    nutritionInWindow.reduce((sum, day) => sum + day.caloriesKcal, 0) / nutritionInWindow.length;
  const dailyWeightChangeKg = trend.weeklyChange / 7;
  const estimatedMaintenanceKcal = roundToNearest(
    averageIntakeKcal - dailyWeightChangeKg * KCAL_PER_KG_BODY_MASS,
    25,
  );

  return {
    status: "estimated",
    estimatedMaintenanceKcal,
    averageIntakeKcal: Math.round(averageIntakeKcal),
    weeklyWeightChangeKg: trend.weeklyChange,
    windowStart,
    windowEnd,
    nutritionDaysInWindow: nutritionInWindow.length,
    requiredNutritionDays: REQUIRED_NUTRITION_DAYS,
    method: `Estimated from ${nutritionInWindow.length} logged nutrition days and a median weight trend of ${
      trend.weeklyChange > 0 ? "+" : ""
    }${trend.weeklyChange} kg/week between ${windowStart} and ${windowEnd}, using ${KCAL_PER_KG_BODY_MASS} kcal per kg of body-mass change. A practical starting point based on your own logged data, not a personalized prescription.`,
  };
}
