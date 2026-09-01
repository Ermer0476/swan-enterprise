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
 * It ALSO seeds the E3 default access-level permission matrix (grant-only): a
 * starter set of permission grants per level (superadmin → all; admin → all but
 * the privilege-management keys; viewer → every read; guest → a minimal read
 * subset). Insert-only the same way — only missing (level, permission) pairs are
 * added, so a re-run never re-grants and never clobbers the office's own edits.
 *
 * `npm run db:seed` is forbidden against the live database (it rewrites real
 * rows); this is the insert-only alternative for just these two vocabularies.
 *
 *   npx tsx scripts/seed-access-levels.ts           # dry run, prints the plan
 *   npx tsx scripts/seed-access-levels.ts --apply   # writes
 */
import { PrismaClient, type DepartmentSide } from "../lib/generated/prisma";
import { ALL_PERMISSION_KEYS, type PermissionKey } from "../lib/permissions";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// superadmin highest; gaps of 20 leave room for future levels to slot between.
const ACCESS_LEVELS: { name: string; rank: number; description: string }[] = [
  { name: "superadmin", rank: 100, description: "Full, unrestricted platform control" },
  { name: "admin", rank: 80, description: "Administers the platform and its users" },
  { name: "viewer", rank: 40, description: "Read-only access" },
  { name: "guest", rank: 20, description: "Minimal, limited access" },
];

// ─── E3: default access-level permission matrix (grant-only union) ──────────
// A user's EFFECTIVE permissions = union(role permissions, their access level's
// grants below). This table GRANTS; it never subtracts what a role already
// gives. This seeds only a STARTER set per level — the office tunes it in the
// settings UI afterward. Insert-only and idempotent, exactly like the level and
// department seeds above: an already-granted (level, permission) pair is
// skipped (createMany skipDuplicates), never re-inserted, so a second --apply is
// a no-op and a set the office has since edited is never overwritten wholesale.

// Every read-only key in the catalog — what the `viewer` level is granted.
const READ_KEYS: PermissionKey[] = ALL_PERMISSION_KEYS.filter((k) => k.endsWith(":read"));

// The privilege-management keys the `admin` level deliberately does NOT hold —
// creating users, assigning roles, editing workflows, and reshaping the
// access-level / department vocabularies are superadmin-reserved (granting
// these is the exact escalation path E3's no-escalation rule guards). Admin is
// granted everything else in the catalog.
const ADMIN_EXCLUDED: readonly PermissionKey[] = [
  "admin:manage-users",
  "admin:manage-roles",
  "admin:manage-workflows",
  "access-level:manage",
  "department:manage",
];

// A `guest` sees only the most basic, non-sensitive informational reads.
const GUEST_KEYS: PermissionKey[] = ["doc:read", "circular:read", "vessel:read"];

// Keyed by the seeded level NAME (see ACCESS_LEVELS). A name not present as a
// seeded AccessLevel row is skipped with a warning rather than invented.
const PERMISSION_MATRIX: Record<string, PermissionKey[]> = {
  superadmin: [...ALL_PERMISSION_KEYS],
  admin: ALL_PERMISSION_KEYS.filter((k) => !ADMIN_EXCLUDED.includes(k)),
  viewer: [...READ_KEYS],
  guest: [...GUEST_KEYS],
};

/**
 * Resolves the matrix against the live catalog: maps each level's desired keys
 * to permission ids, drops (with a warning) any key not in the Permission table,
 * and diffs against the grants already present so only the missing pairs are
 * inserted. Re-run after the level upserts on --apply so a freshly-created
 * level's id is picked up. `levelId` is null when the named level isn't seeded
 * yet — that row is reported and skipped, never granted against a null id.
 */
async function planMatrix(companyId: string) {
  const perms = await prisma.permission.findMany({ select: { id: true, key: true } });
  const permIdByKey = new Map(perms.map((p) => [p.key, p.id] as const));
  const levels = await prisma.accessLevel.findMany({
    where: { companyId },
    select: { id: true, name: true },
  });
  const levelIdByName = new Map(levels.map((l) => [l.name, l.id] as const));
  const grants = await prisma.accessLevelPermission.findMany({
    where: { accessLevel: { companyId } },
    select: { accessLevelId: true, permissionId: true },
  });
  const grantedByLevel = new Map<string, Set<string>>();
  for (const g of grants) {
    const set = grantedByLevel.get(g.accessLevelId) ?? new Set<string>();
    set.add(g.permissionId);
    grantedByLevel.set(g.accessLevelId, set);
  }

  return Object.entries(PERMISSION_MATRIX).map(([name, keys]) => {
    const levelId = levelIdByName.get(name) ?? null;
    const resolvable = keys.filter((k) => permIdByKey.has(k));
    const missingKeys = keys.filter((k) => !permIdByKey.has(k));
    const granted = levelId ? grantedByLevel.get(levelId) ?? new Set<string>() : new Set<string>();
    const addPairs = levelId
      ? resolvable
          .filter((k) => !granted.has(permIdByKey.get(k) as string))
          .map((k) => ({ accessLevelId: levelId, permissionId: permIdByKey.get(k) as string }))
      : [];
    return {
      name,
      levelId,
      desiredCount: keys.length,
      resolvableCount: resolvable.length,
      alreadyCount: levelId ? resolvable.length - addPairs.length : 0,
      toAddCount: levelId ? addPairs.length : resolvable.length,
      addPairs,
      missingKeys,
    };
  });
}

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

  // E3 permission-matrix plan. Resolved against the live catalog so the counts
  // are the real diff, not the intended set. On a fresh dry run the levels may
  // not exist yet — those rows are flagged and their grants happen on --apply
  // right after the level is created.
  const matrixPlan = await planMatrix(company.id);
  console.log("\nAccess-level permission matrix (grant-only union) — starter grants:");
  for (const p of matrixPlan) {
    const note = p.levelId ? "" : "  (level not seeded yet — granted on apply after it's created)";
    console.log(
      `  ${p.name.padEnd(11)} desired ${String(p.desiredCount).padStart(3)}  present ${String(p.alreadyCount).padStart(3)}  to add ${String(p.toAddCount).padStart(3)}${note}`,
    );
    if (p.missingKeys.length > 0) {
      console.log(`    ! ${p.missingKeys.length} key(s) not in the Permission catalog, skipped: ${p.missingKeys.join(", ")}`);
    }
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

  // E3 matrix grants. Re-plan AFTER the level upserts so a level just created
  // above has an id to grant against, then insert only the missing pairs.
  // createMany skipDuplicates is insert-only and idempotent — an existing grant
  // is never re-inserted, mirroring the upsert(update:{}) doctrine above.
  console.log("\nGranting the default access-level permission matrix:");
  const applyPlan = await planMatrix(company.id);
  let totalGrants = 0;
  for (const p of applyPlan) {
    if (!p.levelId) {
      console.log(`  ${p.name.padEnd(11)} skipped — level not seeded`);
      continue;
    }
    if (p.addPairs.length === 0) {
      console.log(`  ${p.name.padEnd(11)} 0 granted (already complete, ${p.alreadyCount} present)`);
      continue;
    }
    const res = await prisma.accessLevelPermission.createMany({
      data: p.addPairs,
      skipDuplicates: true,
    });
    totalGrants += res.count;
    console.log(`  ${p.name.padEnd(11)} ${res.count} permission(s) granted`);
  }
  console.log(`\nGranted ${totalGrants} access-level permission(s) total. Existing grants were left untouched.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
