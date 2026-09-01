import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { listCompanyDocumentTypes } from "@/features/vessel-documents/queries";
import { PageHeader } from "@/components/ui/page-header";
import { DocumentForm } from "@/components/vessel-documents/document-form";

export default async function NewCompanyDocumentPage() {
  const user = await requirePermission("vesseldoc:create");
  const types = await listCompanyDocumentTypes(user.companyId);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/documents/company"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Company Documents
      </Link>
      <PageHeader title="Add Company Document" description="Add a company-level certificate or document — not tied to a specific vessel." />
      <DocumentForm origin="company" companyDocTypes={types} cancelHref="/documents/company" />
    </div>
  );
}
