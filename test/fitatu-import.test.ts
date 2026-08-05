import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "vitest";
import fixture from "./fixtures/current-data-v9.json";
import {
  buildFitatuImportPlan,
  commitFitatuImport,
  parseFitatuCsv,
} from "../src/domain/import/fitatu-import";
import { LiftwiseDataSchema } from "../src/domain/models/schema";
import {
  IMPORT_UNDO_KEY,
  LiftwiseStorageRepository,
  STORAGE_KEY,
  type StoragePort,
} from "../src/infrastructure/local-storage/storage-repository";

class MemoryStorage implements StoragePort {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const samplePath = new URL("./fixtures/fitatu-meal-plan.csv", import.meta.url);

describe("typed Fitatu import", () => {
  test("parses the supplied meal-plan column format into complete daily summaries", () => {
    const pending = parseFitatuCsv(
      readFileSync(samplePath, "utf8"),
      "meal-plan.csv",
      new Date("2026-08-03T10:00:00.000Z"),
    );

    assert.equal(pending.days.length, 2);
    assert.equal(pending.acceptedRowCount, 3);
    assert.equal(pending.rejectedRows.length, 0);
    assert.equal(pending.days[0]?.date, "2026-07-29");
    assert.equal(pending.days[0]?.caloriesKcal, 854.4);
    assert.equal(pending.days[0]?.proteinG, 69.94);
    assert.equal(pending.days[1]?.fiberG, 7.04);
    assert.equal(pending.dateRange, "2026-07-29 – 2026-08-02");
  });

  test("previews new, updated, and unchanged dates before commit", () => {
    const data = LiftwiseDataSchema.parse(fixture);
    const pending = parseFitatuCsv(
      readFileSync(samplePath, "utf8"),
      "meal-plan.csv",
      new Date("2026-08-03T10:00:00.000Z"),
    );
    const newPlan = buildFitatuImportPlan(data, pending, "merge");
    assert.deepEqual(newPlan.counts, { added: 2, updated: 0, unchanged: 0 });

    const committed = commitFitatuImport({
      data,
      pending,
      mode: "merge",
      acceptValidRowsOnly: false,
      now: "2026-08-03T10:00:00.000Z",
      batchId: "fitatu-test",
    });
    const repeated = buildFitatuImportPlan(committed.data, pending, "merge");
    assert.deepEqual(repeated.counts, { added: 0, updated: 0, unchanged: 2 });

    const changedPending = {
      ...pending,
      days: pending.days.map((day, index) =>
        index === 0 ? { ...day, caloriesKcal: 900, contentFingerprint: "changed" } : day,
      ),
    };
    const changed = buildFitatuImportPlan(committed.data, changedPending, "merge");
    assert.deepEqual(changed.counts, { added: 0, updated: 1, unchanged: 1 });
  });

  test("commits through the repository and exact undo restores all previous data", () => {
    const data = LiftwiseDataSchema.parse(fixture);
    const pending = parseFitatuCsv(
      readFileSync(samplePath, "utf8"),
      "meal-plan.csv",
      new Date("2026-08-03T10:00:00.000Z"),
    );
    const committed = commitFitatuImport({
      data,
      pending,
      mode: "replace",
      acceptValidRowsOnly: false,
      now: "2026-08-03T10:00:00.000Z",
      batchId: "fitatu-test",
    });
    const storage = new MemoryStorage();
    const repository = new LiftwiseStorageRepository(storage);

    repository.save(data);
    repository.saveWithImportUndo(
      committed.data,
      committed.previousData,
      committed.batchId,
      "2026-08-03T10:00:00.000Z",
    );

    assert.equal(repository.hasImportUndo(), true);
    assert.equal(committed.data.nutritionDays.length, 2);
    assert.deepEqual(committed.data.workouts, data.workouts);
    assert.deepEqual(committed.data.bodyMetrics, data.bodyMetrics);
    assert.ok(storage.getItem(IMPORT_UNDO_KEY));

    const restored = repository.undoLastImport();
    assert.deepEqual(restored, data);
    assert.equal(repository.hasImportUndo(), false);
    assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY) ?? "{}"), data);
  });

  test("requires explicit consent before importing only valid rows", () => {
    const csv = [
      "Date,Meal,Products and dishes,calories (kcal),Protein (g),Fats (g),Carbohydrates (g)",
      "2026-08-02,Snack,Valid,500,30,20,40",
      "2026-08-05,Snack,Future,500,30,20,40",
    ].join("\n");
    const pending = parseFitatuCsv(csv, "partial.csv", new Date("2026-08-03T10:00:00.000Z"));
    const data = LiftwiseDataSchema.parse(fixture);

    assert.equal(pending.rejectedRows.length, 1);
    assert.throws(
      () =>
        commitFitatuImport({
          data,
          pending,
          mode: "merge",
          acceptValidRowsOnly: false,
        }),
      /Confirm that only valid rows/i,
    );
  });

  test("reports metadata, delimiter, total-row aggregation, and rejected-row decisions", () => {
    const csv = [
      "Fitatu export metadata;;;;;;",
      "Date;Meal;Products and dishes;calories (kcal);Protein (g);Fats (g);Carbohydrates (g)",
      "2026-08-02;Daily total;Summary;500;30;20;40",
      "2026-08-05;Snack;Future;400;20;10;50",
    ].join("\n");
    const pending = parseFitatuCsv(csv, "summarized.csv", new Date("2026-08-03T10:00:00.000Z"));

    assert.equal(pending.days.length, 1);
    assert.equal(pending.days[0]?.aggregation, "daily-total");
    assert.equal(pending.rejectedRows.length, 1);
    assert.match(pending.warnings.join(" "), /metadata row/);
    assert.match(pending.warnings.join(" "), /semicolon-separated/);
    assert.match(pending.warnings.join(" "), /used total rows/);
    assert.match(pending.warnings.join(" "), /invalid or future row was rejected/);
  });

  test("recognizes tab-separated exports and plural metadata rows", () => {
    const csv = [
      "Fitatu export",
      "Generated locally",
      "Date\tMeal\tProducts and dishes\tcalories (kcal)\tProtein (g)\tFats (g)\tCarbohydrates (g)",
      "2026-08-02\tSnack\tFood\t500\t30\t20\t40",
    ].join("\n");
    const pending = parseFitatuCsv(csv, "tab-separated.csv", new Date("2026-08-03T10:00:00.000Z"));

    assert.match(pending.warnings.join(" "), /2 metadata rows/);
    assert.match(pending.warnings.join(" "), /tab-separated/);
  });

  test("commits updated and unchanged merge records without duplicating dates", () => {
    const original = LiftwiseDataSchema.parse(fixture);
    const pending = parseFitatuCsv(
      readFileSync(samplePath, "utf8"),
      "meal-plan.csv",
      new Date("2026-08-03T10:00:00.000Z"),
    );
    const first = commitFitatuImport({
      data: original,
      pending,
      mode: "merge",
      acceptValidRowsOnly: false,
      now: "2026-08-03T10:00:00.000Z",
      batchId: "first",
    });
    const changedPending = {
      ...pending,
      days: pending.days.map((day, index) =>
        index === 0
          ? { ...day, caloriesKcal: 999, contentFingerprint: "updated-fingerprint" }
          : day,
      ),
    };
    const second = commitFitatuImport({
      data: first.data,
      pending: changedPending,
      mode: "merge",
      acceptValidRowsOnly: false,
      now: "2026-08-03T11:00:00.000Z",
      batchId: "second",
    });

    assert.deepEqual(second.counts, { added: 0, updated: 1, unchanged: 1 });
    assert.equal(second.data.nutritionDays.filter(({ date }) => date === "2026-07-29").length, 1);
    assert.equal(
      second.data.nutritionDays.find(({ date }) => date === "2026-07-29")?.caloriesKcal,
      999,
    );
  });

  test("surfaces malformed and oversized files as visible parser errors", () => {
    assert.throws(
      () => parseFitatuCsv("not,a,fitatu,file", "wrong.csv"),
      /nutrition rows|does not look like/i,
    );
    assert.throws(() => parseFitatuCsv("x".repeat(10_000_001), "large.csv"), /10 MB/i);
  });
});
