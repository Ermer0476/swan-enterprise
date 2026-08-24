import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import {
  getFamiliarizationSession,
  getFamiliarizationSessionTopics,
} from "@/features/familiarization/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { FamiliarizationActions } from "./familiarization-actions";

// One familiarization (CK-047(b)) session, shown as a read-only record in the
// same format as an Emergency Drill / LSA-FFE record — meta grid + section
// cards. Only the "Kind" differs, plus a "Topics Covered" section.
export default async function FamiliarizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("drill:read");
  const { id } = await params;
  const session = await getFamiliarizationSession(user.companyId, id);
  if (!session) notFound();

  const topics = await getFamiliarizationSessionTopics(user.companyId, session.id);
  const canDelete = can(user, "drill:delete");

  const meta = [
    { label: "Kind of Drill / Training", value: "Familiarization" },
    { label: "SMS Reference", value: "CK-047(b)" },
    { label: "Vessel", value: session.vessel.name },
    { label: "Date", value: formatDate(session.sessionDate) },
    { label: "Noted by", value: session.notedBy ?? "—" },
    { label: "Topics covered", value: String(topics.length) },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/drills/familiarization"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Familiarization
      </Link>

      <PageHeader
        title={session.refNo}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/drills/familiarization/${session.id}/report`} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="outline" size="sm">
                <FileText className="h-4 w-4" /> Show Report
              </Button>
            </Link>
            <Badge tone="success">Logged</Badge>
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
        <CardHeader><CardTitle>Details / Remarks</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{session.remarks || "—"}</p></CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Topics Covered</CardTitle></CardHeader>
        <CardContent>
          {topics.length === 0 ? (
            <p className="text-sm text-muted-foreground">No topics recorded.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <tbody>
                {topics.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    {t.itemNo && <td className="w-12 py-1.5 pr-2 align-top text-muted-foreground">{t.itemNo}</td>}
                    <td className="py-1.5 pr-3">{t.name}</td>
                    <td className="w-32 py-1.5 text-right text-muted-foreground">{formatDate(t.completedDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {canDelete && (
        <div className="print:hidden">
          <FamiliarizationActions sessionId={session.id} />
        </div>
      )}
    </div>
  );
}
