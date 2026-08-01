import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/committee-meetings/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewMeetingForm } from "./new-meeting-form";

export default async function NewMeetingPage() {
  const user = await requirePermission("meeting:create");
  const vessels = await listVesselOptions(user.companyId);
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Record Committee Meeting"
        description="Pick which committee(s) met, then fill in the agenda per ADM-04 / RC-013."
      />
      <NewMeetingForm vessels={vessels} />
    </div>
  );
}
