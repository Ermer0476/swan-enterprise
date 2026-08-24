// One-off backfill for Vessel Tracker v3 — run BEFORE `prisma db push` drops
// the old Boiler/M.E./A.E. FO/DO fields and the duplicate steamingDistanceNm
// column. Rerunnable safely: the UPDATE only touches rows where the new
// column is still null. Usage: npx tsx scripts/vessel-tracker-v3-migrate.ts
import { prisma } from "../lib/prisma";

async function main() {
  const result = await prisma.$executeRawUnsafe(`
    UPDATE "VoyageLog"
    SET "distanceRunNm" = "steamingDistanceNm"
    WHERE "distanceRunNm" IS NULL AND "steamingDistanceNm" IS NOT NULL
  `);
  console.log(`Backfilled distanceRunNm on ${result} row(s) from steamingDistanceNm.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
