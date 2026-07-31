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
} from "@/features/near-miss/schema";
import { listCapaActions, listAllCapaActions } from "@/features/capa/queries";
import {
  CapaTracker,
  CapaSummaryTable,
  type CapaRowView,
  type CapaSummaryRowView,
} from "@/components/capa/capa-tracker";
import { ROOT_CAUSE_LABELS, ROOT_CAUSE_SUBCATEGORY_LABELS } from "@/lib/root-cause";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize, severityTone } from "@/lib/utils";
import { NearMissActions } from "./near-miss-actions";
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

function toSummaryRowView(
  r: Parameters<typeof toRowView>[0] & { kind: "CORRECTIVE" | "PREVENTIVE" },
): CapaSummaryRowView {
  return { ...toRowView(r), kind: r.kind };
}

function nextOf(status: NearMissStatus): NearMissStatus | null {
  const i = NM_STATUSES.indexOf(status);
  return (NM_STATUSES[i + 1] as NearMissStatus | undefined) ?? null;
}
function statusTone(s: string) {
  return s === "CLOSED" ? "success" : s === "UNDER_REVIEW" ? "warning" : "accent";
}

export default async function NearMissDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("nm:read");
  const { id } = await params;
  const nm = await getNearMiss(user.companyId, id);
  if (!nm) notFound();

  const canUpdate = can(user, "nm:update");
  const canClose = can(user, "nm:close");
  const canDelete = can(user, "nm:delete");
  const next = nextOf(nm.status);
  const canAdvance = canUpdate && !!next && (next !== "CLOSED" || canClose);

  // Corrective actions are vessel-owned — office roles hold nm:create too
  // (to report their own near misses) but shouldn't edit CAPA on someone
  // else's report, so gate on department as well (mirrors the CAPA
  // REGISTRY's server-side guard for NearMiss in features/capa/actions.ts).
  const canEditCapa =
    can(user, "nm:create") && user.department === "SHIPBOARD" && nm.status !== "CLOSED";

  const [correctiveRows, allCapaRows] = await Promise.all([
    listCapaActions(user.companyId, "NearMiss", nm.id, "CORRECTIVE"),
    listAllCapaActions(user.companyId, "NearMiss", nm.id),
  ]);

  const meta = [
    { label: "Vessel", value: nm.vessel?.name ?? "Shore / N/A" },
    { label: "Occurred", value: formatDate(nm.occurredAt) },
    { label: "Location", value: nm.location ?? "—" },
    { label: "Root cause", value: ROOT_CAUSE_LABELS[nm.rootCauseCategory] },
    {
      label: "Reported by",
      value: nm.reporterName
        ? `${nm.reporterName} — ${nm.reporterPosition}`
        : (nm.reportedBy?.fullName ?? "—"),
    },
    { label: "Closed", value: nm.closedAt ? formatDate(nm.closedAt) : "—" },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/near-miss" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground print:hidden">
        <ArrowLeft className="h-4 w-4" /> Back to Near Miss
      </Link>

      <PageHeader
        title={`${nm.refNo} — ${nm.title}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={nm.kind === "HOR" ? "warning" : "accent"}>{NEARMISS_KIND_LABELS[nm.kind]}</Badge>
            <Badge tone={severityTone(nm.potentialSeverity)}>Potential: {humanize(nm.potentialSeverity)}</Badge>
            <Badge tone={statusTone(nm.status)}>{humanize(nm.status)}</Badge>
            <Link href={`/near-miss/${nm.id}/report`} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="outline" size="sm">
                <FileText className="h-4 w-4" /> Show Report
              </Button>
            </Link>
          </div>
        }
      />

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
          {nm.rootCauseSubCategory && (
            <Field
              label="Root cause sub-category"
              value={ROOT_CAUSE_SUBCATEGORY_LABELS[nm.rootCauseCategory][nm.rootCauseSubCategory] ?? nm.rootCauseSubCategory}
            />
          )}
        </CardContent>
      </Card>

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

          <div className="space-y-3">
            <h4 className="text-sm font-semibold">All CAPA Items</h4>
            <CapaSummaryTable
              rows={allCapaRows.map(toSummaryRowView)}
              editable={canEditCapa}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6 print:hidden">
        <CardHeader><CardTitle>Lifecycle</CardTitle></CardHeader>
        <CardContent>
          <NearMissActions nearMissId={nm.id} nextStatus={next} canAdvance={canAdvance} canDelete={canDelete} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Office Review</CardTitle></CardHeader>
        <CardContent>
          <OfficeReviewForm
            nearMissId={nm.id}
            companyComments={nm.companyComments ?? ""}
            reviewedAt={nm.reviewedAt ? nm.reviewedAt.toISOString() : null}
            disabled={!(canUpdate && nm.status !== "CLOSED")}
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
