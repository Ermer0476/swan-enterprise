import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getHazard } from "@/features/hazards/queries";
import { HAZARD_STATUSES } from "@/features/hazards/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize, severityTone } from "@/lib/utils";
import { ActionForm } from "./action-form";
import { HazardActions } from "./hazard-actions";
import type { HazardStatus } from "@/lib/generated/prisma";

function nextOf(status: HazardStatus): HazardStatus | null {
  const i = HAZARD_STATUSES.indexOf(status);
  return (HAZARD_STATUSES[i + 1] as HazardStatus | undefined) ?? null;
}
function statusTone(s: string) {
  return s === "CLOSED" ? "success" : s === "IN_PROGRESS" ? "warning" : "accent";
}

export default async function HazardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("hazard:read");
  const { id } = await params;
  const h = await getHazard(user.companyId, id);
  if (!h) notFound();

  const canUpdate = can(user, "hazard:update");
  const canClose = can(user, "hazard:close");
  const canDelete = can(user, "hazard:delete");
  const next = nextOf(h.status);
  const canAdvance = canUpdate && !!next && (next !== "CLOSED" || canClose);
  const editable = canUpdate && h.status !== "CLOSED";

  const meta = [
    { label: "Category", value: h.category },
    { label: "Type", value: humanize(h.hazardType) },
    { label: "Vessel", value: h.vessel?.name ?? "Shore / N/A" },
    { label: "Observed", value: formatDate(h.observedAt) },
    { label: "Location", value: h.location ?? "—" },
    { label: "By", value: h.reportedBy?.fullName ?? "—" },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/hazards" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Hazard Observations
      </Link>

      <PageHeader
        title={`${h.refNo} — ${h.title}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={severityTone(h.riskLevel)}>{humanize(h.riskLevel)} risk</Badge>
            <Badge tone={statusTone(h.status)}>{humanize(h.status)}</Badge>
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
          <HazardActions hazardId={h.id} nextStatus={next} canAdvance={canAdvance} canDelete={canDelete} />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Observation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="What was observed" value={h.observation} />
          {h.immediateAction && <Field label="Immediate action" value={h.immediateAction} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Corrective action</CardTitle></CardHeader>
        <CardContent>
          {editable ? (
            <ActionForm hazardId={h.id} correctiveAction={h.correctiveAction ?? ""} />
          ) : (
            <Field label="Corrective action" value={h.correctiveAction || "—"} />
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
