import Link from "next/link";
import { Plus, CalendarClock } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listCommitteeMeetings, listVesselOptions } from "@/features/committee-meetings/queries";
import { COMMITTEE_TYPE_LABELS } from "@/features/committee-meetings/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { Check } from "lucide-react";

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("meeting:read");
  const sp = await searchParams;
  const [rows, vessels] = await Promise.all([
    listCommitteeMeetings(user, {
      search: sp.q || undefined,
      vesselId: sp.vesselId || undefined,
    }),
    listVesselOptions(user.companyId),
  ]);
  const canCreate = can(user, "meeting:create");

  return (
    <>
      <PageHeader
        title="Committee Meetings"
        description="Safety, Maintenance, Health & Hygiene and Shipboard Management Team minutes per ADM-04."
        actions={
          canCreate ? (
            <Link href="/meetings/new">
              <Button><Plus className="h-4 w-4" /> Add Record</Button>
            </Link>
          ) : undefined
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Input name="q" placeholder="Search by ref or chairman…" defaultValue={sp.q ?? ""} />
        </div>
        <Select name="vesselId" defaultValue={sp.vesselId ?? ""} className="w-52">
          <option value="">All vessels / shore</option>
          {vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </Select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <CalendarClock className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No committee meetings found</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {canCreate ? "Record a committee meeting to keep minutes on file." : "No meetings match your filters."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Shore/Vessel</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Chairman</th>
                  <th className="px-4 py-2.5 font-medium">In-charge</th>
                  <th className="px-4 py-2.5 font-medium">Shore Remarks</th>
                  <th className="px-4 py-2.5 font-medium">Published</th>
                  <th className="px-4 py-2.5 font-medium">Approved</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 text-muted-foreground">
                      <Link href={`/meetings/${r.id}`} className="text-accent hover:underline">{formatDate(r.meetingDate)}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.vessel?.name ?? "Shore"}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {r.agendaItems.map((a) => (
                          <Badge key={a.committeeType} tone="accent">{COMMITTEE_TYPE_LABELS[a.committeeType]}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.chairman ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.inCharge ?? "—"}</td>
                    <td className="px-4 py-2.5 text-center">{r.shoreRemarks ? <Check className="mx-auto h-4 w-4 text-success" /> : null}</td>
                    <td className="px-4 py-2.5 text-center">{r.published ? <Check className="mx-auto h-4 w-4 text-success" /> : null}</td>
                    <td className="px-4 py-2.5 text-center">{r.approved ? <Check className="mx-auto h-4 w-4 text-success" /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
