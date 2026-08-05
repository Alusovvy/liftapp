import assert from "node:assert/strict";
import { describe, test } from "vitest";
import fixture from "./fixtures/current-data-v9.json";
import { LiftwiseDataSchema } from "../src/domain/models/schema";
import { buildBodyTrend } from "../src/domain/body/body-trend";

function dataWithMetrics(metrics: unknown[]) {
  return LiftwiseDataSchema.parse({ ...fixture, bodyMetrics: metrics });
}

describe("neutral body trends", () => {
  test("requires three observations spanning at least fourteen days", () => {
    const data = dataWithMetrics([
      {
        id: "one",
        date: "2026-07-01",
        weightKg: 80,
        bodyFatPercent: null,
        note: "",
        recordedAt: "",
      },
      {
        id: "two",
        date: "2026-07-08",
        weightKg: 79.8,
        bodyFatPercent: null,
        note: "",
        recordedAt: "",
      },
    ]);
    const trend = buildBodyTrend(data, "weightKg", 30);

    assert.equal(trend.direction, "insufficient");
    assert.equal(trend.weeklyChange, null);
    assert.equal(trend.points.length, 2);
    assert.match(trend.method, /No missing days are interpolated/i);
  });

  test("uses the median consecutive weekly change and neutral direction language", () => {
    const data = dataWithMetrics([
      { id: "one", date: "2026-07-01", weightKg: 80, bodyFatPercent: 20, note: "", recordedAt: "" },
      {
        id: "two",
        date: "2026-07-08",
        weightKg: 79.5,
        bodyFatPercent: 19.8,
        note: "",
        recordedAt: "",
      },
      {
        id: "three",
        date: "2026-07-15",
        weightKg: 79,
        bodyFatPercent: 19.6,
        note: "",
        recordedAt: "",
      },
    ]);
    const weight = buildBodyTrend(data, "weightKg", 30);
    const bodyFat = buildBodyTrend(data, "bodyFatPercent", "all");

    assert.equal(weight.direction, "decreased");
    assert.equal(weight.weeklyChange, -0.5);
    assert.equal(bodyFat.direction, "decreased");
    assert.equal(bodyFat.weeklyChange, -0.2);
    assert.equal(bodyFat.unit, "%");
  });

  test("classifies small median changes as stable without value judgment", () => {
    const data = dataWithMetrics([
      {
        id: "one",
        date: "2026-07-01",
        weightKg: 80,
        bodyFatPercent: null,
        note: "",
        recordedAt: "",
      },
      {
        id: "two",
        date: "2026-07-08",
        weightKg: 80.05,
        bodyFatPercent: null,
        note: "",
        recordedAt: "",
      },
      {
        id: "three",
        date: "2026-07-15",
        weightKg: 80.04,
        bodyFatPercent: null,
        note: "",
        recordedAt: "",
      },
    ]);
    assert.equal(buildBodyTrend(data, "weightKg", 90).direction, "stable");
  });

  test("filters to the selected window and flags likely entry errors without deleting them", () => {
    const data = dataWithMetrics([
      { id: "old", date: "2026-01-01", weightKg: 78, bodyFatPercent: 18, note: "", recordedAt: "" },
      { id: "one", date: "2026-07-01", weightKg: 80, bodyFatPercent: 18, note: "", recordedAt: "" },
      { id: "two", date: "2026-07-02", weightKg: 90, bodyFatPercent: 28, note: "", recordedAt: "" },
      {
        id: "three",
        date: "2026-07-20",
        weightKg: 80,
        bodyFatPercent: 18,
        note: "",
        recordedAt: "",
      },
    ]);
    const weight = buildBodyTrend(data, "weightKg", 30);
    const bodyFat = buildBodyTrend(data, "bodyFatPercent", 30);

    assert.equal(weight.points.length, 3);
    assert.match(weight.points[1]!.reviewReason ?? "", /more than 10%/i);
    assert.match(bodyFat.points[1]!.reviewReason ?? "", /more than 8 points/i);
    assert.equal(
      weight.points.some((point) => point.id === "two"),
      true,
    );
  });

  test("ignores measurements where the selected metric was not recorded", () => {
    const data = dataWithMetrics([
      {
        id: "fat-only",
        date: "2026-07-01",
        weightKg: null,
        bodyFatPercent: 20,
        note: "",
        recordedAt: "",
      },
    ]);
    assert.equal(buildBodyTrend(data, "weightKg", "all").points.length, 0);
    assert.equal(buildBodyTrend(data, "bodyFatPercent", "all").points.length, 1);
  });
});
