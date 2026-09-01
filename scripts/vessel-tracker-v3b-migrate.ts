// One-off backfill for dropping VoyageLog.routeOrPort (v3b cleanup) — run
// BEFORE `prisma db push` drops the column. Copies the old free-text route
// value into fromPort wherever fromPort is still blank, so historical
// entries keep a route label in list/calendar views via routeLabel().
// Rerunnable safely: only touches rows where fromPort is still null.
// Usage: npx tsx scripts/vessel-tracker-v3b-migrate.ts
import { prisma } from "../lib/prisma";

async function main() {
  const result = await prisma.$executeRawUnsafe(`
    UPDATE "VoyageLog"
    SET "fromPort" = "routeOrPort"
    WHERE "fromPort" IS NULL AND "routeOrPort" IS NOT NULL AND "routeOrPort" != ''
  `);
  console.log(`Backfilled fromPort on ${result} row(s) from routeOrPort.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
