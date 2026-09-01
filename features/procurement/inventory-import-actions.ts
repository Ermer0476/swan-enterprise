"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { parseInventoryImportWorkbook, type ParsedInventoryRow, type FlaggedInventoryRow } from "./inventory-import-parser";
import { STORES_CATEGORIES, STORES_CATEGORY_LABELS, REQUISITION_DEPARTMENTS } from "./schema";

// A SHIPBOARD-department user may only act on their own assigned vessel —
// same guard as ownVesselError in actions.ts (not exported from there, so
// duplicated here rather than reaching across module boundaries for one check).
function ownVesselError(userDepartment: string, userVesselId: string | null, vesselId: string): string | null {
  if (userDepartment === "SHIPBOARD" && userVesselId !== vesselId) {
    return "You can only manage procurement for your own vessel.";
  }
  return null;
}

export type ParseImportResult = {
  ok: boolean;
  error: string | null;
  rows: ParsedInventoryRow[];
  flagged: FlaggedInventoryRow[];
  sheetsScanned: string[];
  sheetsSkipped: string[];
};

const EMPTY_PARSE: Omit<ParseImportResult, "ok" | "error"> = { rows: [], flagged: [], sheetsScanned: [], sheetsSkipped: [] };

/** Step 1 of the import flow — parses the uploaded workbook and hands the
 * result back to the client for review. Nothing is written to the database
 * here; that only happens once the vessel confirms via commitInventoryImportAction. */
export async function parseInventoryImportAction(_prev: ParseImportResult, formData: FormData): Promise<ParseImportResult> {
  const user = await requirePermission("procurement:create");
  const vesselId = String(formData.get("vesselId") ?? "");
  const vesselErr = ownVesselError(user.department, user.vesselId, vesselId);
  if (vesselErr) return { ok: false, error: vesselErr, ...EMPTY_PARSE };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file to upload", ...EMPTY_PARSE };
  if (!/\.(xlsx|xls|xlsm)$/i.test(file.name)) {
    return { ok: false, error: "Only Excel files (.xlsx, .xls, .xlsm) are supported", ...EMPTY_PARSE };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { rows, flagged, sheetsScanned, sheetsSkipped, error } = parseInventoryImportWorkbook(buffer);
  if (error) return { ok: false, error, ...EMPTY_PARSE };
  if (rows.length === 0 && flagged.length === 0) {
    return {
      ok: false,
      error: 'No inventory table was recognized in this file — looked for an "ITEM CODE" header row on every sheet.',
      ...EMPTY_PARSE,
    };
  }

  return { ok: true, error: null, rows, flagged, sheetsScanned, sheetsSkipped };
}

const commitRowSchema = z.object({
  subGroup: z.string().nullable(),
  name: z.string().min(1),
  unit: z.string().min(1),
  qtyNew: z.number().nullable(),
  qtyUsable: z.number().nullable(),
  qtyReconditioned: z.number().nullable(),
  remarks: z.string().nullable(),
  location: z.string().nullable(),
});

export type CommitImportResult = { ok: boolean; error: string | null; created: number; merged: number };
const commitFail = (error: string): CommitImportResult => ({ ok: false, error, created: 0, merged: 0 });

/** Step 2 — the vessel has reviewed (and possibly edited/removed) the parsed
 * rows client-side; this writes exactly what's confirmed. Same
 * create-or-merge-by-name behavior as adding items one at a time from
 * Update Inventory: a name that already exists in this vessel's catalogue
 * gets an additional ledger event instead of a duplicate catalogue row. */
export async function commitInventoryImportAction(_prev: CommitImportResult, formData: FormData): Promise<CommitImportResult> {
  const user = await requirePermission("procurement:create");
  const vesselId = String(formData.get("vesselId") ?? "");
  const vesselErr = ownVesselError(user.department, user.vesselId, vesselId);
  if (vesselErr) return commitFail(vesselErr);

  const department = z.enum(REQUISITION_DEPARTMENTS).safeParse(formData.get("department"));
  if (!department.success) return commitFail("Choose a department");
  const category = z.enum(STORES_CATEGORIES).safeParse(formData.get("category"));
  if (!category.success) return commitFail("Choose a category");

  const occurredAtRaw = formData.get("occurredAt");
  const occurredAt = occurredAtRaw ? new Date(String(occurredAtRaw)) : new Date();
  if (isNaN(occurredAt.getTime())) return commitFail("Invalid effective date");

  let parsedRows: z.infer<typeof commitRowSchema>[];
  try {
    parsedRows = z.array(commitRowSchema).min(1).parse(JSON.parse(String(formData.get("rows") ?? "[]")));
  } catch {
    return commitFail("No rows to import");
  }

  let created = 0;
  let merged = 0;

  for (const row of parsedRows) {
    const existing = await prisma.storesCatalogueItem.findFirst({
      where: { companyId: user.companyId, vesselId, deletedAt: null, name: { equals: row.name, mode: "insensitive" } },
    });

    let itemId: string;
    if (existing) {
      itemId = existing.id;
      merged++;
    } else {
      const item = await prisma.storesCatalogueItem.create({
        data: {
          companyId: user.companyId,
          vesselId,
          name: row.name,
          category: category.data,
          department: department.data,
          unit: row.unit,
          subGroup: row.subGroup,
          remarks: row.remarks,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });
      itemId = item.id;
      created++;
    }

    const conditions: ["NEW" | "USABLE" | "RECONDITIONED", number | null][] = [
      ["NEW", row.qtyNew],
      ["USABLE", row.qtyUsable],
      ["RECONDITIONED", row.qtyReconditioned],
    ];
    for (const [condition, quantity] of conditions) {
      if (quantity === null) continue;
      await prisma.inventoryEvent.create({
        data: {
          companyId: user.companyId,
          vesselId,
          itemType: "STORES",
          itemId,
          eventType: existing ? "ADJUSTMENT" : "OPENING",
          condition,
          quantity,
          location: row.location,
          remarks: row.remarks,
          sourceType: "MANUAL",
          occurredAt,
          createdBy: user.id,
        },
      });
    }
  }

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "StoresCatalogueItem",
    entityId: vesselId,
    summary: `Imported ${parsedRows.length} inventory row(s) from Excel into ${STORES_CATEGORY_LABELS[category.data]} (${created} new, ${merged} merged into existing items)`,
  });

  revalidatePath(`/procurement/${vesselId}/inventory`);
  revalidatePath(`/procurement/${vesselId}/inventory/update`);
  revalidatePath("/procurement/catalogue/stores");

  return { ok: true, error: null, created, merged };
}
