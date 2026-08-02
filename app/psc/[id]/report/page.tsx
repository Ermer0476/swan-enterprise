import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { getPsc } from "@/features/psc/queries";
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

// Clean, fully read-only view of a PSC inspection — for looking at "what the
// document looks like" without touching Print, and for the browser's print
// output when Print IS used. Lives outside the (app) route group on purpose:
// no Sidebar/Topbar, so there's nothing to hide either on screen or on paper.
export default async function PscReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("psc:read");
  const { id } = await params;
  const insp = await getPsc(user.companyId, id);
  if (!insp) notFound();

  // Once linked, the NCR is the single source of truth for root cause and
  // corrective actions (see createNcrAction) — read through to it directly.
  const deficiencyIds = insp.deficiencies.map((d) => d.id);
  const ncrBySourceId = await listNcrsBySourceEntityIds(user.companyId, deficiencyIds);
  const unlinkedIds = deficiencyIds.filter((did) => !ncrBySourceId[did]);
  const linkedNcrIds = Object.values(ncrBySourceId).map((n) => n.id);

  const [pscCapaRows, ncrCapaRows, ncrRootCauses, reportAttachments] = await Promise.all([
    listAllCapaActionsForEntities(user.companyId, "PscDeficiency", unlinkedIds),
    listAllCapaActionsForEntities(user.companyId, "NonConformity", linkedNcrIds),
    listNcrRootCauses(user.companyId, linkedNcrIds),
    listAttachments(user.companyId, "PscInspection", insp.id),
  ]);

  const toView = (row: (typeof pscCapaRows)[number]): CapaSummaryRowView => ({
    ...row,
    targetDate: row.targetDate ? row.targetDate.toISOString() : null,
    closedDate: row.closedDate ? row.closedDate.toISOString() : null,
  });

  const allCapaRowsByDeficiency: Record<string, CapaSummaryRowView[]> = {};
  for (const row of pscCapaRows) {
    (allCapaRowsByDeficiency[row.entityId] ??= []).push(toView(row));
  }
  const ncrRowsByNcrId: Record<string, CapaSummaryRowView[]> = {};
  for (const row of ncrCapaRows) {
    (ncrRowsByNcrId[row.entityId] ??= []).push(toView(row));
  }
  const rootCauseByDeficiency: Record<string, { category: string | null; subCategory: string | null; description: string | null }> = {};
  for (const d of insp.deficiencies) {
    const linked = ncrBySourceId[d.id];
    if (linked) {
      allCapaRowsByDeficiency[d.id] = ncrRowsByNcrId[linked.id] ?? [];
      rootCauseByDeficiency[d.id] = {
        category: ncrRootCauses[linked.id]?.rootCauseCategory ?? null,
        subCategory: ncrRootCauses[linked.id]?.rootCauseSubCategory ?? null,
        description: ncrRootCauses[linked.id]?.rootCause ?? null,
      };
    } else {
      rootCauseByDeficiency[d.id] = { category: d.rootCauseCategory, subCategory: d.rootCauseSubCategory, description: d.rootCause };
    }
  }

  const meta = [
    { label: "Vessel", value: insp.vessel?.name ?? "—" },
    { label: "MOU region", value: insp.mouRegion ?? "—" },
    { label: "Port", value: insp.port ?? "—" },
    { label: "Date", value: formatDate(insp.inspectionDate) },
    { label: "Closed", value: insp.closedAt ? formatDate(insp.closedAt) : "—" },
  ];

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/psc/${insp.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to record
        </Link>
        <PrintButton />
      </div>

      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{insp.refNo} — {insp.authority}</h1>
        <div className="flex shrink-0 items-center gap-2">
          {insp.detained ? <Badge tone="danger">Detained</Badge> : <Badge tone="success">Not detained</Badge>}
          <Badge tone={lifecycleStatusTone(insp.status)}>{humanize(insp.status)}</Badge>
        </div>
      </div>

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
        <CardHeader><CardTitle>Deficiencies</CardTitle></CardHeader>
        <CardContent>
          {insp.deficiencies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deficiencies recorded.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {insp.deficiencies.map((d) => {
                const capaRows = allCapaRowsByDeficiency[d.id] ?? [];
                const resolved = capaRows.length > 0 && capaRows.every((r) => r.status === "CLOSED");
                return (
                <li key={d.id} className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {d.natureCode && <span className="font-mono">Code {d.natureCode}</span>}
                    {d.reference && <span>· {d.reference}</span>}
                    {d.actionCode && <Badge tone="accent">Action {d.actionCode}</Badge>}
                    <Badge tone={resolved ? "success" : "warning"}>
                      {resolved ? "Rectified" : "Open"}
                    </Badge>
                  </div>
                  <p className="text-sm">{d.description}</p>
                  {rootCauseByDeficiency[d.id]?.category && (
                    <p className="text-sm text-muted-foreground">
                      Root cause: {formatRootCause(
                        rootCauseByDeficiency[d.id]!.category as RootCauseCategoryValue | null,
                        rootCauseByDeficiency[d.id]!.subCategory,
                      )}
                      {rootCauseByDeficiency[d.id]!.description && ` — ${rootCauseByDeficiency[d.id]!.description}`}
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
