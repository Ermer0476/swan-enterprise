import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getVesselDocument, listCompanyDocumentTypes } from "@/features/vessel-documents/queries";
import { listAttachments } from "@/features/attachments/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentForm } from "@/components/vessel-documents/document-form";
import { AttachmentList } from "@/components/attachments/attachment-list";

export default async function EditCompanyDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("vesseldoc:update");
  const { id } = await params;
  const doc = await getVesselDocument(user.companyId, id);
  if (!doc) notFound();

  const [attachments, archivedAttachments, types] = await Promise.all([
    listAttachments(user.companyId, "VesselDocument", doc.id),
    listAttachments(user.companyId, "VesselDocumentArchive", doc.id),
    listCompanyDocumentTypes(user.companyId),
  ]);
  const editable = can(user, "vesseldoc:update");

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/documents/company"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Company Documents
      </Link>
      <PageHeader title="Edit Company Document" description={doc.name} />
      <DocumentForm
        origin="company"
        companyDocTypes={types}
        cancelHref="/documents/company"
        initial={{
          id: doc.id,
          vesselId: doc.vesselId,
          vesselName: doc.vessel?.name,
          type: doc.type,
          refNo: doc.refNo,
          name: doc.name,
          issuingBody: doc.issuingBody,
          certNo: doc.certNo,
          interval: doc.interval,
          issuedDate: doc.issuedDate,
          expiredDate: doc.expiredDate,
          remarks: doc.remarks,
        }}
      />

      <Card className="mt-4">
        <CardHeader><CardTitle>Attachment</CardTitle></CardHeader>
        <CardContent>
          <AttachmentList
            entityType="VesselDocument"
            entityId={doc.id}
            editable={editable}
            accept=".pdf"
            attachments={attachments.map((a) => ({
              id: a.id,
              fileName: a.fileName,
              mimeType: a.mimeType,
              sizeBytes: a.sizeBytes,
              createdAt: a.createdAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle>Archived (superseded version)</CardTitle></CardHeader>
        <CardContent>
          <AttachmentList
            entityType="VesselDocumentArchive"
            entityId={doc.id}
            editable={editable}
            accept=".pdf"
            attachments={archivedAttachments.map((a) => ({
              id: a.id,
              fileName: a.fileName,
              mimeType: a.mimeType,
              sizeBytes: a.sizeBytes,
              createdAt: a.createdAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
