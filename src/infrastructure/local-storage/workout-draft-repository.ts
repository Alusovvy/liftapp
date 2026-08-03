import {
  ActiveWorkoutDraftSchema,
  type ActiveWorkoutDraft,
} from "../../domain/workout/active-workout";
import type { StoragePort } from "./storage-repository";

export const ACTIVE_WORKOUT_DRAFT_KEY = "liftwise-active-workout-v1";
export const CORRUPT_WORKOUT_DRAFT_KEY = "liftwise-active-workout-corrupt";

export type WorkoutDraftLoadResult =
  | { status: "empty" }
  | { status: "loaded"; draft: ActiveWorkoutDraft }
  | { status: "corrupt"; message: string };

export class WorkoutDraftRepository {
  constructor(private readonly storage: StoragePort) {}

  load(): WorkoutDraftLoadResult {
    const raw = this.storage.getItem(ACTIVE_WORKOUT_DRAFT_KEY);
    if (raw === null) return { status: "empty" };
    try {
      const parsed: unknown = JSON.parse(raw);
      const result = ActiveWorkoutDraftSchema.safeParse(parsed);
      if (result.success) return { status: "loaded", draft: result.data };
      this.preserveCorrupt(raw);
      return {
        status: "corrupt",
        message: `The workout draft failed validation: ${result.error.issues[0]?.message ?? "unknown schema error"}`,
      };
    } catch (error) {
      this.preserveCorrupt(raw);
      return {
        status: "corrupt",
        message: `The workout draft could not be parsed: ${error instanceof Error ? error.message : "unknown JSON error"}`,
      };
    }
  }

  save(draft: ActiveWorkoutDraft): void {
    const validated = ActiveWorkoutDraftSchema.parse(draft);
    this.storage.setItem(ACTIVE_WORKOUT_DRAFT_KEY, JSON.stringify(validated));
  }

  clear(): void {
    this.storage.removeItem(ACTIVE_WORKOUT_DRAFT_KEY);
  }

  private preserveCorrupt(raw: string): void {
    try {
      this.storage.setItem(CORRUPT_WORKOUT_DRAFT_KEY, raw);
      this.storage.removeItem(ACTIVE_WORKOUT_DRAFT_KEY);
    } catch {
      // Keep the main application available even when draft recovery storage fails.
    }
  }
}
