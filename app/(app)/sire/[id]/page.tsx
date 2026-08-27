import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getSire, listPersonnelOptions } from "@/features/sire/queries";
import { SIRE_INSPECTION_TYPE_LABELS, SIRE_OVERALL_RESULT_LABELS } from "@/features/sire/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/utils";
import { lifecycleStatusTone } from "@/lib/status";
import { getRootCauseSubcategoryOptions } from "@/lib/reference-list";
import { ObservationsPanel } from "./observations-panel";
import { SireActions } from "./sire-actions";

export default async function SireDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("sire:read");
  const { id } = await params;
  const insp = await getSire(user.companyId, id, user.department === "SHIPBOARD", user.vesselId);
  if (!insp) notFound();
  const personnel = await listPersonnelOptions(user.companyId);
  const rootCauseSubOptions = await getRootCauseSubcategoryOptions(user.companyId);

  const editable = can(user, "sire:update") && insp.status !== "CLOSED";
  const canClose = can(user, "sire:close");
  const canDelete = can(user, "sire:delete");

  const meta = [
    { label: "Vessel", value: insp.vessel?.name ?? "—" },
    { label: "Port", value: insp.port ?? "—" },
    { label: "Date", value: formatDate(insp.inspectionDate) },
    { label: "Type of inspection", value: insp.inspectionType ? SIRE_INSPECTION_TYPE_LABELS[insp.inspectionType] : "—" },
    { label: "Inspector", value: insp.inspectorName },
    { label: "Overall result", value: insp.overallResult ? SIRE_OVERALL_RESULT_LABELS[insp.overallResult] : "—" },
    { label: "SIRE version", value: insp.sireVersion ?? "—" },
    { label: "Closed", value: insp.closedAt ? formatDate(insp.closedAt) : "—" },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/sire" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to SIRE Inspections
      </Link>

      <PageHeader
        title={`${insp.refNo} — ${insp.inspectingCompany}`}
        actions={<Badge tone={lifecycleStatusTone(insp.status)}>{humanize(insp.status)}</Badge>}
      />

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
          <CardHeader><CardTitle>Remarks</CardTitle></CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{insp.summary}</p>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader><CardTitle>Observations</CardTitle></CardHeader>
        <CardContent>
          <ObservationsPanel
            inspectionId={insp.id}
            editable={editable}
            personnel={personnel}
            subcategoryOptions={rootCauseSubOptions}
            observations={insp.observations.map((o) => ({
              id: o.id,
              seq: o.seq,
              chapter: o.chapter,
              category: o.category,
              viqRef: o.viqRef,
              question: o.question,
              observation: o.observation,
              immediateCause: o.immediateCause,
              rootCauseCategory: o.rootCauseCategory,
              rootCauseSubCategory: o.rootCauseSubCategory,
              rootCause: o.rootCause,
              correctiveAction: o.correctiveAction,
              preventiveMeasure: o.preventiveMeasure,
              responsiblePersonId: o.responsiblePersonId,
              responsiblePerson: o.responsiblePerson,
              targetDate: o.targetDate ? o.targetDate.toISOString() : null,
              actualCompletionDate: o.actualCompletionDate ? o.actualCompletionDate.toISOString() : null,
              status: o.status,
              verifiedById: o.verifiedById,
              verifiedBy: o.verifiedBy,
              attachments: o.attachments.map((a) => ({
                id: a.id,
                fileName: a.fileName,
                mimeType: a.mimeType,
                sizeBytes: a.sizeBytes,
                createdAt: a.createdAt.toISOString(),
              })),
              comments: o.comments.map((c) => ({
                id: c.id,
                body: c.body,
                createdAt: c.createdAt.toISOString(),
                author: c.author,
              })),
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Inspection status</CardTitle></CardHeader>
        <CardContent>
          <SireActions inspectionId={insp.id} status={insp.status} canClose={canClose} canDelete={canDelete} />
        </CardContent>
      </Card>
    </div>
  );
}
