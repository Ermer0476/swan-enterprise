import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getCommitteeMeeting } from "@/features/committee-meetings/queries";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils";
import { MeetingEditForm } from "./meeting-edit-form";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("meeting:read");
  const { id } = await params;
  const meeting = await getCommitteeMeeting(user, id);
  if (!meeting) notFound();

  const canUpdate = can(user, "meeting:update");
  const canDelete = can(user, "meeting:delete");
  const canApprove = user.department === "SHIPBOARD";

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

      <PageHeader title={meeting.refNo} />

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
          vesselId: meeting.vesselId,
          position: meeting.position,
          meetingDate: meeting.meetingDate.toISOString().slice(0, 10),
          meetingTime: meeting.meetingTime,
          chairman: meeting.chairman,
          inCharge: meeting.inCharge,
          members: meeting.members,
          inAttendance: meeting.inAttendance,
          forAcknowledgement: meeting.forAcknowledgement,
          vesselRemarks: meeting.vesselRemarks,
          shoreRemarks: meeting.shoreRemarks,
          published: meeting.published,
          approved: meeting.approved,
        }}
        agendaItems={meeting.agendaItems.map((a) => ({
          id: a.id,
          seq: a.seq,
          committeeType: a.committeeType,
          code: a.code,
          label: a.label,
          details: a.details,
          shoreComments: a.shoreComments,
        }))}
        editable={canUpdate}
        canDelete={canDelete}
        canApprove={canApprove}
      />
    </div>
  );
}
