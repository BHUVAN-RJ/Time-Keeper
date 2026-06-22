#!/usr/bin/env node
/**
 * Load key=value env file (handles quoted values) then run drizzle-kit migrate.
 * Usage: node scripts/migrate-env.mjs .env.production
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const envFile = process.argv[2] ?? ".env.local";
const envPath = path.resolve(process.cwd(), envFile);
if (!fs.existsSync(envPath)) {
  console.error(`Missing env file: ${envPath}`);
  process.exit(1);
}

for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  process.env[m[1]] = v;
}

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN required in env file");
  process.exit(1);
}

execSync("npx drizzle-kit migrate", { stdio: "inherit", env: process.env });
