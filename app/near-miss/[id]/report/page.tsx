import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { getNearMiss } from "@/features/near-miss/queries";
import { NEARMISS_CONSEQUENCE_LABELS } from "@/features/near-miss/schema";
import { listCapaActions, listAllCapaActions } from "@/features/capa/queries";
import {
  CapaTracker,
  CapaSummaryTable,
  type CapaRowView,
  type CapaSummaryRowView,
} from "@/components/capa/capa-tracker";
import { ROOT_CAUSE_LABELS, HUMAN_FACTOR_LABELS } from "@/lib/root-cause";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize, severityTone } from "@/lib/utils";
import { PrintButton } from "@/components/ui/print-button";
import { OfficeReviewForm } from "@/components/near-miss/office-review-form";

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

function toSummaryRowView(
  r: Parameters<typeof toRowView>[0] & { kind: "CORRECTIVE" | "PREVENTIVE" },
): CapaSummaryRowView {
  return { ...toRowView(r), kind: r.kind };
}

function statusTone(s: string) {
  return s === "CLOSED" ? "success" : s === "UNDER_REVIEW" ? "warning" : "accent";
}

// Clean, fully read-only view of a Near Miss report — for looking at "what
// the document looks like" without touching Print, and for the browser's
// print output when Print IS used. Lives outside the (app) route group on
// purpose: no Sidebar/Topbar, so there's nothing to hide either on screen or
// on paper.
export default async function NearMissReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("nm:read");
  const { id } = await params;
  const nm = await getNearMiss(user.companyId, id);
  if (!nm) notFound();

  const [correctiveRows, allCapaRows] = await Promise.all([
    listCapaActions(user.companyId, "NearMiss", nm.id, "CORRECTIVE"),
    listAllCapaActions(user.companyId, "NearMiss", nm.id),
  ]);

  const meta = [
    { label: "Vessel", value: nm.vessel?.name ?? "Shore / N/A" },
    { label: "Occurred", value: formatDate(nm.occurredAt) },
    { label: "Location", value: nm.location ?? "—" },
    { label: "Root cause", value: ROOT_CAUSE_LABELS[nm.rootCauseCategory] },
    { label: "Reported by", value: nm.reportedBy?.fullName ?? "—" },
    { label: "Closed", value: nm.closedAt ? formatDate(nm.closedAt) : "—" },
  ];

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/near-miss/${nm.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to record
        </Link>
        <PrintButton />
      </div>

      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{nm.refNo} — {nm.title}</h1>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={severityTone(nm.potentialSeverity)}>Potential: {humanize(nm.potentialSeverity)}</Badge>
          <Badge tone={statusTone(nm.status)}>{humanize(nm.status)}</Badge>
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

      <Card className="mb-6">
        <CardHeader><CardTitle>What happened</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="Details of the Near Miss" value={nm.description} />
          <Field label="Potential consequence" value={NEARMISS_CONSEQUENCE_LABELS[nm.potentialConsequence]} />
          {nm.immediateAction && <Field label="Immediate action" value={nm.immediateAction} />}
          {nm.rootCauseCategory === "HUMAN_FACTORS" && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Human factors
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {nm.humanFactorPrimary && (
                  <Badge tone="warning">
                    Primary: {HUMAN_FACTOR_LABELS[nm.humanFactorPrimary]}
                  </Badge>
                )}
                {nm.humanFactorContributing.map((f) => (
                  <Badge key={f} tone="neutral">
                    {HUMAN_FACTOR_LABELS[f]}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Corrective Action</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          {/* Always read-only here — this is a report view, not a working page. */}
          <CapaTracker
            entityType="NearMiss"
            entityId={nm.id}
            kind="CORRECTIVE"
            title="Corrective Actions"
            editable={false}
            rows={correctiveRows.map(toRowView)}
          />

          <div className="space-y-3">
            <h4 className="text-sm font-semibold">All CAPA Items</h4>
            <CapaSummaryTable
              rows={allCapaRows.map(toSummaryRowView)}
              editable={false}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Office Review</CardTitle></CardHeader>
        <CardContent>
          <OfficeReviewForm
            nearMissId={nm.id}
            companyComments={nm.companyComments ?? ""}
            reviewedAt={nm.reviewedAt ? nm.reviewedAt.toISOString() : null}
            disabled
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
