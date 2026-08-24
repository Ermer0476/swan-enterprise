import "server-only";
import { prisma } from "@/lib/prisma";
import type { InventoryItemTypeValue, RequisitionDepartmentValue, StoresCategoryValue } from "./schema";

export async function listStoresCatalogue(companyId: string, vesselId: string) {
  return prisma.storesCatalogueItem.findMany({
    where: { companyId, vesselId, deletedAt: null },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

export async function listSparesCatalogue(companyId: string, vesselId: string) {
  return prisma.sparesCatalogueItem.findMany({
    where: { companyId, vesselId, deletedAt: null },
    orderBy: [{ equipmentName: "asc" }, { partNo: "asc" }],
  });
}

export async function getStoresItem(companyId: string, id: string) {
  return prisma.storesCatalogueItem.findFirst({ where: { id, companyId, deletedAt: null } });
}

export async function getSparesItem(companyId: string, id: string) {
  return prisma.sparesCatalogueItem.findFirst({ where: { id, companyId, deletedAt: null } });
}

export async function hasPostedOpeningStockTake(companyId: string, vesselId: string): Promise<boolean> {
  const stockTake = await prisma.openingStockTake.findFirst({
    where: { companyId, vesselId, status: "POSTED" },
    select: { id: true },
  });
  return !!stockTake;
}

export async function getOpeningStockTake(companyId: string, vesselId: string) {
  return prisma.openingStockTake.findFirst({ where: { companyId, vesselId } });
}

/** Current Received-On-Board — always computed, never stored. Sums every
 * signed InventoryEvent.quantity for this vessel+item. */
export async function getCurrentRob(companyId: string, vesselId: string, itemType: InventoryItemTypeValue, itemId: string): Promise<number> {
  const result = await prisma.inventoryEvent.aggregate({
    where: { companyId, vesselId, itemType, itemId },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

/** ROB for every item of a given type on a vessel, in one query — avoids an
 * N+1 when rendering a full ledger or a catalogue-with-current-ROB list. */
export async function getRobMap(companyId: string, vesselId: string, itemType: InventoryItemTypeValue): Promise<Map<string, number>> {
  const rows = await prisma.inventoryEvent.groupBy({
    by: ["itemId"],
    where: { companyId, vesselId, itemType },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.itemId, r._sum.quantity ?? 0]));
}

/** ROB split by condition (New/Usable/Reconditioned) for one item — mirrors
 * the real inventory report's three balance columns. */
export async function getRobByCondition(companyId: string, vesselId: string, itemType: InventoryItemTypeValue, itemId: string): Promise<Record<string, number>> {
  const rows = await prisma.inventoryEvent.groupBy({
    by: ["condition"],
    where: { companyId, vesselId, itemType, itemId },
    _sum: { quantity: true },
  });
  return Object.fromEntries(rows.map((r) => [r.condition, r._sum.quantity ?? 0]));
}

/** ROB for every item of a given type on a vessel, split by condition — the
 * bulk version of getRobByCondition, so a full recount grid (Update
 * Inventory) isn't N+1. Keyed by "itemId:condition". */
export async function getRobMapByCondition(companyId: string, vesselId: string, itemType: InventoryItemTypeValue): Promise<Map<string, number>> {
  const rows = await prisma.inventoryEvent.groupBy({
    by: ["itemId", "condition"],
    where: { companyId, vesselId, itemType },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [`${r.itemId}:${r.condition}`, r._sum.quantity ?? 0]));
}

/** Most recently reported physical placement per item — location and
 * remarks off that same latest event row, so they're never mismatched
 * against each other. Either can be blank (e.g. an imported opening count
 * that only carried remarks, no location yet) — the Update Inventory grid
 * just shows whatever's there and lets the crew fill in the rest. */
export async function getCurrentPlacementMap(
  companyId: string,
  vesselId: string,
  itemType: InventoryItemTypeValue,
): Promise<Map<string, { location: string; remarks: string }>> {
  const rows = await prisma.inventoryEvent.findMany({
    where: { companyId, vesselId, itemType },
    select: { itemId: true, location: true, remarks: true },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
  });
  const map = new Map<string, { location: string; remarks: string }>();
  for (const r of rows) {
    if (!map.has(r.itemId)) map.set(r.itemId, { location: r.location ?? "", remarks: r.remarks ?? "" });
  }
  return map;
}

/** Every distinct physical stowage location this vessel has ever reported —
 * pooled from the ledger (Stores + Spares events) and the Spares catalogue's
 * own location field. Powers a type-to-pick suggestion list on the Update
 * Inventory Location field, same pattern as the Requisition item search:
 * pick an existing one, or just keep typing to add a new one. */
export async function listKnownLocations(companyId: string, vesselId: string): Promise<string[]> {
  const [eventLocations, spareLocations] = await Promise.all([
    prisma.inventoryEvent.findMany({
      where: { companyId, vesselId, location: { not: null } },
      select: { location: true },
      distinct: ["location"],
    }),
    prisma.sparesCatalogueItem.findMany({
      where: { companyId, vesselId, deletedAt: null, location: { not: null } },
      select: { location: true },
      distinct: ["location"],
    }),
  ]);
  const set = new Set<string>();
  for (const r of eventLocations) if (r.location) set.add(r.location);
  for (const r of spareLocations) if (r.location) set.add(r.location);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export async function listInventoryLedger(companyId: string, vesselId: string) {
  return prisma.inventoryEvent.findMany({
    where: { companyId, vesselId },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
  });
}

/** The one open (unposted) "Update Inventory" draft, if any, for this exact
 * Deck/Engine/Spares + Category scope — lets the page resume a checkpoint
 * instead of always starting from a blank grid. */
export async function getOpenInventoryUpdateDraft(
  companyId: string,
  vesselId: string,
  department: RequisitionDepartmentValue | null,
  category: StoresCategoryValue | null,
) {
  return prisma.inventoryUpdateDraft.findFirst({
    where: { companyId, vesselId, status: "DRAFT", department, category },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listRequisitionsForVessel(companyId: string, vesselId: string) {
  return prisma.requisition.findMany({
    where: { companyId, vesselId },
    include: { currentRevision: { include: { lines: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getRequisition(companyId: string, requisitionId: string) {
  return prisma.requisition.findFirst({
    where: { id: requisitionId, companyId },
    include: {
      vessel: { select: { id: true, name: true, code: true } },
      currentRevision: { include: { lines: true } },
      revisions: { orderBy: { revisionNo: "asc" } },
    },
  });
}

export async function getRequisitionRevision(companyId: string, revisionId: string) {
  return prisma.requisitionRevision.findFirst({
    where: { id: revisionId, companyId },
    include: { lines: true },
  });
}

/** Fleet-wide landing list — every active vessel, whether or not its
 * Opening Stock Take is posted yet (the gate is enforced at the action
 * level; this just surfaces the gate's status so the user knows where to
 * start). Mirrors listFleetLastEnvironmentEntries in features/environment/. */
export async function listFleetProcurementStatus(companyId: string) {
  const vessels = await prisma.vessel.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  const stockTakes = await prisma.openingStockTake.findMany({
    where: { companyId, vesselId: { in: vessels.map((v) => v.id) } },
    select: { vesselId: true, status: true },
  });
  const stockTakeByVessel = new Map(stockTakes.map((s) => [s.vesselId, s.status]));

  // "Pending" from the office's point of view — a requisition the vessel
  // Master already approved and sent, still somewhere in the office/delivery
  // pipeline (screening, out for quotation, or awaiting the vessel to
  // receive it). Drops off once RECEIVED (terminal).
  const pendingCounts = await prisma.requisition.groupBy({
    by: ["vesselId"],
    where: {
      companyId,
      vesselId: { in: vessels.map((v) => v.id) },
      currentRevision: { status: { in: ["SENT_TO_OFFICE", "FOR_QUOTATION", "FOR_DELIVERY"] } },
    },
    _count: { id: true },
  });
  const pendingByVessel = new Map(pendingCounts.map((r) => [r.vesselId, r._count.id]));

  // Most recent inventory movement of any kind (opening count, issue,
  // adjustment) per vessel — the "when was this vessel's inventory last
  // touched" signal the fleet list flags as stale past 3 months.
  const lastUpdates = await prisma.inventoryEvent.groupBy({
    by: ["vesselId"],
    where: { companyId, vesselId: { in: vessels.map((v) => v.id) } },
    _max: { occurredAt: true },
  });
  const lastUpdateByVessel = new Map(lastUpdates.map((r) => [r.vesselId, r._max.occurredAt]));

  return vessels.map((v) => ({
    vessel: v,
    stockTakeStatus: stockTakeByVessel.get(v.id) ?? null,
    pendingRequisitionCount: pendingByVessel.get(v.id) ?? 0,
    lastInventoryUpdate: lastUpdateByVessel.get(v.id) ?? null,
  }));
}

/** Fleet-wide office inbox — every requisition still in play at the office
 * (SENT_TO_OFFICE awaiting screening, FOR_QUOTATION awaiting a supplier
 * price, or FOR_DELIVERY awaiting the vessel to receive it), across every
 * vessel. Not vessel-scoped, unlike everything else in this module — this
 * is the one office-side, cross-vessel view. RECEIVED (terminal) drops off
 * the list once it's done. */
export async function listSentToOfficeRequisitions(companyId: string) {
  const requisitions = await prisma.requisition.findMany({
    where: { companyId, currentRevision: { status: { in: ["SENT_TO_OFFICE", "FOR_QUOTATION", "FOR_DELIVERY"] } } },
    include: {
      vessel: { select: { id: true, name: true } },
      currentRevision: { include: { lines: { select: { id: true, cancelled: true } } } },
    },
    orderBy: { currentRevision: { sentToOfficeAt: "asc" } },
  });

  return requisitions
    .filter((r) => r.currentRevision)
    .map((r) => ({
      id: r.id,
      vesselId: r.vessel.id,
      vesselName: r.vessel.name,
      refNo: r.refNo,
      category: r.category,
      department: r.department,
      status: r.currentRevision!.status,
      requestedBy: r.currentRevision!.requestedBy,
      sentToOfficeAt: r.currentRevision!.sentToOfficeAt,
      lineCount: r.currentRevision!.lines.length,
      cancelledCount: r.currentRevision!.lines.filter((l) => l.cancelled).length,
    }));
}

export async function getProcurementThresholds(companyId: string): Promise<{ thresholdSupt: number; thresholdTechManager: number }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { procurementThresholdSupt: true, procurementThresholdTechManager: true },
  });
  return {
    thresholdSupt: company?.procurementThresholdSupt ?? 50000,
    thresholdTechManager: company?.procurementThresholdTechManager ?? 500000,
  };
}
