import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import request from "supertest";
import fixture from "./fixtures/current-data-v9.json";
import { app } from "../server/app";
import { db } from "../server/db";
import { hashPassword } from "../server/auth";

const hevyCsv = readFileSync("test/fixtures/hevy-workouts.csv", "utf8");
const fitatuCsv = readFileSync("test/fixtures/fitatu-meal-plan.csv", "utf8");

async function createTestUser(username: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(
    username,
    passwordHash,
  );
}

test("unauthenticated requests to protected routes are rejected", async () => {
  await request(app).get("/api/data").expect(401);
  await request(app).get("/api/session").expect(200, { authenticated: false });
});

test("login rejects an unknown user or wrong password, and accepts the right one", async () => {
  await createTestUser("alex", "correct-horse-battery");

  await request(app)
    .post("/api/login")
    .send({ username: "nobody", password: "correct-horse-battery" })
    .expect(401);
  await request(app)
    .post("/api/login")
    .send({ username: "alex", password: "wrong-password" })
    .expect(401);

  const agent = request.agent(app);
  await agent
    .post("/api/login")
    .send({ username: "alex", password: "correct-horse-battery" })
    .expect(200, { username: "alex" });
  await agent.get("/api/session").expect(200, { authenticated: true, username: "alex" });

  await agent.post("/api/logout").expect(204);
  await agent.get("/api/session").expect(200, { authenticated: false });
  await agent.get("/api/data").expect(401);
});

test("the API round-trips data, imports, undo, and backup restore against SQLite", async () => {
  await createTestUser("jordan", "correct-horse-battery");
  const agent = request.agent(app);
  await agent
    .post("/api/login")
    .send({ username: "jordan", password: "correct-horse-battery" })
    .expect(200);

  await agent.get("/api/data").expect(404);

  await agent
    .post("/api/import/workout/preview")
    .send({ csv: hevyCsv, fileName: "hevy-workouts.csv", mode: "merge" })
    .expect(400);

  await agent.put("/api/data").send(fixture).expect(204);

  const loaded = await agent.get("/api/data").expect(200);
  assert.equal(loaded.body.workouts.length, 1);
  assert.equal(loaded.body.profile.name, "Fixture athlete");

  const exported = await agent.get("/api/backup/export").expect(200);
  assert.equal(exported.body.schemaVersion, 9);

  const preview = await agent
    .post("/api/import/workout/preview")
    .send({ csv: hevyCsv, fileName: "hevy-workouts.csv", mode: "merge" })
    .expect(200);
  assert.equal(preview.body.plan.counts.added, 1);

  await agent.get("/api/import/undo-available").expect(200, { available: false });

  const committed = await agent
    .post("/api/import/workout/commit")
    .send({
      csv: hevyCsv,
      fileName: "hevy-workouts.csv",
      mode: "merge",
      acceptValidRowsOnly: false,
    })
    .expect(200);
  assert.equal(committed.body.counts.added, 1);

  const afterCommit = await agent.get("/api/data").expect(200);
  assert.equal(afterCommit.body.workouts.length, 2);

  await agent.get("/api/import/undo-available").expect(200, { available: true });

  const undone = await agent.post("/api/import/undo").expect(200);
  assert.equal(undone.body.workouts.length, 1);

  await agent.get("/api/import/undo-available").expect(200, { available: false });

  const fitatuPreview = await agent
    .post("/api/import/fitatu/preview")
    .send({ csv: fitatuCsv, fileName: "fitatu-meal-plan.csv", mode: "merge" })
    .expect(200);
  assert.equal(fitatuPreview.body.pending.days.length, 2);
  assert.equal(fitatuPreview.body.plan.counts.added, 2);

  const restored = await agent.post("/api/backup/restore").send(fixture).expect(200);
  assert.equal(restored.body.workouts.length, 1);
});

test("PUT /api/data rejects data that fails schema validation", async () => {
  await createTestUser("sam", "correct-horse-battery");
  const agent = request.agent(app);
  await agent.post("/api/login").send({ username: "sam", password: "correct-horse-battery" });

  await agent.put("/api/data").send({ not: "valid" }).expect(400);
});

test("requests are logged to request_logs with method, path, status, and the signed-in user", async () => {
  await createTestUser("drew", "correct-horse-battery");
  const agent = request.agent(app);

  type LogRow = { method: string; path: string; status: number; user_id: number | null };
  const maxLogId = () =>
    (db.prepare("SELECT MAX(id) AS id FROM request_logs").get() as { id: number | null }).id ?? 0;
  // Other tests in this file hit the same paths, so scope each lookup to
  // rows created after this specific action instead of matching on path
  // alone.
  const nextLogAfter = (sinceId: number, path: string) =>
    db
      .prepare(
        "SELECT method, path, status, user_id FROM request_logs WHERE id > ? AND path = ? ORDER BY id ASC LIMIT 1",
      )
      .get(sinceId, path) as LogRow | undefined;

  const beforeAnonymous = maxLogId();
  await request(app).get("/api/data").expect(401);
  await expect
    .poll(() => nextLogAfter(beforeAnonymous, "/api/data"))
    .toMatchObject({ method: "GET", path: "/api/data", status: 401, user_id: null });

  const beforeLogin = maxLogId();
  await agent.post("/api/login").send({ username: "drew", password: "correct-horse-battery" });
  await expect
    .poll(() => nextLogAfter(beforeLogin, "/api/login"))
    .toMatchObject({ method: "POST", path: "/api/login", status: 200 });

  const beforeSession = maxLogId();
  await agent.get("/api/session");
  await expect
    .poll(() => nextLogAfter(beforeSession, "/api/session"))
    .toMatchObject({ status: 200 });
  const sessionLog = nextLogAfter(beforeSession, "/api/session");
  assert.notEqual(sessionLog?.user_id, null);
});

test("two users' data stays isolated from each other", async () => {
  await createTestUser("riley", "correct-horse-battery");
  await createTestUser("casey", "correct-horse-battery");

  const riley = request.agent(app);
  await riley.post("/api/login").send({ username: "riley", password: "correct-horse-battery" });
  await riley.put("/api/data").send(fixture).expect(204);

  const casey = request.agent(app);
  await casey.post("/api/login").send({ username: "casey", password: "correct-horse-battery" });
  await casey.get("/api/data").expect(404);
});
