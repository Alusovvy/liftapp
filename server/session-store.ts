import session from "express-session";
import type Database from "better-sqlite3";

const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type Callback<T = void> = (error: unknown, result?: T) => void;

// A minimal express-session Store backed by the same SQLite connection as
// the rest of the app, so sessions survive a server restart without pulling
// in a separate community session-store package for a handful of users.
export class SqliteSessionStore extends session.Store {
  constructor(private readonly db: Database.Database) {
    super();
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `);
  }

  override get(sid: string, callback: Callback<session.SessionData | null>): void {
    try {
      const row = this.db
        .prepare("SELECT data, expires_at FROM sessions WHERE sid = ?")
        .get(sid) as { data: string; expires_at: number } | undefined;
      if (!row || row.expires_at < Date.now()) {
        callback(null, null);
        return;
      }
      callback(null, JSON.parse(row.data) as session.SessionData);
    } catch (error) {
      callback(error);
    }
  }

  override set(sid: string, sessionData: session.SessionData, callback?: Callback): void {
    try {
      const maxAge = sessionData.cookie?.maxAge ?? DEFAULT_MAX_AGE_MS;
      const expiresAt = Date.now() + maxAge;
      this.db
        .prepare(
          `INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)
           ON CONFLICT (sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at`,
        )
        .run(sid, JSON.stringify(sessionData), expiresAt);
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  override destroy(sid: string, callback?: Callback): void {
    try {
      this.db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }
}
