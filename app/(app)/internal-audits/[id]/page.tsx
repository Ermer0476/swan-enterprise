import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getRootCauseSubcategoryOptions } from "@/lib/reference-list";
import { getInternalAudit } from "@/features/internal-audits/queries";
import { listNcrsBySourceEntityIds, listNcrRootCauses } from "@/features/non-conformities/queries";
import { listAllCapaActionsForEntities } from "@/features/capa/queries";
import { listAttachments } from "@/features/attachments/queries";
import { AttachmentList } from "@/components/attachments/attachment-list";
import {
  addFindingAction,
  deleteFindingAction,
  saveFindingRootCauseAction,
  closeInternalAuditAction,
  deleteInternalAuditAction,
} from "@/features/internal-audits/actions";
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
import { DeleteDraftInternalAuditButton, ReportDraftInternalAuditButton } from "./draft-actions";
import { EditDraftInternalAuditForm } from "./edit-draft-form";
import { listVesselOptions } from "@/features/internal-audits/queries";

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

export default async function InternalAuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("iaudit:read");
  const { id } = await params;
  const isShipboard = user.department === "SHIPBOARD";
  const vesselId = isShipboard ? user.vesselId ?? "__no-vessel-assigned__" : undefined;
  const audit = await getInternalAudit(user.companyId, id, user.id, vesselId);
  if (!audit) notFound();

  const isOwnDraft = audit.status === "DRAFT" && can(user, "iaudit:create") && audit.createdBy === user.id;

  if (audit.status === "DRAFT") {
    const vessels = await listVesselOptions(user.companyId);
    return (
      <div className="mx-auto max-w-7xl">
        <Link href="/internal-audits" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Internal Audits
        </Link>
        <PageHeader
          title={`Draft — ${audit.scope}`}
          actions={
            <div className="flex items-center gap-2">
              <Badge tone={lifecycleStatusTone(audit.status)}>{humanize(audit.status)}</Badge>
              {isOwnDraft && <DeleteDraftInternalAuditButton auditId={audit.id} />}
              {isOwnDraft && <ReportDraftInternalAuditButton auditId={audit.id} />}
            </div>
          }
        />
        {isOwnDraft ? (
          <EditDraftInternalAuditForm
            audit={{
              id: audit.id,
              vesselId: audit.vesselId,
              scope: audit.scope,
              standard: audit.standard,
              auditorName: audit.auditorName ?? "",
              auditBody: audit.auditBody ?? "",
              auditDate: audit.auditDate.toISOString().slice(0, 10),
              summary: audit.summary ?? "",
            }}
            vessels={vessels}
          />
        ) : (
          <p className="text-sm text-muted-foreground">You don&apos;t have access to edit this draft.</p>
        )}
      </div>
    );
  }

  const editable = can(user, "iaudit:update") && audit.status !== "CLOSED";
  // The vessel can mark its own findings' corrective actions done/not done
  // (status + closed date only) without the full office edit permission —
  // the audit was already fetched scoped to their own vessel above.
  const canRespond = isShipboard && can(user, "capa:respond") && audit.status !== "CLOSED";
  const canClose = can(user, "iaudit:close");
  const canDelete = can(user, "iaudit:delete");
  const canCreateNcr = can(user, "ncr:create");
  const canUpdateNcr = can(user, "ncr:update");
  const findingIds = audit.findings.map((f) => f.id);
  const ncrBySourceId = await listNcrsBySourceEntityIds(user.companyId, findingIds);

  // Once a finding is raised into an NCR, the NCR is the single source of
  // truth for root cause + corrective actions (see createNcrAction) — read
  // and write through to it directly instead of a separate copy.
  const unlinkedIds = findingIds.filter((fid) => !ncrBySourceId[fid]);
  const linkedNcrIds = Object.values(ncrBySourceId).map((n) => n.id);
  const [ownCapaRows, ncrCapaRows, ncrRootCauses, reportAttachments, rootCauseSubOptions] = await Promise.all([
    listAllCapaActionsForEntities(user.companyId, "InternalAuditFinding", unlinkedIds),
    listAllCapaActionsForEntities(user.companyId, "NonConformity", linkedNcrIds),
    listNcrRootCauses(user.companyId, linkedNcrIds),
    listAttachments(user.companyId, "InternalAudit", audit.id),
    getRootCauseSubcategoryOptions(user.companyId),
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
      : { entityType: "InternalAuditFinding", entityId: f.id };
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
    { label: "Vessel", value: audit.vessel?.name ?? "Shore / office" },
    { label: "Date", value: formatDate(audit.auditDate) },
    { label: "Lead auditor", value: audit.auditorName ?? "—" },
    { label: "Team", value: audit.auditBody ?? "—" },
    { label: "Closed", value: audit.closedAt ? formatDate(audit.closedAt) : "—" },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/internal-audits" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Internal Audits
      </Link>

      <PageHeader
        title={`${audit.refNo} — ${audit.scope}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={lifecycleStatusTone(audit.status)}>{humanize(audit.status)}</Badge>
            <Link href={`/internal-audits/${audit.id}/report`} target="_blank" rel="noopener noreferrer">
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
            entityType="InternalAudit"
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
              reportRefNo: audit.refNo ?? "",
              raisedAt: audit.auditDate.toISOString().slice(0, 10),
              source: "INTERNAL_AUDIT",
            }}
            correctiveRowsByFinding={correctiveRowsByFinding}
            allCapaRowsByFinding={allCapaRowsByFinding}
            rootCauseByFinding={rootCauseByFinding}
            capaEntityByFinding={capaEntityByFinding}
            entityType="InternalAuditFinding"
            attachmentsByFinding={attachmentsByFinding}
            subcategoryOptions={rootCauseSubOptions}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Audit status</CardTitle></CardHeader>
        <CardContent>
          <AuditStatusActions
            auditId={audit.id}
            status={audit.status}
            canClose={canClose}
            canDelete={canDelete}
            closeAction={closeInternalAuditAction}
            deleteAction={deleteInternalAuditAction}
          />
        </CardContent>
      </Card>
    </div>
  );
}
