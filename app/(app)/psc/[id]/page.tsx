import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getPsc } from "@/features/psc/queries";
import { listNcrsBySourceEntityIds, listNcrRootCauses } from "@/features/non-conformities/queries";
import { listAllCapaActionsForEntities } from "@/features/capa/queries";
import type { CapaRowView, CapaSummaryRowView } from "@/components/capa/capa-tracker";
import { listAttachments } from "@/features/attachments/queries";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/utils";
import { lifecycleStatusTone } from "@/lib/status";
import { DeficienciesPanel } from "./deficiencies-panel";
import { PscActions } from "./psc-actions";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

function toRowView(r: {
  id: string;
  code: string;
  action: string;
  responsible: string | null;
  targetDate: Date | null;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
  closedDate: Date | null;
}): CapaRowView {
  return {
    ...r,
    targetDate: r.targetDate ? r.targetDate.toISOString() : null,
    closedDate: r.closedDate ? r.closedDate.toISOString() : null,
  };
}

export default async function PscDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("psc:read");
  const { id } = await params;
  const insp = await getPsc(user.companyId, id);
  if (!insp) notFound();

  const editable = can(user, "psc:update") && insp.status !== "CLOSED";
  const canClose = can(user, "psc:close");
  const canDelete = can(user, "psc:delete");
  const canCreateNcr = can(user, "ncr:create");
  const canUpdateNcr = can(user, "ncr:update");
  const deficiencyIds = insp.deficiencies.map((d) => d.id);
  const ncrBySourceId = await listNcrsBySourceEntityIds(user.companyId, deficiencyIds);

  // Once a deficiency is raised into an NCR, the NCR is the single source of
  // truth for root cause + corrective actions (see createNcrAction) — read
  // and write through to it directly instead of a separate copy, so editing
  // from either PSC or the NCR page updates the same record.
  const unlinkedIds = deficiencyIds.filter((did) => !ncrBySourceId[did]);
  const linkedNcrIds = Object.values(ncrBySourceId).map((n) => n.id);
  const [pscCapaRows, ncrCapaRows, ncrRootCauses, reportAttachments] = await Promise.all([
    listAllCapaActionsForEntities(user.companyId, "PscDeficiency", unlinkedIds),
    listAllCapaActionsForEntities(user.companyId, "NonConformity", linkedNcrIds),
    listNcrRootCauses(user.companyId, linkedNcrIds),
    listAttachments(user.companyId, "PscInspection", insp.id),
  ]);

  const correctiveRowsByDeficiency: Record<string, CapaRowView[]> = {};
  const allCapaRowsByDeficiency: Record<string, CapaSummaryRowView[]> = {};
  const rootCauseByDeficiency: Record<string, { category: string | null; subCategory: string | null; description: string | null }> = {};
  const capaEntityByDeficiency: Record<string, { entityType: string; entityId: string }> = {};

  const attachmentsByDeficiency: Record<string, { id: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: string }[]> = {};
  for (const d of insp.deficiencies) {
    attachmentsByDeficiency[d.id] = d.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  for (const d of insp.deficiencies) {
    const linked = ncrBySourceId[d.id];
    capaEntityByDeficiency[d.id] = linked
      ? { entityType: "NonConformity", entityId: linked.id }
      : { entityType: "PscDeficiency", entityId: d.id };
    rootCauseByDeficiency[d.id] = linked
      ? {
          category: ncrRootCauses[linked.id]?.rootCauseCategory ?? null,
          subCategory: ncrRootCauses[linked.id]?.rootCauseSubCategory ?? null,
          description: ncrRootCauses[linked.id]?.rootCause ?? null,
        }
      : { category: d.rootCauseCategory, subCategory: d.rootCauseSubCategory, description: d.rootCause };
  }

  for (const row of pscCapaRows) {
    const view = toRowView(row);
    (allCapaRowsByDeficiency[row.entityId] ??= []).push({ ...view, kind: row.kind });
    if (row.kind === "CORRECTIVE") {
      (correctiveRowsByDeficiency[row.entityId] ??= []).push(view);
    }
  }
  // NCR CAPA rows are keyed by the NCR's id — re-key them under whichever
  // deficiency(s) point at that NCR so the panel can look them up by
  // deficiency id the same way regardless of link status.
  const ncrRowsByNcrId: Record<string, CapaSummaryRowView[]> = {};
  for (const row of ncrCapaRows) {
    const view = toRowView(row);
    (ncrRowsByNcrId[row.entityId] ??= []).push({ ...view, kind: row.kind });
  }
  for (const d of insp.deficiencies) {
    const linked = ncrBySourceId[d.id];
    if (!linked) continue;
    const rows = ncrRowsByNcrId[linked.id] ?? [];
    allCapaRowsByDeficiency[d.id] = rows;
    correctiveRowsByDeficiency[d.id] = rows.filter((r) => r.kind === "CORRECTIVE");
  }

  const meta = [
    { label: "Vessel", value: insp.vessel?.name ?? "—" },
    { label: "MOU region", value: insp.mouRegion ?? "—" },
    { label: "Port", value: insp.port ?? "—" },
    { label: "Date", value: formatDate(insp.inspectionDate) },
    { label: "Closed", value: insp.closedAt ? formatDate(insp.closedAt) : "—" },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/psc" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to PSC Inspections
      </Link>

      <PageHeader
        title={`${insp.refNo} — ${insp.authority}`}
        actions={
          <div className="flex items-center gap-2">
            {insp.detained ? <Badge tone="danger">Detained</Badge> : <Badge tone="success">Not detained</Badge>}
            <Badge tone={lifecycleStatusTone(insp.status)}>{humanize(insp.status)}</Badge>
            <Link href={`/psc/${insp.id}/report`} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="outline" size="sm">
                <FileText className="h-4 w-4" /> Show Report
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {meta.map((m) => (
          <div key={m.label}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</div>
            <div className="mt-0.5 text-sm font-medium">{m.value}</div>
          </div>
        ))}
      </div>

      {insp.summary && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-wrap text-sm">{insp.summary}</p></CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader><CardTitle>Report Attachments</CardTitle></CardHeader>
        <CardContent>
          <AttachmentList
            entityType="PscInspection"
            entityId={insp.id}
            editable={editable}
            attachments={reportAttachments.map((a) => ({
              id: a.id,
              fileName: a.fileName,
              mimeType: a.mimeType,
              sizeBytes: a.sizeBytes,
              createdAt: a.createdAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Deficiencies</CardTitle></CardHeader>
        <CardContent>
          <DeficienciesPanel
            inspectionId={insp.id}
            editable={editable}
            deficiencies={insp.deficiencies.map((d) => ({
              id: d.id,
              natureCode: d.natureCode,
              reference: d.reference,
              actionCode: d.actionCode,
              description: d.description,
            }))}
            canCreateNcr={canCreateNcr}
            canUpdateNcr={canUpdateNcr}
            ncrBySourceId={ncrBySourceId}
            ncrContext={{
              vesselId: insp.vesselId,
              reportRefNo: insp.refNo,
              port: insp.port,
              raisedAt: insp.inspectionDate.toISOString().slice(0, 10),
            }}
            correctiveRowsByDeficiency={correctiveRowsByDeficiency}
            allCapaRowsByDeficiency={allCapaRowsByDeficiency}
            rootCauseByDeficiency={rootCauseByDeficiency}
            capaEntityByDeficiency={capaEntityByDeficiency}
            attachmentsByDeficiency={attachmentsByDeficiency}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Inspection status</CardTitle></CardHeader>
        <CardContent>
          <PscActions inspectionId={insp.id} status={insp.status} canClose={canClose} canDelete={canDelete} />
        </CardContent>
      </Card>
    </div>
  );
}
