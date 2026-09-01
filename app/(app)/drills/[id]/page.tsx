import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getDrill, listVesselOptions } from "@/features/drills/queries";
import { resolveEffectiveScheduleItems } from "@/features/schedule/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, humanize } from "@/lib/utils";
import { lifecycleStatusTone } from "@/lib/status";
import { listAttachments } from "@/features/attachments/queries";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { DrillActions } from "./drill-actions";
import { DeleteDraftDrillButton, ReportDraftDrillButton } from "./draft-actions";
import { EditDraftDrillForm } from "./edit-draft-form";

export default async function DrillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("drill:read");
  const { id } = await params;
  const isShipboard = user.department === "SHIPBOARD";
  const drill = await getDrill(user.companyId, id, isShipboard, user.id, user.vesselId);
  if (!drill) notFound();

  const isOwnDraft =
    drill.status === "DRAFT" && can(user, "drill:create") && (isShipboard || drill.createdBy === user.id);

  if (drill.status === "DRAFT") {
    const [vessels, scheduleItems] = await Promise.all([
      listVesselOptions(user.companyId),
      resolveEffectiveScheduleItems(user.companyId, "DRILL", drill.vessel?.flag ?? null),
    ]);
    const ownVesselName = vessels.find((v) => v.id === user.vesselId)?.name ?? null;
    return (
      <div className="mx-auto max-w-7xl">
        <Link href="/drills" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Emergency Drills
        </Link>
        <PageHeader
          title="Draft drill record"
          actions={
            <div className="flex items-center gap-2">
              <Badge tone={lifecycleStatusTone(drill.status)}>{humanize(drill.status)}</Badge>
              {isOwnDraft && <DeleteDraftDrillButton drillId={drill.id} />}
              {isOwnDraft && <ReportDraftDrillButton drillId={drill.id} />}
            </div>
          }
        />
        {isOwnDraft ? (
          <EditDraftDrillForm
            drill={{
              id: drill.id,
              vesselId: drill.vesselId,
              scheduleItemId: drill.scheduleItemId,
              drillDate: drill.drillDate.toISOString().slice(0, 10),
              drillTime: drill.drillTime ?? "",
              position: drill.position ?? "",
              participants: drill.participants ?? "",
              conductedBy: drill.conductedBy ?? "",
              details: drill.details ?? "",
              deficiencies: drill.deficiencies ?? "",
              correctiveAction: drill.correctiveAction ?? "",
              vesselRemarks: drill.vesselRemarks ?? "",
            }}
            vessels={vessels}
            scheduleItems={scheduleItems}
            isShipboard={isShipboard}
            ownVesselId={user.vesselId}
            ownVesselName={ownVesselName}
          />
        ) : (
          <p className="text-sm text-muted-foreground">You don&apos;t have access to edit this draft.</p>
        )}
      </div>
    );
  }

  const editable = can(user, "drill:update") && drill.status !== "CLOSED";
  const canClose = can(user, "drill:close");
  const canDelete = can(user, "drill:delete");
  const attachments = await listAttachments(user.companyId, "EmergencyDrill", drill.id);

  const meta = [
    {
      label: "Kind of Drill / Training",
      value: drill.scheduleItem
        ? `${drill.scheduleItem.itemNo ? `${drill.scheduleItem.itemNo} — ` : ""}${drill.scheduleItem.name}`
        : "—",
    },
    { label: "SMS reference", value: drill.scheduleItem?.smsReference ?? "—" },
    { label: "Vessel", value: drill.vessel?.name ?? "—" },
    { label: "Date", value: formatDate(drill.drillDate) },
    { label: "Time", value: drill.drillTime ?? "—" },
    { label: "Position", value: drill.position ?? "—" },
    { label: "Master's Name", value: drill.conductedBy ?? "—" },
    { label: "Closed", value: drill.closedAt ? formatDate(drill.closedAt) : "—" },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/drills" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Emergency Drills
      </Link>

      <PageHeader
        title={drill.refNo ?? ""}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={lifecycleStatusTone(drill.status)}>{humanize(drill.status)}</Badge>
            <Link href={`/drills/${drill.id}/report`} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="outline" size="sm">
                <FileText className="h-4 w-4" /> Show Report
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {meta.map((m) => (
          <div key={m.label}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</div>
            <div className="mt-0.5 text-sm font-medium">{m.value}</div>
          </div>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Ranks of Crew Participated</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{drill.participants || "—"}</p></CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Details of Drill / Training</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{drill.details || "—"}</p></CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Found Deficiencies</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{drill.deficiencies || "No deficiencies were noted."}</p></CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Master's Opinion for Improvement and Corrective Action</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{drill.correctiveAction || "—"}</p></CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Vessel Remarks</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{drill.vesselRemarks || "—"}</p></CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Attachments</CardTitle></CardHeader>
        <CardContent>
          <AttachmentList
            entityType="EmergencyDrill"
            entityId={drill.id}
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

      <Card>
        <CardHeader><CardTitle>Drill status</CardTitle></CardHeader>
        <CardContent>
          <DrillActions drillId={drill.id} isOpen={drill.status !== "CLOSED"} canClose={canClose} canDelete={canDelete} />
        </CardContent>
      </Card>
    </div>
  );
}
