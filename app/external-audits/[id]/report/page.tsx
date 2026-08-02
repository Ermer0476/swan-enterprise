import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { getExternalAudit } from "@/features/external-audits/queries";
import { listNcrsBySourceEntityIds, listNcrRootCauses } from "@/features/non-conformities/queries";
import { listAllCapaActionsForEntities } from "@/features/capa/queries";
import { CapaSummaryTable, type CapaSummaryRowView } from "@/components/capa/capa-tracker";
import { formatRootCause, type RootCauseCategoryValue } from "@/lib/root-cause";
import { listAttachments } from "@/features/attachments/queries";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/utils";
import { lifecycleStatusTone } from "@/lib/status";
import { PrintButton } from "@/components/ui/print-button";
import { auditCategoryLabel, auditCategoryTone, type AuditFindingCategory } from "@/components/audit/types";

// Clean, fully read-only view of an External Audit — for looking at "what the
// document looks like" without touching Print, and for the browser's print
// output when Print IS used. Lives outside the (app) route group on purpose:
// no Sidebar/Topbar, so there's nothing to hide either on screen or on paper.
export default async function ExternalAuditReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("eaudit:read");
  const { id } = await params;
  const audit = await getExternalAudit(user.companyId, id);
  if (!audit) notFound();

  // Once linked, the NCR is the single source of truth for root cause and
  // corrective actions (see createNcrAction) — read through to it directly.
  const findingIds = audit.findings.map((f) => f.id);
  const ncrBySourceId = await listNcrsBySourceEntityIds(user.companyId, findingIds);
  const unlinkedIds = findingIds.filter((fid) => !ncrBySourceId[fid]);
  const linkedNcrIds = Object.values(ncrBySourceId).map((n) => n.id);

  const [ownCapaRows, ncrCapaRows, ncrRootCauses, reportAttachments] = await Promise.all([
    listAllCapaActionsForEntities(user.companyId, "ExternalAuditFinding", unlinkedIds),
    listAllCapaActionsForEntities(user.companyId, "NonConformity", linkedNcrIds),
    listNcrRootCauses(user.companyId, linkedNcrIds),
    listAttachments(user.companyId, "ExternalAudit", audit.id),
  ]);

  const toView = (row: (typeof ownCapaRows)[number]): CapaSummaryRowView => ({
    ...row,
    targetDate: row.targetDate ? row.targetDate.toISOString() : null,
    closedDate: row.closedDate ? row.closedDate.toISOString() : null,
  });

  const allCapaRowsByFinding: Record<string, CapaSummaryRowView[]> = {};
  for (const row of ownCapaRows) {
    (allCapaRowsByFinding[row.entityId] ??= []).push(toView(row));
  }
  const ncrRowsByNcrId: Record<string, CapaSummaryRowView[]> = {};
  for (const row of ncrCapaRows) {
    (ncrRowsByNcrId[row.entityId] ??= []).push(toView(row));
  }
  const rootCauseByFinding: Record<string, { category: string | null; subCategory: string | null; description: string | null }> = {};
  for (const f of audit.findings) {
    const linked = ncrBySourceId[f.id];
    if (linked) {
      allCapaRowsByFinding[f.id] = ncrRowsByNcrId[linked.id] ?? [];
      rootCauseByFinding[f.id] = {
        category: ncrRootCauses[linked.id]?.rootCauseCategory ?? null,
        subCategory: ncrRootCauses[linked.id]?.rootCauseSubCategory ?? null,
        description: ncrRootCauses[linked.id]?.rootCause ?? null,
      };
    } else {
      rootCauseByFinding[f.id] = { category: f.rootCauseCategory, subCategory: f.rootCauseSubCategory, description: f.rootCause };
    }
  }

  const meta = [
    { label: "Standard", value: audit.standard },
    { label: "Body", value: audit.auditBody ?? "—" },
    { label: "Vessel", value: audit.vessel?.name ?? "Shore / office" },
    { label: "Date", value: formatDate(audit.auditDate) },
    { label: "Lead auditor", value: audit.auditorName ?? "—" },
    { label: "Closed", value: audit.closedAt ? formatDate(audit.closedAt) : "—" },
  ];

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/external-audits/${audit.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to record
        </Link>
        <PrintButton />
      </div>

      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{audit.refNo} — {audit.scope}</h1>
        <Badge tone={lifecycleStatusTone(audit.status)}>{humanize(audit.status)}</Badge>
      </div>

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
            entityType="ExternalAudit"
            entityId={audit.id}
            editable={false}
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

      <Card>
        <CardHeader><CardTitle>Findings</CardTitle></CardHeader>
        <CardContent>
          {audit.findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No findings recorded.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {audit.findings.map((f) => {
                const capaRows = allCapaRowsByFinding[f.id] ?? [];
                const resolved = capaRows.length > 0 && capaRows.every((r) => r.status === "CLOSED");
                return (
                <li key={f.id} className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge tone={auditCategoryTone(f.category as AuditFindingCategory)}>
                      {auditCategoryLabel(f.category as AuditFindingCategory)}
                    </Badge>
                    {f.reference && <span className="font-mono">{f.reference}</span>}
                    <Badge tone={resolved ? "success" : "warning"}>
                      {resolved ? "Closed" : "Open"}
                    </Badge>
                  </div>
                  <p className="text-sm">{f.description}</p>
                  {rootCauseByFinding[f.id]?.category && (
                    <p className="text-sm text-muted-foreground">
                      Root cause: {formatRootCause(
                        rootCauseByFinding[f.id]!.category as RootCauseCategoryValue | null,
                        rootCauseByFinding[f.id]!.subCategory,
                      )}
                      {rootCauseByFinding[f.id]!.description && ` — ${rootCauseByFinding[f.id]!.description}`}
                    </p>
                  )}
                  {capaRows.length > 0 && (
                    <div className="pt-1">
                      <CapaSummaryTable rows={capaRows} editable={false} />
                    </div>
                  )}
                </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
