// Backfill the office-editable reference lists for every existing company,
// from the registry fallback constants (lib/reference-registry.ts). Each row
// is an upsert keyed on @@unique([companyId, listKey, value]) with update: {},
// so it is idempotent and NEVER rewrites an existing (possibly office-edited)
// row — re-running only fills in rows that are missing. Seeded rows are marked
// isSystem: true. Wrapped in a single transaction so a partial run can't leave
// a company half-populated.
// Usage: npx tsx scripts/backfill-reference-lists.ts
import { prisma } from "../lib/prisma";
import { REFERENCE_REGISTRY, REFERENCE_LIST_KEYS } from "../lib/reference-registry";

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, code: true } });
  console.log(`Backfilling reference lists for ${companies.length} company(ies)…`);

  let upserted = 0;
  await prisma.$transaction(async (tx) => {
    for (const company of companies) {
      for (const listKey of REFERENCE_LIST_KEYS) {
        for (const opt of REFERENCE_REGISTRY[listKey].fallback) {
          await tx.referenceListItem.upsert({
            where: { companyId_listKey_value: { companyId: company.id, listKey, value: opt.value } },
            update: {},
            create: {
              companyId: company.id,
              listKey,
              value: opt.value,
              label: opt.label,
              sortOrder: opt.sortOrder,
              isSystem: true,
            },
          });
          upserted++;
        }
      }
    }
  });

  console.log(`Done. Processed ${upserted} reference-list row(s) across ${companies.length} company(ies).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
