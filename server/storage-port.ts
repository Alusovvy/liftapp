import type Database from "better-sqlite3";
import type { StoragePort } from "../src/infrastructure/local-storage/storage-repository";

// Mirrors the localStorage-shaped StoragePort the client already uses, so
// LiftwiseStorageRepository (src/infrastructure/local-storage/storage-repository.ts)
// runs unchanged on the server: one row per (user, key) in place of one
// browser's localStorage entries.
export class SqliteUserStoragePort implements StoragePort {
  constructor(
    private readonly db: Database.Database,
    private readonly userId: number,
  ) {}

  getItem(key: string): string | null {
    const row = this.db
      .prepare("SELECT value FROM kv_store WHERE user_id = ? AND key = ?")
      .get(this.userId, key) as { value: string } | undefined;
    return row ? row.value : null;
  }

  setItem(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO kv_store (user_id, key, value, updated_at)
         VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT (user_id, key)
         DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(this.userId, key, value);
  }

  removeItem(key: string): void {
    this.db.prepare("DELETE FROM kv_store WHERE user_id = ? AND key = ?").run(this.userId, key);
  }
}
