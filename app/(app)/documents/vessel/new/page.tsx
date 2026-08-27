import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { listVesselOptions, listVesselDocumentNamesByType } from "@/features/vessel-documents/queries";
import { getReferenceList } from "@/lib/reference-list";
import { PageHeader } from "@/components/ui/page-header";
import { DocumentForm } from "@/components/vessel-documents/document-form";

export default async function NewVesselDocumentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("vesseldoc:create");
  const sp = await searchParams;
  const [vessels, namesByType, vesselDocTypes] = await Promise.all([
    listVesselOptions(user.companyId),
    listVesselDocumentNamesByType(user.companyId),
    getReferenceList(user.companyId, "vessel-document-type"),
  ]);
  const backHref = sp.vesselId ? `/documents/vessel?vesselId=${sp.vesselId}` : "/documents/vessel";

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={backHref}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Vessel Documentation
      </Link>
      <PageHeader title="Add Vessel Document" description="Add a certificate or document to a vessel's register." />
      <DocumentForm
        origin="vessel"
        vessels={vessels}
        vesselDocTypes={vesselDocTypes}
        namesByType={namesByType}
        initialVesselId={sp.vesselId}
        cancelHref={backHref}
      />
    </div>
  );
}
