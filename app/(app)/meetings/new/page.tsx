import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/safety-meetings/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewMeetingForm } from "./new-meeting-form";

export default async function NewMeetingPage() {
  const user = await requirePermission("meeting:create");
  const vessels = await listVesselOptions(user.companyId);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Record Safety Meeting"
        description="Log the minutes of a safety committee, office safety, or management review meeting."
      />
      <NewMeetingForm vessels={vessels} />
    </div>
  );
}
