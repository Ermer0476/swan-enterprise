import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getDrill } from "@/features/drills/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/utils";
import { DrillActions } from "./drill-actions";

export default async function DrillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("drill:read");
  const { id } = await params;
  const drill = await getDrill(user.companyId, id);
  if (!drill) notFound();

  const canClose = can(user, "drill:close");
  const canDelete = can(user, "drill:delete");

  const meta = [
    { label: "Type", value: humanize(drill.drillType) },
    { label: "Vessel", value: drill.vessel?.name ?? "—" },
    { label: "Date", value: formatDate(drill.drillDate) },
    { label: "Conducted by", value: drill.conductedBy ?? "—" },
    { label: "Closed", value: drill.closedAt ? formatDate(drill.closedAt) : "—" },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/drills" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Emergency Drills
      </Link>

      <PageHeader
        title={drill.refNo}
        actions={<Badge tone={drill.status === "CLOSED" ? "success" : "warning"}>{humanize(drill.status)}</Badge>}
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
        <CardHeader><CardTitle>Scenario</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{drill.scenario || "—"}</p></CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Participants</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{drill.participants || "—"}</p></CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Observations / follow-up</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{drill.observations || "—"}</p></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Drill status</CardTitle></CardHeader>
        <CardContent>
          <DrillActions drillId={drill.id} isOpen={drill.status !== "CLOSED"} canClose={canClose} canDelete={canDelete} />
        </CardContent>
      </Card>
    </div>
  );
}
