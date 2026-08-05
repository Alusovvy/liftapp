import type { NextFunction, Request, Response } from "express";
import { db } from "./db";

const insertLog = db.prepare(
  `INSERT INTO request_logs (method, path, status, duration_ms, user_id, ip)
   VALUES (?, ?, ?, ?, ?, ?)`,
);

// Metadata only - method, path, status, timing, the signed-in user (if any),
// and IP. Never request/response bodies, so login passwords and workout
// data never reach this table.
export function trafficLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();
  // Capture everything up front: app.use("/api", requireAuth) further down
  // the chain temporarily rewrites req.url for its own sub-chain, so
  // req.path read later inside the async "finish" handler can no longer be
  // trusted to reflect the original request path.
  const method = req.method;
  const path = req.path;
  const ip = req.ip ?? null;
  res.on("finish", () => {
    insertLog.run(
      method,
      path,
      res.statusCode,
      Date.now() - startedAt,
      req.session?.userId ?? null,
      ip,
    );
  });
  next();
}
