import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getMeeting } from "@/features/safety-meetings/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/utils";
import { MeetingActions } from "./meeting-actions";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("meeting:read");
  const { id } = await params;
  const meeting = await getMeeting(user.companyId, id);
  if (!meeting) notFound();

  const canClose = can(user, "meeting:close");
  const canDelete = can(user, "meeting:delete");

  const meta = [
    { label: "Type", value: humanize(meeting.meetingType) },
    { label: "Vessel", value: meeting.vessel?.name ?? "Office / Shore" },
    { label: "Date", value: formatDate(meeting.meetingDate) },
    { label: "Chaired by", value: meeting.chairedBy ?? "—" },
    { label: "Closed", value: meeting.closedAt ? formatDate(meeting.closedAt) : "—" },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/meetings" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Safety Meetings
      </Link>

      <PageHeader
        title={meeting.refNo}
        actions={<Badge tone={meeting.status === "CLOSED" ? "success" : "warning"}>{humanize(meeting.status)}</Badge>}
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
        <CardHeader><CardTitle>Meeting status</CardTitle></CardHeader>
        <CardContent>
          <MeetingActions meetingId={meeting.id} isOpen={meeting.status !== "CLOSED"} canClose={canClose} canDelete={canDelete} />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Attendees</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{meeting.attendees || "—"}</p></CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Agenda / topics discussed</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{meeting.agenda || "—"}</p></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Minutes</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{meeting.minutes || "—"}</p></CardContent>
      </Card>
    </div>
  );
}
