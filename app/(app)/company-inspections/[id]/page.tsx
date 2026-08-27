import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getCompanyInspection } from "@/features/company-inspections/queries";
import { COMPANY_INSPECTION_TYPE_LABELS, COMPANY_INSPECTION_VISIT_KIND_LABELS } from "@/features/company-inspections/schema";
import { listAllCapaActionsForEntities } from "@/features/capa/queries";
import { getActiveQuestionnaireItems } from "@/features/sire-questionnaire/queries";
import {
  closeCompanyInspectionAction,
  deleteCompanyInspectionAction,
} from "@/features/company-inspections/actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, humanize } from "@/lib/utils";
import { lifecycleStatusTone } from "@/lib/status";
import { getRootCauseSubcategoryOptions } from "@/lib/reference-list";
import { ObservationsPanel } from "./observations-panel";
import { CompanyInspectionStatusActions } from "./status-actions";
import { EditDetailsForm } from "./edit-details-form";
import type { CapaRowView } from "@/components/capa/capa-tracker";
import type { AttachmentView } from "@/components/attachments/attachment-list";

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

export default async function CompanyInspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("cinsp:read");
  const { id } = await params;
  const isShipboard = user.department === "SHIPBOARD";
  const insp = await getCompanyInspection(user.companyId, id, isShipboard, user.vesselId);
  if (!insp) notFound();

  const editable = can(user, "cinsp:update") && insp.status !== "CLOSED";
  // The vessel can mark its own observations' corrective actions done/not
  // done (status + closed date only) without the full office edit
  // permission — `insp` was already fetched scoped to their own vessel.
  const canRespond = isShipboard && can(user, "capa:respond") && insp.status !== "CLOSED";
  const canClose = can(user, "cinsp:close");
  const canDelete = can(user, "cinsp:delete");
  const observationIds = insp.observations.map((o) => o.id);
  const [capaRows, questionnaireItems, rootCauseSubOptions] = await Promise.all([
    listAllCapaActionsForEntities(user.companyId, "CompanyInspectionObservation", observationIds),
    editable ? getActiveQuestionnaireItems(user.companyId) : Promise.resolve([]),
    getRootCauseSubcategoryOptions(user.companyId),
  ]);

  const correctiveRowsByObservation: Record<string, CapaRowView[]> = {};
  for (const row of capaRows) {
    if (row.kind !== "CORRECTIVE") continue;
    (correctiveRowsByObservation[row.entityId] ??= []).push(toRowView(row));
  }

  const attachmentsByObservation: Record<string, AttachmentView[]> = {};
  for (const o of insp.observations) {
    attachmentsByObservation[o.id] = o.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      createdAt: a.createdAt.toISOString(),
    }));
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
    <div className="mx-auto max-w-7xl">
      <Link href="/company-inspections" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Company Inspections
      </Link>

      <PageHeader
        title={`${insp.refNo} — ${insp.vessel?.name ?? "Shore / office"}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={lifecycleStatusTone(insp.status)}>{humanize(insp.status)}</Badge>
            <Link href={`/company-inspections/${insp.id}/report`} target="_blank" rel="noopener noreferrer">
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

      {insp.summary && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-wrap text-sm">{insp.summary}</p></CardContent>
        </Card>
      )}

      {editable && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Edit Inspection Details</CardTitle></CardHeader>
          <CardContent>
            <EditDetailsForm
              inspectionId={insp.id}
              inspectionType={insp.inspectionType}
              visitKind={insp.visitKind}
              inspectorName={insp.inspectorName}
              port={insp.port}
            />
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader><CardTitle>Observations</CardTitle></CardHeader>
        <CardContent>
          <ObservationsPanel
            inspectionId={insp.id}
            editable={editable}
            canRespond={canRespond}
            questionnaireItems={questionnaireItems}
            subcategoryOptions={rootCauseSubOptions}
            observations={insp.observations.map((o) => ({
              id: o.id,
              seq: o.seq,
              chapter: o.chapter,
              category: o.category,
              viqRef: o.viqRef,
              observation: o.observation,
              immediateCause: o.immediateCause,
              rootCauseCategory: o.rootCauseCategory,
              rootCauseSubCategory: o.rootCauseSubCategory,
              rootCause: o.rootCause,
              immediateCorrectiveAction: o.immediateCorrectiveAction,
            }))}
            correctiveRowsByObservation={correctiveRowsByObservation}
            attachmentsByObservation={attachmentsByObservation}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Inspection status</CardTitle></CardHeader>
        <CardContent>
          <CompanyInspectionStatusActions
            inspectionId={insp.id}
            status={insp.status}
            canClose={canClose}
            canDelete={canDelete}
            closeAction={closeCompanyInspectionAction}
            deleteAction={deleteCompanyInspectionAction}
          />
        </CardContent>
      </Card>
    </div>
  );
}
