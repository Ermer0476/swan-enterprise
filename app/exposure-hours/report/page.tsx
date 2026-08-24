import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { listExposureSummary, defaultYearRange } from "@/features/exposure-hours/queries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PrintButton } from "@/components/ui/print-button";
import { formatDate } from "@/lib/utils";

function fmtFreq(n: number): string {
  return n.toFixed(2);
}

// Clean, read-only view of the fleet-wide Exposure Hours summary — lives
// outside the (app) route group so there's no sidebar/topbar to hide on
// paper, same pattern as the Near Miss / Incident report pages.
export default async function ExposureHoursReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("exposure:read");
  const sp = await searchParams;
  const isShipboard = user.department === "SHIPBOARD";
  const vesselId = isShipboard ? (user.vesselId ?? "__no-vessel-assigned__") : (sp.vesselId || undefined);
  const yearDefault = defaultYearRange();
  const from = sp.from ? new Date(sp.from) : yearDefault.from;
  const to = sp.to ? new Date(sp.to) : yearDefault.to;
  const { rows, total } = await listExposureSummary(user.companyId, {
    vesselId,
    from,
    to,
  });

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/exposure-hours" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Exposure Hours
        </Link>
        <PrintButton />
      </div>

      <h1 className="mb-1 text-xl font-semibold">Exposure Hours - Summary</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {from || to
          ? `Period: ${from ? formatDate(from) : "—"} to ${to ? formatDate(to) : "—"}`
          : "All time"}
      </p>

      <Card className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
        <span className="font-semibold">TOTAL:</span>
        {[
          ["FAT", total.fat],
          ["PTD", total.ptd],
          ["PPD", total.ppd],
          ["LWC", total.lwc],
          ["RWC", total.rwc],
          ["MTC", total.mtc],
          ["LTI", total.lti],
          ["TRC", total.trc],
        ].map(([label, value]) => (
          <span key={label as string} className="flex items-center gap-1.5">
            {label}: <Badge tone="accent">{value}</Badge>
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          TOTAL HOURS: <Badge tone="accent">{total.totalHours.toLocaleString()}</Badge>
        </span>
        <span className="flex items-center gap-1.5">
          LTIF: <Badge tone="accent">{fmtFreq(total.ltif)}</Badge>
        </span>
        <span className="flex items-center gap-1.5">
          TRCF: <Badge tone="accent">{fmtFreq(total.trcf)}</Badge>
        </span>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Vessels</th>
                <th className="px-4 py-2.5 font-medium">FAT</th>
                <th className="px-4 py-2.5 font-medium">PTD</th>
                <th className="px-4 py-2.5 font-medium">PPD</th>
                <th className="px-4 py-2.5 font-medium">LWC</th>
                <th className="px-4 py-2.5 font-medium">RWC</th>
                <th className="px-4 py-2.5 font-medium">MTC</th>
                <th className="px-4 py-2.5 font-medium">LTI</th>
                <th className="px-4 py-2.5 font-medium">TRC</th>
                <th className="px-4 py-2.5 font-medium">Total Hours</th>
                <th className="px-4 py-2.5 font-medium">LTIF</th>
                <th className="px-4 py-2.5 font-medium">TRCF</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.vesselId} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-medium">{r.vesselName}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{r.fat}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{r.ptd}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{r.ppd}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{r.lwc}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{r.rwc}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{r.mtc}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{r.lti}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{r.trc}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{r.totalHours.toLocaleString()}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{fmtFreq(r.ltif)}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{fmtFreq(r.trcf)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
