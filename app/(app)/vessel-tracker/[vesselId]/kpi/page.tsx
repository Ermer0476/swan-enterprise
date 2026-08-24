import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lightbulb } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { getVessel } from "@/features/vessels/queries";
import { getVoyageKpis, getVoyagePerformance, getVoyageMonthlyTime, getVoyageMonthlyLubeOil, getVoyageFuelRate } from "@/features/vessel-tracker/queries";
import type { VoyageReportTypeValue } from "@/features/vessel-tracker/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StackedBarChart, VerticalGroupedBarChart, paletteColor } from "@/components/ui/bar-chart";
import { DonutChart } from "@/components/ui/donut-chart";
import { TrendChart } from "@/components/ui/trend-chart";
import { KpiTabs } from "@/components/ui/kpi-tabs";
import { SpeedVoyageFilter } from "./speed-voyage-filter";
import { PeriodForm } from "./period-form";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const QUARTER_LABELS = ["Q1 (Jan–Mar)", "Q2 (Apr–Jun)", "Q3 (Jul–Sep)", "Q4 (Oct–Dec)"];
const REPORT_TYPE_SHORT: Record<VoyageReportTypeValue, string> = {
  DEPARTURE: "D",
  ARRIVAL: "A",
  NOON_AT_SEA: "N",
  IN_PORT: "P",
};

/** `highlight` marks a tile worth the crew's attention at a glance (e.g.
 * Off-hire > 0 for the period) — same warning-tint convention used for the
 * archived-vessel banner and discrepancy badges elsewhere in this module,
 * rather than a plain number that reads the same whether it's 0 or not. */
function statTile(label: string, value: string, highlight = false) {
  return (
    <Card key={label} className={highlight ? "border-warning/40 bg-warning/10" : undefined}>
      <CardContent className="pt-5">
        <div className={`text-2xl font-semibold tabular-nums ${highlight ? "text-warning" : ""}`}>{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

/** Median of the non-zero values only — a zero day means no consumption was
 * logged (in port, no report), not an efficient burn, and would otherwise
 * drag the "standard" baseline down and make ordinary days look flagged. */
function medianNonZero(values: number[]): number | undefined {
  const nonZero = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) return undefined;
  const mid = Math.floor(nonZero.length / 2);
  return nonZero.length % 2 === 0 ? (nonZero[mid - 1]! + nonZero[mid]!) / 2 : nonZero[mid]!;
}

function average(values: number[]): number | undefined {
  return values.length === 0 ? undefined : values.reduce((s, v) => s + v, 0) / values.length;
}

/** Plain-language readout of the period's figures, replacing the tiles that
 * used to show Total Distance / Steaming Hrs / Port Stay / F.O.+D.O. as bare
 * numbers — those totals are still derivable from the charts below, but a
 * sentence pointing out what's notable (over-standard fuel days, which lube
 * grade ran heaviest) is more actionable than a number alone. */
function buildAnalysis(
  kpis: { totalDistanceNm: number; totalSteamingHrs: number; totalPortStayHrs: number },
  voyageCount: number,
  fuelRate: { foRateMtPerDay: number; doRateMtPerDay: number }[],
  monthlyLubeOil: { cylOilMt: number; meloMt: number; geloMt: number }[],
  vessel: { stdFoConsumptionMt: number | null; stdDoConsumptionMt: number | null },
): string[] {
  const bullets: string[] = [];

  const totalHrs = kpis.totalSteamingHrs + kpis.totalPortStayHrs;
  if (totalHrs > 0) {
    const underwayPct = Math.round((kpis.totalSteamingHrs / totalHrs) * 100);
    bullets.push(
      `Covered ${kpis.totalDistanceNm.toFixed(0)} nm across ${voyageCount} voyage${voyageCount === 1 ? "" : "s"} this period — ${underwayPct}% of logged time underway (${kpis.totalSteamingHrs.toFixed(1)} hrs), ${100 - underwayPct}% in port (${kpis.totalPortStayHrs.toFixed(1)} hrs).`,
    );
  }

  if (fuelRate.length > 0) {
    const foRates = fuelRate.map((p) => p.foRateMtPerDay);
    const doRates = fuelRate.map((p) => p.doRateMtPerDay);
    const foStd = vessel.stdFoConsumptionMt ?? medianNonZero(foRates);
    const doStd = vessel.stdDoConsumptionMt ?? medianNonZero(doRates);
    const foFlagged = foStd !== undefined ? foRates.filter((v) => v > foStd).length : 0;
    const doFlagged = doStd !== undefined ? doRates.filter((v) => v > doStd).length : 0;
    const avgFo = average(foRates);
    const avgDo = average(doRates);
    if (avgFo !== undefined) {
      bullets.push(
        `F.O. averaged ${avgFo.toFixed(2)} mt/24h across ${fuelRate.length} report${fuelRate.length === 1 ? "" : "s"}` +
          (foFlagged > 0 ? ` — ${foFlagged} exceeded the ${foStd!.toFixed(2)} mt/day standard.` : `, staying within the ${foStd?.toFixed(2) ?? "—"} mt/day standard throughout.`),
      );
    }
    if (avgDo !== undefined) {
      bullets.push(
        `D.O. averaged ${avgDo.toFixed(2)} mt/24h` +
          (doFlagged > 0 ? ` — ${doFlagged} report${doFlagged === 1 ? "" : "s"} exceeded the ${doStd!.toFixed(2)} mt/day standard.` : `, staying within the ${doStd?.toFixed(2) ?? "—"} mt/day standard throughout.`),
      );
    }
  }

  const lubeTotals = monthlyLubeOil.reduce(
    (acc, m) => ({ cylOilMt: acc.cylOilMt + m.cylOilMt, meloMt: acc.meloMt + m.meloMt, geloMt: acc.geloMt + m.geloMt }),
    { cylOilMt: 0, meloMt: 0, geloMt: 0 },
  );
  const lubeEntries: [string, number][] = [
    ["Cyl Oil", lubeTotals.cylOilMt],
    ["MELO", lubeTotals.meloMt],
    ["GELO", lubeTotals.geloMt],
  ];
  const topLube = lubeEntries.reduce((a, b) => (b[1] > a[1] ? b : a));
  if (topLube[1] > 0) {
    bullets.push(`${topLube[0]} was the heaviest lube oil draw this period, at ${topLube[1].toFixed(2)} mt total.`);
  }

  return bullets;
}

export default async function VesselTrackerKpiPage({
  params,
  searchParams,
}: {
  params: Promise<{ vesselId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("vtracker:read");
  const { vesselId } = await params;
  const sp = await searchParams;
  const vessel = await getVessel(user.companyId, vesselId);
  if (!vessel) notFound();

  const today = new Date();
  const year = Number(sp.year) || today.getUTCFullYear();
  const month = Number(sp.month) || today.getUTCMonth() + 1;
  const quarter = Number(sp.quarter) || Math.ceil(month / 3);
  const period = sp.period === "quarter" || sp.period === "year" ? sp.period : "month";

  // Monthly stays the one true calendar month; Quarterly is a real 3-month
  // calendar quarter (Jan–Mar, not a cumulative Jan-to-date the way the
  // SIRE/PSC/CDI dashboards define "quarter") — Vessel Performance figures
  // are period totals, not a YTD running comparison, so an isolated quarter
  // is what "Quarterly" should mean here. Yearly is the full calendar year.
  const { from, to } =
    period === "year"
      ? { from: new Date(Date.UTC(year, 0, 1)), to: new Date(Date.UTC(year, 11, 31, 23, 59, 59)) }
      : period === "quarter"
        ? { from: new Date(Date.UTC(year, (quarter - 1) * 3, 1)), to: new Date(Date.UTC(year, quarter * 3, 0, 23, 59, 59)) }
        : { from: new Date(Date.UTC(year, month - 1, 1)), to: new Date(Date.UTC(year, month, 0, 23, 59, 59)) };

  const [kpis, voyagePerformance, monthlyTime, monthlyLubeOil, fuelRate] = await Promise.all([
    getVoyageKpis(user.companyId, vesselId, { from, to }),
    getVoyagePerformance(user.companyId, vesselId, { from, to }),
    getVoyageMonthlyTime(user.companyId, vesselId, { from, to }),
    getVoyageMonthlyLubeOil(user.companyId, vesselId, { from, to }),
    getVoyageFuelRate(user.companyId, vesselId, { from, to }),
  ]);

  const years = Array.from({ length: 4 }, (_, i) => today.getUTCFullYear() - i);

  return (
    <div className="mx-auto max-w-7xl">
      <Link href={`/vessel-tracker/${vesselId}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to {vessel.name} — Voyage Log
      </Link>

      <PageHeader
        title={`${vessel.name} — KPI Dashboard`}
        description={`Distance, speed, consumption, and time-in-port figures for ${
          period === "year" ? String(year) : period === "quarter" ? `${QUARTER_LABELS[quarter - 1]} ${year}` : `${MONTH_NAMES[month - 1]} ${year}`
        }.`}
      />

      <PeriodForm years={years} year={year} period={period} month={month} quarter={quarter} />

      <div className="mb-6 grid grid-cols-2 gap-4">
        {statTile("Avg Speed (kn)", kpis.avgObsSpeedKn != null ? kpis.avgObsSpeedKn.toFixed(2) : "—")}
        {statTile("Off-hire (hrs)", kpis.offHireHrs.toFixed(1), kpis.offHireHrs > 0)}
      </div>

      {(() => {
        const analysis = buildAnalysis(kpis, voyagePerformance.length, fuelRate, monthlyLubeOil, vessel);
        return analysis.length > 0 ? (
          <Card className="mb-6">
            <CardContent className="pt-5">
              <div className="mb-3 text-sm font-semibold">Period Analysis</div>
              <ul className="space-y-2.5">
                {analysis.map((line, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null;
      })()}

      <KpiTabs
        tabs={[
          {
            key: "speed",
            label: "Average Speed per Voyage",
            content: (
              <SpeedVoyageFilter
                points={voyagePerformance.map((v) => ({
                  voyageNo: v.voyageNo,
                  avgSpeedKn: v.avgSpeedKn,
                  avgBeaufort: v.avgBeaufort,
                  ladenState: v.ladenState,
                }))}
              />
            ),
          },
          {
            key: "underway-port",
            label: "Underway vs Port Time",
            content: (
              <DonutChart
                title="Hours"
                data={[
                  { label: "Underway", value: Math.round(kpis.totalSteamingHrs * 10) / 10, color: paletteColor(0) },
                  { label: "In Port", value: Math.round(kpis.totalPortStayHrs * 10) / 10, color: paletteColor(2) },
                ]}
              />
            ),
          },
          {
            key: "sailing-port-month",
            label: "Sailing Time vs Time at Port per Month",
            content: (
              <StackedBarChart
                data={monthlyTime.map((m) => ({
                  label: `${SHORT_MONTHS[m.month - 1]} ${m.year}`,
                  segments: [
                    { key: "Underway", value: Math.round(m.steamingHrs * 10) / 10, color: paletteColor(0) },
                    { key: "In Port", value: Math.round(m.portStayHrs * 10) / 10, color: paletteColor(2) },
                  ],
                }))}
                legend={[
                  { key: "Underway (hrs)", color: paletteColor(0) },
                  { key: "In Port (hrs)", color: paletteColor(2) },
                ]}
              />
            ),
          },
          {
            key: "lube-oil",
            label: "Lube Oil Consumption per Month",
            content:
              monthlyLubeOil.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bunker entries logged for this period.</p>
              ) : (
                <VerticalGroupedBarChart
                  data={monthlyLubeOil.map((m) => ({
                    label: `${SHORT_MONTHS[m.month - 1]} ${m.year}`,
                    segments: [
                      { key: "Cyl Oil", value: Math.round(m.cylOilMt * 100) / 100, color: paletteColor(3) },
                      { key: "MELO", value: Math.round(m.meloMt * 100) / 100, color: paletteColor(4) },
                      { key: "GELO", value: Math.round(m.geloMt * 100) / 100, color: paletteColor(5) },
                    ],
                  }))}
                  legend={[
                    { key: "Cyl Oil (mt)", color: paletteColor(3) },
                    { key: "MELO (mt)", color: paletteColor(4) },
                    { key: "GELO (mt)", color: paletteColor(5) },
                  ]}
                />
              ),
          },
          {
            key: "fo-do-voyage",
            label: "F.O. vs D.O. Consumption per Voyage",
            content: (
              <StackedBarChart
                data={voyagePerformance.map((v) => ({
                  label: v.voyageNo,
                  segments: [
                    { key: "F.O.", value: Math.round(v.foTotalMt * 100) / 100, color: paletteColor(0) },
                    { key: "D.O.", value: Math.round(v.doTotalMt * 100) / 100, color: paletteColor(1) },
                  ],
                }))}
                legend={[
                  { key: "F.O. (mt)", color: paletteColor(0) },
                  { key: "D.O. (mt)", color: paletteColor(1) },
                ]}
              />
            ),
          },
          {
            key: "fo-rate",
            label: "F.O. Consumption Rate (per 24h)",
            content:
              fuelRate.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bunker entries logged for this period.</p>
              ) : (
                <TrendChart
                  points={fuelRate.map((p) => ({
                    label: `${Number(p.date.slice(8, 10))} ${REPORT_TYPE_SHORT[p.reportType]}`,
                    sublabel: SHORT_MONTHS[Number(p.date.slice(5, 7)) - 1],
                    value: Math.round(p.foRateMtPerDay * 100) / 100,
                  }))}
                  color={paletteColor(0)}
                  target={vessel.stdFoConsumptionMt ?? medianNonZero(fuelRate.map((p) => p.foRateMtPerDay))}
                  targetLabel={
                    vessel.stdFoConsumptionMt != null
                      ? `Standard (sea trial): ${vessel.stdFoConsumptionMt.toFixed(2)} mt/day`
                      : "Estimated standard (no sea-trial figure set — set it in Vessel Particulars)"
                  }
                  flagOverTarget
                  seriesLabel="F.O. (mt/24h)"
                />
              ),
          },
          {
            key: "do-rate",
            label: "D.O. Consumption Rate (per 24h)",
            content:
              fuelRate.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bunker entries logged for this period.</p>
              ) : (
                <TrendChart
                  points={fuelRate.map((p) => ({
                    label: `${Number(p.date.slice(8, 10))} ${REPORT_TYPE_SHORT[p.reportType]}`,
                    sublabel: SHORT_MONTHS[Number(p.date.slice(5, 7)) - 1],
                    value: Math.round(p.doRateMtPerDay * 100) / 100,
                  }))}
                  color={paletteColor(1)}
                  target={vessel.stdDoConsumptionMt ?? medianNonZero(fuelRate.map((p) => p.doRateMtPerDay))}
                  targetLabel={
                    vessel.stdDoConsumptionMt != null
                      ? `Standard (sea trial): ${vessel.stdDoConsumptionMt.toFixed(2)} mt/day`
                      : "Estimated standard (no sea-trial figure set — set it in Vessel Particulars)"
                  }
                  flagOverTarget
                  seriesLabel="D.O. (mt/24h)"
                />
              ),
          },
        ]}
      />
    </div>
  );
}
