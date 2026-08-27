import Link from "next/link";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { getOperationalWindows } from "@/features/operational-windows/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { WindowsForm } from "./windows-form";

export default async function OperationalWindowsSettingsPage() {
  const user = await requirePermission("settings:manage-windows");
  const windows = await getOperationalWindows(user.companyId);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      <PageHeader
        title="Operational Windows"
        description="Timing windows (in days) behind the overdue and due-soon flags on the Incidents, SIRE and Internal Audit dashboards."
      />

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="h-4 w-4 text-accent" /> Timing Windows
        </div>
        <WindowsForm
          incidentOverdueDays={windows.incidentOverdueDays}
          sireDueSoonDays={windows.sireDueSoonDays}
          internalAuditDueSoonDays={windows.internalAuditDueSoonDays}
        />
      </Card>
    </div>
  );
}
