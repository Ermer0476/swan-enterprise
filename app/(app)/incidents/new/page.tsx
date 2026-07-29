import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/incidents/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewIncidentForm } from "./new-incident-form";

export default async function NewIncidentPage() {
  const user = await requirePermission("incident:create");
  const vessels = await listVesselOptions(user.companyId);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Report Incident"
        description="Capture what happened and its consequences. Root cause is established later, during investigation."
      />
      <NewIncidentForm vessels={vessels} />
    </div>
  );
}
