// One-off import of Esmeralda's real Deck Inventory (from the vessel's own
// "DECK INVENTORY - 23 JUNE 2026.xls" report) into the Procurement module.
// Source workbook was parsed offline into scripts/data/deck-inventory-esmeralda.json
// (one row per physical item, grouped by Location + Sub-Group, matching the
// real form's structure — see features/procurement schema comments).
//
// This creates a StoresCatalogueItem (category DECK) per parsed row, then
// replaces Esmeralda's existing (test/placeholder) Opening Stock Take with
// one built from the real counted quantities, split by condition
// (New/Usable/Reconditioned). Idempotent: refuses to run twice by checking
// for a prior import via InventoryEvent.sourceType.
// Usage: npx tsx scripts/import-deck-inventory-esmeralda.ts
import { readFileSync } from "fs";
import { prisma } from "../lib/prisma";

const DATA_PATH = __dirname + "/data/deck-inventory-esmeralda.json";
const IMPORT_SOURCE_TYPE = "DECK_INVENTORY_IMPORT_2026_06_23";
const COUNT_DATE = new Date("2026-06-23T00:00:00.000Z");

type ParsedRow = {
  sheet: string;
  location: string;
  subGroup: string | null;
  itemCode: string;
  description: string;
  unit: string;
  qtyNew: number;
  qtyUsable: number;
  qtyReconditioned: number;
  remarks: string | null;
};

async function main() {
  const company = await prisma.company.findFirst({ where: { code: "SWAN" } });
  if (!company) throw new Error("Company SWAN not found");

  const vessel = await prisma.vessel.findFirst({ where: { companyId: company.id, code: "ESM" } });
  if (!vessel) throw new Error("Vessel ESM (Esmeralda) not found");

  const admin = await prisma.user.findFirst({ where: { companyId: company.id, email: "admin@swanshipping.com" } });
  const actorId = admin?.id ?? null;

  const already = await prisma.inventoryEvent.findFirst({
    where: { companyId: company.id, vesselId: vessel.id, sourceType: IMPORT_SOURCE_TYPE },
  });
  if (already) {
    console.log("Already imported — found an InventoryEvent tagged", IMPORT_SOURCE_TYPE, "- aborting (idempotent).");
    return;
  }

  const rows: ParsedRow[] = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
  console.log(`Parsed rows: ${rows.length}`);

  // Reset Esmeralda's existing (placeholder/test) Opening Stock Take, if any,
  // so the real count becomes the vessel's one true opening balance.
  const existingStockTake = await prisma.openingStockTake.findFirst({ where: { companyId: company.id, vesselId: vessel.id } });
  if (existingStockTake) {
    await prisma.inventoryEvent.deleteMany({ where: { companyId: company.id, vesselId: vessel.id, openingStockTakeId: existingStockTake.id } });
    await prisma.openingStockTake.delete({ where: { id: existingStockTake.id } });
    console.log("Cleared previous (placeholder) Opening Stock Take for Esmeralda.");
  }

  const stockTake = await prisma.openingStockTake.create({
    data: {
      companyId: company.id,
      vesselId: vessel.id,
      status: "POSTED",
      postedAt: COUNT_DATE,
      postedBy: actorId,
      createdBy: actorId,
      updatedBy: actorId,
    },
  });

  const catalogueItemIds: string[] = [];
  let created = 0;
  for (const row of rows) {
    const item = await prisma.storesCatalogueItem.create({
      data: {
        companyId: company.id,
        vesselId: vessel.id,
        impaCode: null,
        name: row.description,
        category: "DECK",
        unit: row.unit,
        subGroup: row.subGroup,
        remarks: row.remarks,
        createdBy: actorId,
        updatedBy: actorId,
      },
      select: { id: true },
    });
    catalogueItemIds.push(item.id);
    created++;
    if (created % 200 === 0) console.log(`  ...${created} catalogue items created`);
  }
  console.log(`Created ${created} StoresCatalogueItem rows (category DECK).`);

  const eventRows: {
    companyId: string;
    vesselId: string;
    itemType: "STORES";
    itemId: string;
    eventType: "OPENING";
    condition: "NEW" | "USABLE" | "RECONDITIONED";
    quantity: number;
    location: string;
    sourceType: string;
    sourceId: string;
    occurredAt: Date;
    openingStockTakeId: string;
    createdBy: string | null;
  }[] = [];

  rows.forEach((row, i) => {
    const itemId = catalogueItemIds[i];
    if (!itemId) return;
    const conditions: [number, "NEW" | "USABLE" | "RECONDITIONED"][] = [
      [row.qtyNew, "NEW"],
      [row.qtyUsable, "USABLE"],
      [row.qtyReconditioned, "RECONDITIONED"],
    ];
    for (const [qty, condition] of conditions) {
      if (qty > 0) {
        eventRows.push({
          companyId: company.id,
          vesselId: vessel.id,
          itemType: "STORES",
          itemId,
          eventType: "OPENING",
          condition,
          quantity: qty,
          location: row.location,
          sourceType: IMPORT_SOURCE_TYPE,
          sourceId: stockTake.id,
          occurredAt: COUNT_DATE,
          openingStockTakeId: stockTake.id,
          createdBy: actorId,
        });
      }
    }
  });

  await prisma.inventoryEvent.createMany({ data: eventRows });
  console.log(`Created ${eventRows.length} InventoryEvent OPENING rows (New/Usable/Reconditioned).`);
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
