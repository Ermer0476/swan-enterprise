// Local dev-only: boots a real embedded PostgreSQL on :5432 with
// postgres/postgres and a `swan_enterprise` database, matching .env.
// Keeps running so the server stays up. NOT for production.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const DATA_DIR =
  process.env.PGDATA_DIR ||
  "/private/tmp/claude-501/-Users-ermermagbanua-Documents-My-FIle-Claude-Project-Folder/73c5605b-8ab7-484d-8195-4b091af8a575/scratchpad/pgdata";

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: "postgres",
  password: "postgres",
  port: 5432,
  persistent: true,
});

const initialised = existsSync(path.join(DATA_DIR, "PG_VERSION"));

if (!initialised) {
  console.log("[pg] initialising cluster…");
  await pg.initialise();
}
console.log("[pg] starting…");
await pg.start();

try {
  await pg.createDatabase("swan_enterprise");
  console.log("[pg] created database swan_enterprise");
} catch {
  console.log("[pg] database swan_enterprise already exists");
}

console.log("[pg] READY on postgres://postgres:postgres@localhost:5432/swan_enterprise");

// Keep the process (and postmaster) alive.
setInterval(() => {}, 1 << 30);

async function shutdown() {
  try {
    await pg.stop();
  } catch {}
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
