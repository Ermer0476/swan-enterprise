import Link from "next/link";
import { ArrowLeft, Target } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getCinspKpiTargets } from "@/features/company-inspections/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { CinspTargetForm } from "./cinsp-target-form";

export default async function CinspKpiSettingsPage() {
  const user = await requirePermission("cinsp:read");
  const canManage = can(user, "cinsp:manage-targets");
  const targets = await getCinspKpiTargets(user.companyId);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/company-inspections/kpi" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Company Inspection KPI Dashboard
      </Link>
      <PageHeader
        title="Company Inspection KPI Target"
        description="Average Observations per Inspection target used on the KPI dashboard's gauge."
      />
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Target className="h-4 w-4 text-accent" /> Fleet Target
        </div>
        {canManage ? (
          <CinspTargetForm avgObservationTarget={targets.avgObservationTarget} />
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Average Observations Target</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums">
                {targets.avgObservationTarget.toFixed(2)}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              You don&apos;t have permission to change this target. Contact an Administrator or QHSE Manager.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
