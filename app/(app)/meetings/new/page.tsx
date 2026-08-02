import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/committee-meetings/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewMeetingForm } from "./new-meeting-form";

export default async function NewMeetingPage() {
  const user = await requirePermission("meeting:create");
  const vessels = await listVesselOptions(user.companyId);
  const isShipboard = user.department === "SHIPBOARD";
  const ownVesselName = vessels.find((v) => v.id === user.vesselId)?.name ?? null;
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Record Committee Meeting"
        description="Pick which committee(s) met, then fill in the agenda per ADM-04 / RC-013."
      />
      <NewMeetingForm
        vessels={vessels}
        isShipboard={isShipboard}
        ownVesselId={user.vesselId}
        ownVesselName={ownVesselName}
      />
    </div>
  );
}
