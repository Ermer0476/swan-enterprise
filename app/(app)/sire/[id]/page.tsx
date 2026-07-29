import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getSire } from "@/features/sire/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/utils";
import { ObservationsPanel } from "./observations-panel";
import { SireActions } from "./sire-actions";

function statusTone(s: string) {
  return s === "CLOSED" ? "success" : s === "IN_PROGRESS" ? "warning" : "accent";
}

export default async function SireDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("sire:read");
  const { id } = await params;
  const insp = await getSire(user.companyId, id);
  if (!insp) notFound();

  const editable = can(user, "sire:update") && insp.status !== "CLOSED";
  const canClose = can(user, "sire:close");
  const canDelete = can(user, "sire:delete");

  const meta = [
    { label: "Vessel", value: insp.vessel?.name ?? "—" },
    { label: "Port", value: insp.port ?? "—" },
    { label: "Date", value: formatDate(insp.inspectionDate) },
    { label: "SIRE version", value: insp.sireVersion ?? "—" },
    { label: "Inspector", value: insp.inspectorName ?? "—" },
    { label: "Closed", value: insp.closedAt ? formatDate(insp.closedAt) : "—" },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/sire" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to SIRE Inspections
      </Link>

      <PageHeader
        title={`${insp.refNo} — ${insp.inspectingCompany}`}
        actions={<Badge tone={statusTone(insp.status)}>{humanize(insp.status)}</Badge>}
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
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{insp.summary}</p>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader><CardTitle>Inspection status</CardTitle></CardHeader>
        <CardContent>
          <SireActions inspectionId={insp.id} status={insp.status} canClose={canClose} canDelete={canDelete} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Observations</CardTitle></CardHeader>
        <CardContent>
          <ObservationsPanel
            inspectionId={insp.id}
            editable={editable}
            observations={insp.observations.map((o) => ({
              id: o.id,
              viqRef: o.viqRef,
              category: o.category,
              observation: o.observation,
              response: o.response,
              status: o.status,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
