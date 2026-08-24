import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getCdi } from "@/features/cdi/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/utils";
import { lifecycleStatusTone } from "@/lib/status";
import { ObservationsPanel } from "./observations-panel";
import { CdiActions } from "./cdi-actions";

export default async function CdiDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("cdi:read");
  const { id } = await params;
  const isShipboard = user.department === "SHIPBOARD";
  const vesselId = isShipboard ? user.vesselId ?? "__no-vessel-assigned__" : undefined;
  const insp = await getCdi(user.companyId, id, vesselId);
  if (!insp) notFound();

  const editable = can(user, "cdi:update") && insp.status !== "CLOSED";
  // The vessel can respond to and close its own observations (response +
  // status only) without the full office edit permission — `insp` was
  // already fetched scoped to their own vessel above.
  const canRespond = isShipboard && can(user, "cdi:respond") && insp.status !== "CLOSED";
  const canClose = can(user, "cdi:close");
  const canDelete = can(user, "cdi:delete");

  const meta = [
    { label: "Scheme", value: insp.scheme ?? "—" },
    { label: "Vessel", value: insp.vessel?.name ?? "—" },
    { label: "Port", value: insp.port ?? "—" },
    { label: "Date", value: formatDate(insp.inspectionDate) },
    { label: "Inspector", value: insp.inspectorName ?? "—" },
    { label: "Closed", value: insp.closedAt ? formatDate(insp.closedAt) : "—" },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/cdi" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to CDI Inspections
      </Link>

      <PageHeader
        title={`${insp.refNo} — ${insp.scheme ?? "CDI"}`}
        actions={<Badge tone={lifecycleStatusTone(insp.status)}>{humanize(insp.status)}</Badge>}
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
          <CardContent><p className="whitespace-pre-wrap text-sm">{insp.summary}</p></CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader><CardTitle>Observations</CardTitle></CardHeader>
        <CardContent>
          <ObservationsPanel
            inspectionId={insp.id}
            editable={editable}
            canRespond={canRespond}
            observations={insp.observations.map((o) => ({
              id: o.id,
              questionRef: o.questionRef,
              category: o.category,
              observation: o.observation,
              response: o.response,
              status: o.status,
              rootCauseCategory: o.rootCauseCategory,
              rootCauseSubCategory: o.rootCauseSubCategory,
              rootCause: o.rootCause,
              attachments: o.attachments.map((a) => ({
                id: a.id,
                fileName: a.fileName,
                mimeType: a.mimeType,
                sizeBytes: a.sizeBytes,
                createdAt: a.createdAt.toISOString(),
              })),
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Inspection status</CardTitle></CardHeader>
        <CardContent>
          <CdiActions inspectionId={insp.id} status={insp.status} canClose={canClose} canDelete={canDelete} />
        </CardContent>
      </Card>
    </div>
  );
}
