"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { allocateRefNo } from "@/lib/ref-sequence";
import { getCurrentRob, getRobMapByCondition, hasPostedOpeningStockTake } from "./queries";
import {
  addStoresItemSchema,
  addSparesItemSchema,
  stockTakeLineSchema,
  updateInventoryLineSchema,
  createRequisitionSchema,
  addRequisitionLineSchema,
  updateStoresItemImpaCodeSchema,
  updateStoresItemDepartmentSchema,
  updateStoresItemCategorySchema,
  updateRequisitionLineSchema,
  reviseRequisitionLineQtySchema,
  markForDeliverySchema,
  receiveRequisitionLinesSchema,
  closeRequisitionSchema,
  STORES_CATEGORY_LABELS,
  type RequisitionDepartmentValue,
  type StoresCategoryValue,
  type InventoryItemTypeValue,
  type InventoryConditionValue,
} from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

// A SHIPBOARD-department user may only act on their own assigned vessel —
// same guard shape as guardVesselAccess in features/environment/actions.ts.
function ownVesselError(userDepartment: string, userVesselId: string | null, vesselId: string): string | null {
  if (userDepartment === "SHIPBOARD" && userVesselId !== vesselId) {
    return "You can only manage procurement for your own vessel.";
  }
  return null;
}

// Master approval is restricted to this rank specifically — same
// coarse-permission-plus-strict-rank-gate shape as
// NCR_SHIP_CREATOR_RANKS in features/non-conformities/actions.ts.
const REQUISITION_APPROVER_RANK = "Master";

// ── Item Master ─────────────────────────────────────────────────────────────

export async function addStoresItemAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("procurement:manage-catalogue");
  const parsed = addStoresItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  if (d.impaCode) {
    const existing = await prisma.storesCatalogueItem.findFirst({
      where: { companyId: user.companyId, vesselId: d.vesselId, impaCode: d.impaCode, deletedAt: null },
    });
    if (existing) return fail(`IMPA code ${d.impaCode} is already in this vessel's catalogue.`);
  }

  const item = await prisma.storesCatalogueItem.create({
    data: {
      companyId: user.companyId,
      vesselId: d.vesselId,
      impaCode: d.impaCode || null,
      name: d.name,
      category: d.category,
      department: d.department,
      unit: d.unit,
      subGroup: d.subGroup || null,
      remarks: d.remarks || null,
      requiresExpiryTracking: d.requiresExpiryTracking,
      medicalChestCompliance: d.medicalChestCompliance,
      imoHazardClass: d.imoHazardClass || null,
      shelfLifeMonths: d.shelfLifeMonths ?? null,
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({ actor: user, action: "CREATE", entityType: "StoresCatalogueItem", entityId: item.id, summary: `Added Stores item ${d.impaCode || d.name}` });
  revalidatePath("/procurement/catalogue/stores");
  return OK;
}

// Gated by procurement:create (not manage-catalogue) — same rationale as
// updateStoresItemCategoryAction: lets whoever's doing an Update Inventory
// pass add a brand-new catalogue item on the spot (something physically
// onboard that was never catalogued, or a freshly-added category with
// nothing filed under it yet) instead of routing through the office-only
// Stores Catalogue admin page first.
export async function addInventoryStoresItemAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("procurement:create");
  const parsed = addStoresItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;
  const vesselErr = ownVesselError(user.department, user.vesselId, d.vesselId);
  if (vesselErr) return fail(vesselErr);

  const existing = await prisma.storesCatalogueItem.findFirst({
    where: { companyId: user.companyId, vesselId: d.vesselId, name: { equals: d.name, mode: "insensitive" }, category: d.category, deletedAt: null },
  });
  if (existing) return fail(`"${d.name}" is already in this vessel's ${STORES_CATEGORY_LABELS[d.category]} catalogue.`);

  const item = await prisma.storesCatalogueItem.create({
    data: {
      companyId: user.companyId,
      vesselId: d.vesselId,
      name: d.name,
      category: d.category,
      department: d.department,
      unit: d.unit,
      subGroup: d.subGroup || null,
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({ actor: user, action: "CREATE", entityType: "StoresCatalogueItem", entityId: item.id, summary: `Added Stores item ${d.name} from Update Inventory` });
  revalidatePath("/procurement/catalogue/stores");
  revalidatePath(`/procurement/${d.vesselId}/inventory`);
  revalidatePath(`/procurement/${d.vesselId}/inventory/update`);
  return OK;
}

// IMPA numbers get reassigned/corrected from time to time in real fleet
// practice — this lets office fix an already-catalogued item's code instead
// of it staying wrong indefinitely.
export async function updateStoresItemImpaCodeAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("procurement:manage-catalogue");
  const parsed = updateStoresItemImpaCodeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const item = await prisma.storesCatalogueItem.findFirst({ where: { id: d.itemId, companyId: user.companyId, deletedAt: null } });
  if (!item) return fail("Catalogue item not found.");

  if (d.impaCode) {
    const existing = await prisma.storesCatalogueItem.findFirst({
      where: { companyId: user.companyId, vesselId: item.vesselId, impaCode: d.impaCode, deletedAt: null, id: { not: item.id } },
    });
    if (existing) return fail(`IMPA code ${d.impaCode} is already used by ${existing.name} in this vessel's catalogue.`);
  }

  await prisma.storesCatalogueItem.update({ where: { id: item.id }, data: { impaCode: d.impaCode || null, updatedBy: user.id } });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "StoresCatalogueItem",
    entityId: item.id,
    summary: `Updated IMPA code for ${item.name}: ${item.impaCode || "(none)"} → ${d.impaCode || "(none)"}`,
  });
  revalidatePath("/procurement/catalogue/stores");
  return OK;
}

// Same rationale as the IMPA edit above — a catalogue item's department can
// need correcting after the fact (mis-tagged on entry), not just at creation.
export async function updateStoresItemDepartmentAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("procurement:manage-catalogue");
  const parsed = updateStoresItemDepartmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const item = await prisma.storesCatalogueItem.findFirst({ where: { id: d.itemId, companyId: user.companyId, deletedAt: null } });
  if (!item) return fail("Catalogue item not found.");

  await prisma.storesCatalogueItem.update({ where: { id: item.id }, data: { department: d.department, updatedBy: user.id } });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "StoresCatalogueItem",
    entityId: item.id,
    summary: `Updated department for ${item.name}: ${item.department} → ${d.department}`,
  });
  revalidatePath("/procurement/catalogue/stores");
  return OK;
}

// Gated by procurement:create (not manage-catalogue, unlike the Department/
// IMPA edits above) — this one is meant to be used by whoever is doing an
// Update Inventory pass on the vessel and notices an item's filed under the
// wrong category, not just by office catalogue admins.
export async function updateStoresItemCategoryAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("procurement:create");
  const parsed = updateStoresItemCategorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const item = await prisma.storesCatalogueItem.findFirst({ where: { id: d.itemId, companyId: user.companyId, deletedAt: null } });
  if (!item) return fail("Catalogue item not found.");
  const vesselErr = ownVesselError(user.department, user.vesselId, item.vesselId);
  if (vesselErr) return fail(vesselErr);

  await prisma.storesCatalogueItem.update({ where: { id: item.id }, data: { category: d.category, updatedBy: user.id } });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "StoresCatalogueItem",
    entityId: item.id,
    summary: `Updated category for ${item.name}: ${item.category} → ${d.category}`,
  });
  revalidatePath("/procurement/catalogue/stores");
  revalidatePath(`/procurement/${item.vesselId}/inventory`);
  revalidatePath(`/procurement/${item.vesselId}/inventory/update`);
  return OK;
}

export async function addSparesItemAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("procurement:manage-catalogue");
  const parsed = addSparesItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const existing = await prisma.sparesCatalogueItem.findFirst({
    where: { companyId: user.companyId, vesselId: d.vesselId, makerName: d.makerName, partNo: d.partNo, deletedAt: null },
  });
  if (existing) return fail(`${d.makerName} part ${d.partNo} is already in this vessel's catalogue.`);

  const item = await prisma.sparesCatalogueItem.create({
    data: {
      companyId: user.companyId,
      vesselId: d.vesselId,
      makerName: d.makerName,
      equipmentName: d.equipmentName,
      partNo: d.partNo,
      description: d.description || null,
      unit: d.unit,
      location: d.location || null,
      criticalSpare: d.criticalSpare,
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({ actor: user, action: "CREATE", entityType: "SparesCatalogueItem", entityId: item.id, summary: `Added Spares item ${d.partNo} — ${d.equipmentName}` });
  revalidatePath(`/procurement/catalogue/spares`);
  return OK;
}

// ── Opening Stock Take (the gate) ───────────────────────────────────────────

export async function postOpeningStockTakeAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("procurement:opening-stock-take");
  const vesselId = String(formData.get("vesselId") ?? "");
  if (!vesselId) return fail("Vessel is required");
  const vesselErr = ownVesselError(user.department, user.vesselId, vesselId);
  if (vesselErr) return fail(vesselErr);

  const vessel = await prisma.vessel.findFirst({ where: { id: vesselId, companyId: user.companyId, deletedAt: null } });
  if (!vessel) return fail("Vessel not found");

  const existing = await prisma.openingStockTake.findFirst({ where: { companyId: user.companyId, vesselId } });
  if (existing?.status === "POSTED") return fail(`${vessel.name} already has a posted Opening Stock Take.`);

  const rawLines = formData.get("lines");
  if (typeof rawLines !== "string") return fail("No lines submitted");
  let lines: unknown;
  try {
    lines = JSON.parse(rawLines);
  } catch {
    return fail("Invalid line data");
  }
  const parsed = stockTakeLineSchema.array().safeParse(lines);
  if (!parsed.success) return fail("Invalid line data");
  const countedLines = parsed.data.filter((l) => l.qtyCounted > 0);
  if (countedLines.length === 0) return fail("Enter at least one counted quantity before posting");

  const stockTake = await prisma.$transaction(async (tx) => {
    const st = await tx.openingStockTake.upsert({
      where: { vesselId },
      update: { status: "POSTED", postedAt: new Date(), postedBy: user.id, updatedBy: user.id },
      create: { companyId: user.companyId, vesselId, status: "POSTED", postedAt: new Date(), postedBy: user.id, createdBy: user.id, updatedBy: user.id },
    });
    await tx.inventoryEvent.createMany({
      data: countedLines.map((l) => ({
        companyId: user.companyId,
        vesselId,
        itemType: l.itemType,
        itemId: l.itemId,
        eventType: "OPENING" as const,
        condition: l.condition,
        quantity: l.qtyCounted,
        location: l.location || null,
        remarks: l.remarks || null,
        sourceType: "OPENING_STOCK_TAKE",
        sourceId: st.id,
        openingStockTakeId: st.id,
        createdBy: user.id,
      })),
    });
    return st;
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "OpeningStockTake",
    entityId: stockTake.id,
    summary: `Posted Opening Stock Take for ${vessel.name} (${countedLines.length} line${countedLines.length === 1 ? "" : "s"})`,
  });
  revalidatePath(`/procurement/${vesselId}`);
  revalidatePath("/procurement");
  return OK;
}

// ── Inventory ────────────────────────────────────────────────────────────────

// Bulk "Update Inventory" grid — every item row on the page is independently
// editable, submitted together in one save (same shape as
// postOpeningStockTakeAction's line array above). One shared effective date
// applies to every line in the batch, since a single update session
// represents one round of counting/issuing, not per-item dates.
// Parses+validates the shared "lines" FormData field used by both the draft
// save and the final post — same shape either way, just different
// strictness applied by the caller (draft accepts zero-quantity/incomplete
// rows as a checkpoint; posting filters them out below).
function parseUpdateInventoryLines(formData: FormData): { ok: true; lines: z.infer<typeof updateInventoryLineSchema>[] } | { ok: false; error: string } {
  const raw = formData.get("lines");
  if (typeof raw !== "string") return { ok: false, error: "No lines submitted" };
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Invalid line data" };
  }
  const parsed = updateInventoryLineSchema.array().safeParse(parsedJson);
  if (!parsed.success) return { ok: false, error: "Invalid line data" };
  return { ok: true, lines: parsed.data };
}

// Saves the current "Update Inventory" grid as a checkpoint — does NOT touch
// the InventoryEvent ledger. Upserts against whatever open draft already
// exists for this exact department/category scope, so repeated saves while
// the crew keeps reviewing don't pile up duplicate drafts.
export async function saveInventoryUpdateDraftAction(formData: FormData): Promise<ActionResult & { draftId?: string }> {
  const user = await requirePermission("procurement:create");
  const vesselId = String(formData.get("vesselId") ?? "");
  if (!vesselId) return fail("Vessel is required");
  const vesselErr = ownVesselError(user.department, user.vesselId, vesselId);
  if (vesselErr) return fail(vesselErr);

  const department = (String(formData.get("department") ?? "") || null) as RequisitionDepartmentValue | null;
  const category = (String(formData.get("category") ?? "") || null) as StoresCategoryValue | null;
  const occurredAtRaw = String(formData.get("occurredAt") ?? "");
  const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : new Date();

  const parsedLines = parseUpdateInventoryLines(formData);
  if (!parsedLines.ok) return fail(parsedLines.error);

  const existing = await prisma.inventoryUpdateDraft.findFirst({
    where: { companyId: user.companyId, vesselId, status: "DRAFT", department, category },
  });

  const draft = existing
    ? await prisma.inventoryUpdateDraft.update({
        where: { id: existing.id },
        data: { occurredAt, linesJson: parsedLines.lines, updatedBy: user.id },
      })
    : await prisma.inventoryUpdateDraft.create({
        data: {
          companyId: user.companyId,
          vesselId,
          department,
          category,
          occurredAt,
          linesJson: parsedLines.lines,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });

  await writeAudit({
    actor: user,
    action: existing ? "UPDATE" : "CREATE",
    entityType: "InventoryUpdateDraft",
    entityId: draft.id,
    summary: `Saved an Update Inventory draft (${parsedLines.lines.length} row${parsedLines.lines.length === 1 ? "" : "s"})`,
  });
  revalidatePath(`/procurement/${vesselId}/inventory/update`);
  return { ...OK, draftId: draft.id };
}

export async function updateInventoryAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("procurement:create");
  const vesselId = String(formData.get("vesselId") ?? "");
  if (!vesselId) return fail("Vessel is required");
  const vesselErr = ownVesselError(user.department, user.vesselId, vesselId);
  if (vesselErr) return fail(vesselErr);

  if (!(await hasPostedOpeningStockTake(user.companyId, vesselId))) {
    return fail("Post the Opening Stock Take before logging inventory movements.");
  }

  const occurredAtRaw = String(formData.get("occurredAt") ?? "");
  const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : undefined;
  const draftId = String(formData.get("draftId") ?? "") || null;

  const parsedLines = parseUpdateInventoryLines(formData);
  if (!parsedLines.ok) return fail(parsedLines.error);
  // A line with no counted quantity but a location or remarks change is a
  // pure placement update — no ROB change, still worth logging. Only drop
  // lines that carry neither.
  const touchedLines = parsedLines.lines.filter(
    (l) => (l.quantity !== null && l.quantity !== undefined) || (l.location && l.location.trim() !== "") || (l.remarks && l.remarks.trim() !== ""),
  );
  if (touchedLines.length === 0) return fail("Enter at least one quantity or location change before saving");

  // `quantity` on each line is the recounted total, not a delta — fetch the
  // real current ROB per item+condition (fresh, not whatever the client had
  // cached at page load) and diff against that to get the signed event.
  // Grouped by itemType since a grid is homogeneous (Stores or Spares, never
  // mixed), so this is at most two bulk queries, not one per line.
  const itemTypesPresent = new Set(touchedLines.filter((l) => l.quantity !== null && l.quantity !== undefined).map((l) => l.itemType));
  const robMaps = new Map<string, Map<string, number>>();
  for (const itemType of itemTypesPresent) {
    robMaps.set(itemType, await getRobMapByCondition(user.companyId, vesselId, itemType));
  }

  const activeLines: { itemType: string; itemId: string; eventType: "ISSUED" | "ADJUSTMENT"; condition: string; quantity: number; reason: string | null; location: string | null; remarks: string | null }[] = [];
  for (const l of touchedLines) {
    const hasCount = l.quantity !== null && l.quantity !== undefined;
    let delta = 0;
    let eventType: "ISSUED" | "ADJUSTMENT" = "ADJUSTMENT";
    if (hasCount) {
      const currentRob = robMaps.get(l.itemType)?.get(`${l.itemId}:${l.condition}`) ?? 0;
      delta = l.quantity! - currentRob;
      eventType = delta < 0 ? "ISSUED" : "ADJUSTMENT";
    }
    const hasPlacementChange = !!(l.location && l.location.trim()) || !!(l.remarks && l.remarks.trim());
    if (delta === 0 && !hasPlacementChange) continue; // recount matched what's already on record, no placement change either — nothing to log
    activeLines.push({
      itemType: l.itemType,
      itemId: l.itemId,
      eventType,
      condition: l.condition,
      quantity: delta,
      reason: l.reason || null,
      location: l.location || null,
      remarks: l.remarks || null,
    });
  }
  if (activeLines.length === 0) return fail("Enter at least one quantity or location change before saving");
  if (activeLines.some((l) => l.eventType === "ADJUSTMENT" && !l.reason)) {
    return fail("A reason is required whenever the counted quantity is higher than what's on record, or for a placement-only update.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.inventoryEvent.createMany({
      data: activeLines.map((l) => ({
        companyId: user.companyId,
        vesselId,
        itemType: l.itemType as InventoryItemTypeValue,
        itemId: l.itemId,
        eventType: l.eventType,
        condition: l.condition as InventoryConditionValue,
        quantity: l.quantity,
        reason: l.reason,
        location: l.location,
        remarks: l.remarks,
        occurredAt,
        sourceType: "MANUAL",
        createdBy: user.id,
      })),
    });
    if (draftId) {
      await tx.inventoryUpdateDraft.updateMany({
        where: { id: draftId, companyId: user.companyId, vesselId, status: "DRAFT" },
        data: { status: "POSTED", postedAt: new Date(), postedBy: user.id, updatedBy: user.id },
      });
    }
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "InventoryEvent",
    entityId: vesselId,
    summary: `Logged ${activeLines.length} inventory movement${activeLines.length === 1 ? "" : "s"} on vessel inventory`,
  });
  revalidatePath(`/procurement/${vesselId}/inventory`);
  return OK;
}

// ── Requisitions ─────────────────────────────────────────────────────────────

export async function createRequisitionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("procurement:create");
  const parsed = createRequisitionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;
  const vesselErr = ownVesselError(user.department, user.vesselId, d.vesselId);
  if (vesselErr) return fail(vesselErr);

  if (!(await hasPostedOpeningStockTake(user.companyId, d.vesselId))) {
    return fail("Post the Opening Stock Take before creating requisitions.");
  }

  const requisition = await prisma.$transaction(async (tx) => {
    const req = await tx.requisition.create({
      data: { companyId: user.companyId, vesselId: d.vesselId, category: d.category, department: d.department, createdBy: user.id, updatedBy: user.id },
    });
    const revision = await tx.requisitionRevision.create({
      data: {
        companyId: user.companyId,
        requisitionId: req.id,
        revisionNo: 1,
        status: "DRAFT",
        requestedBy: d.requestedBy || null,
        createdBy: user.id,
        updatedBy: user.id,
      },
    });
    return tx.requisition.update({ where: { id: req.id }, data: { currentRevisionId: revision.id } });
  });

  await writeAudit({ actor: user, action: "CREATE", entityType: "Requisition", entityId: requisition.id, summary: `Started a ${d.category} requisition draft` });
  revalidatePath(`/procurement/${d.vesselId}/requisitions`);
  redirect(`/procurement/${d.vesselId}/requisitions/${requisition.id}`);
}

export async function addRequisitionLineAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("procurement:create");
  const parsed = addRequisitionLineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const revision = await prisma.requisitionRevision.findFirst({
    where: { id: d.revisionId, companyId: user.companyId, status: "DRAFT" },
    include: { requisition: true },
  });
  if (!revision) return fail("Requisition is not editable (not found or no longer a draft).");
  const vesselErr = ownVesselError(user.department, user.vesselId, revision.requisition.vesselId);
  if (vesselErr) return fail(vesselErr);

  if (d.itemType === "NON_CATALOGUE" && !d.nonCatalogueDescription) {
    return fail("Describe the non-catalogue item.");
  }
  if (d.itemType !== "NON_CATALOGUE" && !d.itemId) {
    return fail("Choose a catalogue item.");
  }

  let robAtRequestTime: number | null = null;
  if (d.itemType === "STORES" && d.itemId) {
    robAtRequestTime = await getCurrentRob(user.companyId, revision.requisition.vesselId, "STORES", d.itemId);
  } else if (d.itemType === "SPARES" && d.itemId) {
    robAtRequestTime = await getCurrentRob(user.companyId, revision.requisition.vesselId, "SPARES", d.itemId);
  }

  await prisma.requisitionLine.create({
    data: {
      companyId: user.companyId,
      revisionId: d.revisionId,
      itemType: d.itemType,
      itemId: d.itemId ?? null,
      nonCatalogueDescription: d.itemType === "NON_CATALOGUE" ? d.nonCatalogueDescription || null : null,
      unit: d.itemType === "NON_CATALOGUE" ? d.unit || null : null,
      // Not restricted to NON_CATALOGUE — a chosen catalogue item can still
      // lack its own IMPA code, in which case the form exposes this same
      // field for the requester to fill in on the line itself.
      impaCode: d.impaCode || null,
      remarks: d.remarks || null,
      qtyRequested: d.qtyRequested,
      robAtRequestTime,
      createdBy: user.id,
    },
  });

  revalidatePath(`/procurement/${revision.requisition.vesselId}/requisitions/${revision.requisitionId}`);
  return OK;
}

export async function deleteRequisitionLineAction(lineId: string): Promise<void> {
  const user = await requirePermission("procurement:create");
  const line = await prisma.requisitionLine.findFirst({
    where: { id: lineId, companyId: user.companyId },
    include: { revision: { include: { requisition: true } } },
  });
  if (!line || line.revision.status !== "DRAFT") return;
  if (ownVesselError(user.department, user.vesselId, line.revision.requisition.vesselId)) return;

  await prisma.requisitionLine.delete({ where: { id: lineId } });
  revalidatePath(`/procurement/${line.revision.requisition.vesselId}/requisitions/${line.revision.requisitionId}`);
}

export async function updateRequisitionLineAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("procurement:create");
  const parsed = updateRequisitionLineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const line = await prisma.requisitionLine.findFirst({
    where: { id: d.lineId, companyId: user.companyId },
    include: { revision: { include: { requisition: true } } },
  });
  if (!line || line.revision.status !== "DRAFT") return fail("Line is not editable (requisition no longer a draft).");
  const vesselErr = ownVesselError(user.department, user.vesselId, line.revision.requisition.vesselId);
  if (vesselErr) return fail(vesselErr);

  await prisma.requisitionLine.update({
    where: { id: d.lineId },
    data: {
      qtyRequested: d.qtyRequested,
      unit: line.itemType === "NON_CATALOGUE" ? d.unit || null : line.unit,
      impaCode: d.impaCode || null,
      remarks: d.remarks || null,
    },
  });

  revalidatePath(`/procurement/${line.revision.requisition.vesselId}/requisitions/${line.revision.requisitionId}`);
  return OK;
}

export async function submitForMasterApprovalAction(requisitionId: string): Promise<void> {
  const user = await requirePermission("procurement:create");
  const requisition = await prisma.requisition.findFirst({
    where: { id: requisitionId, companyId: user.companyId },
    include: { currentRevision: { include: { lines: true } } },
  });
  if (!requisition?.currentRevision || requisition.currentRevision.status !== "DRAFT") return;
  if (requisition.currentRevision.lines.length === 0) return;
  if (ownVesselError(user.department, user.vesselId, requisition.vesselId)) return;

  await prisma.requisitionRevision.update({
    where: { id: requisition.currentRevision.id },
    data: { status: "PENDING_MASTER_APPROVAL", updatedBy: user.id },
  });

  await writeAudit({ actor: user, action: "UPDATE", entityType: "Requisition", entityId: requisitionId, summary: "Submitted requisition for Master approval" });
  revalidatePath(`/procurement/${requisition.vesselId}/requisitions/${requisitionId}`);
}

export async function masterApproveRequisitionAction(requisitionId: string): Promise<ActionResult> {
  const user = await requirePermission("procurement:approve");
  if (user.rank !== REQUISITION_APPROVER_RANK) {
    return fail("Only the vessel Master can approve a requisition.");
  }

  const requisition = await prisma.requisition.findFirst({
    where: { id: requisitionId, companyId: user.companyId },
    include: { currentRevision: true, vessel: { select: { code: true } } },
  });
  if (!requisition?.currentRevision) return fail("Requisition not found");
  const vesselErr = ownVesselError(user.department, user.vesselId, requisition.vesselId);
  if (vesselErr) return fail(vesselErr);
  if (requisition.currentRevision.status !== "PENDING_MASTER_APPROVAL") {
    return fail("This requisition is not pending Master approval.");
  }

  let refNo = requisition.refNo;
  if (!refNo) {
    const yy = String(new Date().getFullYear()).slice(-2);
    refNo = await allocateRefNo(user.companyId, `${requisition.vessel.code}-${yy}RQ-${requisition.category}`, 3);
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.requisition.update({ where: { id: requisitionId }, data: { refNo, updatedBy: user.id } }),
    prisma.requisitionRevision.update({
      where: { id: requisition.currentRevision.id },
      data: {
        status: "SENT_TO_OFFICE",
        masterApprovedAt: now,
        masterApprovedBy: user.id,
        sentToOfficeAt: now,
        updatedBy: user.id,
      },
    }),
  ]);

  await writeAudit({ actor: user, action: "UPDATE", entityType: "Requisition", entityId: requisitionId, summary: `Master-approved requisition — assigned ${refNo}` });
  revalidatePath(`/procurement/${requisition.vesselId}/requisitions/${requisitionId}`);
  revalidatePath(`/procurement/${requisition.vesselId}/requisitions`);
  return OK;
}

// --- Office screening (once a requisition is SENT_TO_OFFICE) ---
// Gated to procurement:office-review, not procurement:create/approve — this
// is the office (Marine Superintendent) acting on what the vessel already
// sent in, not the vessel editing its own draft. Both actions require the
// revision to still be SENT_TO_OFFICE (nothing past that status exists yet —
// see the RequisitionRevisionStatus comment in schema.prisma).

/** Toggles a line's cancelled flag — reversible, so a Superintendent can
 * un-cancel a line they cancelled by mistake without losing the line. */
export async function toggleRequisitionLineCancelledAction(lineId: string, cancelled: boolean): Promise<ActionResult> {
  const user = await requirePermission("procurement:office-review");
  const line = await prisma.requisitionLine.findFirst({
    where: { id: lineId, companyId: user.companyId },
    include: { revision: { include: { requisition: true } } },
  });
  if (!line) return fail("Line not found");
  if (line.revision.status !== "SENT_TO_OFFICE") return fail("This requisition is not awaiting office review.");

  await prisma.requisitionLine.update({
    where: { id: lineId },
    data: cancelled
      ? { cancelled: true, cancelledAt: new Date(), cancelledBy: user.id }
      : { cancelled: false, cancelledAt: null, cancelledBy: null },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "RequisitionLine",
    entityId: lineId,
    summary: `${cancelled ? "Cancelled" : "Un-cancelled"} requisition line on ${line.revision.requisition.refNo ?? "an unnumbered requisition"}`,
  });
  revalidatePath(`/procurement/${line.revision.requisition.vesselId}/requisitions/${line.revision.requisitionId}`);
  revalidatePath("/procurement/requisitions");
  return OK;
}

/** Records the office's approved quantity for a line, kept separate from
 * qtyRequested so what the vessel actually asked for stays on record. */
export async function reviseRequisitionLineQtyAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("procurement:office-review");
  const parsed = reviseRequisitionLineQtySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const line = await prisma.requisitionLine.findFirst({
    where: { id: d.lineId, companyId: user.companyId },
    include: { revision: { include: { requisition: true } } },
  });
  if (!line) return fail("Line not found");
  if (line.revision.status !== "SENT_TO_OFFICE") return fail("This requisition is not awaiting office review.");

  await prisma.requisitionLine.update({ where: { id: d.lineId }, data: { qtyApproved: d.qtyApproved } });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "RequisitionLine",
    entityId: d.lineId,
    summary: `Revised requisition line quantity to ${d.qtyApproved} (requested was ${line.qtyRequested}) on ${line.revision.requisition.refNo ?? "an unnumbered requisition"}`,
  });
  revalidatePath(`/procurement/${line.revision.requisition.vesselId}/requisitions/${line.revision.requisitionId}`);
  revalidatePath("/procurement/requisitions");
  return OK;
}

// --- Office pipeline past screening: quotation → delivery. Picking a
// quotation happens outside the system (email/phone with the supplier) —
// these two actions just record the outcome once the office has one. ---

export async function markForQuotationAction(requisitionId: string): Promise<ActionResult> {
  const user = await requirePermission("procurement:office-review");
  const requisition = await prisma.requisition.findFirst({
    where: { id: requisitionId, companyId: user.companyId },
    include: { currentRevision: true },
  });
  if (!requisition?.currentRevision) return fail("Requisition not found");
  if (requisition.currentRevision.status !== "SENT_TO_OFFICE") return fail("This requisition isn't awaiting office screening.");

  await prisma.requisitionRevision.update({
    where: { id: requisition.currentRevision.id },
    data: { status: "FOR_QUOTATION", forQuotationAt: new Date(), updatedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "Requisition",
    entityId: requisitionId,
    summary: `Marked ${requisition.refNo ?? "requisition"} for quotation`,
  });
  revalidatePath(`/procurement/${requisition.vesselId}/requisitions/${requisitionId}`);
  revalidatePath("/procurement/requisitions");
  return OK;
}

export async function markForDeliveryAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("procurement:office-review");
  const parsed = markForDeliverySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const requisition = await prisma.requisition.findFirst({
    where: { id: d.requisitionId, companyId: user.companyId },
    include: { currentRevision: true },
  });
  if (!requisition?.currentRevision) return fail("Requisition not found");
  if (requisition.currentRevision.status !== "FOR_QUOTATION") return fail("This requisition isn't awaiting a quotation decision.");

  await prisma.requisitionRevision.update({
    where: { id: requisition.currentRevision.id },
    data: { status: "FOR_DELIVERY", forDeliveryAt: new Date(), deliveryPort: d.deliveryPort, updatedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "Requisition",
    entityId: d.requisitionId,
    summary: `Marked ${requisition.refNo ?? "requisition"} for delivery to ${d.deliveryPort}`,
  });
  revalidatePath(`/procurement/${requisition.vesselId}/requisitions/${d.requisitionId}`);
  revalidatePath("/procurement/requisitions");
  return OK;
}

// --- Receiving (vessel side) — posts straight to inventory. A single call
// can cover several lines (one delivery usually brings more than one item)
// and can be partial; whatever isn't included this round just stays open
// for a later delivery. A NON_CATALOGUE line under a Stores requisition gets
// a real catalogue entry created on first receipt (so it's trackable
// afterward) — Spares has no equivalent free-text-to-catalogue path (a
// SparesCatalogueItem needs Maker/Equipment/Part No, none of which a
// requisition line carries), so a NON_CATALOGUE Spares line's qtyReceived is
// still recorded but doesn't post an inventory event.
export async function receiveRequisitionLinesAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("procurement:create");
  const parsed = receiveRequisitionLinesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const requisition = await prisma.requisition.findFirst({
    where: { id: d.requisitionId, companyId: user.companyId },
    include: { currentRevision: { include: { lines: true } } },
  });
  if (!requisition?.currentRevision) return fail("Requisition not found");
  const vesselErr = ownVesselError(user.department, user.vesselId, requisition.vesselId);
  if (vesselErr) return fail(vesselErr);
  if (requisition.currentRevision.status !== "FOR_DELIVERY") return fail("This requisition isn't awaiting delivery.");

  const linesById = new Map(requisition.currentRevision.lines.map((l) => [l.id, l]));
  const entries = Object.entries(d.receivedQtys).filter(([lineId, qty]) => linesById.has(lineId) && qty > 0);
  if (entries.length === 0) return fail("Enter a received quantity for at least one item.");

  const now = new Date();
  let touchedCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const [lineId, qty] of entries) {
      const line = linesById.get(lineId)!;
      if (line.cancelled) continue;

      let itemId = line.itemId;
      if (line.itemType === "NON_CATALOGUE" && requisition.category !== "SPARES") {
        const created = await tx.storesCatalogueItem.create({
          data: {
            companyId: user.companyId,
            vesselId: requisition.vesselId,
            name: line.nonCatalogueDescription ?? "Received item",
            category: requisition.category,
            department: requisition.department,
            unit: line.unit ?? "pc",
            createdBy: user.id,
            updatedBy: user.id,
          },
        });
        itemId = created.id;
      }

      if (itemId) {
        await tx.inventoryEvent.create({
          data: {
            companyId: user.companyId,
            vesselId: requisition.vesselId,
            itemType: line.itemType === "SPARES" ? "SPARES" : "STORES",
            itemId,
            eventType: "RECEIVED",
            condition: "USABLE",
            quantity: qty,
            remarks: line.remarks,
            sourceType: "REQUISITION",
            sourceId: requisition.id,
            occurredAt: now,
            createdBy: user.id,
          },
        });
      }

      await tx.requisitionLine.update({ where: { id: lineId }, data: { qtyReceived: { increment: qty } } });
      touchedCount++;
    }

    const refreshedLines = await tx.requisitionLine.findMany({ where: { revisionId: requisition.currentRevision!.id } });
    const allFulfilled = refreshedLines
      .filter((l) => !l.cancelled)
      .every((l) => l.qtyReceived >= (l.qtyApproved ?? l.qtyRequested));
    if (allFulfilled) {
      await tx.requisitionRevision.update({
        where: { id: requisition.currentRevision!.id },
        data: { status: "RECEIVED", receivedAt: now, updatedBy: user.id },
      });
    }
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "Requisition",
    entityId: d.requisitionId,
    summary: `Received ${touchedCount} line(s) of ${requisition.refNo ?? "a requisition"}`,
  });
  revalidatePath(`/procurement/${requisition.vesselId}/requisitions/${d.requisitionId}`);
  revalidatePath(`/procurement/${requisition.vesselId}/inventory`);
  revalidatePath(`/procurement/${requisition.vesselId}/inventory/update`);
  revalidatePath("/procurement/requisitions");
  return OK;
}

/** Closes out a requisition that's stalled at FOR_QUOTATION or FOR_DELIVERY
 * without everything arriving — the supplier never quoted, never shipped a
 * line, or the office decided to cancel it. Whatever was already received
 * (if any, via receiveRequisitionLinesAction) stays posted in inventory;
 * this just stops the requisition from waiting on the rest. A vessel that
 * still genuinely needs the unfulfilled item raises a fresh requisition
 * rather than reopening this one — there's no "reopen" action by design. */
export async function closeRequisitionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("procurement:office-review");
  const parsed = closeRequisitionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const requisition = await prisma.requisition.findFirst({
    where: { id: d.requisitionId, companyId: user.companyId },
    include: { currentRevision: true },
  });
  if (!requisition?.currentRevision) return fail("Requisition not found");
  if (!["FOR_QUOTATION", "FOR_DELIVERY"].includes(requisition.currentRevision.status)) {
    return fail("This requisition isn't in a state that can be closed.");
  }

  await prisma.requisitionRevision.update({
    where: { id: requisition.currentRevision.id },
    data: { status: "CLOSED", closedAt: new Date(), closedBy: user.id, closeReason: d.closeReason, updatedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "Requisition",
    entityId: d.requisitionId,
    summary: `Closed ${requisition.refNo ?? "requisition"} without full delivery — ${d.closeReason}`,
  });
  revalidatePath(`/procurement/${requisition.vesselId}/requisitions/${d.requisitionId}`);
  revalidatePath("/procurement/requisitions");
  return OK;
}
