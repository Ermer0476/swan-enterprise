import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getVesselDocument, listVesselDocumentNamesByType } from "@/features/vessel-documents/queries";
import { getReferenceList } from "@/lib/reference-list";
import { listAttachments } from "@/features/attachments/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentForm } from "@/components/vessel-documents/document-form";
import { AttachmentList } from "@/components/attachments/attachment-list";

export default async function EditVesselDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("vesseldoc:update");
  const { id } = await params;
  const doc = await getVesselDocument(user.companyId, id);
  if (!doc) notFound();

  const [attachments, archivedAttachments, namesByType, vesselDocTypes] = await Promise.all([
    listAttachments(user.companyId, "VesselDocument", doc.id),
    listAttachments(user.companyId, "VesselDocumentArchive", doc.id),
    listVesselDocumentNamesByType(user.companyId),
    getReferenceList(user.companyId, "vessel-document-type"),
  ]);
  const editable = can(user, "vesseldoc:update");
  const backHref = doc.vesselId ? `/documents/vessel?vesselId=${doc.vesselId}` : "/documents/vessel";

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={backHref}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Vessel Documentation
      </Link>
      <PageHeader title="Edit Vessel Document" description={doc.name} />
      <DocumentForm
        origin="vessel"
        cancelHref={backHref}
        vesselDocTypes={vesselDocTypes}
        namesByType={namesByType}
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
