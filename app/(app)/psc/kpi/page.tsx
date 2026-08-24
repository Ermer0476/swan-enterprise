import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { pscAnalytics, resolvePscKpiRange } from "@/features/psc/queries";
import { PSC_KPI_PERIODS, PSC_KPI_PERIOD_LABELS, DEFAULT_PSC_KPI_PERIOD, type PscKpiPeriodKey } from "@/features/psc/schema";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function isPscKpiPeriodKey(v: string | undefined): v is PscKpiPeriodKey {
  return !!v && (PSC_KPI_PERIODS as readonly string[]).includes(v);
}

export default async function PscKpiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("psc:read");
  const sp = await searchParams;

  const period = isPscKpiPeriodKey(sp.period) ? sp.period : DEFAULT_PSC_KPI_PERIOD;
  const range = resolvePscKpiRange(period);
  const data = await pscAnalytics(user.companyId, range);

  return (
    <>
      <Link href="/psc" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to PSC Inspections
      </Link>
      <PageHeader
        title="PSC KPIs"
        description="Port State Control inspection trends — deficiency rate and detention outcomes."
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Period</label>
          <Select name="period" defaultValue={period} className="w-48">
            {PSC_KPI_PERIODS.map((p) => (
              <option key={p} value={p}>
                {PSC_KPI_PERIOD_LABELS[p]}
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
            <div className="text-2xl font-semibold tabular-nums">{data.totalInspections}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Inspections in Period</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-semibold tabular-nums">{data.avgPerInspection.toFixed(1)}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Average Observations / Inspection</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-semibold tabular-nums text-danger">{data.detainedCount}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Inspections with Detention</div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
