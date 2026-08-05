// Invite-only account provisioning: run this to create or reset a friend's
// login. There is no public signup route.
//
//   npx tsx server/scripts/create-user.ts <username> <password>
import { db } from "../db";
import { hashPassword } from "../auth";

async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.error("Usage: npx tsx server/scripts/create-user.ts <username> <password>");
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error("Use a password of at least 8 characters.");
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(password);
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as
    { id: number } | undefined;

  if (existing) {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, existing.id);
    console.log(`Updated password for existing user "${username}" (id ${existing.id}).`);
  } else {
    const inserted = db
      .prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
      .run(username, passwordHash);
    console.log(`Created user "${username}" (id ${inserted.lastInsertRowid}).`);
  }
}

main();
