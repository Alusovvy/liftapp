import { LiftwiseDataSchema, type LiftwiseData } from "../../domain/models/schema";

export const STORAGE_KEY = "liftwise-data-v1";
export const CORRUPT_STORAGE_KEY = "liftwise-data-corrupt";

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type StorageLoadResult =
  | { status: "empty" }
  | { status: "loaded"; data: LiftwiseData }
  | { status: "corrupt"; raw: string; message: string };

export class LiftwiseStorageRepository {
  constructor(private readonly storage: StoragePort) {}

  load(): StorageLoadResult {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (raw === null) return { status: "empty" };

    try {
      const parsed: unknown = JSON.parse(raw);
      const result = LiftwiseDataSchema.safeParse(parsed);
      if (result.success) return { status: "loaded", data: result.data };
      this.preserveCorrupt(raw);
      return {
        status: "corrupt",
        raw,
        message: `Stored data failed validation: ${result.error.issues[0]?.message ?? "unknown schema error"}`,
      };
    } catch (error) {
      this.preserveCorrupt(raw);
      return {
        status: "corrupt",
        raw,
        message: `Stored data could not be parsed: ${error instanceof Error ? error.message : "unknown JSON error"}`,
      };
    }
  }

  save(data: LiftwiseData): void {
    const validated = LiftwiseDataSchema.parse(data);
    this.storage.setItem(STORAGE_KEY, JSON.stringify(validated));
  }

  export(data: LiftwiseData): string {
    const validated = LiftwiseDataSchema.parse(data);
    return JSON.stringify(validated, null, 2);
  }

  import(raw: string): LiftwiseData {
    const parsed: unknown = JSON.parse(raw);
    return LiftwiseDataSchema.parse(parsed);
  }

  private preserveCorrupt(raw: string): void {
    try {
      this.storage.setItem(CORRUPT_STORAGE_KEY, raw);
    } catch {
      // A failed recovery write must not hide the original validation error.
    }
  }
}
