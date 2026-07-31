import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getNcr } from "@/features/non-conformities/queries";
import { NCR_STATUSES } from "@/features/non-conformities/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize, severityTone } from "@/lib/utils";
import { CapaForm } from "./capa-form";
import { NcrActions } from "./ncr-actions";
import type { NcrStatus } from "@/lib/generated/prisma";

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

  const meta = [
    { label: "Source", value: humanize(ncr.source) },
    { label: "Vessel", value: ncr.vessel?.name ?? "Shore / N/A" },
    { label: "Raised", value: formatDate(ncr.raisedAt) },
    { label: "Target", value: formatDate(ncr.targetDate) },
    { label: "Closed", value: ncr.closedAt ? formatDate(ncr.closedAt) : "—" },
    { label: "Raised by", value: ncr.raisedBy?.fullName ?? "—" },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/non-conformities" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Non-Conformities
      </Link>

      <PageHeader
        title={`${ncr.refNo} — ${ncr.title}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={severityTone(ncr.severity)}>{humanize(ncr.severity)}</Badge>
            <Badge tone={statusTone(ncr.status)}>{humanize(ncr.status)}</Badge>
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
        <CardHeader><CardTitle>Lifecycle</CardTitle></CardHeader>
        <CardContent>
          <NcrActions ncrId={ncr.id} nextStatus={next} canAdvance={canAdvance} canDelete={canDelete} />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Finding</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="Requirement breached" value={ncr.requirement} />
          <Field label="Description" value={ncr.description} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Root cause &amp; corrective action (CAPA)</CardTitle></CardHeader>
        <CardContent>
          {editable ? (
            <CapaForm
              ncrId={ncr.id}
              rootCause={ncr.rootCause ?? ""}
              correctiveAction={ncr.correctiveAction ?? ""}
              verification={ncr.verification ?? ""}
            />
          ) : (
            <div className="space-y-4">
              <Field label="Root cause" value={ncr.rootCause || "—"} />
              <Field label="Corrective action" value={ncr.correctiveAction || "—"} />
              <Field label="Verification" value={ncr.verification || "—"} />
            </div>
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
