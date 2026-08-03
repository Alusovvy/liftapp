import assert from "node:assert/strict";
import fixture from "./fixtures/current-data-v9.json";
import { describe, test } from "vitest";
import { LiftwiseDataSchema } from "../src/domain/models/schema";
import {
  CORRUPT_STORAGE_KEY,
  IMPORT_UNDO_KEY,
  LiftwiseStorageRepository,
  STORAGE_KEY,
  type StoragePort,
} from "../src/infrastructure/local-storage/storage-repository";

class MemoryStorage implements StoragePort {
  private readonly values = new Map<string, string>();

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

describe("current persisted schema", () => {
  test("accepts the representative v9 fixture and preserves unknown fields", () => {
    const result = LiftwiseDataSchema.parse(fixture);
    assert.equal(result.schemaVersion, 9);
    assert.equal(result.workouts[0]?.entries[0]?.sets[0]?.rir, 3);
    assert.deepEqual(result.futureCompatibleField, { preserved: true });
  });

  test("backup export and import round trip without losing user data", () => {
    const storage = new MemoryStorage();
    const repository = new LiftwiseStorageRepository(storage);
    const data = LiftwiseDataSchema.parse(fixture);

    repository.save(data);
    const loaded = repository.load();
    assert.equal(loaded.status, "loaded");
    if (loaded.status !== "loaded") return;

    const exported = repository.export(loaded.data);
    const restored = repository.import(exported);
    assert.deepEqual(restored, data);
  });

  test("accepts the legacy body-fat-only measurement shape", () => {
    const data = LiftwiseDataSchema.parse({
      ...fixture,
      bodyMetrics: [{
        id: "body-fat-only",
        date: "2026-08-02",
        weightKg: null,
        bodyFatPercent: 16.1,
        note: "",
        recordedAt: "2026-08-02T07:00:00.000Z",
      }],
    });

    assert.equal(data.bodyMetrics[0]?.weightKg, null);
    assert.equal(data.bodyMetrics[0]?.bodyFatPercent, 16.1);
  });

  test("invalid JSON is retained as a raw recovery copy", () => {
    const storage = new MemoryStorage();
    const repository = new LiftwiseStorageRepository(storage);
    storage.setItem(STORAGE_KEY, "{broken-json");

    const result = repository.load();

    assert.equal(result.status, "corrupt");
    assert.equal(storage.getItem(CORRUPT_STORAGE_KEY), "{broken-json");
  });

  test("invalid structured data is rejected instead of silently rewritten", () => {
    const storage = new MemoryStorage();
    const repository = new LiftwiseStorageRepository(storage);
    const invalid = { ...fixture, schemaVersion: 8 };
    storage.setItem(STORAGE_KEY, JSON.stringify(invalid));

    const result = repository.load();

    assert.equal(result.status, "corrupt");
    assert.match(result.status === "corrupt" ? result.message : "", /validation/i);
  });

  test("treats malformed import undo records as unavailable", () => {
    const storage = new MemoryStorage();
    const repository = new LiftwiseStorageRepository(storage);
    storage.setItem(IMPORT_UNDO_KEY, "{broken");
    assert.equal(repository.hasImportUndo(), false);

    storage.setItem(IMPORT_UNDO_KEY, JSON.stringify({ snapshot: 42 }));
    assert.equal(repository.hasImportUndo(), false);
    assert.throws(() => repository.undoLastImport(), /invalid/i);

    storage.removeItem(IMPORT_UNDO_KEY);
    assert.throws(() => repository.undoLastImport(), /No import undo/i);
  });
});
