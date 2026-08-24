import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import {
  listVesselDocuments,
  listCompanyDocumentTypes,
  getExpiryWarningMonths,
  computeWarningStatus,
} from "@/features/vessel-documents/queries";
import { listAttachmentsForEntities } from "@/features/attachments/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/ui/print-button";
import { ExpiryWarningEditor } from "@/components/vessel-documents/expiry-warning-editor";
import { DocumentRegister, type DocumentRow } from "@/components/vessel-documents/document-register";

export default async function CompanyDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("vesseldoc:read");
  const sp = await searchParams;

  const [docs, types, warningMonths] = await Promise.all([
    listVesselDocuments(user.companyId, { origin: "COMPANY", type: sp.type }),
    listCompanyDocumentTypes(user.companyId),
    getExpiryWarningMonths(user.companyId),
  ]);

  const docIds = docs.map((d) => d.id);
  const [attachments, archivedAttachments] = await Promise.all([
    listAttachmentsForEntities(user.companyId, "VesselDocument", docIds),
    listAttachmentsForEntities(user.companyId, "VesselDocumentArchive", docIds),
  ]);

  const rows: DocumentRow[] = docs.map((d) => ({
    id: d.id,
    type: d.type,
    refNo: d.refNo,
    name: d.name,
    issuingBody: d.issuingBody,
    certNo: d.certNo,
    issuedDate: d.issuedDate,
    expiredDate: d.expiredDate,
    active: d.active,
    vesselId: d.vesselId,
    warningStatus: computeWarningStatus(d.expiredDate, warningMonths, d.active),
  }));

  const expiringCount = rows.filter((r) => r.warningStatus === "warning").length;
  const expiredCount = rows.filter((r) => r.warningStatus === "expired").length;

  const canCreate = can(user, "vesseldoc:create");
  const canEdit = can(user, "vesseldoc:update");
  const canDelete = can(user, "vesseldoc:delete");
  const canEditWarning = can(user, "schedule:manage");

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Company Documents"
        description={
          <span>
            Expiring documents is set to <ExpiryWarningEditor months={warningMonths} canEdit={canEditWarning} />.
          </span>
        }
        actions={
          canCreate ? (
            <Link href="/documents/company/new">
              <Button><Plus className="h-4 w-4" /> Add Document</Button>
            </Link>
          ) : undefined
        }
      />

      <Card className="p-4">
        <form className="mb-4 flex flex-wrap items-end gap-2">
          <Select name="type" defaultValue={sp.type ?? ""} className="w-64">
            <option value="">Show all certificates</option>
            {types.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
          <Button type="submit" variant="outline">Filter</Button>
          <span className="ml-2 inline-flex items-center gap-1.5 text-xs">
            <span className="rounded-full bg-warning/10 px-2 py-1 font-semibold text-warning">Expiring: {expiringCount}</span>
            <span className="rounded-full bg-danger/10 px-2 py-1 font-semibold text-danger">Expired: {expiredCount}</span>
          </span>
          <PrintButton />
          <span className="ml-auto text-xs text-muted-foreground">
            <span className="mr-1 font-semibold">Legend:</span>
            <span className="text-success">●</span> Active&nbsp;&nbsp;
            <span className="text-danger">●</span> Inactive
          </span>
        </form>

        <DocumentRegister
          rows={rows}
          attachments={attachments}
          archivedAttachments={archivedAttachments}
          canEdit={canEdit}
          canDelete={canDelete}
          editBasePath="/documents/company"
        />
      </Card>
    </div>
  );
}
