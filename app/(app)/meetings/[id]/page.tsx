import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getCommitteeMeeting } from "@/features/committee-meetings/queries";
import { meetingStatusLabel, meetingStatusTone } from "@/features/committee-meetings/schema";
import { listAttachments } from "@/features/attachments/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { MeetingEditForm } from "./meeting-edit-form";
import { ReportMeetingButton, RevertMeetingButton } from "./meeting-actions";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("meeting:read");
  const { id } = await params;
  const meeting = await getCommitteeMeeting(user, id);
  if (!meeting) notFound();

  const isShipboard = user.department === "SHIPBOARD";
  const canDelete = can(user, "meeting:delete");

  // A DRAFT is only ever visible to its own vessel or to the office user who
  // created it (see queries.ts) — so reaching this page while it's still
  // DRAFT already means "mine to act on."
  const isOwnMeeting = isShipboard || meeting.createdBy === user.id;
  const shipEditable = isOwnMeeting && meeting.status === "DRAFT";
  const canReport = isOwnMeeting && meeting.status === "DRAFT";
  const canRevert = isOwnMeeting && (meeting.status === "REPORTED" || meeting.status === "CLOSED");
  const officeEditable = !isShipboard && meeting.status === "REPORTED" && can(user, "meeting:update");
  const canClose = !isShipboard && meeting.status === "REPORTED" && can(user, "meeting:close");
  const attachments = await listAttachments(user.companyId, "CommitteeMeeting", meeting.id);

  const meta = [
    { label: "Vessel", value: meeting.vessel?.name ?? "Shore" },
    { label: "Position", value: meeting.position ?? "—" },
    { label: "Date", value: formatDate(meeting.meetingDate) },
    { label: "Time", value: meeting.meetingTime ?? "—" },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/meetings" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Committee Meetings
      </Link>

      <PageHeader
        title={meeting.refNo ?? "Draft"}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={meetingStatusTone(meeting.status)}>{meetingStatusLabel(meeting.status)}</Badge>
            {meeting.revisedAfterReview && meeting.status === "REPORTED" && (
              <Badge tone="warning">Revised by vessel</Badge>
            )}
            {canRevert && <RevertMeetingButton meetingId={meeting.id} />}
            {canReport && <ReportMeetingButton meetingId={meeting.id} />}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {meta.map((m) => (
          <div key={m.label}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</div>
            <div className="mt-0.5 text-sm font-medium">{m.value}</div>
          </div>
        ))}
      </div>

      <MeetingEditForm
        meeting={{
          id: meeting.id,
          position: meeting.position,
          meetingDate: meeting.meetingDate.toISOString().slice(0, 10),
          meetingTime: meeting.meetingTime,
          chairman: meeting.chairman,
          inCharge: meeting.inCharge,
          members: meeting.members,
          inAttendance: meeting.inAttendance,
          forAcknowledgement: meeting.forAcknowledgement,
        }}
        typeRemarks={meeting.typeRemarks.map((r) => ({
          committeeType: r.committeeType,
          shoreRemarks: r.shoreRemarks,
          updatedByUser: r.updatedByUser,
          updatedAt: r.updatedAt.toISOString(),
        }))}
        agendaItems={meeting.agendaItems.map((a) => ({
          id: a.id,
          seq: a.seq,
          committeeType: a.committeeType,
          code: a.code,
          label: a.label,
          details: a.details,
        }))}
        shipEditable={shipEditable}
        officeEditable={officeEditable}
        canClose={canClose}
        canDelete={canDelete}
        attachments={attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          createdAt: a.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
