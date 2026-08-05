import argon2 from "argon2";
import type { NextFunction, Request, Response } from "express";
import { db } from "./db";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    username?: string;
  }
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export type UserRow = { id: number; username: string; password_hash: string };

export function findUserByUsername(username: string): UserRow | undefined {
  return db
    .prepare("SELECT id, username, password_hash FROM users WHERE username = ?")
    .get(username) as UserRow | undefined;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  next();
}
