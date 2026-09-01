// One-off import of Esmeralda's real Medicine requisition (from the vessel's
// own "26-PC-033-DECK- Medicines.xls" paper form — filed under Deck dept.
// administratively, but every line is Medicine-category). The form's own
// header says "Vessel: PLUMERIA CORAL" / ref "26-PC-033-DECK" (PC = that
// vessel's code) — confirmed with the user this is stale template header
// text and the real recipient is Esmeralda.
//
// Creates a StoresCatalogueItem (category MEDICINE) per line that doesn't
// already exist in Esmeralda's catalogue, then a single Requisition already
// in its real-world final state (SENT_TO_OFFICE — the paper form is already
// signed by Department Head and Master), numbered through the same
// allocateRefNo sequence every other requisition uses.
// Idempotent: refuses to run twice by checking for a prior import via a
// matching Requisition (vessel + category + requestedBy).
// Usage: npx tsx scripts/import-medicine-requisition-esmeralda.ts
import { readFileSync } from "fs";
import { prisma } from "../lib/prisma";

// Inlined copy of lib/ref-sequence.ts's allocateRefNo — that module imports
// "server-only", which errors when required directly under tsx (only meant
// to be bundled by Next.js). Same atomic INSERT ... ON CONFLICT logic.
async function allocateRefNo(companyId: string, prefix: string, pad = 4): Promise<string> {
  const rows = await prisma.$queryRaw<{ seq: number }[]>`
    INSERT INTO "RefSequence" ("companyId", "prefix", "seq")
    VALUES (${companyId}, ${prefix}, 1)
    ON CONFLICT ("companyId", "prefix")
    DO UPDATE SET "seq" = "RefSequence"."seq" + 1
    RETURNING "seq"
  `;
  const seq = rows[0]!.seq;
  return `${prefix}-${String(seq).padStart(pad, "0")}`;
}

const DATA_PATH = __dirname + "/data/esmeralda-medicine-requisition.json";

type ParsedItem = {
  description: string;
  unit: string;
  qtyRequired: number;
  remarks: string | null;
};

type ParsedFile = {
  date: string;
  preparedBy: string;
  items: ParsedItem[];
};

async function main() {
  const company = await prisma.company.findFirst({ where: { code: "SWAN" } });
  if (!company) throw new Error("Company SWAN not found");

  const vessel = await prisma.vessel.findFirst({ where: { companyId: company.id, code: "ESM" } });
  if (!vessel) throw new Error("Vessel ESM (Esmeralda) not found");

  const admin = await prisma.user.findFirst({ where: { companyId: company.id, email: "admin@swanshipping.com" } });
  const actorId = admin?.id ?? null;

  const data: ParsedFile = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
  const requisitionDate = new Date(data.date);

  const already = await prisma.requisition.findFirst({
    where: { companyId: company.id, vesselId: vessel.id, category: "MEDICINE", currentRevision: { requestedBy: data.preparedBy } },
  });
  if (already) {
    console.log("Already imported — found a MEDICINE requisition requested by", data.preparedBy, "- aborting (idempotent).");
    return;
  }

  console.log(`Parsed items: ${data.items.length}`);

  const catalogueItemIds: string[] = [];
  let created = 0;
  for (const item of data.items) {
    const existing = await prisma.storesCatalogueItem.findFirst({
      where: { companyId: company.id, vesselId: vessel.id, category: "MEDICINE", name: item.description },
    });
    if (existing) {
      catalogueItemIds.push(existing.id);
      continue;
    }
    const row = await prisma.storesCatalogueItem.create({
      data: {
        companyId: company.id,
        vesselId: vessel.id,
        impaCode: null,
        name: item.description,
        category: "MEDICINE",
        unit: item.unit,
        subGroup: "Medicine Chest",
        remarks: item.remarks,
        createdBy: actorId,
        updatedBy: actorId,
      },
      select: { id: true },
    });
    catalogueItemIds.push(row.id);
    created++;
  }
  console.log(`Created ${created} new StoresCatalogueItem rows (category MEDICINE); ${data.items.length - created} already existed.`);

  const requisition = await prisma.$transaction(async (tx) => {
    const req = await tx.requisition.create({
      data: {
        companyId: company.id,
        vesselId: vessel.id,
        category: "MEDICINE",
        createdAt: requisitionDate,
        updatedAt: requisitionDate,
        createdBy: actorId,
        updatedBy: actorId,
      },
    });
    const revision = await tx.requisitionRevision.create({
      data: {
        companyId: company.id,
        requisitionId: req.id,
        revisionNo: 1,
        status: "SENT_TO_OFFICE",
        requestedBy: data.preparedBy,
        masterApprovedAt: requisitionDate,
        sentToOfficeAt: requisitionDate,
        createdAt: requisitionDate,
        updatedAt: requisitionDate,
        createdBy: actorId,
        updatedBy: actorId,
      },
    });
    await tx.requisitionLine.createMany({
      data: data.items.map((item, i) => ({
        companyId: company.id,
        revisionId: revision.id,
        itemType: "STORES" as const,
        itemId: catalogueItemIds[i]!,
        qtyRequested: item.qtyRequired,
        robAtRequestTime: 0, // no prior InventoryEvent for Medicine at Esmeralda yet
        createdAt: requisitionDate,
        createdBy: actorId,
      })),
    });
    return tx.requisition.update({ where: { id: req.id }, data: { currentRevisionId: revision.id } });
  });

  const yy = String(requisitionDate.getFullYear()).slice(-2);
  const refNo = await allocateRefNo(company.id, `${vessel.code}-${yy}RQ-MEDICINE`, 3);
  await prisma.requisition.update({ where: { id: requisition.id }, data: { refNo } });

  console.log(`Created Requisition ${refNo} with ${data.items.length} lines, status SENT_TO_OFFICE.`);
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
