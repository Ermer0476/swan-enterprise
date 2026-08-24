import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { getVessel } from "@/features/vessels/queries";
import {
  getEnvironmentMonthlyGarbage,
  getEnvironmentMonthlyDischarge,
  getEnvironmentGarbageByDisposalMethod,
} from "@/features/environment/queries";
import { GARBAGE_CATEGORIES, GARBAGE_CATEGORY_LABELS, type GarbageCategoryValue } from "@/features/environment/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StackedBarChart, VerticalBarChart, VerticalGroupedBarChart, paletteColor } from "@/components/ui/bar-chart";
import { TrendChart } from "@/components/ui/trend-chart";
import { KpiTabs } from "@/components/ui/kpi-tabs";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const QUARTER_MONTHS: Record<string, number[]> = {
  Q1: [1, 2, 3],
  Q2: [4, 5, 6],
  Q3: [7, 8, 9],
  Q4: [10, 11, 12],
};

/** Resolve the "period" URL param (Full Year / QN / MN) to the set of
 * months it covers and a human label — drives the Total Cargo Loaded tile
 * without a second DB query, since monthlyDischarge already has every
 * month's figure for the selected year in hand. */
function resolvePeriod(period: string | undefined, year: number): { months: number[]; label: string } {
  if (period && period in QUARTER_MONTHS) {
    return { months: QUARTER_MONTHS[period]!, label: `${period} ${year} (${SHORT_MONTHS[QUARTER_MONTHS[period]![0]! - 1]}–${SHORT_MONTHS[QUARTER_MONTHS[period]!.at(-1)! - 1]})` };
  }
  if (period?.startsWith("M")) {
    const m = Number(period.slice(1));
    if (m >= 1 && m <= 12) return { months: [m], label: `${MONTH_NAMES[m - 1]} ${year}` };
  }
  return { months: Array.from({ length: 12 }, (_, i) => i + 1), label: `Full Year ${year}` };
}

export default async function EnvironmentKpiPage({
  params,
  searchParams,
}: {
  params: Promise<{ vesselId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("environment:read");
  const { vesselId } = await params;
  const sp = await searchParams;
  const vessel = await getVessel(user.companyId, vesselId);
  if (!vessel) notFound();

  const today = new Date();
  const year = Number(sp.year) || today.getUTCFullYear();

  const [monthlyGarbage, monthlyDischarge, garbageByMethod] = await Promise.all([
    getEnvironmentMonthlyGarbage(user.companyId, vesselId, year),
    getEnvironmentMonthlyDischarge(user.companyId, vesselId, year),
    getEnvironmentGarbageByDisposalMethod(user.companyId, vesselId, year),
  ]);

  const years = Array.from({ length: 4 }, (_, i) => today.getUTCFullYear() - i);
  const { months: periodMonths, label: periodLabel } = resolvePeriod(sp.period, year);
  const totalCargoLoaded = monthlyDischarge
    .filter((r) => periodMonths.includes(r.month))
    .reduce((sum, r) => sum + (r.cargoLoaded ?? 0), 0);

  const dischargeMonths = monthlyDischarge.map((r) => r.month).sort((a, b) => a - b);
  const byMonthDischarge = new Map(monthlyDischarge.map((r) => [r.month, r]));
  const round = (v: number | null | undefined) => Math.round((v ?? 0) * 100) / 100;
  const monthLabel = (m: number) => `${SHORT_MONTHS[m - 1]} ${year}`;

  // Ballast Water — one vertical bar per month.
  const ballastPoints = dischargeMonths.map((m) => ({
    label: monthLabel(m),
    value: round(byMonthDischarge.get(m)?.ballastWaterQuantity),
    color: paletteColor(0),
  }));
  // Sewage — one vertical bar per month (already the at-sea + to-facility total, normalized).
  const sewagePoints = dischargeMonths.map((m) => ({
    label: monthLabel(m),
    value: round(byMonthDischarge.get(m)?.sewageQuantity),
    color: paletteColor(1),
  }));
  // Grey Water — one vertical bar per month (Discharged, the MARPOL-tracked figure).
  const greyWaterPoints = dischargeMonths.map((m) => ({
    label: monthLabel(m),
    value: round(byMonthDischarge.get(m)?.greyWaterDischarged),
    color: paletteColor(2),
  }));
  // Bilge — one vertical bar per month (Processed).
  const bilgePoints = dischargeMonths.map((m) => ({
    label: monthLabel(m),
    value: round(byMonthDischarge.get(m)?.bilgeProcessed),
    color: paletteColor(8),
  }));
  // Sludge — Generated vs Landed Ashore side by side per month, since both
  // are separately worth watching (Generated on its own doesn't show how
  // much of it actually left the ship).
  const sludgeData = dischargeMonths.map((m) => {
    const d = byMonthDischarge.get(m);
    return {
      label: monthLabel(m),
      segments: [
        { key: "Generated", value: round(d?.sludgeGenerated), color: paletteColor(6) },
        { key: "Landed Ashore", value: round(d?.sludgeLandedAshore), color: paletteColor(7) },
      ],
    };
  });

  // One row per month, segments per category — months with zero garbage
  // logged still get a row (empty bar) so the axis stays a consistent 12-wide
  // (or however many months have any record) timeline.
  const monthsWithData = Array.from(new Set(monthlyGarbage.map((g) => g.month))).sort((a, b) => a - b);
  const garbageCategories = Array.from(new Set(monthlyGarbage.map((g) => g.category))) as GarbageCategoryValue[];
  const garbageByMonth = monthsWithData.map((month) => ({
    label: `${SHORT_MONTHS[month - 1]} ${year}`,
    segments: garbageCategories.map((category, i) => ({
      key: GARBAGE_CATEGORY_LABELS[category],
      value: Math.round((monthlyGarbage.find((g) => g.month === month && g.category === category)?.totalCbm ?? 0) * 100) / 100,
      color: paletteColor(i),
    })),
  }));

  const disposalMethodRows = GARBAGE_CATEGORIES.filter((category) => garbageByMethod.some((g) => g.category === category)).map((category) => {
    const g = garbageByMethod.find((row) => row.category === category)!;
    return {
      label: GARBAGE_CATEGORY_LABELS[category],
      segments: [
        { key: "Discharged to Sea", value: Math.round(g.overboardToSeaCbm * 100) / 100, color: paletteColor(0) },
        { key: "Incinerated", value: Math.round(g.incineratedCbm * 100) / 100, color: paletteColor(1) },
        { key: "Discharged Ashore", value: Math.round(g.dischargeAshoreCbm * 100) / 100, color: paletteColor(2) },
      ],
    };
  });

  const singleMetricPoints = (key: keyof (typeof monthlyDischarge)[number]) =>
    monthlyDischarge
      .filter((r) => r[key] !== null)
      .map((r) => ({ label: `${SHORT_MONTHS[r.month - 1]} ${year}`, value: Math.round(((r[key] as number) ?? 0) * 100) / 100 }));

  return (
    <div className="mx-auto max-w-7xl">
      <Link href={`/environment/${vesselId}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to {vessel.name} — Environment Records
      </Link>

      <PageHeader title={`${vessel.name} — Environment KPI Dashboard`} description={`Garbage and discharge figures for ${year}.`} />

      <form className="mb-6 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Year</label>
          <Select name="year" defaultValue={String(year)} className="w-28">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Period (Total Cargo Loaded tile)</label>
          <Select name="period" defaultValue={sp.period ?? ""} className="w-48">
            <option value="">Full Year</option>
            <optgroup label="Quarterly">
              {Object.keys(QUARTER_MONTHS).map((q) => (
                <option key={q} value={q}>
                  {q} ({SHORT_MONTHS[QUARTER_MONTHS[q]![0]! - 1]}–{SHORT_MONTHS[QUARTER_MONTHS[q]!.at(-1)! - 1]})
                </option>
              ))}
            </optgroup>
            <optgroup label="Monthly">
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={`M${i + 1}`}>
                  {m}
                </option>
              ))}
            </optgroup>
          </Select>
        </div>
        <Button type="submit" variant="outline">
          Apply
        </Button>
      </form>

      <KpiTabs
        tabs={[
          {
            key: "garbage-by-category",
            label: "Garbage by Category per Month",
            content:
              garbageByMonth.length === 0 ? (
                <p className="text-sm text-muted-foreground">No garbage entries logged for {year}.</p>
              ) : (
                <div className="space-y-6">
                  <StackedBarChart
                    data={garbageByMonth}
                    legend={garbageCategories.map((category, i) => ({ key: GARBAGE_CATEGORY_LABELS[category], color: paletteColor(i) }))}
                  />
                  <div className="border-t border-border pt-6">
                    <div className="mb-3 text-sm font-semibold">Disposal Method by Category — {year} Total</div>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Per category, how much (cu.m.) was discharged to sea, incinerated, or discharged ashore for the year.
                    </p>
                    <StackedBarChart
                      data={disposalMethodRows}
                      legend={[
                        { key: "Discharged to Sea", color: paletteColor(0) },
                        { key: "Incinerated", color: paletteColor(1) },
                        { key: "Discharged Ashore", color: paletteColor(2) },
                      ]}
                    />
                  </div>
                </div>
              ),
          },
          {
            key: "water-discharge",
            label: "Discharge & Waste Summary per Month",
            content:
              dischargeMonths.length === 0 ? (
                <p className="text-sm text-muted-foreground">No records logged for {year}.</p>
              ) : (
                <div className="space-y-8">
                  <div>
                    <div className="mb-2 text-sm font-semibold">Ballast Water (cu.m.)</div>
                    <VerticalBarChart data={ballastPoints} />
                  </div>
                  <div className="border-t border-border pt-6">
                    <div className="mb-2 text-sm font-semibold">Sewage Discharged (cu.m.)</div>
                    <VerticalBarChart data={sewagePoints} />
                  </div>
                  <div className="border-t border-border pt-6">
                    <div className="mb-2 text-sm font-semibold">Grey Water Discharged (cu.m.)</div>
                    <VerticalBarChart data={greyWaterPoints} />
                  </div>
                  <div className="border-t border-border pt-6">
                    <div className="mb-2 text-sm font-semibold">Bilge Processed (cu.m.)</div>
                    <VerticalBarChart data={bilgePoints} />
                  </div>
                  <div className="border-t border-border pt-6">
                    <div className="mb-2 text-sm font-semibold">Sludge — Generated vs Landed Ashore (cu.m.)</div>
                    <VerticalGroupedBarChart
                      data={sludgeData}
                      legend={[
                        { key: "Generated", color: paletteColor(6) },
                        { key: "Landed Ashore", color: paletteColor(7) },
                      ]}
                    />
                  </div>
                </div>
              ),
          },
          {
            key: "refrigerant",
            label: "Refrigerant Gas per Month",
            content:
              singleMetricPoints("refrigerantQuantityKg").length === 0 && singleMetricPoints("refrigerantAdded").length === 0 ? (
                <p className="text-sm text-muted-foreground">No refrigerant figures logged for {year}.</p>
              ) : (
                <div className="space-y-6">
                  {/* Kept as its own chart, in kg — stacking it into the cu.m.
                      discharge chart above would silently add mass to volume. */}
                  {singleMetricPoints("refrigerantQuantityKg").length > 0 && (
                    <div>
                      <div className="mb-2 text-sm font-semibold">Refrigerant Consumption</div>
                      <TrendChart points={singleMetricPoints("refrigerantQuantityKg")} color={paletteColor(3)} seriesLabel="Refrigerant (kg)" />
                    </div>
                  )}
                  {singleMetricPoints("refrigerantAdded").length > 0 && (
                    <div className="border-t border-border pt-6">
                      <div className="mb-2 text-sm font-semibold">Total Refrigerant Added</div>
                      <TrendChart points={singleMetricPoints("refrigerantAdded")} color={paletteColor(9)} seriesLabel="Added (kg)" />
                    </div>
                  )}
                </div>
              ),
          },
          {
            key: "cargo",
            label: "Cargo Loaded per Month",
            content:
              singleMetricPoints("cargoLoaded").length === 0 ? (
                <p className="text-sm text-muted-foreground">No cargo figures logged for {year}.</p>
              ) : (
                <div className="space-y-4">
                  <Card>
                    <CardContent className="pt-5">
                      <div className="text-2xl font-semibold tabular-nums">{totalCargoLoaded.toLocaleString(undefined, { maximumFractionDigits: 2 })} mt</div>
                      <div className="text-xs text-muted-foreground">Total Cargo Loaded — {periodLabel}</div>
                    </CardContent>
                  </Card>
                  <TrendChart points={singleMetricPoints("cargoLoaded")} color={paletteColor(4)} seriesLabel="Cargo Loaded (mt)" />
                </div>
              ),
          },
        ]}
      />
    </div>
  );
}
