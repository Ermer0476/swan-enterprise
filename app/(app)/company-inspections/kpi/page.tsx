import Link from "next/link";
import { ArrowLeft, Target } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { companyInspectionAnalytics, getCinspKpiTargets } from "@/features/company-inspections/queries";
import { resolveSirePeriod } from "@/features/sire/queries";
import {
  SIRE_OBSERVATION_CATEGORY_LABELS,
  SIRE_OBSERVATION_CATEGORY_ICONS,
  VIQ_CHAPTERS,
} from "@/features/company-inspections/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { humanize } from "@/lib/utils";
import {
  BarChart,
  StackedBarChart,
  VerticalBarChart,
  paletteColor,
  type BarDatum,
  type StackedDatum,
  type LegendEntry,
} from "@/components/ui/bar-chart";
import { RootCausePanel } from "@/components/kpi/root-cause-panel";
import { KpiTabs } from "@/components/ui/kpi-tabs";
import { GaugeChart } from "@/components/ui/gauge-chart";

export default async function CompanyInspectionKpiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("cinsp:create");
  const sp = await searchParams;

  const year = sp.year ? Number(sp.year) : undefined;
  const quarter = sp.quarter ? Number(sp.quarter) : undefined;

  const range = resolveSirePeriod(year, quarter);
  const [data, targets] = await Promise.all([
    companyInspectionAnalytics(user.companyId, range),
    getCinspKpiTargets(user.companyId),
  ]);
  const { avgObservationTarget: OBSERVATION_TARGET } = targets;
  const canManageTargets = can(user, "cinsp:manage-targets");

  const categoryData: BarDatum[] = Object.entries(data.byCategory)
    .map(([key, value], i) => ({
      label: SIRE_OBSERVATION_CATEGORY_LABELS[key as keyof typeof SIRE_OBSERVATION_CATEGORY_LABELS] ?? humanize(key),
      value,
      color: paletteColor(i),
      icon: SIRE_OBSERVATION_CATEGORY_ICONS[key as keyof typeof SIRE_OBSERVATION_CATEGORY_ICONS],
    }))
    .sort((a, b) => b.value - a.value);

  // All 12 VIQ chapters, zero-filled — a chapter with no observations still
  // needs a visible bar at 0. Labeled by number + the chapter title's first
  // word (e.g. "4-Navigation", "5-Safety").
  const chapterData: BarDatum[] = VIQ_CHAPTERS.map((c, i) => ({
    label: `${c.no}-${c.title.split(" ")[0]}`,
    value: data.byChapter[c.no] ?? 0,
    color: paletteColor(i),
  }));

  // Fixed colors matching the Type badge elsewhere in the module (Safety =
  // warning amber, Technical = neutral blue) rather than palette-cycling by
  // insertion order, so the same type always reads as the same color.
  const INSPECTION_TYPE_COLORS: Record<string, string> = {
    Technical: "#3b82f6",
    Safety: "#f59e0b",
    Unspecified: "#9ca3af",
  };
  const inspectionTypes = Array.from(
    new Set(Object.values(data.byVesselInspectionType).flatMap((byType) => Object.keys(byType))),
  );
  const vesselData: StackedDatum[] = Object.entries(data.byVesselInspectionType)
    .map(([vesselName, byType]) => ({
      label: vesselName,
      segments: Object.entries(byType).map(([type, value]) => ({
        key: type,
        value,
        color: INSPECTION_TYPE_COLORS[type] ?? paletteColor(0),
      })),
    }))
    .sort(
      (a, b) =>
        b.segments.reduce((s, x) => s + x.value, 0) - a.segments.reduce((s, x) => s + x.value, 0),
    );
  const vesselLegend: LegendEntry[] = inspectionTypes.map((type) => ({
    key: type,
    color: INSPECTION_TYPE_COLORS[type] ?? paletteColor(0),
  }));

  return (
    <>
      <Link href="/company-inspections" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Company Inspections
      </Link>
      <PageHeader
        title="Company Inspection KPIs"
        description="Fleet-wide observation trends — office use only."
        actions={
          canManageTargets && (
            <Link href="/settings/company-inspections-kpi">
              <Button type="button" variant="outline" size="sm">
                <Target className="h-4 w-4" /> Edit Target
              </Button>
            </Link>
          )
        }
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

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
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
        <Card>
          <CardContent className="flex items-center justify-center pt-2">
            <GaugeChart
              value={data.avgPerInspection}
              target={OBSERVATION_TARGET}
              label={`vs Target ≤ ${OBSERVATION_TARGET.toFixed(2)}`}
              size={130}
            />
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
            key: "chapter",
            label: "By Chapter",
            content: <VerticalBarChart data={chapterData} />,
          },
          {
            key: "vessel",
            label: "By Vessel (Type of Inspection)",
            content: <StackedBarChart data={vesselData} legend={vesselLegend} />,
          },
        ]}
      />
    </>
  );
}
