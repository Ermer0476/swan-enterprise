import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getCircular } from "@/features/circulars/queries";
import { CIRCULAR_SOURCE_LABELS } from "@/features/circulars/schema";
import { listAttachments } from "@/features/attachments/queries";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/utils";
import { CircularActions } from "./circular-actions";
import { AcknowledgePanel } from "./acknowledge-panel";

export default async function CircularDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("circular:read");
  const { id } = await params;
  // SHIPBOARD may open a fleet-wide circular or one targeted at their own
  // vessel — not another vessel's. OFFICE is unrestricted.
  const isShipboard = user.department === "SHIPBOARD";
  const circular = await getCircular(user.companyId, id, isShipboard ? user.vesselId : undefined);
  if (!circular) notFound();

  const canDelete = can(user, "circular:delete");
  const editable = can(user, "circular:update");
  const attachments = await listAttachments(user.companyId, "Circular", circular.id);

  // My own recipient row — a shipboard user acknowledges on behalf of their
  // vessel; an office user acknowledges their own named row (see
  // acknowledgeCircularAction for the write side of this same match).
  const myRecipientType = user.department === "SHIPBOARD" ? "VESSEL" : "USER";
  const myRecipientId = user.department === "SHIPBOARD" ? (user.vesselId ?? "") : user.id;
  const myRow = circular.acknowledgements.find(
    (a) => a.recipientType === myRecipientType && a.recipientId === myRecipientId,
  );

  const meta = [
    { label: "Source", value: CIRCULAR_SOURCE_LABELS[circular.source] },
    { label: "Issuing body", value: circular.issuingBody ?? "—" },
    { label: "Category", value: humanize(circular.category) },
    { label: "Distribution", value: circular.vessel?.name ?? "Fleet-wide" },
    { label: "Date issued", value: formatDate(circular.issueDate) },
    { label: "Date received", value: circular.dateReceived ? formatDate(circular.dateReceived) : "—" },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/circulars" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Circulars
      </Link>

      <PageHeader
        title={`${circular.refNo} — ${circular.title}`}
        actions={<Badge tone="accent">{humanize(circular.category)}</Badge>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {meta.map((m) => (
          <div key={m.label}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</div>
            <div className="mt-0.5 text-sm font-medium">{m.value}</div>
          </div>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Content</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{circular.body}</p></CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Attachments</CardTitle></CardHeader>
        <CardContent>
          <AttachmentList
            entityType="Circular"
            entityId={circular.id}
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

      <Card className="mb-6">
        <CardHeader><CardTitle>Distribution &amp; Acknowledgement</CardTitle></CardHeader>
        <CardContent>
          <AcknowledgePanel
            circularId={circular.id}
            myRowId={myRow?.id ?? null}
            rows={circular.acknowledgements.map((a) => ({
              id: a.id,
              recipientLabel: a.recipientLabel,
              acknowledgedAt: a.acknowledgedAt ? a.acknowledgedAt.toISOString() : null,
              acknowledgedByName: a.acknowledgedByName,
            }))}
          />
        </CardContent>
      </Card>

      <CircularActions circularId={circular.id} canDelete={canDelete} />
    </div>
  );
}
