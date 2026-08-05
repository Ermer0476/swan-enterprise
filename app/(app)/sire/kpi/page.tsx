import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { sireAnalytics, resolveSirePeriod } from "@/features/sire/queries";
import { ROOT_CAUSE_LABELS, ROOT_CAUSE_SUBCATEGORY_LABELS, type RootCauseCategoryValue } from "@/lib/root-cause";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { humanize } from "@/lib/utils";
import { BarChart, StackedBarChart, paletteColor, type BarDatum, type StackedDatum, type LegendEntry } from "@/components/ui/bar-chart";
import { DonutChart, type DonutDatum } from "@/components/ui/donut-chart";
import { KpiTabs } from "./kpi-tabs";

export default async function SireKpiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("sire:create");
  const sp = await searchParams;

  // No year selected = All Time (quarter is meaningless without a year, so
  // it's ignored in that case too). Year with no quarter = the whole year.
  const year = sp.year ? Number(sp.year) : undefined;
  const quarter = sp.quarter ? Number(sp.quarter) : undefined;

  const range = resolveSirePeriod(year, quarter);
  const data = await sireAnalytics(user.companyId, range);

  const categoryData: BarDatum[] = Object.entries(data.byCategory)
    .map(([key, value], i) => ({ label: humanize(key), value, color: paletteColor(i) }))
    .sort((a, b) => b.value - a.value);

  const rootCauseData: BarDatum[] = Object.entries(data.byRootCause)
    .map(([key, value], i) => ({
      label: ROOT_CAUSE_LABELS[key as RootCauseCategoryValue] ?? humanize(key),
      value,
      color: paletteColor(i),
    }))
    .sort((a, b) => b.value - a.value);

  const subCauseDonuts = rootCauseData
    .map((cat) => {
      const categoryKey = (Object.keys(data.byRootCause) as string[]).find(
        (k) => (ROOT_CAUSE_LABELS[k as RootCauseCategoryValue] ?? humanize(k)) === cat.label,
      )!;
      const subs = data.bySubRootCause
        .filter((s) => s.category === categoryKey)
        .sort((a, b) => b.count - a.count)
        .map((s, i): DonutDatum => ({
          label:
            ROOT_CAUSE_SUBCATEGORY_LABELS[categoryKey as RootCauseCategoryValue]?.[s.subCategory] ??
            s.subCategory,
          value: s.count,
          color: paletteColor(i),
        }));
      return { category: cat.label, subs };
    })
    .filter((c) => c.subs.length > 0);

  const oilMajors = Array.from(
    new Set(Object.values(data.byVesselOilMajor).flatMap((byOilMajor) => Object.keys(byOilMajor))),
  );
  const oilMajorColor = new Map(oilMajors.map((name, i) => [name, paletteColor(i)]));
  const vesselData: StackedDatum[] = Object.entries(data.byVesselOilMajor)
    .map(([vesselName, byOilMajor]) => ({
      label: vesselName,
      segments: Object.entries(byOilMajor).map(([oilMajor, value]) => ({
        key: oilMajor,
        value,
        color: oilMajorColor.get(oilMajor)!,
      })),
    }))
    .sort(
      (a, b) =>
        b.segments.reduce((s, x) => s + x.value, 0) - a.segments.reduce((s, x) => s + x.value, 0),
    );
  const vesselLegend: LegendEntry[] = oilMajors.map((name) => ({ key: name, color: oilMajorColor.get(name)! }));

  return (
    <>
      <Link href="/sire" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to SIRE Inspections
      </Link>
      <PageHeader
        title="SIRE KPIs"
        description="Fleet-wide observation trends — office use only."
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <Select name="year" defaultValue={year ? String(year) : ""} className="w-32">
          <option value="">All Time</option>
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
        <Select name="quarter" defaultValue={quarter ? String(quarter) : ""} className="w-36">
          <option value="">Full Year</option>
          <option value="1">Q1 (Jan–Mar)</option>
          <option value="2">Q2 (Apr–Jun)</option>
          <option value="3">Q3 (Jul–Sep)</option>
          <option value="4">Q4 (Oct–Dec)</option>
        </Select>
        <Button type="submit" variant="outline">Apply</Button>
      </form>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-semibold tabular-nums">{data.totalInspections}</div>
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
            <div className="text-2xl font-semibold tabular-nums">{data.avgPerInspection.toFixed(1)}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Average Observations / Inspection (Fleet-wide)</div>
          </CardContent>
        </Card>
      </div>

      <KpiTabs
        tabs={[
          {
            key: "category",
            label: "By Category",
            content: <BarChart data={categoryData} />,
          },
          {
            key: "root-cause",
            label: "By Root Cause",
            content: (
              <div className="space-y-6">
                <BarChart data={rootCauseData} />
                {subCauseDonuts.length > 0 && (
                  <div>
                    <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Sub-Causes by Category
                    </div>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                      {subCauseDonuts.map((c) => (
                        <Card key={c.category}>
                          <CardContent className="pt-4">
                            <div className="mb-2 text-center text-xs font-semibold uppercase tracking-wide">
                              {c.category} Sub-Causes
                            </div>
                            <DonutChart title={c.category} data={c.subs} />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ),
          },
          {
            key: "vessel",
            label: "By Vessel (Oil Major)",
            content: <StackedBarChart data={vesselData} legend={vesselLegend} />,
          },
        ]}
      />
    </>
  );
}
