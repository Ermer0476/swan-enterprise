import { z } from "zod";

export const STORES_CATEGORIES = [
  "DECK", "ENGINE", "TOOLS", "GALLEY", "STATIONERY", "PAINTS", "CHEMICALS", "MEDICINE", "PROVISIONS",
  "SAFETY", "FIREFIGHTING", "BOOKS_CHARTS", "NAVIGATION", "PORTABLE_RADIOS", "IMO_STICKERS",
] as const;
export type StoresCategoryValue = (typeof STORES_CATEGORIES)[number];
export const STORES_CATEGORY_LABELS: Record<StoresCategoryValue, string> = {
  DECK: "Deck Stores",
  ENGINE: "Engine Store",
  TOOLS: "Tools",
  GALLEY: "Galley",
  STATIONERY: "Stationery",
  PAINTS: "Paints",
  CHEMICALS: "Chemicals",
  MEDICINE: "Medicine",
  PROVISIONS: "Provisions",
  SAFETY: "Safety",
  FIREFIGHTING: "Firefighting",
  BOOKS_CHARTS: "Books and Charts",
  NAVIGATION: "Navigation",
  PORTABLE_RADIOS: "Portable Radios",
  IMO_STICKERS: "IMO Stickers",
};

// The ref-number CATEGORY segment covers the 9 Stores categories plus SPARES
// for the Spares Catalogue — e.g. "ESM-26RQ-DECK-001", "ESM-26RQ-SPARES-001".
export const REQUISITION_CATEGORIES = [...STORES_CATEGORIES, "SPARES"] as const;
export type RequisitionCategoryValue = (typeof REQUISITION_CATEGORIES)[number];
export const REQUISITION_CATEGORY_LABELS: Record<RequisitionCategoryValue, string> = {
  ...STORES_CATEGORY_LABELS,
  SPARES: "Spares",
};

// The vessel's onboard department making the request — independent of
// Category above (what kind of item/catalogue the lines are drawn from).
export const REQUISITION_DEPARTMENTS = ["DECK", "ENGINE"] as const;
export type RequisitionDepartmentValue = (typeof REQUISITION_DEPARTMENTS)[number];
export const REQUISITION_DEPARTMENT_LABELS: Record<RequisitionDepartmentValue, string> = {
  DECK: "Deck",
  ENGINE: "Engine",
};

// Which Stores categories are actually relevant to each onboard department —
// real fleet practice is that the Engine Room only ever deals with its own
// store, chemicals (lubricants/treatment chemicals), and shared Tools;
// everything else (Galley, Medicine, Navigation, ...) is Deck-side. Used to
// scope category pickers/filters so Engine isn't cluttered with categories
// that never apply there, and vice versa.
export const STORES_CATEGORIES_BY_DEPARTMENT: Record<RequisitionDepartmentValue, readonly StoresCategoryValue[]> = {
  DECK: STORES_CATEGORIES.filter((c) => c !== "ENGINE" && c !== "CHEMICALS"),
  ENGINE: ["ENGINE", "CHEMICALS", "TOOLS"],
};

export const REQUISITION_REVISION_STATUSES = [
  "DRAFT", "PENDING_MASTER_APPROVAL", "APPROVED_BY_MASTER", "SENT_TO_OFFICE",
  "FOR_QUOTATION", "FOR_DELIVERY", "RECEIVED", "CLOSED",
] as const;
export type RequisitionRevisionStatusValue = (typeof REQUISITION_REVISION_STATUSES)[number];
export const REQUISITION_REVISION_STATUS_LABELS: Record<RequisitionRevisionStatusValue, string> = {
  DRAFT: "Draft",
  PENDING_MASTER_APPROVAL: "Pending Master Approval",
  APPROVED_BY_MASTER: "Approved by Master",
  SENT_TO_OFFICE: "Sent to Office",
  FOR_QUOTATION: "For Quotation",
  FOR_DELIVERY: "For Delivery",
  RECEIVED: "Received",
  CLOSED: "Closed",
};

export function nextRequisitionStatus(current: RequisitionRevisionStatusValue): RequisitionRevisionStatusValue | null {
  const i = REQUISITION_REVISION_STATUSES.indexOf(current);
  return (REQUISITION_REVISION_STATUSES[i + 1] as RequisitionRevisionStatusValue | undefined) ?? null;
}

export const INVENTORY_ITEM_TYPES = ["STORES", "SPARES"] as const;
export type InventoryItemTypeValue = (typeof INVENTORY_ITEM_TYPES)[number];

export const INVENTORY_EVENT_TYPES = ["OPENING", "ISSUED", "RECEIVED", "ADJUSTMENT"] as const;
export type InventoryEventTypeValue = (typeof INVENTORY_EVENT_TYPES)[number];

export const REQUISITION_LINE_ITEM_TYPES = ["STORES", "SPARES", "NON_CATALOGUE"] as const;
export type RequisitionLineItemTypeValue = (typeof REQUISITION_LINE_ITEM_TYPES)[number];

// Matches the real inventory report's New / Usable / Reconditioned balance
// columns — every counted or moved quantity carries a condition.
export const INVENTORY_CONDITIONS = ["NEW", "USABLE", "RECONDITIONED"] as const;
export type InventoryConditionValue = (typeof INVENTORY_CONDITIONS)[number];
export const INVENTORY_CONDITION_LABELS: Record<InventoryConditionValue, string> = {
  NEW: "New",
  USABLE: "Usable",
  RECONDITIONED: "Reconditioned",
};

// ── Zod schemas ─────────────────────────────────────────────────────────────

export const addStoresItemSchema = z.object({
  vesselId: z.string().uuid(),
  impaCode: z.string().trim().optional().or(z.literal("")),
  name: z.string().trim().min(1, "Name is required"),
  category: z.enum(STORES_CATEGORIES),
  department: z.enum(REQUISITION_DEPARTMENTS),
  unit: z.string().trim().min(1, "Unit is required"),
  subGroup: z.string().trim().optional().or(z.literal("")),
  remarks: z.string().trim().optional().or(z.literal("")),
  requiresExpiryTracking: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()).default(false),
  medicalChestCompliance: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()).default(false),
  imoHazardClass: z.string().trim().optional().or(z.literal("")),
  shelfLifeMonths: z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number().int().positive().optional()),
});

export const addSparesItemSchema = z.object({
  vesselId: z.string().uuid(),
  makerName: z.string().trim().min(1, "Maker is required"),
  equipmentName: z.string().trim().min(1, "Equipment is required"),
  partNo: z.string().trim().min(1, "Part No. is required"),
  description: z.string().trim().optional().or(z.literal("")),
  unit: z.string().trim().min(1, "Unit is required"),
  location: z.string().trim().optional().or(z.literal("")),
  criticalSpare: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()).default(false),
});

export const stockTakeLineSchema = z.object({
  itemType: z.enum(INVENTORY_ITEM_TYPES),
  itemId: z.string().uuid(),
  condition: z.enum(INVENTORY_CONDITIONS).default("USABLE"),
  qtyCounted: z.coerce.number().min(0),
  // Where the ship found it. For Spares this is carried over from the
  // catalogue automatically (already per-vessel); for Stores (fleet-wide
  // catalogue, no location of its own) the ship labels it while counting.
  // Kept to the general area (e.g. "Bosun Store") — box/bin detail goes in
  // remarks instead, so many boxes in the same area share one location.
  location: z.string().trim().optional().or(z.literal("")),
  remarks: z.string().trim().optional().or(z.literal("")),
});

// One row of the "Update Inventory" grid — every item in the selected
// department/category is editable at once, same bulk-entry shape as
// stockTakeLineSchema above. `quantity` is the RECOUNTED TOTAL on board for
// this item+condition right now — not a delta, and not "how many were
// issued." The action diffs it against the current ROB (fetched fresh, not
// trusted from the client) to work out the signed ledger event. null/omitted
// means this row wasn't touched this session — filtered out server-side
// rather than requiring the crew to retype every row.
export const updateInventoryLineSchema = z.object({
  itemType: z.enum(INVENTORY_ITEM_TYPES),
  itemId: z.string().uuid(),
  condition: z.enum(INVENTORY_CONDITIONS).default("USABLE"),
  quantity: z.coerce.number().nullable().optional(),
  reason: z.string().trim().optional().or(z.literal("")),
  // Lets the crew correct/update an item's physical stowage from this same
  // grid — items do get relocated between counts. Left blank means "no
  // change."
  location: z.string().trim().optional().or(z.literal("")),
  // Sub-detail within Location — box/bin number, "beside C/O cabin", etc.
  remarks: z.string().trim().optional().or(z.literal("")),
});

export const createRequisitionSchema = z.object({
  vesselId: z.string().uuid(),
  category: z.enum(REQUISITION_CATEGORIES),
  department: z.enum(REQUISITION_DEPARTMENTS),
  requestedBy: z.string().trim().optional().or(z.literal("")),
});

export const addRequisitionLineSchema = z.object({
  revisionId: z.string().uuid(),
  itemType: z.enum(REQUISITION_LINE_ITEM_TYPES),
  itemId: z.string().uuid().optional(),
  nonCatalogueDescription: z.string().trim().optional().or(z.literal("")),
  // Non-Catalogue only — the requester's own best-guess Unit/IMPA, since
  // there's no catalogue item to read those from.
  unit: z.string().trim().optional().or(z.literal("")),
  impaCode: z.string().trim().optional().or(z.literal("")),
  // Requisition-specific context (why it's needed) — independent of the
  // catalogue item's own remarks, editable regardless of item type.
  remarks: z.string().trim().optional().or(z.literal("")),
  qtyRequested: z.coerce.number().positive("Quantity must be greater than 0"),
});

export const updateStoresItemImpaCodeSchema = z.object({
  itemId: z.string().uuid(),
  impaCode: z.string().trim().optional().or(z.literal("")),
});

export const updateStoresItemDepartmentSchema = z.object({
  itemId: z.string().uuid(),
  department: z.enum(REQUISITION_DEPARTMENTS),
});

// Same rationale as Department/IMPA above — an item's category can be
// mis-tagged on entry (a tool filed under Deck Stores, say) and needs
// correcting later, including right from the Update Inventory grid where
// the crew actually notices it.
export const updateStoresItemCategorySchema = z.object({
  itemId: z.string().uuid(),
  category: z.enum(STORES_CATEGORIES),
});

// Editing an existing Draft line — item type/identity isn't editable (that
// would just be a different line), only its quantity and the fields the
// requester might need to correct: Unit/IMPA when there's no catalogue value
// to fall back on, and its own independent Remarks.
export const updateRequisitionLineSchema = z.object({
  lineId: z.string().uuid(),
  qtyRequested: z.coerce.number().positive("Quantity must be greater than 0"),
  unit: z.string().trim().optional().or(z.literal("")),
  impaCode: z.string().trim().optional().or(z.literal("")),
  remarks: z.string().trim().optional().or(z.literal("")),
});

export const reviseRequisitionLineQtySchema = z.object({
  lineId: z.string().uuid(),
  qtyApproved: z.coerce.number().nonnegative("Quantity can't be negative"),
});

export const markForDeliverySchema = z.object({
  requisitionId: z.string().uuid(),
  deliveryPort: z.string().trim().min(1, "Enter a delivery port"),
});

export const closeRequisitionSchema = z.object({
  requisitionId: z.string().uuid(),
  closeReason: z.string().trim().min(1, "Say why this is being closed"),
});

// One receiving action can touch several lines at once (a single delivery
// usually brings more than one item) and can be partial — a line with 0 (or
// omitted) here just isn't touched this round, and stays open for a later
// delivery. `receivedQtys` arrives as a JSON-encoded { [lineId]: number }.
export const receiveRequisitionLinesSchema = z.object({
  requisitionId: z.string().uuid(),
  receivedQtys: z.string().transform((s, ctx) => {
    try {
      const parsed = z.record(z.string().uuid(), z.number().positive()).parse(JSON.parse(s));
      return parsed;
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid receiving payload" });
      return z.NEVER;
    }
  }),
});
