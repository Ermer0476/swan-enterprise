import Link from "next/link";
import { CalendarRange, Activity, BarChart3 } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { listExposureSummary, listVesselOptions, resolveSummaryPeriodRange } from "@/features/exposure-hours/queries";
import { SUMMARY_PERIODS, SUMMARY_PERIOD_LABELS, DEFAULT_SUMMARY_PERIOD, type SummaryPeriodKey } from "@/features/exposure-hours/schema";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExposureSummaryTiles } from "@/components/exposure/summary-tiles";
import { LegendsPanel } from "./legends-panel";
import { SummaryTable } from "./summary-table";

function isSummaryPeriodKey(v: string | undefined): v is SummaryPeriodKey {
  return !!v && (SUMMARY_PERIODS as readonly string[]).includes(v);
}

export default async function ExposureHoursPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("exposure:read");
  const sp = await searchParams;
  const vessels = await listVesselOptions(user.companyId);
  const isShipboard = user.department === "SHIPBOARD";
  const vesselId = isShipboard ? (user.vesselId ?? "__no-vessel-assigned__") : (sp.vesselId || undefined);

  const period = isSummaryPeriodKey(sp.period) ? sp.period : DEFAULT_SUMMARY_PERIOD;
  const { from, to } = resolveSummaryPeriodRange(period);
  const { rows, total } = await listExposureSummary(user.companyId, {
    vesselId,
    from,
    to,
  });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Exposure Hours - Summary" description="Fleet-wide LTI/TRC safety statistics per vessel." />

      <Card className="mb-4 p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <CalendarRange className="h-4 w-4 text-accent" /> Filter
        </div>
        <form className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Vessel</label>
            <Select name="vesselId" defaultValue={sp.vesselId ?? ""} className="w-56">
              <option value="">All Vessels</option>
              {vessels.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Period</label>
            <Select name="period" defaultValue={period} className="w-48">
              {SUMMARY_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {SUMMARY_PERIOD_LABELS[p]}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit">Filter</Button>
          <p className="pb-1.5 text-xs text-muted-foreground">
            Showing {formatDate(from)} – {formatDate(to)}
          </p>
        </form>
      </Card>

      <div className="mb-4">
        <ExposureSummaryTiles
          totals={total}
          actions={
            <div className="flex items-center gap-2">
              <LegendsPanel />
              <Link href={`/exposure-hours/kpi${sp.vesselId ? `?vesselId=${sp.vesselId}` : ""}`}>
                <Button type="button" variant="warning" size="sm">
                  <BarChart3 className="h-4 w-4" /> Exposure KPIs
                </Button>
              </Link>
            </div>
          }
        />
      </div>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Activity className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No vessels to show</p>
        </Card>
      ) : (
        <SummaryTable rows={rows} />
      )}
    </div>
  );
}
