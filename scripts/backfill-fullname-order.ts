// One-time backfill: recompute every existing user's stored `fullName` with the
// new NATURAL-order composeFullName() ("First Middle Last") so rows saved under
// the old "LAST, FIRST MIDDLE" rule catch up. Uses the SAME shared helper the
// actions use, so this can never spell a name differently from a future save.
//
// SAFE BY DESIGN:
//   • Dry-run by default — prints what WOULD change and touches nothing.
//     Pass `--apply` to actually write.
//   • Idempotent — re-running only updates rows whose composed name still
//     differs; a second `--apply` run reports 0 updated.
//   • Only rows with at least one non-empty name part are considered, and a row
//     is rewritten ONLY when the freshly composed name differs from the stored
//     one. Accounts with NO name parts (a stored fullName only — e.g. the
//     seeded ship accounts "Diamond Coral", "Capt. Eduardo Villanueva") make
//     composeFullName() return null and are LEFT UNTOUCHED.
//   • Company-scoped and deletedAt:null, honouring the multi-tenant + soft-
//     delete doctrine used everywhere else.
//
// Take a backup FIRST (PG15 tooling), then:
//   npx tsx scripts/backfill-fullname-order.ts            # dry run (default)
//   npx tsx scripts/backfill-fullname-order.ts --apply    # write changes
import { prisma } from "../lib/prisma";
import { composeFullName } from "../features/users/schema";

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(
    apply
      ? "APPLY mode — changes WILL be written.\n"
      : "DRY RUN — no changes written. Re-run with --apply to write.\n",
  );

  const companies = await prisma.company.findMany({ select: { id: true, code: true } });
  console.log(`Scanning ${companies.length} company(ies)…\n`);

  let considered = 0;
  let updated = 0;
  let unchanged = 0;

  for (const company of companies) {
    const users = await prisma.user.findMany({
      where: {
        companyId: company.id,
        deletedAt: null,
        // At least one name part present (non-null). Empty/whitespace-only
        // parts still get filtered out by composeFullName below.
        OR: [
          { firstName: { not: null } },
          { middleName: { not: null } },
          { lastName: { not: null } },
        ],
      },
      select: {
        id: true,
        email: true,
        employeeId: true,
        fullName: true,
        firstName: true,
        middleName: true,
        lastName: true,
      },
    });

    for (const user of users) {
      considered++;
      const label = user.employeeId ?? user.email;
      const next = composeFullName(user);

      // No usable name part (all blank/whitespace) → helper returns null →
      // never overwrite the stored fullName. Also skip when the composed name
      // already matches what's stored.
      if (next === null || next === user.fullName) {
        unchanged++;
        console.log(`  unchanged  ${label}  (${user.fullName})`);
        continue;
      }

      updated++;
      console.log(`  UPDATE     ${label}  "${user.fullName}" -> "${next}"`);
      if (apply) {
        await prisma.user.update({
          where: { id: user.id },
          data: { fullName: next },
        });
      }
    }
  }

  console.log(
    `\nDone. Considered ${considered} row(s): ${updated} ${apply ? "updated" : "would update"}, ${unchanged} unchanged/skipped.`,
  );
  if (!apply && updated > 0) {
    console.log("Re-run with --apply to write these changes.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
