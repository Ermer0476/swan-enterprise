import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import {
  getCrewFamiliarization,
  getFamiliarizationSessionItems,
} from "@/features/crew-familiarization/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { CrewFamiliarizationActions } from "./crew-familiarization-actions";

// One familiarization session, shown as a read-only record in the same format
// as an Emergency Drill record — meta grid + section cards. Only the "Kind"
// differs, plus the LSA/FFE "Items Covered" section for the audit trail.
export default async function CrewFamiliarizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("drill:read");
  const { id } = await params;
  const cf = await getCrewFamiliarization(user.companyId, id);
  if (!cf) notFound();

  const items = await getFamiliarizationSessionItems(user.companyId, cf.id);
  const canDelete = can(user, "drill:delete");

  const meta = [
    { label: "Kind of Drill / Training", value: "LSA/FFE Familiarization" },
    { label: "SMS Reference", value: "CK-047(a) / TRN-10 4.3(5)" },
    { label: "Vessel", value: cf.vessel.name },
    { label: "Date", value: formatDate(cf.cycleStartDate) },
    { label: "Week", value: `WK${cf.week}` },
    { label: "Supervised by (Master)", value: cf.supervisedBy ?? "—" },
    { label: "Items covered", value: String(items.length) },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/drills/crew-familiarization"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        <ArrowLeft className="h-4 w-4" /> Back to LSA/FFE Familiarization
      </Link>

      <PageHeader
        title={cf.refNo}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/drills/crew-familiarization/${cf.id}/report`} target="_blank" rel="noopener noreferrer">
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
        <CardHeader><CardTitle>Ranks of Crew Participated / Attendees</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{cf.attendees || "—"}</p></CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Details of Familiarization</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{cf.details || "—"}</p></CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Items Covered — WK{cf.week}</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items recorded.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b border-border last:border-0">
                    <td className="w-8 py-1.5 pr-2 align-top text-muted-foreground">{i.itemNo}.</td>
                    <td className="py-1.5 pr-3">
                      {i.name} <span className="text-xs text-muted-foreground">({i.category})</span>
                    </td>
                    <td className="w-32 py-1.5 text-right text-muted-foreground">{formatDate(i.completedDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {canDelete && (
        <div className="print:hidden">
          <CrewFamiliarizationActions crewFamiliarizationId={cf.id} />
        </div>
      )}
    </div>
  );
}
