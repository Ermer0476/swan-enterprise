import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/drills/queries";
import { listScheduleItems } from "@/features/schedule/queries";
import { PageHeader } from "@/components/ui/page-header";
import { LogFamiliarizationForm } from "./log-familiarization-form";

export default async function LogFamiliarizationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("drill:create");
  const sp = await searchParams;

  const vessels = await listVesselOptions(user.companyId);
  const isShipboard = user.department === "SHIPBOARD";
  const vesselId = isShipboard ? user.vesselId : (sp.vesselId ?? null);
  const vessel = vessels.find((v) => v.id === vesselId);
  if (!vessel) notFound();

  const scheduleItems = await listScheduleItems(user.companyId, "FAMILIARIZATION");

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={`/drills/matrix?vesselId=${vessel.id}&tab=familiarization`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Drill & Familiarization Matrix
      </Link>
      <PageHeader
        title="Log Familiarization"
        description={`${vessel.name} — mirrors SMS CK-047(b). Check every topic actually covered this session.`}
      />
      <LogFamiliarizationForm vesselId={vessel.id} scheduleItems={scheduleItems} />
    </div>
  );
}
