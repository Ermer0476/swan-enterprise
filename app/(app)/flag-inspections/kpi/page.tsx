import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { flaginspAnalytics, resolveFlaginspKpiRange } from "@/features/flag-inspections/queries";
import {
  FLAGINSP_KPI_PERIODS,
  FLAGINSP_KPI_PERIOD_LABELS,
  DEFAULT_FLAGINSP_KPI_PERIOD,
  type FlaginspKpiPeriodKey,
} from "@/features/flag-inspections/schema";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function isFlaginspKpiPeriodKey(v: string | undefined): v is FlaginspKpiPeriodKey {
  return !!v && (FLAGINSP_KPI_PERIODS as readonly string[]).includes(v);
}

export default async function FlagInspectionKpiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("flaginsp:read");
  const sp = await searchParams;
  const isShipboard = user.department === "SHIPBOARD";
  const vesselId = isShipboard ? (user.vesselId ?? undefined) : undefined;

  const period = isFlaginspKpiPeriodKey(sp.period) ? sp.period : DEFAULT_FLAGINSP_KPI_PERIOD;
  const range = resolveFlaginspKpiRange(period);
  const data = await flaginspAnalytics(user.companyId, range, vesselId);

  return (
    <>
      <Link
        href="/flag-inspections"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Flag Inspections
      </Link>
      <PageHeader
        title="Flag Inspections KPIs"
        description="Flag State inspection trends — finding rate across every inspection."
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Period</label>
          <Select name="period" defaultValue={period} className="w-48">
            {FLAGINSP_KPI_PERIODS.map((p) => (
              <option key={p} value={p}>
                {FLAGINSP_KPI_PERIOD_LABELS[p]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">
          Apply
        </Button>
        <p className="pb-1.5 text-xs text-muted-foreground">
          Showing {formatDate(range.from)} – {formatDate(range.to)}
        </p>
      </form>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-semibold tabular-nums">{data.totalAudits}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Inspections in Period</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-semibold tabular-nums">{data.totalObservations}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Total Observations</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-semibold tabular-nums">{data.avgPerAudit.toFixed(1)}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Average Observations / Inspection</div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
