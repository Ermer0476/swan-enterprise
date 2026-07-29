import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { NewDocumentForm } from "./new-document-form";

export default async function NewDocumentPage() {
  // Server-side gate — the UI link is also permission-gated, but never trust it.
  await requirePermission("sms:create");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="New SMS Document"
        description="Create a controlled document. It starts as a draft revision 1."
      />
      <NewDocumentForm />
    </div>
  );
}
