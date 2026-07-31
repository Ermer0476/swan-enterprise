import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getPsc } from "@/features/psc/queries";
import { listNcrsBySourceEntityIds } from "@/features/non-conformities/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/utils";
import { DeficienciesPanel } from "./deficiencies-panel";
import { PscActions } from "./psc-actions";

function statusTone(s: string) {
  return s === "CLOSED" ? "success" : s === "IN_PROGRESS" ? "warning" : "accent";
}

export default async function PscDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("psc:read");
  const { id } = await params;
  const insp = await getPsc(user.companyId, id);
  if (!insp) notFound();

  const editable = can(user, "psc:update") && insp.status !== "CLOSED";
  const canClose = can(user, "psc:close");
  const canDelete = can(user, "psc:delete");
  const canCreateNcr = can(user, "ncr:create");
  const ncrBySourceId = await listNcrsBySourceEntityIds(
    user.companyId,
    insp.deficiencies.map((d) => d.id),
  );

  const meta = [
    { label: "Vessel", value: insp.vessel?.name ?? "—" },
    { label: "MOU region", value: insp.mouRegion ?? "—" },
    { label: "Port", value: insp.port ?? "—" },
    { label: "Date", value: formatDate(insp.inspectionDate) },
    { label: "Closed", value: insp.closedAt ? formatDate(insp.closedAt) : "—" },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/psc" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to PSC Inspections
      </Link>

      <PageHeader
        title={`${insp.refNo} — ${insp.authority}`}
        actions={
          <div className="flex items-center gap-2">
            {insp.detained ? <Badge tone="danger">Detained</Badge> : <Badge tone="success">Not detained</Badge>}
            <Badge tone={statusTone(insp.status)}>{humanize(insp.status)}</Badge>
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

      {insp.summary && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-wrap text-sm">{insp.summary}</p></CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader><CardTitle>Inspection status</CardTitle></CardHeader>
        <CardContent>
          <PscActions inspectionId={insp.id} status={insp.status} canClose={canClose} canDelete={canDelete} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Deficiencies</CardTitle></CardHeader>
        <CardContent>
          <DeficienciesPanel
            inspectionId={insp.id}
            editable={editable}
            deficiencies={insp.deficiencies.map((d) => ({
              id: d.id,
              natureCode: d.natureCode,
              reference: d.reference,
              actionCode: d.actionCode,
              description: d.description,
              rectification: d.rectification,
              status: d.status,
            }))}
            canCreateNcr={canCreateNcr}
            ncrBySourceId={ncrBySourceId}
            ncrContext={{
              vesselId: insp.vesselId,
              reportRefNo: insp.refNo,
              port: insp.port,
              raisedAt: insp.inspectionDate.toISOString().slice(0, 10),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
