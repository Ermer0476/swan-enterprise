import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/company-inspections/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewCompanyInspectionForm } from "./new-company-inspection-form";

export default async function NewCompanyInspectionPage() {
  const user = await requirePermission("cinsp:create");
  const vessels = await listVesselOptions(user.companyId);
  const isShipboard = user.department === "SHIPBOARD";
  const ownVesselName = vessels.find((v) => v.id === user.vesselId)?.name ?? null;
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="New Company Inspection"
        description="Create the inspection header, then record observations on the detail page."
      />
      <NewCompanyInspectionForm
        vessels={vessels}
        isShipboard={isShipboard}
        ownVesselId={user.vesselId}
        ownVesselName={ownVesselName}
      />
    </div>
  );
}
