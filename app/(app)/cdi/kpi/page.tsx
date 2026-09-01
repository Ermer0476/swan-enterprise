import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { cdiAnalytics, resolveCdiPeriod } from "@/features/cdi/queries";
import { CDI_OBSERVATION_CATEGORIES, CDI_OBSERVATION_CATEGORY_LABELS } from "@/features/cdi/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { humanize } from "@/lib/utils";
import { BarChart, StackedBarChart, paletteColor, type BarDatum, type StackedDatum, type LegendEntry } from "@/components/ui/bar-chart";
import { RootCausePanel } from "@/components/kpi/root-cause-panel";
import { KpiTabs } from "@/components/ui/kpi-tabs";

export default async function CdiKpiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("cdi:create");
  const sp = await searchParams;
  const isShipboard = user.department === "SHIPBOARD";
  const vesselId = isShipboard ? (user.vesselId ?? undefined) : undefined;

  // No year selected = All Time (quarter is meaningless without a year, so
  // it's ignored in that case too). Year with no quarter = the whole year.
  const year = sp.year ? Number(sp.year) : undefined;
  const quarter = sp.quarter ? Number(sp.quarter) : undefined;

  const range = resolveCdiPeriod(year, quarter);
  const data = await cdiAnalytics(user.companyId, range, vesselId);

  const categoryData: BarDatum[] = Object.entries(data.byCategory)
    .map(([key, value], i) => ({
      label: CDI_OBSERVATION_CATEGORY_LABELS[key as (typeof CDI_OBSERVATION_CATEGORIES)[number]] ?? humanize(key),
      value,
      color: paletteColor(i),
    }))
    .sort((a, b) => b.value - a.value);

  const inspectors = Array.from(
    new Set(Object.values(data.byVesselInspector).flatMap((byInspector) => Object.keys(byInspector))),
  );
  const inspectorColor = new Map(inspectors.map((name, i) => [name, paletteColor(i)]));
  const vesselData: StackedDatum[] = Object.entries(data.byVesselInspector)
    .map(([vesselName, byInspector]) => ({
      label: vesselName,
      segments: Object.entries(byInspector).map(([inspector, value]) => ({
        key: inspector,
        value,
        color: inspectorColor.get(inspector)!,
      })),
    }))
    .sort(
      (a, b) =>
        b.segments.reduce((s, x) => s + x.value, 0) - a.segments.reduce((s, x) => s + x.value, 0),
    );
  const vesselLegend: LegendEntry[] = inspectors.map((name) => ({ key: name, color: inspectorColor.get(name)! }));

  return (
    <>
      <Link href="/cdi" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to CDI Inspections
      </Link>
      <PageHeader
        title="CDI KPIs"
        description={`${isShipboard ? "Observation trends" : "Fleet-wide observation trends"} — office use only.`}
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
          <option value="2">Q2 (Jan–Jun)</option>
          <option value="3">Q3 (Jan–Sep)</option>
          <option value="4">Q4 (Jan–Dec)</option>
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
            <div className="mt-0.5 text-xs text-muted-foreground">Average Observations / Inspection{isShipboard ? "" : " (Fleet-wide)"}</div>
          </CardContent>
        </Card>
      </div>

      <KpiTabs
        tabs={[
          {
            key: "category",
            label: "By Category",
            content: <BarChart data={categoryData} unit="observations" />,
          },
          {
            key: "root-cause",
            label: "By Root Cause",
            content: (
              <RootCausePanel
                byRootCause={data.byRootCause}
                bySubRootCause={data.bySubRootCause}
                totalObservations={data.totalObservations}
                unit="observations"
              />
            ),
          },
          {
            key: "vessel",
            label: "By Vessel (Inspector)",
            content: <StackedBarChart data={vesselData} legend={vesselLegend} />,
          },
        ]}
      />
    </>
  );
}
