#!/usr/bin/env node
// Grants (or revokes) application access for one faculty directory profile.
//
//   node scripts/grant-faculty-access.mjs --key sadiq-ali-khan --email msakhan@uok.edu.pk --out .wrangler/seed/access.sql
//   npx wrangler d1 execute attendance-db --remote --file .wrangler/seed/access.sql
//
//   node scripts/grant-faculty-access.mjs --key sadiq-ali-khan --revoke --out .wrangler/seed/access.sql
//
// Granting creates a login account with a random one-time password, prints it once to
// this terminal, and links the account to the profile. Share it with the person through
// a private channel and delete the generated .sql file afterwards. Only run this for
// people who have been authorised to use the system.

import { pbkdf2Sync, randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const PBKDF2_ITERATIONS = 100_000; // Must match worker/lib/password.ts.

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const key = flag("--key");
const email = flag("--email")?.trim().toLowerCase();
const outPath = flag("--out");
const revoke = args.includes("--revoke");

function fail(message) {
  console.error(`grant-faculty-access: ${message}`);
  process.exit(1);
}

if (!key || !outPath || (!revoke && !email)) {
  fail("usage: --key <directory key> (--email <login email> | --revoke) --out <file.sql>");
}
if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(`invalid email "${email}"`);

const sql = (v) => `'${String(v).replaceAll("'", "''")}'`;
let statements;

if (revoke) {
  // Disables the linked account; the profile and its teaching history are kept.
  statements = [
    `UPDATE users SET status = 'disabled' WHERE id = (SELECT user_id FROM faculty WHERE directory_key = ${sql(key)});`,
    `DELETE FROM sessions WHERE user_id = (SELECT user_id FROM faculty WHERE directory_key = ${sql(key)});`,
  ];
} else {
  // 18 random bytes -> 24 URL-safe characters.
  const password = randomBytes(18).toString("base64url");
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, "sha256");
  const passwordHash = `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${salt.toString("base64")}$${hash.toString("base64")}`;
  statements = [
    // Fails (UNIQUE) if the email is already used by another account, so nothing is overwritten.
    `INSERT INTO users (email, password_hash, role, status) VALUES (${sql(email)}, ${sql(passwordHash)}, 'faculty', 'active');`,
    // Only links a profile that exists and has no account yet.
    `UPDATE faculty SET user_id = (SELECT id FROM users WHERE email = ${sql(email)}), status = 'active'
       WHERE directory_key = ${sql(key)} AND user_id IS NULL;`,
  ];
  console.log(`One-time password for ${email}: ${password}`);
  console.log("It is shown only once and is not stored anywhere in plain text.");
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, statements.join("\n") + "\n");
console.log(`grant-faculty-access: wrote ${outPath}. Check that the UPDATE affected 1 row after running it.`);
