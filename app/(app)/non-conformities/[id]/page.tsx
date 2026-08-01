import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getNcr } from "@/features/non-conformities/queries";
import { NCR_STATUSES } from "@/features/non-conformities/schema";
import { listCapaActions, listAllCapaActions } from "@/features/capa/queries";
import {
  CapaTracker,
  CapaSummaryTable,
  type CapaRowView,
  type CapaSummaryRowView,
} from "@/components/capa/capa-tracker";
import { formatRootCause } from "@/lib/root-cause";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize, severityTone } from "@/lib/utils";
import { RootCauseForm } from "./root-cause-form";
import { NcrActions } from "./ncr-actions";
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

function toSummaryRowView(
  r: Parameters<typeof toRowView>[0] & { kind: "CORRECTIVE" | "PREVENTIVE" },
): CapaSummaryRowView {
  return { ...toRowView(r), kind: r.kind };
}

function nextOf(status: NcrStatus): NcrStatus | null {
  const i = NCR_STATUSES.indexOf(status);
  return (NCR_STATUSES[i + 1] as NcrStatus | undefined) ?? null;
}
function statusTone(s: string) {
  if (s === "CLOSED") return "success";
  if (s === "SUBMITTED_TO_OFFICE") return "warning";
  return "danger";
}

export default async function NcrDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("ncr:read");
  const { id } = await params;
  const ncr = await getNcr(user.companyId, id);
  if (!ncr) notFound();

  const canUpdate = can(user, "ncr:update");
  const canClose = can(user, "ncr:close");
  const canDelete = can(user, "ncr:delete");
  const next = nextOf(ncr.status);
  const canAdvance =
    canUpdate && !!next && (next === "CLOSED" ? canClose : true);
  const editable = canUpdate && ncr.status !== "CLOSED";

  const [correctiveRows, allCapaRows] = await Promise.all([
    listCapaActions(user.companyId, "NonConformity", ncr.id, "CORRECTIVE"),
    listAllCapaActions(user.companyId, "NonConformity", ncr.id),
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
            <Badge tone={statusTone(ncr.status)}>{humanize(ncr.status)}</Badge>
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

          <div className="space-y-3">
            <h4 className="text-sm font-semibold">All CAPA Tracker</h4>
            <CapaSummaryTable
              rows={allCapaRows.map(toSummaryRowView)}
              editable={editable}
            />
          </div>
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
