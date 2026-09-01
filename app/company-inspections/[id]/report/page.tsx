import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { getCompanyInspection } from "@/features/company-inspections/queries";
import {
  COMPANY_INSPECTION_TYPE_LABELS,
  COMPANY_INSPECTION_VISIT_KIND_LABELS,
  SIRE_OBSERVATION_CATEGORY_LABELS,
  VIQ_CHAPTER_TITLES,
} from "@/features/company-inspections/schema";
import { listAllCapaActionsForEntities } from "@/features/capa/queries";
import { CapaSummaryTable, type CapaSummaryRowView } from "@/components/capa/capa-tracker";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { formatRootCause } from "@/lib/root-cause";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/utils";
import { lifecycleStatusTone } from "@/lib/status";
import { PrintButton } from "@/components/ui/print-button";

// Clean, fully read-only view of a Company Inspection — for looking at "what
// the document looks like" without touching Print, and for the browser's
// print output when Print IS used. Lives outside the (app) route group on
// purpose: no Sidebar/Topbar, so there's nothing to hide either on screen or
// on paper.
export default async function CompanyInspectionReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("cinsp:read");
  const { id } = await params;
  const isShipboard = user.department === "SHIPBOARD";
  const insp = await getCompanyInspection(user.companyId, id, isShipboard, user.vesselId);
  if (!insp) notFound();

  const observationIds = insp.observations.map((o) => o.id);
  const capaRows = await listAllCapaActionsForEntities(
    user.companyId,
    "CompanyInspectionObservation",
    observationIds,
  );

  const toView = (row: (typeof capaRows)[number]): CapaSummaryRowView => ({
    ...row,
    targetDate: row.targetDate ? row.targetDate.toISOString() : null,
    closedDate: row.closedDate ? row.closedDate.toISOString() : null,
  });

  const capaRowsByObservation: Record<string, CapaSummaryRowView[]> = {};
  for (const row of capaRows) {
    (capaRowsByObservation[row.entityId] ??= []).push(toView(row));
  }

  const meta = [
    { label: "Vessel", value: insp.vessel?.name ?? "Shore / office" },
    { label: "Type", value: insp.inspectionType ? COMPANY_INSPECTION_TYPE_LABELS[insp.inspectionType] : "—" },
    { label: "Date", value: formatDate(insp.inspectionDate) },
    { label: "Inspector", value: insp.inspectorName ?? "—" },
    { label: "Port", value: insp.port ?? "—" },
    { label: "Kind of inspection", value: insp.visitKind ? COMPANY_INSPECTION_VISIT_KIND_LABELS[insp.visitKind] : "—" },
    { label: "Closed", value: insp.closedAt ? formatDate(insp.closedAt) : "—" },
  ];

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/company-inspections/${insp.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to record
        </Link>
        <PrintButton />
      </div>

      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{insp.refNo} — {insp.vessel?.name ?? "Shore / office"}</h1>
        <Badge tone={lifecycleStatusTone(insp.status)}>{humanize(insp.status)}</Badge>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
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

      <Card>
        <CardHeader><CardTitle>Observations</CardTitle></CardHeader>
        <CardContent>
          {insp.observations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No observations recorded.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {insp.observations.map((o) => {
                const rows = capaRowsByObservation[o.id] ?? [];
                const resolved = rows.length > 0 && rows.every((r) => r.status === "CLOSED");
                return (
                  <li key={o.id} className="space-y-2 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Observation No. {o.seq}</span>
                      {o.chapter && <span>{o.chapter}. {VIQ_CHAPTER_TITLES[o.chapter]}</span>}
                      {o.category && (
                        <Badge tone="neutral">{SIRE_OBSERVATION_CATEGORY_LABELS[o.category]}</Badge>
                      )}
                      {o.viqRef && <span className="font-mono">{o.viqRef}</span>}
                      <Badge tone={resolved ? "success" : "warning"}>
                        {resolved ? "Closed" : "Open"}
                      </Badge>
                    </div>
                    <p className="text-sm">{o.observation}</p>
                    {o.immediateCause && (
                      <p className="text-sm text-muted-foreground">Immediate cause: {o.immediateCause}</p>
                    )}
                    {o.rootCauseCategory && (
                      <p className="text-sm text-muted-foreground">
                        Root cause: {formatRootCause(o.rootCauseCategory, o.rootCauseSubCategory)}
                        {o.rootCause && ` — ${o.rootCause}`}
                      </p>
                    )}
                    {o.immediateCorrectiveAction && (
                      <p className="text-sm text-muted-foreground">
                        Immediate corrective action: {o.immediateCorrectiveAction}
                      </p>
                    )}
                    {rows.length > 0 && (
                      <div className="pt-1">
                        <CapaSummaryTable rows={rows} editable={false} />
                      </div>
                    )}
                    {o.attachments.length > 0 && (
                      <div className="pt-1">
                        <AttachmentList
                          entityType="CompanyInspectionObservation"
                          entityId={o.id}
                          editable={false}
                          attachments={o.attachments.map((a) => ({
                            id: a.id,
                            fileName: a.fileName,
                            mimeType: a.mimeType,
                            sizeBytes: a.sizeBytes,
                            createdAt: a.createdAt.toISOString(),
                          }))}
                        />
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
