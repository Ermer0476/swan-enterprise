/**
 * Seeds the initial access levels and departments — and does nothing else.
 *
 * These are the DATA behind the data-driven user-management module: the four
 * levels (superadmin/admin/viewer/guest) and the eight departments (ship:
 * Deck/Engine/Steward; shore: Admin/Ops/Tech/Purch/Acct). Every seeded row is
 * `isSystem: true`, so the UI refuses to delete it — only deactivate a
 * non-system one.
 *
 * Insert-only and idempotent: `update: {}` means a row that already exists is
 * never touched, so a second `--apply` is a no-op and this never overwrites a
 * rank or description an operator has since adjusted in the UI. It assigns
 * these to NO user — mapping each existing account onto a Department row is a
 * separate data step, run deliberately by a human, not here.
 *
 * `npm run db:seed` is forbidden against the live database (it rewrites real
 * rows); this is the insert-only alternative for just these two vocabularies.
 *
 *   npx tsx scripts/seed-access-levels.ts           # dry run, prints the plan
 *   npx tsx scripts/seed-access-levels.ts --apply   # writes
 */
import { PrismaClient, type DepartmentSide } from "../lib/generated/prisma";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// superadmin highest; gaps of 20 leave room for future levels to slot between.
const ACCESS_LEVELS: { name: string; rank: number; description: string }[] = [
  { name: "superadmin", rank: 100, description: "Full, unrestricted platform control" },
  { name: "admin", rank: 80, description: "Administers the platform and its users" },
  { name: "viewer", rank: 40, description: "Read-only access" },
  { name: "guest", rank: 20, description: "Minimal, limited access" },
];

const DEPARTMENTS: { name: string; side: DepartmentSide; description: string }[] = [
  { name: "Deck", side: "SHIP", description: "Deck department (shipboard)" },
  { name: "Engine", side: "SHIP", description: "Engine department (shipboard)" },
  { name: "Steward", side: "SHIP", description: "Steward / catering department (shipboard)" },
  { name: "Admin", side: "SHORE", description: "Administration (shore)" },
  { name: "Ops", side: "SHORE", description: "Operations (shore)" },
  { name: "Tech", side: "SHORE", description: "Technical (shore)" },
  { name: "Purch", side: "SHORE", description: "Purchasing (shore)" },
  { name: "Acct", side: "SHORE", description: "Accounting (shore)" },
];

async function main() {
  console.log(APPLY ? "MODE: apply\n" : "MODE: dry run (pass --apply to write)\n");

  // Which company. Single-tenant in practice but not in the schema, so the
  // company is RESOLVED, never assumed: with more than one, this stops rather
  // than seeding against the wrong tenant — a dry run would not reveal a wrong
  // pick, so the guard is here, not left to the operator.
  const companies = await prisma.company.findMany({ select: { id: true, name: true, code: true } });
  if (companies.length !== 1) {
    console.log(`${companies.length} companies in this database: ${companies.map((c) => c.code).join(", ") || "(none)"}`);
    console.log("Refusing to guess which one these belong to. Nothing was written.");
    process.exitCode = 1;
    return;
  }
  const company = companies[0];
  if (!company) return; // unreachable; satisfies noUncheckedIndexedAccess

  const existingLevels = await prisma.accessLevel.findMany({
    where: { companyId: company.id },
    select: { name: true },
  });
  const existingLevelNames = new Set(existingLevels.map((l) => l.name));
  const existingDepts = await prisma.department.findMany({
    where: { companyId: company.id },
    select: { name: true },
  });
  const existingDeptNames = new Set(existingDepts.map((d) => d.name));

  const levelsToAdd = ACCESS_LEVELS.filter((l) => !existingLevelNames.has(l.name));
  const deptsToAdd = DEPARTMENTS.filter((d) => !existingDeptNames.has(d.name));

  console.log(`Company: ${company.name} (${company.code})\n`);
  console.log(`Access levels — ${levelsToAdd.length} to insert, ${ACCESS_LEVELS.length - levelsToAdd.length} already present:`);
  for (const l of ACCESS_LEVELS) {
    const mark = existingLevelNames.has(l.name) ? "exists" : "NEW";
    console.log(`  [${mark.padEnd(6)}] ${l.name.padEnd(11)} rank ${String(l.rank).padStart(3)}  isSystem  — ${l.description}`);
  }
  console.log(`\nDepartments — ${deptsToAdd.length} to insert, ${DEPARTMENTS.length - deptsToAdd.length} already present:`);
  for (const d of DEPARTMENTS) {
    const mark = existingDeptNames.has(d.name) ? "exists" : "NEW";
    console.log(`  [${mark.padEnd(6)}] ${d.side.padEnd(5)} ${d.name.padEnd(9)} isSystem  — ${d.description}`);
  }

  if (!APPLY) {
    console.log("\nNothing was written. Re-run with --apply.");
    return;
  }

  // Upsert on the (companyId, name) unique key. update: {} never edits an
  // existing row, so this is insert-only and safe to re-run.
  for (const l of ACCESS_LEVELS) {
    await prisma.accessLevel.upsert({
      where: { companyId_name: { companyId: company.id, name: l.name } },
      update: {},
      create: {
        companyId: company.id,
        name: l.name,
        rank: l.rank,
        description: l.description,
        isSystem: true,
      },
    });
  }
  for (const d of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { companyId_name: { companyId: company.id, name: d.name } },
      update: {},
      create: {
        companyId: company.id,
        name: d.name,
        side: d.side,
        description: d.description,
        isSystem: true,
      },
    });
  }

  console.log(`\nInserted ${levelsToAdd.length} access level(s) and ${deptsToAdd.length} department(s). Existing rows were left untouched.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
