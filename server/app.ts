import express, { type NextFunction, type Request, type Response } from "express";
import session from "express-session";
import { db } from "./db";
import { SqliteSessionStore } from "./session-store";
import { trafficLogger } from "./traffic-log";
import { findUserByUsername, hashPassword, requireAuth, verifyPassword } from "./auth";
import { SqliteUserStoragePort } from "./storage-port";
import { LiftwiseStorageRepository } from "../src/infrastructure/local-storage/storage-repository";
import { calculateWeeklyDose } from "../src/domain/coaching/weekly-dose";
import { mondayKey, nextMondayKey } from "../src/domain/dates";
import { EXERCISE_CATALOG } from "../src/domain/exercises/catalog";
import { MUSCLES, type LiftwiseData } from "../src/domain/models/schema";
import {
  buildFitatuImportPlan,
  commitFitatuImport,
  parseFitatuCsv,
  type FitatuImportMode,
} from "../src/domain/import/fitatu-import";
import {
  buildWorkoutImportPlan,
  commitWorkoutImport,
  parseWorkoutCsv,
} from "../src/domain/import/workout-import";

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET must be set in production.");
}

const app = express();
app.use(express.json({ limit: "15mb" }));
app.use(
  session({
    store: new SqliteSessionStore(db),
    secret: sessionSecret ?? "dev-only-secret-do-not-use-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  }),
);
app.set("trust proxy", process.env.TRUST_PROXY === "1");
app.use(trafficLogger);

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  const user = username ? findUserByUsername(username) : undefined;
  if (!user || !password || !(await verifyPassword(user.password_hash, password))) {
    res.status(401).json({ error: "Incorrect username or password." });
    return;
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  res.json({ username: user.username });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      res.status(500).json({ error: "Could not sign out." });
      return;
    }
    res.status(204).end();
  });
});

app.get("/api/session", (req, res) => {
  if (req.session.userId) {
    res.json({ authenticated: true, username: req.session.username });
    return;
  }
  res.json({ authenticated: false });
});

// Test-only user provisioning for the Playwright e2e suite, which needs a
// real HTTP-only way to create a fresh account per test (there is no public
// signup route by design). Disabled unless explicitly opted into, never in
// production.
if (process.env.ALLOW_TEST_ENDPOINTS === "1" && process.env.NODE_ENV !== "production") {
  app.post("/api/test/create-user", async (req, res) => {
    const { username, password } = req.body as { username: string; password: string };
    const passwordHash = await hashPassword(password);
    db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(
      username,
      passwordHash,
    );
    res.status(204).end();
  });
}

app.use("/api", requireAuth);

function currentRepository(req: Request): LiftwiseStorageRepository {
  const userId = req.session.userId;
  if (!userId) throw new Error("Not authenticated.");
  return new LiftwiseStorageRepository(new SqliteUserStoragePort(db, userId));
}

function requireCurrentData(repository: LiftwiseStorageRepository): LiftwiseData {
  const result = repository.load();
  if (result.status !== "loaded") {
    throw new Error("No data has been saved yet. Save a profile before importing.");
  }
  return result.data;
}

app.get("/api/data", (req, res) => {
  const repository = currentRepository(req);
  const result = repository.load();
  if (result.status === "empty") {
    res.status(404).json({ error: "No data has been saved yet." });
    return;
  }
  if (result.status === "corrupt") {
    res.status(409).json({ error: result.message, raw: result.raw });
    return;
  }
  res.json(result.data);
});

// Every account can see every other account's current-week comparison
// stats - this is a small trusted friend group with no per-friend sharing
// controls (see PRODUCT_TRANSFORMATION_PLAN.md / plan Stage 4 assumption).
app.get("/api/compare", (_req, res) => {
  const now = new Date();
  const weekStart = mondayKey(now);
  const weekEnd = nextMondayKey(now);
  const users = db.prepare("SELECT id, username FROM users ORDER BY username").all() as Array<{
    id: number;
    username: string;
  }>;

  const rows = users.map((user) => {
    const repository = new LiftwiseStorageRepository(new SqliteUserStoragePort(db, user.id));
    const result = repository.load();
    if (result.status !== "loaded") {
      return {
        username: user.username,
        sessions: 0,
        doses: Object.fromEntries(MUSCLES.map((muscle) => [muscle, 0])),
      };
    }
    const weekWorkouts = result.data.workouts.filter(
      (workout) => workout.date >= weekStart && workout.date < weekEnd,
    );
    const mappings = [
      ...EXERCISE_CATALOG.map(({ id, primary, secondary }) => ({ id, primary, secondary })),
      ...result.data.customExercises.map(({ id, primary, secondary }) => ({
        id,
        primary,
        secondary,
      })),
    ];
    const doses = calculateWeeklyDose(weekWorkouts, mappings);
    return { username: user.username, sessions: weekWorkouts.length, doses };
  });

  res.json({ weekStart, weekEnd, rows });
});

app.put("/api/data", (req, res) => {
  const repository = currentRepository(req);
  repository.save(req.body as LiftwiseData);
  res.status(204).end();
});

// The browser client parses/diffs/commits CSV imports locally (pure,
// already-tested domain functions - see src/domain/import/*) against the
// data it already fetched, then hands the result here to persist with an
// undo snapshot. The CSV-specific /api/import/*/preview and /commit routes
// below are a separate, complete server-side import API for non-browser
// callers; the browser client does not use them.
app.post("/api/data/import-snapshot", (req, res) => {
  const { data, previousData, batchId } = req.body as {
    data: LiftwiseData;
    previousData: LiftwiseData;
    batchId: string;
  };
  const repository = currentRepository(req);
  repository.saveWithImportUndo(data, previousData, batchId);
  res.status(204).end();
});

app.get("/api/backup/export", (req, res) => {
  const repository = currentRepository(req);
  const result = repository.load();
  if (result.status !== "loaded") {
    res.status(404).json({ error: "No data has been saved yet." });
    return;
  }
  res.type("application/json").send(repository.export(result.data));
});

app.post("/api/backup/restore", (req, res) => {
  const repository = currentRepository(req);
  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  const restored = repository.import(raw);
  repository.save(restored);
  res.json(restored);
});

app.get("/api/import/undo-available", (req, res) => {
  res.json({ available: currentRepository(req).hasImportUndo() });
});

app.post("/api/import/undo", (req, res) => {
  const repository = currentRepository(req);
  const restored = repository.undoLastImport();
  res.json(restored);
});

app.post("/api/import/workout/preview", (req, res) => {
  const { csv, fileName, mode } = req.body as { csv: string; fileName: string; mode: string };
  const repository = currentRepository(req);
  const data = requireCurrentData(repository);
  const pending = parseWorkoutCsv(csv, fileName);
  const plan = buildWorkoutImportPlan(data, pending, mode as "merge" | "replace");
  res.json({ pending, plan });
});

app.post("/api/import/workout/commit", (req, res) => {
  const { csv, fileName, mode, acceptValidRowsOnly } = req.body as {
    csv: string;
    fileName: string;
    mode: "merge" | "replace";
    acceptValidRowsOnly: boolean;
  };
  const repository = currentRepository(req);
  const data = requireCurrentData(repository);
  const pending = parseWorkoutCsv(csv, fileName);
  const committed = commitWorkoutImport({ data, pending, mode, acceptValidRowsOnly });
  repository.saveWithImportUndo(committed.data, committed.previousData, committed.batchId);
  res.json({ counts: committed.counts, batchId: committed.batchId });
});

app.post("/api/import/fitatu/preview", (req, res) => {
  const { csv, fileName, mode } = req.body as { csv: string; fileName: string; mode: string };
  const repository = currentRepository(req);
  const data = requireCurrentData(repository);
  const pending = parseFitatuCsv(csv, fileName);
  const plan = buildFitatuImportPlan(data, pending, mode as FitatuImportMode);
  res.json({ pending, plan });
});

app.post("/api/import/fitatu/commit", (req, res) => {
  const { csv, fileName, mode, acceptValidRowsOnly } = req.body as {
    csv: string;
    fileName: string;
    mode: FitatuImportMode;
    acceptValidRowsOnly: boolean;
  };
  const repository = currentRepository(req);
  const data = requireCurrentData(repository);
  const pending = parseFitatuCsv(csv, fileName);
  const committed = commitFitatuImport({ data, pending, mode, acceptValidRowsOnly });
  repository.saveWithImportUndo(committed.data, committed.previousData, committed.batchId);
  res.json({ counts: committed.counts, batchId: committed.batchId });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express identifies error handlers by arity (4 params).
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown server error.";
  res.status(400).json({ error: message });
});

export { app };
