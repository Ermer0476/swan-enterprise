import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { getNcr } from "@/features/non-conformities/queries";
import { listCapaActions } from "@/features/capa/queries";
import { CapaTracker, type CapaRowView } from "@/components/capa/capa-tracker";
import { formatRootCause } from "@/lib/root-cause";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize, severityTone } from "@/lib/utils";
import { PrintButton } from "@/components/ui/print-button";
import { VerificationSummary } from "@/app/(app)/non-conformities/[id]/verification-form";
import { CloseOutSummary } from "@/app/(app)/non-conformities/[id]/close-out-form";

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

function statusTone(s: string) {
  if (s === "CLOSED") return "success";
  if (s === "SUBMITTED_TO_OFFICE" || s === "VERIFIED") return "warning";
  return "danger";
}

// Clean, fully read-only view of an NCR — for looking at "what the document
// looks like" without touching Print, and for the browser's print output
// when Print IS used. Lives outside the (app) route group on purpose: no
// Sidebar/Topbar, so there's nothing to hide either on screen or on paper.
export default async function NcrReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("ncr:read");
  const { id } = await params;
  const ncr = await getNcr(user.companyId, id, user.department === "SHIPBOARD", user.id, user.vesselId);
  if (!ncr) notFound();

  const correctiveRows = await listCapaActions(user.companyId, "NonConformity", ncr.id, "CORRECTIVE");

  const meta = [
    { label: "Source", value: humanize(ncr.source) },
    { label: "Vessel", value: ncr.vessel?.name ?? "Shore / N/A" },
    { label: "Department", value: ncr.departmentName || "—" },
    { label: "Raised", value: formatDate(ncr.raisedAt) },
    { label: "Target", value: formatDate(ncr.targetDate) },
    { label: "Closed", value: ncr.closedAt ? formatDate(ncr.closedAt) : "—" },
    { label: "Reporter", value: ncr.reporterName || ncr.raisedBy?.fullName || "—" },
  ];

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/non-conformities/${ncr.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to record
        </Link>
        <PrintButton />
      </div>

      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{ncr.refNo} — {ncr.title}</h1>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={severityTone(ncr.severity)}>{humanize(ncr.severity)}</Badge>
          <Badge tone={statusTone(ncr.status)}>{humanize(ncr.status)}</Badge>
        </div>
      </div>

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
          {ncr.rootCauseCategory ? (
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
        <CardHeader><CardTitle>Corrective Action</CardTitle></CardHeader>
        <CardContent>
          {/* Always read-only here — this is a report view, not a working page. */}
          <CapaTracker
            entityType="NonConformity"
            entityId={ncr.id}
            kind="CORRECTIVE"
            title="Corrective Actions"
            editable={false}
            rows={correctiveRows.map(toRowView)}
          />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Verification of Corrective Action</CardTitle></CardHeader>
        <CardContent>
          <VerificationSummary
            outcome={ncr.verificationOutcome}
            followUpNature={ncr.verificationFollowUpNature}
            assistanceRequired={ncr.assistanceRequired}
            assistanceNature={ncr.assistanceNature}
            verifiedBy={ncr.verifiedByUser}
            verifiedAt={ncr.verifiedAt ? formatDate(ncr.verifiedAt) : null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Close Out</CardTitle></CardHeader>
        <CardContent>
          {ncr.status === "CLOSED" ? (
            <CloseOutSummary
              followUpRequired={ncr.closeOutFollowUpRequired}
              followUpNature={ncr.closeOutFollowUpNature}
              closedBy={ncr.closedByUser}
              closedAt={ncr.closedAt ? formatDate(ncr.closedAt) : null}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Not yet closed out.</p>
          )}
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
