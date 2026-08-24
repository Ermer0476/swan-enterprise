import * as XLSX from "xlsx";
import { requirePermission } from "@/lib/rbac";
import { getRequisition, listStoresCatalogue, listSparesCatalogue } from "@/features/procurement/queries";
import { REQUISITION_CATEGORY_LABELS, REQUISITION_DEPARTMENT_LABELS } from "@/features/procurement/schema";

/** Plain, supplier-facing quotation request — no internal fields (cancelled
 * lines are dropped entirely rather than shown crossed out, and whatever
 * qtyApproved the office set stands in for qtyRequested since that's what's
 * actually being asked for pricing). */
export async function GET(_req: Request, { params }: { params: Promise<{ vesselId: string; requisitionId: string }> }) {
  const user = await requirePermission("procurement:read");
  const { vesselId, requisitionId } = await params;
  const requisition = await getRequisition(user.companyId, requisitionId);
  if (!requisition || requisition.vesselId !== vesselId || !requisition.currentRevision) {
    return new Response("Not found", { status: 404 });
  }

  const itemMetaById = new Map<string, string>();
  if (requisition.category === "SPARES") {
    const spares = await listSparesCatalogue(user.companyId, vesselId);
    for (const i of spares) itemMetaById.set(i.id, `${i.equipmentName} — ${i.makerName} ${i.partNo}`);
  } else {
    const stores = await listStoresCatalogue(user.companyId, vesselId);
    for (const i of stores) itemMetaById.set(i.id, i.name);
  }

  const lines = requisition.currentRevision.lines.filter((l) => !l.cancelled);

  const headerBlock: (string | number)[][] = [
    ["Swan Shipping Corp. — Request for Quotation"],
    ["Vessel", requisition.vessel.name],
    ["Ref No.", requisition.refNo ?? "(not yet numbered)"],
    ["Department", REQUISITION_DEPARTMENT_LABELS[requisition.department]],
    ["Category", REQUISITION_CATEGORY_LABELS[requisition.category]],
    ["Date", new Date().toLocaleDateString("en-PH")],
    [],
    ["No.", "Item Description", "Unit", "Quantity", "IMPA", "Remarks"],
  ];

  const dataRows = lines.map((l, i) => [
    i + 1,
    l.itemType === "NON_CATALOGUE" ? (l.nonCatalogueDescription ?? "") : (l.itemId ? (itemMetaById.get(l.itemId) ?? "Unknown item") : "Unknown item"),
    l.unit ?? "",
    l.qtyApproved ?? l.qtyRequested,
    l.impaCode ?? "",
    l.remarks ?? "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([...headerBlock, ...dataRows]);
  ws["!cols"] = [{ wch: 6 }, { wch: 45 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 30 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Requisition");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const filename = `${(requisition.refNo ?? "requisition").replace(/[^A-Za-z0-9-]/g, "_")}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
