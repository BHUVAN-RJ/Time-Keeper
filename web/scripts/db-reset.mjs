/**
 * Wipes every application table and re-applies Drizzle migrations.
 * Requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the environment.
 */
import { createClient } from "@libsql/client";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error(
    "Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN. Load web/.env.local first.",
  );
  process.exit(1);
}

const client = createClient({ url, authToken });
const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

async function reset() {
  await client.execute("PRAGMA foreign_keys = OFF");

  const { rows } = await client.execute(
    `SELECT name FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
  );

  for (const row of rows) {
    const name = String(row.name);
    await client.execute(`DROP TABLE IF EXISTS "${name.replace(/"/g, '""')}"`);
    console.log(`Dropped table: ${name}`);
  }

  await client.execute("PRAGMA foreign_keys = ON");

  console.log("\nRe-applying migrations…");
  execSync("npm run db:migrate", {
    cwd: webRoot,
    stdio: "inherit",
    env: process.env,
  });

  console.log("\nDatabase reset complete (empty schema, no rows).");
}

reset().catch((err) => {
  console.error(err);
  process.exit(1);
});
