import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import {
  getIncidentKpis,
  getIncidentRootCauseTrends,
  getIncidentTypeTrends,
} from "@/features/incidents/queries";
import { getKpiPeriod, quarterEndDate, clampToToday, startOfToday } from "@/lib/kpi-period";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { KpiTabs } from "@/components/ui/kpi-tabs";
import { IncidentKpiStrip } from "../incident-kpis";
import { RootCauseTrends } from "../root-cause-trends";
import { IncidentTypeTrends } from "../incident-type-trends";
import { ReportingPeriodSelect } from "@/components/kpi/reporting-period-select";

export default async function IncidentKpiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("incident:create");
  const sp = await searchParams;
  const isShipboard = user.department === "SHIPBOARD";
  const vesselId = isShipboard ? (user.vesselId ?? undefined) : undefined;

  const year = sp.year ? Number(sp.year) : undefined;
  const quarter = sp.quarter ? (Number(sp.quarter) as 1 | 2 | 3 | 4) : undefined;
  const reportingDate =
    year && quarter && quarter >= 1 && quarter <= 4 ? clampToToday(quarterEndDate(year, quarter)) : undefined;

  const currentPeriod = getKpiPeriod({
    measurementPeriod: "ROLLING_12",
    reportingDate: reportingDate ?? startOfToday(),
  });
  const periodRange = { from: currentPeriod.periodStart, to: currentPeriod.periodEnd };

  const [kpis, rootCauseTrends, typeTrends] = await Promise.all([
    getIncidentKpis(user.companyId, reportingDate, vesselId),
    getIncidentRootCauseTrends(user.companyId, periodRange, vesselId),
    getIncidentTypeTrends(user.companyId, periodRange, vesselId),
  ]);

  return (
    <>
      <Link href="/incidents" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Incident Management
      </Link>
      <PageHeader
        title="Incident KPIs"
        description={`Review: Quarterly · Measurement: Rolling 12 Months · Reporting Period: ${currentPeriod.periodLabel} — TMSA Element 6 evidence.`}
      />

      <Card className="mb-4 p-5">
        <ReportingPeriodSelect defaultYear={sp.year} defaultQuarter={sp.quarter} />
      </Card>

      <IncidentKpiStrip kpis={kpis} periodLabel={currentPeriod.periodLabel} />
      <KpiTabs
        tabs={[
          {
            key: "type",
            label: "By Incident Type",
            content: <IncidentTypeTrends rows={typeTrends} />,
          },
          {
            key: "root-cause",
            label: "By Root Cause",
            content: <RootCauseTrends rows={rootCauseTrends} totalIncidents={kpis.totalYtd} />,
          },
        ]}
      />
    </>
  );
}
