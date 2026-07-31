import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getExternalAudit } from "@/features/external-audits/queries";
import { listNcrsBySourceEntityIds } from "@/features/non-conformities/queries";
import {
  addFindingAction,
  updateFindingAction,
  deleteFindingAction,
  closeExternalAuditAction,
  deleteExternalAuditAction,
} from "@/features/external-audits/actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/utils";
import { AuditFindingsPanel } from "@/components/audit/findings-panel";
import { AuditStatusActions } from "@/components/audit/audit-status-actions";
import type { AuditFindingCategory } from "@/components/audit/types";

function statusTone(s: string) {
  return s === "CLOSED" ? "success" : s === "IN_PROGRESS" ? "warning" : "accent";
}

export default async function ExternalAuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("eaudit:read");
  const { id } = await params;
  const audit = await getExternalAudit(user.companyId, id);
  if (!audit) notFound();

  const editable = can(user, "eaudit:update") && audit.status !== "CLOSED";
  const canClose = can(user, "eaudit:close");
  const canDelete = can(user, "eaudit:delete");
  const canCreateNcr = can(user, "ncr:create");
  const ncrBySourceId = await listNcrsBySourceEntityIds(
    user.companyId,
    audit.findings.map((f) => f.id),
  );

  const meta = [
    { label: "Standard", value: audit.standard },
    { label: "Body", value: audit.auditBody ?? "—" },
    { label: "Vessel", value: audit.vessel?.name ?? "Shore / office" },
    { label: "Date", value: formatDate(audit.auditDate) },
    { label: "Lead auditor", value: audit.auditorName ?? "—" },
    { label: "Closed", value: audit.closedAt ? formatDate(audit.closedAt) : "—" },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/external-audits" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to External Audits
      </Link>

      <PageHeader
        title={`${audit.refNo} — ${audit.scope}`}
        actions={<Badge tone={statusTone(audit.status)}>{humanize(audit.status)}</Badge>}
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
        <CardHeader><CardTitle>Audit status</CardTitle></CardHeader>
        <CardContent>
          <AuditStatusActions
            auditId={audit.id}
            status={audit.status}
            canClose={canClose}
            canDelete={canDelete}
            closeAction={closeExternalAuditAction}
            deleteAction={deleteExternalAuditAction}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Findings</CardTitle></CardHeader>
        <CardContent>
          <AuditFindingsPanel
            auditId={audit.id}
            editable={editable}
            addAction={addFindingAction}
            updateAction={updateFindingAction}
            deleteAction={deleteFindingAction}
            findings={audit.findings.map((f) => ({
              id: f.id,
              category: f.category as AuditFindingCategory,
              reference: f.reference,
              description: f.description,
              correctiveAction: f.correctiveAction,
              status: f.status,
            }))}
            canCreateNcr={canCreateNcr}
            ncrBySourceId={ncrBySourceId}
            ncrContext={{
              vesselId: audit.vesselId,
              reportRefNo: audit.refNo,
              raisedAt: audit.auditDate.toISOString().slice(0, 10),
              source: "EXTERNAL_AUDIT",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
