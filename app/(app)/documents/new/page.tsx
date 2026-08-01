import { requirePermission } from "@/lib/rbac";
import { listVesselOptions } from "@/features/documents/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewDocumentForm } from "./new-document-form";

export default async function NewDocumentPage() {
  const user = await requirePermission("doc:create");
  const vessels = await listVesselOptions(user.companyId);
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Add Document"
        description="Register a controlled form, checklist, certificate, manual, or procedure."
      />
      <NewDocumentForm vessels={vessels} />
    </div>
  );
}
