import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getDefect } from "@/features/defects/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize, severityTone } from "@/lib/utils";
import { defectStatusTone } from "@/features/defects/ui";
import { listAttachments } from "@/features/attachments/queries";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { DefectStatusForm } from "./defect-status-form";
import { DefectRemarksForm } from "./defect-remarks-form";

export default async function DefectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("defect:read");
  const { id } = await params;
  const isShipboard = user.department === "SHIPBOARD";
  const defect = await getDefect(user.companyId, id, isShipboard, user.vesselId);
  if (!defect) notFound();

  const editable = can(user, "defect:update");
  // Vessel remarks are the ship's own status update; Office remarks are the
  // office's reply — each side only ever writes its own box, never the
  // other's, same split as RA execution's controlText (vessel) vs
  // officeWording (office).
  const canEditVesselRemarks = editable && isShipboard;
  const canEditOfficeRemarks = editable && !isShipboard;
  const canDelete = can(user, "defect:delete");
  const attachments = await listAttachments(user.companyId, "Defect", defect.id);

  const meta = [
    { label: "Vessel", value: defect.vessel?.name ?? "—" },
    { label: "Raised", value: formatDate(defect.dateRaised) },
    { label: "Target", value: formatDate(defect.targetRectificationDate) },
    { label: "Rectified", value: defect.rectifiedAt ? formatDate(defect.rectifiedAt) : "—" },
    { label: "Raised by", value: defect.raisedBy ?? "—" },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/defects" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Defect List
      </Link>

      <PageHeader
        title={`${defect.refNo} — ${defect.equipment}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={severityTone(defect.severity)}>{humanize(defect.severity)}</Badge>
            <Badge tone={defectStatusTone(defect.status)}>{humanize(defect.status)}</Badge>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {meta.map((m) => (
          <div key={m.label}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</div>
            <div className="mt-0.5 text-sm font-medium">{m.value}</div>
          </div>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Description</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{defect.description}</p></CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Status &amp; rectification</CardTitle></CardHeader>
        <CardContent>
          <DefectStatusForm
            defectId={defect.id}
            status={defect.status}
            actionTaken={defect.actionTaken ?? ""}
            targetRectificationDate={defect.targetRectificationDate ? defect.targetRectificationDate.toISOString().slice(0, 10) : ""}
            rectifiedAt={defect.rectifiedAt ? defect.rectifiedAt.toISOString() : null}
            editable={editable}
            canDelete={canDelete}
          />
        </CardContent>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Vessel remarks</CardTitle></CardHeader>
          <CardContent>
            <DefectRemarksForm
              defectId={defect.id}
              kind="vessel"
              value={defect.vesselRemarks ?? ""}
              editable={canEditVesselRemarks}
              placeholder="Ship's status update / remarks on this defect…"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Office remarks</CardTitle></CardHeader>
          <CardContent>
            <DefectRemarksForm
              defectId={defect.id}
              kind="office"
              value={defect.officeRemarks ?? ""}
              editable={canEditOfficeRemarks}
              placeholder="Office reply / guidance to the ship…"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Attachments</CardTitle></CardHeader>
        <CardContent>
          <AttachmentList
            entityType="Defect"
            entityId={defect.id}
            editable={editable}
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
    </div>
  );
}
