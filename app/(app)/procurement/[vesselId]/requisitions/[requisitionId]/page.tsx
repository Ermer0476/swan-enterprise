import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/rbac";
import { getRequisition, listStoresCatalogue, listSparesCatalogue, getRobMap } from "@/features/procurement/queries";
import { REQUISITION_REVISION_STATUS_LABELS, REQUISITION_CATEGORY_LABELS, REQUISITION_DEPARTMENT_LABELS } from "@/features/procurement/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddLineForm } from "./add-line-form";
import { LineRow } from "./line-row";
import { SubmitForApprovalButton, MasterApproveButton } from "./submit-approve-buttons";
import { MarkForQuotationButton, MarkForDeliveryForm, CloseRequisitionForm } from "./office-pipeline-controls";
import { ReceiveDeliveryForm } from "./receive-delivery-form";

const STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "accent" | "danger"> = {
  DRAFT: "neutral",
  PENDING_MASTER_APPROVAL: "warning",
  APPROVED_BY_MASTER: "success",
  SENT_TO_OFFICE: "accent",
  FOR_QUOTATION: "warning",
  FOR_DELIVERY: "accent",
  RECEIVED: "success",
  CLOSED: "danger",
};

export default async function RequisitionDetailPage({ params }: { params: Promise<{ vesselId: string; requisitionId: string }> }) {
  const user = await requirePermission("procurement:read");
  const { vesselId, requisitionId } = await params;
  const requisition = await getRequisition(user.companyId, requisitionId);
  if (!requisition || requisition.vesselId !== vesselId) notFound();

  const revision = requisition.currentRevision;
  const isDraft = revision?.status === "DRAFT";
  const canCreate = can(user, "procurement:create");
  const canApprove = can(user, "procurement:approve") && user.rank === "Master";
  const canOfficeReview = revision?.status === "SENT_TO_OFFICE" && can(user, "procurement:office-review");
  const canMarkForQuotation = revision?.status === "SENT_TO_OFFICE" && can(user, "procurement:office-review");
  const canMarkForDelivery = revision?.status === "FOR_QUOTATION" && can(user, "procurement:office-review");
  const canReceive = revision?.status === "FOR_DELIVERY" && canCreate;
  const canClose =
    !!revision && (["FOR_QUOTATION", "FOR_DELIVERY"] as string[]).includes(revision.status) && can(user, "procurement:office-review");
  const canDownload = !!revision && (["SENT_TO_OFFICE", "FOR_QUOTATION", "FOR_DELIVERY", "RECEIVED"] as string[]).includes(revision.status);

  let addLineOptions: { itemType: "STORES" | "SPARES"; itemId: string; label: string; unit: string; rob: number; impaCode: string | null }[] = [];
  if (isDraft && canCreate) {
    if (requisition.category === "SPARES") {
      const [spares, robMap] = await Promise.all([listSparesCatalogue(user.companyId, vesselId), getRobMap(user.companyId, vesselId, "SPARES")]);
      addLineOptions = spares.map((i) => ({
        itemType: "SPARES" as const,
        itemId: i.id,
        label: `${i.equipmentName} — ${i.makerName} ${i.partNo}`,
        unit: i.unit,
        rob: robMap.get(i.id) ?? 0,
        impaCode: null,
      }));
    } else {
      const [stores, robMap] = await Promise.all([listStoresCatalogue(user.companyId, vesselId), getRobMap(user.companyId, vesselId, "STORES")]);
      addLineOptions = stores
        .filter((i) => i.category === requisition.category)
        .map((i) => ({
          itemType: "STORES" as const,
          itemId: i.id,
          label: i.name,
          unit: i.unit,
          rob: robMap.get(i.id) ?? 0,
          impaCode: i.impaCode,
        }));
    }
  }

  // Lookup map for whichever catalogue this requisition's lines reference —
  // Stores lines for a Stores-category requisition, Spares lines for a
  // Spares-category one (a requisition never mixes both). Spares has no
  // IMPA code, so it stays blank for a Spares requisition. Remarks is NOT
  // sourced here — RequisitionLine.remarks is independent of the catalogue
  // item's own remarks (per-request context vs. per-item description).
  const itemMetaById = new Map<string, { label: string; unit: string; impaCode: string | null }>();
  if (revision && revision.lines.length > 0) {
    if (requisition.category === "SPARES") {
      const spares = await listSparesCatalogue(user.companyId, vesselId);
      for (const i of spares) itemMetaById.set(i.id, { label: `${i.equipmentName} — ${i.makerName} ${i.partNo}`, unit: i.unit, impaCode: null });
    } else {
      const stores = await listStoresCatalogue(user.companyId, vesselId);
      for (const i of stores) itemMetaById.set(i.id, { label: i.name, unit: i.unit, impaCode: i.impaCode });
    }
  }

  const categoryLabel = REQUISITION_CATEGORY_LABELS[requisition.category];
  const draftTitle = `${categoryLabel} Requisition — Draft`;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/procurement/${vesselId}/requisitions`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        ← Back to Requisitions
      </Link>
      <PageHeader
        title={requisition.refNo ?? draftTitle}
        description={`${requisition.vessel.name} · ${REQUISITION_DEPARTMENT_LABELS[requisition.department]} · ${REQUISITION_CATEGORY_LABELS[requisition.category]}`}
      />

      <Card className="mb-4">
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {revision && <Badge tone={STATUS_TONE[revision.status] ?? "neutral"}>{REQUISITION_REVISION_STATUS_LABELS[revision.status]}</Badge>}
              {revision?.requestedBy && <span className="text-sm text-muted-foreground">Requested by {revision.requestedBy}</span>}
              {revision?.deliveryPort && <span className="text-sm text-muted-foreground">→ {revision.deliveryPort}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {isDraft && canCreate && revision && revision.lines.length > 0 && <SubmitForApprovalButton requisitionId={requisition.id} />}
              {revision?.status === "PENDING_MASTER_APPROVAL" && canApprove && <MasterApproveButton requisitionId={requisition.id} />}
              {canDownload && (
                <a href={`/procurement/${vesselId}/requisitions/${requisitionId}/export`}>
                  <Button type="button" variant="outline">
                    Download as Excel
                  </Button>
                </a>
              )}
              {canMarkForQuotation && <MarkForQuotationButton requisitionId={requisition.id} />}
            </div>
          </div>
          {revision?.status === "CLOSED" && revision.closeReason && (
            <p className="text-sm text-muted-foreground">Closed: {revision.closeReason}</p>
          )}
          {canMarkForDelivery && <MarkForDeliveryForm requisitionId={requisition.id} />}
          {canClose && <CloseRequisitionForm requisitionId={requisition.id} />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 text-sm font-semibold">Lines ({revision?.lines.length ?? 0})</div>
          {!revision || revision.lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lines yet.</p>
          ) : (
            <div className="mb-4 overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Item</th>
                    <th className="px-3 py-2 font-medium">Unit</th>
                    <th className="px-3 py-2 font-medium">ROB</th>
                    <th className="px-3 py-2 font-medium">Qnty Req</th>
                    <th className="px-3 py-2 font-medium">IMPA</th>
                    <th className="px-3 py-2 font-medium">Remarks</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {revision.lines.map((line) => (
                    <LineRow
                      key={line.id}
                      line={line}
                      meta={line.itemId ? itemMetaById.get(line.itemId) : undefined}
                      canEdit={isDraft && canCreate}
                      canOfficeReview={canOfficeReview}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {isDraft && canCreate && <AddLineForm revisionId={revision!.id} options={addLineOptions} />}
        </CardContent>
      </Card>

      {canReceive && revision && (
        <Card className="mt-4">
          <CardContent className="pt-5">
            <div className="mb-3 text-sm font-semibold">Receive Delivery</div>
            <ReceiveDeliveryForm
              requisitionId={requisition.id}
              lines={revision.lines
                .filter((l) => !l.cancelled)
                .map((l) => ({
                  id: l.id,
                  label: l.itemType === "NON_CATALOGUE" ? (l.nonCatalogueDescription ?? "Non-catalogue item") : (l.itemId ? (itemMetaById.get(l.itemId)?.label ?? "Unknown item") : "Unknown item"),
                  unit: itemMetaById.get(l.itemId ?? "")?.unit ?? l.unit,
                  qtyExpected: l.qtyApproved ?? l.qtyRequested,
                  qtyReceived: l.qtyReceived,
                }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
