#!/usr/bin/env node
// Deletes the LOCAL D1 database files (.wrangler/state/v3/d1). Never touches remote data.
// Used by `npm run db:reset:local`, which then re-runs migrations, imports and the dev seed.
import { rmSync } from "node:fs";

try {
  rmSync(".wrangler/state/v3/d1", { recursive: true, force: true });
  console.log("reset-local-db: removed local D1 state");
} catch (error) {
  if (error.code === "EBUSY" || error.code === "EPERM") {
    console.error("reset-local-db: the local database is in use. Stop `npm run dev` / `vite preview` and run this again.");
    process.exit(1);
  }
  throw error;
}
