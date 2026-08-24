import Link from "next/link";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Clock,
  UserRound,
  FileWarning,
  TrendingUp,
  ShieldCheck,
  Info,
  Target,
} from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getRollingKpiDashboard, getExposureKpiTargets, listVesselOptions } from "@/features/exposure-hours/queries";
import { getKpiPeriod, quarterEndDate, clampToToday } from "@/lib/kpi-period";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatCard, type StatDelta } from "@/components/ui/stat-card";
import { TrendChart } from "@/components/ui/trend-chart";
import { GaugeChart } from "@/components/ui/gauge-chart";
import { PrintButton } from "@/components/ui/print-button";
import { ReportingPeriodSelect } from "@/components/kpi/reporting-period-select";
import { cn } from "@/lib/utils";

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / prev) * 100;
}

function lowerIsBetterDelta(curr: number, prev: number): StatDelta {
  const percent = pctChange(curr, prev);
  return { percent, tone: percent === 0 ? "neutral" : percent < 0 ? "good" : "bad" };
}

// Compact "vs prior 12mo" indicator shown under a gauge tile — the trend
// context that used to live in its own separate stat tile, folded into the
// gauge tile instead so the two don't show the same figure twice.
function GaugeDelta({ delta }: { delta: StatDelta }) {
  const up = delta.percent >= 0;
  return (
    <div
      className={cn(
        "-mt-1 flex items-center gap-1 whitespace-nowrap text-xs font-medium",
        delta.tone === "good" && "text-success",
        delta.tone === "bad" && "text-danger",
        delta.tone === "neutral" && "text-muted-foreground",
      )}
      title={`${Math.abs(delta.percent).toFixed(1)}% vs the prior rolling 12-month period`}
    >
      {up ? <ArrowUp className="h-3 w-3 shrink-0" /> : <ArrowDown className="h-3 w-3 shrink-0" />}
      {Math.abs(delta.percent).toFixed(1)}% vs prior 12mo
    </div>
  );
}

export default async function ExposureKpiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("exposure:read");
  const sp = await searchParams;
  const vesselId = sp.vesselId || undefined;

  const year = sp.year ? Number(sp.year) : undefined;
  const quarter = sp.quarter ? (Number(sp.quarter) as 1 | 2 | 3 | 4) : undefined;
  const reportingDate =
    year && quarter && quarter >= 1 && quarter <= 4 ? clampToToday(quarterEndDate(year, quarter)) : undefined;

  const [vessels, dashboard, targets] = await Promise.all([
    listVesselOptions(user.companyId),
    getRollingKpiDashboard(user.companyId, { vesselId, reportingDate }),
    getExposureKpiTargets(user.companyId),
  ]);
  const { ltifTarget: LTIF_TARGET, trcfTarget: TRCF_TARGET } = targets;
  const canManageTargets = can(user, "exposure:manage-targets");

  const { totals, previousTotals, monthly, asOf } = dashboard;
  const currentPeriod = getKpiPeriod({ measurementPeriod: "ROLLING_12", reportingDate: asOf });

  const ltifPoints = monthly.map((m) => ({ label: m.label, value: m.ltif }));
  const trcfPoints = monthly.map((m) => ({ label: m.label, value: m.trcf }));

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        href="/exposure-hours"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Exposure Hours
      </Link>

      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" /> Safety · KPI Dashboard
      </div>

      <PageHeader
        title="Rolling 12-Month LTIF & TRCF Performance"
        description={`Review: Quarterly · Measurement: Rolling 12 Months · Reporting Period: ${currentPeriod.periodLabel} — per 1,000,000 exposure hours.`}
        actions={
          <div className="flex items-center gap-2">
            {canManageTargets && (
              <Link href="/settings/exposure-kpi">
                <Button type="button" variant="outline" size="sm">
                  <Target className="h-4 w-4" /> Edit Targets
                </Button>
              </Link>
            )}
            <PrintButton />
          </div>
        }
      />

      <Card className="mb-4 p-5">
        <ReportingPeriodSelect
          defaultYear={sp.year}
          defaultQuarter={sp.quarter}
          extraFields={
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Vessel</label>
              <Select name="vesselId" defaultValue={vesselId ?? ""} className="w-56">
                <option value="">All Vessels (Fleet)</option>
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
            </div>
          }
        />
      </Card>

      <div className="mb-4 flex flex-wrap gap-4">
        <StatCard
          icon={Clock}
          iconClassName="bg-accent/10 text-accent"
          label="Exposure Hours"
          value={totals.totalHours.toLocaleString()}
          unit="hours"
          delta={{ percent: pctChange(totals.totalHours, previousTotals.totalHours), tone: "neutral" }}
          deltaCaption="vs prior 12mo"
          deltaTitle="vs the prior rolling 12-month period"
        />
        <StatCard
          icon={UserRound}
          iconClassName="bg-danger/10 text-danger"
          label="LTI"
          value={totals.lti.toString()}
          unit="cases"
          delta={lowerIsBetterDelta(totals.lti, previousTotals.lti)}
          deltaCaption="vs prior 12mo"
          deltaTitle="vs the prior rolling 12-month period"
        />
        <StatCard
          icon={FileWarning}
          iconClassName="bg-accent/10 text-accent"
          label="TRC"
          value={totals.trc.toString()}
          unit="cases"
          delta={lowerIsBetterDelta(totals.trc, previousTotals.trc)}
          deltaCaption="vs prior 12mo"
          deltaTitle="vs the prior rolling 12-month period"
        />
        <Card className="min-w-[10rem] flex-1">
          <CardContent className="flex flex-col items-center pt-2">
            <GaugeChart
              value={totals.ltif}
              target={LTIF_TARGET}
              label={`LTIF vs Target ≤ ${LTIF_TARGET.toFixed(2)}`}
              size={100}
            />
            <GaugeDelta delta={lowerIsBetterDelta(totals.ltif, previousTotals.ltif)} />
          </CardContent>
        </Card>
        <Card className="min-w-[10rem] flex-1">
          <CardContent className="flex flex-col items-center pt-2">
            <GaugeChart
              value={totals.trcf}
              target={TRCF_TARGET}
              label={`TRCF vs Target ≤ ${TRCF_TARGET.toFixed(2)}`}
              size={100}
            />
            <GaugeDelta delta={lowerIsBetterDelta(totals.trcf, previousTotals.trcf)} />
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-accent" /> Rolling 12-Month LTIF Trend
          </div>
          <TrendChart points={ltifPoints} color="#3b82f6" target={LTIF_TARGET} seriesLabel="LTIF" />
          <div className="mt-4 flex items-start gap-2 rounded-md bg-accent/10 p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>
              Current rolling 12-month LTIF is <span className="font-semibold">{totals.ltif.toFixed(2)}</span> per
              1,000,000 exposure hours.
              <br />
              Target: ≤ {LTIF_TARGET.toFixed(2)}
            </span>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-accent" /> Rolling 12-Month TRCF Trend
          </div>
          <TrendChart points={trcfPoints} color="#f59e0b" target={TRCF_TARGET} seriesLabel="TRCF" />
          <div className="mt-4 flex items-start gap-2 rounded-md bg-accent/10 p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>
              Current rolling 12-month TRCF is <span className="font-semibold">{totals.trcf.toFixed(2)}</span> per
              1,000,000 exposure hours.
              <br />
              Target: ≤ {TRCF_TARGET.toFixed(2)}
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
