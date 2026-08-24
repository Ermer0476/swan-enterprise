import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getNcr, listVesselOptions } from "@/features/non-conformities/queries";
import { NCR_STATUSES, PERSON_IN_CHARGE_OPTIONS } from "@/features/non-conformities/schema";
import { listCapaActions } from "@/features/capa/queries";
import { CapaTracker, type CapaRowView } from "@/components/capa/capa-tracker";
import { formatRootCause } from "@/lib/root-cause";
import { listAttachments } from "@/features/attachments/queries";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize, severityTone } from "@/lib/utils";
import { ncrStatusTone } from "@/features/non-conformities/ui";
import { RootCauseForm } from "./root-cause-form";
import { ShoreRemarksForm } from "./shore-remarks-form";
import { NcrActions, DeleteDraftNcrButton, ReportDraftNcrButton } from "./ncr-actions";
import { EditDraftNcrForm } from "./edit-draft-form";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import type { NcrStatus } from "@/lib/generated/prisma";

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

function nextOf(status: NcrStatus): NcrStatus | null {
  const i = NCR_STATUSES.indexOf(status);
  return (NCR_STATUSES[i + 1] as NcrStatus | undefined) ?? null;
}

export default async function NcrDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("ncr:read");
  const { id } = await params;
  const isShipboard = user.department === "SHIPBOARD";
  const ncr = await getNcr(user.companyId, id, isShipboard, user.id, user.vesselId);
  if (!ncr) notFound();

  const canUpdate = can(user, "ncr:update");
  const canClose = can(user, "ncr:close");
  const canDelete = can(user, "ncr:delete");
  const next = nextOf(ncr.status);
  const canAdvance =
    canUpdate && !!next && (next === "CLOSED" ? canClose : true);
  const editable = canUpdate && ncr.status !== "CLOSED";

  const isOwnDraft =
    ncr.status === "DRAFT" && can(user, "ncr:create") && (isShipboard || ncr.createdBy === user.id);

  if (ncr.status === "DRAFT") {
    const vessels = await listVesselOptions(user.companyId);
    const ownVesselName = vessels.find((v) => v.id === user.vesselId)?.name ?? null;
    return (
      <div className="mx-auto max-w-7xl">
        <Link href="/non-conformities" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Non-Conformities
        </Link>
        <PageHeader
          title={`Draft — ${ncr.title}`}
          actions={
            <div className="flex items-center gap-2">
              <Badge tone={ncrStatusTone(ncr.status)}>{humanize(ncr.status)}</Badge>
              {isOwnDraft && <DeleteDraftNcrButton ncrId={ncr.id} />}
              {isOwnDraft && <ReportDraftNcrButton ncrId={ncr.id} />}
            </div>
          }
        />
        {isOwnDraft ? (
          <EditDraftNcrForm
            ncr={{
              id: ncr.id,
              title: ncr.title,
              vesselId: ncr.vesselId,
              source: ncr.source,
              sourceEntityId: ncr.sourceEntityId,
              requirement: ncr.requirement,
              severity: ncr.severity,
              raisedAt: ncr.raisedAt.toISOString().slice(0, 10),
              targetDate: ncr.targetDate ? ncr.targetDate.toISOString().slice(0, 10) : "",
              description: ncr.description,
              personInCharge: ncr.personInCharge ?? PERSON_IN_CHARGE_OPTIONS[0],
            }}
            vessels={vessels}
            isShipboard={isShipboard}
            ownVesselName={ownVesselName}
          />
        ) : (
          <p className="text-sm text-muted-foreground">You don&apos;t have access to edit this draft.</p>
        )}
      </div>
    );
  }

  const [correctiveRows, attachments] = await Promise.all([
    listCapaActions(user.companyId, "NonConformity", ncr.id, "CORRECTIVE"),
    listAttachments(user.companyId, "NonConformity", ncr.id),
  ]);

  const meta = [
    { label: "Source", value: humanize(ncr.source) },
    { label: "Vessel", value: ncr.vessel?.name ?? "Shore / N/A" },
    { label: "Raised", value: formatDate(ncr.raisedAt) },
    { label: "Target", value: formatDate(ncr.targetDate) },
    { label: "Closed", value: ncr.closedAt ? formatDate(ncr.closedAt) : "—" },
    { label: "Raised by", value: ncr.raisedBy?.fullName ?? "—" },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/non-conformities" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Non-Conformities
      </Link>

      <PageHeader
        title={`${ncr.refNo} — ${ncr.title}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={severityTone(ncr.severity)}>{humanize(ncr.severity)}</Badge>
            <Badge tone={ncrStatusTone(ncr.status)}>{humanize(ncr.status)}</Badge>
            <Link href={`/non-conformities/${ncr.id}/report`} target="_blank" rel="noopener noreferrer">
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

      <Card className="mb-6">
        <CardHeader><CardTitle>Finding</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="Requirement breached" value={ncr.requirement} />
          <Field label="Description" value={ncr.description} />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Root cause</CardTitle></CardHeader>
        <CardContent>
          {editable ? (
            <RootCauseForm
              key={ncr.updatedAt.getTime()}
              ncrId={ncr.id}
              rootCauseCategory={ncr.rootCauseCategory ?? ""}
              rootCauseSubCategory={ncr.rootCauseSubCategory ?? ""}
              rootCause={ncr.rootCause ?? ""}
            />
          ) : ncr.rootCauseCategory ? (
            <div className="space-y-4">
              <Field
                label="Root cause"
                value={formatRootCause(ncr.rootCauseCategory, ncr.rootCauseSubCategory)}
              />
              {ncr.rootCause && <Field label="Root cause description" value={ncr.rootCause} />}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No root cause recorded yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="space-y-6 pt-5">
          <CapaTracker
            entityType="NonConformity"
            entityId={ncr.id}
            kind="CORRECTIVE"
            title="Corrective Actions"
            editable={editable}
            rows={correctiveRows.map(toRowView)}
          />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Attachments</CardTitle></CardHeader>
        <CardContent>
          <AttachmentList
            entityType="NonConformity"
            entityId={ncr.id}
            editable={editable}
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

      <Card className="mb-6">
        <CardHeader><CardTitle>Shore Remarks</CardTitle></CardHeader>
        <CardContent>
          {editable ? (
            <ShoreRemarksForm
              key={ncr.updatedAt.getTime()}
              ncrId={ncr.id}
              shoreRemarks={ncr.shoreRemarks ?? ""}
            />
          ) : ncr.shoreRemarks ? (
            <Field label="Shore Remarks" value={ncr.shoreRemarks} />
          ) : (
            <p className="text-sm text-muted-foreground">No shore remarks recorded yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lifecycle</CardTitle></CardHeader>
        <CardContent>
          <NcrActions ncrId={ncr.id} nextStatus={next} canAdvance={canAdvance} canDelete={canDelete} />
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
