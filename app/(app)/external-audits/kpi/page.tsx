import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { eauditAnalytics, resolveEauditKpiRange } from "@/features/external-audits/queries";
import {
  EAUDIT_KPI_PERIODS,
  EAUDIT_KPI_PERIOD_LABELS,
  DEFAULT_EAUDIT_KPI_PERIOD,
  type EauditKpiPeriodKey,
} from "@/features/external-audits/schema";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function isEauditKpiPeriodKey(v: string | undefined): v is EauditKpiPeriodKey {
  return !!v && (EAUDIT_KPI_PERIODS as readonly string[]).includes(v);
}

export default async function ExternalAuditKpiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("eaudit:read");
  const sp = await searchParams;

  const period = isEauditKpiPeriodKey(sp.period) ? sp.period : DEFAULT_EAUDIT_KPI_PERIOD;
  const range = resolveEauditKpiRange(period);
  const data = await eauditAnalytics(user.companyId, range);

  return (
    <>
      <Link
        href="/external-audits"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to External Audits
      </Link>
      <PageHeader
        title="External Audits KPIs"
        description="Third-party audit trends — finding rate across class, flag, and ISO audits."
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Period</label>
          <Select name="period" defaultValue={period} className="w-48">
            {EAUDIT_KPI_PERIODS.map((p) => (
              <option key={p} value={p}>
                {EAUDIT_KPI_PERIOD_LABELS[p]}
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
            <div className="mt-0.5 text-xs text-muted-foreground">Audits in Period</div>
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
            <div className="mt-0.5 text-xs text-muted-foreground">Average Observations / Audit</div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
