import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getFlagInspection } from "@/features/flag-inspections/queries";
import { listNcrsBySourceEntityIds, listNcrRootCauses } from "@/features/non-conformities/queries";
import { listAllCapaActionsForEntities } from "@/features/capa/queries";
import { listAttachments } from "@/features/attachments/queries";
import { AttachmentList } from "@/components/attachments/attachment-list";
import {
  addFindingAction,
  deleteFindingAction,
  saveFindingRootCauseAction,
  closeFlagInspectionAction,
  deleteFlagInspectionAction,
} from "@/features/flag-inspections/actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/utils";
import { lifecycleStatusTone } from "@/lib/status";
import { AuditFindingsPanel } from "@/components/audit/findings-panel";
import { AuditStatusActions } from "@/components/audit/audit-status-actions";
import type { AuditFindingCategory, RootCauseValue, CapaEntityRef } from "@/components/audit/types";
import type { CapaRowView, CapaSummaryRowView } from "@/components/capa/capa-tracker";
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

export default async function FlagInspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("flaginsp:read");
  const { id } = await params;
  const isShipboard = user.department === "SHIPBOARD";
  const vesselId = isShipboard ? user.vesselId ?? "__no-vessel-assigned__" : undefined;
  const audit = await getFlagInspection(user.companyId, id, vesselId);
  if (!audit) notFound();

  const editable = can(user, "flaginsp:update") && audit.status !== "CLOSED";
  // The vessel can mark its own findings' corrective actions done/not done
  // (status + closed date only) without the full office edit permission —
  // the inspection was already fetched scoped to their own vessel above.
  const canRespond = isShipboard && can(user, "capa:respond") && audit.status !== "CLOSED";
  const canClose = can(user, "flaginsp:close");
  const canDelete = can(user, "flaginsp:delete");
  const canCreateNcr = can(user, "ncr:create");
  const canUpdateNcr = can(user, "ncr:update");
  const findingIds = audit.findings.map((f) => f.id);
  const ncrBySourceId = await listNcrsBySourceEntityIds(user.companyId, findingIds);

  // Once a finding is raised into an NCR, the NCR is the single source of
  // truth for root cause + corrective actions (see createNcrAction) — read
  // and write through to it directly instead of a separate copy.
  const unlinkedIds = findingIds.filter((fid) => !ncrBySourceId[fid]);
  const linkedNcrIds = Object.values(ncrBySourceId).map((n) => n.id);
  const [ownCapaRows, ncrCapaRows, ncrRootCauses, reportAttachments] = await Promise.all([
    listAllCapaActionsForEntities(user.companyId, "FlagInspectionFinding", unlinkedIds),
    listAllCapaActionsForEntities(user.companyId, "NonConformity", linkedNcrIds),
    listNcrRootCauses(user.companyId, linkedNcrIds),
    listAttachments(user.companyId, "FlagInspection", audit.id),
  ]);

  const correctiveRowsByFinding: Record<string, CapaRowView[]> = {};
  const allCapaRowsByFinding: Record<string, CapaSummaryRowView[]> = {};
  const rootCauseByFinding: Record<string, RootCauseValue> = {};
  const capaEntityByFinding: Record<string, CapaEntityRef> = {};

  const attachmentsByFinding: Record<string, { id: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: string }[]> = {};
  for (const f of audit.findings) {
    attachmentsByFinding[f.id] = f.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  for (const f of audit.findings) {
    const linked = ncrBySourceId[f.id];
    capaEntityByFinding[f.id] = linked
      ? { entityType: "NonConformity", entityId: linked.id }
      : { entityType: "FlagInspectionFinding", entityId: f.id };
    rootCauseByFinding[f.id] = linked
      ? {
          category: ncrRootCauses[linked.id]?.rootCauseCategory ?? null,
          subCategory: ncrRootCauses[linked.id]?.rootCauseSubCategory ?? null,
          description: ncrRootCauses[linked.id]?.rootCause ?? null,
        }
      : { category: f.rootCauseCategory, subCategory: f.rootCauseSubCategory, description: f.rootCause };
  }

  for (const row of ownCapaRows) {
    const view = toRowView(row);
    (allCapaRowsByFinding[row.entityId] ??= []).push({ ...view, kind: row.kind });
    if (row.kind === "CORRECTIVE") {
      (correctiveRowsByFinding[row.entityId] ??= []).push(view);
    }
  }
  const ncrRowsByNcrId: Record<string, CapaSummaryRowView[]> = {};
  for (const row of ncrCapaRows) {
    const view = toRowView(row);
    (ncrRowsByNcrId[row.entityId] ??= []).push({ ...view, kind: row.kind });
  }
  for (const f of audit.findings) {
    const linked = ncrBySourceId[f.id];
    if (!linked) continue;
    const rows = ncrRowsByNcrId[linked.id] ?? [];
    allCapaRowsByFinding[f.id] = rows;
    correctiveRowsByFinding[f.id] = rows.filter((r) => r.kind === "CORRECTIVE");
  }

  const meta = [
    { label: "Standard", value: audit.standard },
    { label: "Body", value: audit.auditBody ?? "—" },
    { label: "Vessel", value: audit.vessel?.name ?? "Shore / office" },
    { label: "Date", value: formatDate(audit.auditDate) },
    { label: "Lead inspector", value: audit.auditorName ?? "—" },
    { label: "Closed", value: audit.closedAt ? formatDate(audit.closedAt) : "—" },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/flag-inspections" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Flag Inspections
      </Link>

      <PageHeader
        title={`${audit.refNo} — ${audit.scope}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={lifecycleStatusTone(audit.status)}>{humanize(audit.status)}</Badge>
            <Link href={`/flag-inspections/${audit.id}/report`} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="outline" size="sm">
                <FileText className="h-4 w-4" /> Show Report
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {meta.map((m) => (
          <div key={m.label}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</div>
            <div className="mt-0.5 text-sm font-medium">{m.value}</div>
          </div>
        ))}
      </div>

      {audit.summary && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-wrap text-sm">{audit.summary}</p></CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader><CardTitle>Report Attachments</CardTitle></CardHeader>
        <CardContent>
          <AttachmentList
            entityType="FlagInspection"
            entityId={audit.id}
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
        <CardHeader><CardTitle>Findings</CardTitle></CardHeader>
        <CardContent>
          <AuditFindingsPanel
            auditId={audit.id}
            editable={editable}
            canRespond={canRespond}
            addAction={addFindingAction}
            deleteAction={deleteFindingAction}
            saveRootCauseAction={saveFindingRootCauseAction}
            findings={audit.findings.map((f) => ({
              id: f.id,
              category: f.category as AuditFindingCategory,
              reference: f.reference,
              description: f.description,
            }))}
            canCreateNcr={canCreateNcr}
            canUpdateNcr={canUpdateNcr}
            ncrBySourceId={ncrBySourceId}
            ncrContext={{
              vesselId: audit.vesselId,
              reportRefNo: audit.refNo,
              raisedAt: audit.auditDate.toISOString().slice(0, 10),
              source: "FLAG_STATE",
            }}
            correctiveRowsByFinding={correctiveRowsByFinding}
            allCapaRowsByFinding={allCapaRowsByFinding}
            rootCauseByFinding={rootCauseByFinding}
            capaEntityByFinding={capaEntityByFinding}
            entityType="FlagInspectionFinding"
            attachmentsByFinding={attachmentsByFinding}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Inspection status</CardTitle></CardHeader>
        <CardContent>
          <AuditStatusActions
            auditId={audit.id}
            status={audit.status}
            canClose={canClose}
            canDelete={canDelete}
            closeAction={closeFlagInspectionAction}
            deleteAction={deleteFlagInspectionAction}
          />
        </CardContent>
      </Card>
    </div>
  );
}
