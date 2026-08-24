import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getNearMiss } from "@/features/near-miss/queries";
import {
  NM_STATUSES,
  NEARMISS_CONSEQUENCE_LABELS,
  NEARMISS_KIND_LABELS,
  HOR_CATEGORY_LABELS,
  nearMissStatusLabel,
  nearMissStatusTone,
  positionsFor,
} from "@/features/near-miss/schema";
import { listCapaActions, listAllCapaActions } from "@/features/capa/queries";
import { CapaTracker, type CapaRowView } from "@/components/capa/capa-tracker";
import { formatRootCause } from "@/lib/root-cause";
import { listAttachments } from "@/features/attachments/queries";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize, severityTone } from "@/lib/utils";
import { NearMissActions, ReportDraftButton, DeleteDraftButton } from "./near-miss-actions";
import { EditDraftNearMissForm } from "./edit-draft-form";
import { OfficeReviewForm } from "@/components/near-miss/office-review-form";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import type { NearMissStatus } from "@/lib/generated/prisma";

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

function nextOf(status: NearMissStatus): NearMissStatus | null {
  const i = NM_STATUSES.indexOf(status);
  return (NM_STATUSES[i + 1] as NearMissStatus | undefined) ?? null;
}
export default async function NearMissDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("nm:read");
  const { id } = await params;
  const nm = await getNearMiss(user.companyId, id, user.department === "SHIPBOARD", user.id, user.vesselId);
  if (!nm) notFound();

  const canUpdate = can(user, "nm:update");
  const canClose = can(user, "nm:close");
  const canDelete = can(user, "nm:delete");
  const next = nextOf(nm.status);
  const canAdvance = canUpdate && !!next && (next !== "CLOSED" || canClose);

  // Corrective actions can only be edited/closed by the Administrator role —
  // office roles below Administrator (and the vessel itself) hold nm:create
  // too (to report near misses) but shouldn't edit CAPA (mirrors the CAPA
  // REGISTRY's server-side guard for NearMiss in features/capa/actions.ts).
  const canEditCapa =
    can(user, "nm:create") && user.roles.includes("Administrator") && nm.status !== "CLOSED";
  // A draft is only ever visible to a shipboard user (any vessel account) or
  // to the specific office user who created it (see queries.ts) — so
  // reaching this page while it's still DRAFT already means "this is mine to
  // act on." Drives the full edit form, the Report button, and Delete alike.
  const isOwnDraft =
    nm.status === "DRAFT" &&
    can(user, "nm:create") &&
    (user.department === "SHIPBOARD" || nm.createdBy === user.id);

  const [correctiveRows, allCapaRows, attachments] = await Promise.all([
    listCapaActions(user.companyId, "NearMiss", nm.id, "CORRECTIVE"),
    listAllCapaActions(user.companyId, "NearMiss", nm.id),
    listAttachments(user.companyId, "NearMiss", nm.id),
  ]);
  const allCapaClosed = allCapaRows.every((r) => r.status === "CLOSED");
  // Same "who may act on this record right now" logic as CAPA above (ship
  // owns it while reporting, office owns it while reviewing) — attachments
  // follow the same edit window rather than inventing a separate rule.
  const attachmentsEditable = canEditCapa || (canUpdate && nm.status !== "CLOSED");

  const meta = [
    { label: "Vessel", value: nm.vessel?.name ?? "Shore / N/A" },
    { label: "Occurred", value: formatDate(nm.occurredAt) },
    { label: "Location", value: nm.location ?? "—" },
    { label: "Root cause", value: formatRootCause(nm.rootCauseCategory, nm.rootCauseSubCategory) },
    {
      label: "Reported by",
      value: nm.reporterName
        ? `${nm.reporterName} — ${nm.reporterPosition}`
        : (nm.reportedBy?.fullName ?? "—"),
    },
    { label: "Closed", value: nm.closedAt ? formatDate(nm.closedAt) : "—" },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/near-miss" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground print:hidden">
        <ArrowLeft className="h-4 w-4" /> Back to Near Miss
      </Link>

      <PageHeader
        title={nm.refNo ? `${nm.refNo} — ${nm.title}` : `Draft — ${nm.title}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={nm.kind === "HOR" ? "warning" : "accent"}>{NEARMISS_KIND_LABELS[nm.kind]}</Badge>
            <Badge tone={severityTone(nm.potentialSeverity)}>Potential: {humanize(nm.potentialSeverity)}</Badge>
            <Badge tone={nearMissStatusTone(nm.status)}>{nearMissStatusLabel(nm.status, user.department)}</Badge>
            <Link href={`/near-miss/${nm.id}/report`} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="outline" size="sm">
                <FileText className="h-4 w-4" /> Show Report
              </Button>
            </Link>
            {isOwnDraft && <DeleteDraftButton nearMissId={nm.id} />}
            {isOwnDraft && <ReportDraftButton nearMissId={nm.id} blocked={!allCapaClosed} />}
          </div>
        }
      />

      {isOwnDraft ? (
        <EditDraftNearMissForm
          nearMiss={{
            id: nm.id,
            title: nm.title,
            reporterName: nm.reporterName ?? "",
            reporterPosition: nm.reporterPosition ?? "",
            kind: nm.kind,
            horCategory: nm.horCategory,
            stopAuthorityExercised: nm.stopAuthorityExercised,
            occurredAt: nm.occurredAt.toISOString().slice(0, 10),
            location: nm.location,
            description: nm.description,
            potentialConsequence: nm.potentialConsequence,
            potentialSeverity: nm.potentialSeverity,
            immediateAction: nm.immediateAction,
            rootCauseCategory: nm.rootCauseCategory,
            rootCauseSubCategory: nm.rootCauseSubCategory,
          }}
          positions={positionsFor(user.department)}
          ownVesselName={nm.vessel?.name ?? null}
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {meta.map((m) => (
              <div key={m.label}>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</div>
                <div className="mt-0.5 text-sm font-medium">{m.value}</div>
              </div>
            ))}
          </div>

          <Card className="mb-6">
            <CardHeader><CardTitle>What happened</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field
                label={nm.kind === "HOR" ? "Details of the Observation" : "Details of the Near Miss"}
                value={nm.description}
              />
              {nm.kind === "HOR" && nm.horCategory && (
                <Field label="Category" value={HOR_CATEGORY_LABELS[nm.horCategory]} />
              )}
              {nm.kind === "HOR" && (
                <Field label="Stop Work Authority Exercised" value={nm.stopAuthorityExercised ? "Yes" : "No"} />
              )}
              <Field label="Potential consequence" value={NEARMISS_CONSEQUENCE_LABELS[nm.potentialConsequence]} />
              {nm.immediateAction && <Field label="Immediate action" value={nm.immediateAction} />}
            </CardContent>
          </Card>
        </>
      )}

      <Card className="mb-6">
        <CardHeader><CardTitle>Corrective Action</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <CapaTracker
            entityType="NearMiss"
            entityId={nm.id}
            kind="CORRECTIVE"
            title="Corrective Actions"
            editable={canEditCapa}
            rows={correctiveRows.map(toRowView)}
          />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Attachments</CardTitle></CardHeader>
        <CardContent>
          <AttachmentList
            entityType="NearMiss"
            entityId={nm.id}
            editable={attachmentsEditable}
            attachments={attachments.map((a) => ({
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
        <CardHeader><CardTitle>Office Review</CardTitle></CardHeader>
        <CardContent>
          <OfficeReviewForm
            nearMissId={nm.id}
            shoreRemarks={nm.shoreRemarks ?? ""}
            reviewedAt={nm.reviewedAt ? nm.reviewedAt.toISOString() : null}
            disabled={!(canUpdate && nm.status !== "CLOSED")}
            lifecycleActions={
              <NearMissActions nearMissId={nm.id} nextStatus={next} canAdvance={canAdvance} canDelete={canDelete} />
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <p className="mt-1 whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}
