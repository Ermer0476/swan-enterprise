import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { getDrill } from "@/features/drills/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/utils";
import { lifecycleStatusTone } from "@/lib/status";

// Clean, fully read-only view of a Drill report — mirrors SMS form R-AS-021
// "Report of Drill / Training onboard" (Appendix 6). Lives outside the (app)
// route group on purpose: no Sidebar/Topbar, so there's nothing to hide
// either on screen or on paper.
export default async function DrillReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("drill:read");
  const { id } = await params;
  const isShipboard = user.department === "SHIPBOARD";
  const drill = await getDrill(user.companyId, id, isShipboard, user.id, user.vesselId);
  if (!drill) notFound();

  const meta = [
    {
      label: "Kind of Drill / Training",
      value: drill.scheduleItem
        ? `${drill.scheduleItem.itemNo ? `${drill.scheduleItem.itemNo} — ` : ""}${drill.scheduleItem.name}`
        : "—",
    },
    { label: "SMS reference", value: drill.scheduleItem?.smsReference ?? "—" },
    { label: "Vessel", value: drill.vessel?.name ?? "—" },
    { label: "Date", value: formatDate(drill.drillDate) },
    { label: "Time", value: drill.drillTime ?? "—" },
    { label: "Position", value: drill.position ?? "—" },
    { label: "Master's Name", value: drill.conductedBy ?? "—" },
    { label: "Closed", value: drill.closedAt ? formatDate(drill.closedAt) : "—" },
  ];

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 print:hidden">
        <Link
          href={`/drills/${drill.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to record
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{drill.refNo}</h1>
        <Badge tone={lifecycleStatusTone(drill.status)}>{humanize(drill.status)}</Badge>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {meta.map((m) => (
          <div key={m.label}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</div>
            <div className="mt-0.5 text-sm font-medium">{m.value}</div>
          </div>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Ranks of Crew Participated</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{drill.participants || "—"}</p></CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Details of Drill / Training</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{drill.details || "—"}</p></CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Found Deficiencies</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{drill.deficiencies || "No deficiencies were noted."}</p></CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Master&apos;s Opinion for Improvement and Corrective Action</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{drill.correctiveAction || "—"}</p></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Vessel Remarks</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{drill.vesselRemarks || "—"}</p></CardContent>
      </Card>
    </div>
  );
}
