import Link from "next/link";
import {
  ArrowLeft,
  ShieldAlert,
  HandMetal,
  Trophy,
  MapPin,
  HeartPulse,
  Leaf,
  Wrench,
  Flame,
  Droplet,
  Compass,
  Lock,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { nearMissAnalytics, resolveNearMissPeriod } from "@/features/near-miss/queries";
import { NEARMISS_CONSEQUENCE_LABELS, NEARMISS_CONSEQUENCE_TYPES } from "@/features/near-miss/schema";

// Icon per potential-consequence type, in the same order as the schema —
// only used on this page's breakdown chart, so kept local rather than
// promoted to the shared schema file.
const CONSEQUENCE_ICONS: Record<(typeof NEARMISS_CONSEQUENCE_TYPES)[number], LucideIcon> = {
  INJURY_ILL_HEALTH: HeartPulse,
  ENVIRONMENTAL_DAMAGE: Leaf,
  PROPERTY_DAMAGE: Wrench,
  FIRE_EXPLOSION: Flame,
  LOSS_OF_CONTAINMENT: Droplet,
  NAVIGATION_MARINE_INCIDENT: Compass,
  SECURITY: Lock,
  REGULATORY: Scale,
};
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BarChart, paletteColor, type BarDatum } from "@/components/ui/bar-chart";
import { DonutChart, type DonutDatum } from "@/components/ui/donut-chart";
import { KpiTabs } from "@/components/ui/kpi-tabs";

export default async function NearMissKpiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("nm:create");
  const sp = await searchParams;
  const isShipboard = user.department === "SHIPBOARD";
  const vesselId = isShipboard ? (user.vesselId ?? undefined) : undefined;

  // No year selected = All Time (quarter is meaningless without a year, so
  // it's ignored in that case too). Year with no quarter = the whole year.
  const year = sp.year ? Number(sp.year) : undefined;
  const quarter = sp.quarter ? Number(sp.quarter) : undefined;

  const range = resolveNearMissPeriod(year, quarter);
  const data = await nearMissAnalytics(user.companyId, range, vesselId);

  const consequenceData: BarDatum[] = Object.entries(data.byConsequence)
    .map(([key, value], i) => ({
      label: NEARMISS_CONSEQUENCE_LABELS[key as keyof typeof NEARMISS_CONSEQUENCE_LABELS] ?? key,
      value,
      color: paletteColor(i),
      icon: CONSEQUENCE_ICONS[key as keyof typeof CONSEQUENCE_ICONS],
    }))
    .sort((a, b) => b.value - a.value);

  const locationData: DonutDatum[] = Object.entries(data.byLocation)
    .map(([label, value], i) => ({ label, value, color: paletteColor(i) }))
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <Link href="/near-miss" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Near Miss/HOR
      </Link>
      <PageHeader
        title="Near Miss/HOR KPIs"
        description="Potential consequences, Stop Work Authority usage, and reporter engagement — office use only."
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
            <div className="text-2xl font-semibold tabular-nums">{data.ncCount}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Near Misses (NC) in Period</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-semibold tabular-nums">{data.horCount}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Hazard Observations (HOR) in Period</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-semibold tabular-nums">{data.stopAuthorityCount}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Stop Work Authority Exercised</div>
          </CardContent>
        </Card>
      </div>

      <KpiTabs
        tabs={[
          {
            key: "consequences",
            label: "Potential Consequences",
            content: (
              <div>
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                  <ShieldAlert className="h-4 w-4 text-accent" /> Potential Consequences
                </div>
                <BarChart data={consequenceData} unit="reports" />
              </div>
            ),
          },
          {
            key: "location",
            label: "By Location",
            content: (
              <div>
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  <MapPin className="h-4 w-4 text-accent" /> By Location
                </div>
                <p className="mb-5 text-xs text-muted-foreground">Where reports occurred on board.</p>
                {locationData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No location data recorded for this period.</p>
                ) : (
                  <DonutChart title="Total Reports" data={locationData} size={240} thickness={44} sliceLabels />
                )}
              </div>
            ),
          },
          {
            key: "stop-authority",
            label: "Stop Work Authority",
            content: (
              <div>
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                  <HandMetal className="h-4 w-4 text-accent" /> Stop Work Authority — by Reporter
                </div>
                {data.reporterLeaderboard.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No Stop Work Authority exercises recorded for this period.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {data.reporterLeaderboard.map((r, i) => (
                      <li key={r.reporterName} className="flex items-center gap-3 rounded-md px-1.5 py-1.5">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {i === 0 ? <Trophy className="h-3.5 w-3.5 text-warning" /> : i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.reporterName}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {r.horCount} HOR{r.horCount === 1 ? "" : "s"}
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{r.stopAuthorityCount}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
