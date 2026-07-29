import { requirePermission } from "@/lib/rbac";
import { createVesselAction } from "@/features/vessels/actions";
import { PageHeader } from "@/components/ui/page-header";
import { VesselForm } from "@/components/vessels/vessel-form";

export default async function NewVesselPage() {
  await requirePermission("vessel:create");
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Add Vessel"
        description="Enter the vessel's particulars once — every safety module reuses it from here."
      />
      <VesselForm action={createVesselAction} submitLabel="Add vessel" pendingLabel="Adding…" />
    </div>
  );
}
