import Link from "next/link";
import { ArrowLeft, Target } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getSireKpiTargets } from "@/features/sire/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { SireTargetForm } from "./sire-target-form";

export default async function SireKpiSettingsPage() {
  const user = await requirePermission("sire:read");
  const canManage = can(user, "sire:manage-targets");
  const targets = await getSireKpiTargets(user.companyId);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/sire/kpi" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to SIRE KPI Dashboard
      </Link>
      <PageHeader
        title="SIRE KPI Target"
        description="Average Observations per Inspection target used on the KPI dashboard's gauge."
      />
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Target className="h-4 w-4 text-accent" /> Fleet Target
        </div>
        {canManage ? (
          <SireTargetForm avgObservationTarget={targets.avgObservationTarget} />
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
