import { requirePermission } from "@/lib/rbac";
import { listScheduleItems, listFlagsWithScheduleItems } from "@/features/schedule/queries";
import { VESSEL_FLAGS } from "@/lib/vessel-flags";
import { PageHeader } from "@/components/ui/page-header";
import { FlagScheduleManager } from "./flag-schedule-manager";

export default async function FlagDrillSchedulesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("schedule:manage");
  const sp = await searchParams;
  const flag = sp.flag ?? "";

  const [drillItems, familiarizationItems, flagsWithItems] = await Promise.all([
    listScheduleItems(user.companyId, "DRILL", flag),
    listScheduleItems(user.companyId, "FAMILIARIZATION", flag),
    listFlagsWithScheduleItems(user.companyId),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Flag Drill Schedules"
        description="Every flag state has its own required drill/familiarization frequencies. Set up a flag's list here — vessels automatically use whichever flag's list matches their own."
      />
      <FlagScheduleManager
        flags={VESSEL_FLAGS as unknown as string[]}
        flagsWithItems={flagsWithItems}
        selectedFlag={flag}
        drillItems={drillItems}
        familiarizationItems={familiarizationItems}
      />
    </div>
  );
}
