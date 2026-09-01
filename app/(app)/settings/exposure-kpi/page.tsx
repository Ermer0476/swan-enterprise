import Link from "next/link";
import { ArrowLeft, Target } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getExposureKpiTargets } from "@/features/exposure-hours/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { KpiTargetsForm } from "./kpi-targets-form";

export default async function ExposureKpiSettingsPage() {
  const user = await requirePermission("exposure:read");
  const canManage = can(user, "exposure:manage-targets");
  const targets = await getExposureKpiTargets(user.companyId);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/exposure-hours/kpi"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to KPI Dashboard
      </Link>

      <PageHeader
        title="Exposure Hours KPI Targets"
        description="LTIF/TRCF targets used on the KPI dashboard's trend charts and gauges."
      />

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Target className="h-4 w-4 text-accent" /> Fleet Targets
        </div>
        {canManage ? (
          <KpiTargetsForm ltifTarget={targets.ltifTarget} trcfTarget={targets.trcfTarget} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">LTIF Target</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums">{targets.ltifTarget.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">TRCF Target</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums">{targets.trcfTarget.toFixed(2)}</div>
            </div>
            <p className="col-span-full text-sm text-muted-foreground">
              You don&apos;t have permission to change these targets. Contact an Administrator or QHSE Manager.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
