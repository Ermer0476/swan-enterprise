import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import {
  getCrewFamiliarization,
  getFamiliarizationSessionItems,
} from "@/features/crew-familiarization/queries";
import { PrintButton } from "@/components/ui/print-button";
import { formatDate } from "@/lib/utils";

// Print-optimized record of ONE familiarization session, laid out like the
// Emergency Drill record — same meta grid + section format, only the "Kind"
// differs, plus an Items-Covered section for the audit trail. The app shell
// hides itself in print.
export default async function FamiliarizationReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("drill:read");
  const { id } = await params;
  const cf = await getCrewFamiliarization(user.companyId, id);
  if (!cf) notFound();

  const items = await getFamiliarizationSessionItems(user.companyId, cf.id);

  const meta = [
    { label: "Kind of Drill / Training", value: "LSA/FFE Familiarization" },
    { label: "SMS Reference", value: "CK-047(a) / TRN-10 4.3(5)" },
    { label: "Vessel", value: cf.vessel.name },
    { label: "Reference", value: cf.refNo },
    { label: "Date", value: formatDate(cf.cycleStartDate) },
    { label: "Week", value: `WK${cf.week}` },
    { label: "Supervised by (Master)", value: cf.supervisedBy || "—" },
    { label: "Attendees", value: cf.attendees || "—" },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/drills/crew-familiarization/${cf.id}`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        <ArrowLeft className="h-4 w-4" /> Back to record
      </Link>

      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-lg font-semibold">Familiarization Report</h1>
        <PrintButton />
      </div>

      <div className="rounded-md border border-border bg-background p-6 print:border-0 print:p-0">
        <div className="mb-4 border-b border-border pb-3">
          <h2 className="text-base font-bold">Emergency Drill / Training Record</h2>
          <p className="text-xs text-muted-foreground">CK-047(a) — per SMS TRN-10 4.3(5)</p>
        </div>

        {/* Same meta grid as the Emergency Drill record. */}
        <div className="mb-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          {meta.map((m) => (
            <div key={m.label}>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.label}</div>
              <div className="mt-0.5 text-sm font-medium">{m.value}</div>
            </div>
          ))}
        </div>

        <section className="mb-5">
          <h3 className="mb-1 border-b border-border pb-1 text-sm font-semibold">Details of Familiarization</h3>
          <p className="whitespace-pre-wrap text-sm">{cf.details || "—"}</p>
        </section>

        <section>
          <h3 className="mb-1 border-b border-border pb-1 text-sm font-semibold">Items Covered — WK{cf.week}</h3>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items recorded.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b border-border last:border-0">
                    <td className="w-8 py-1 pr-2 align-top text-muted-foreground">{i.itemNo}.</td>
                    <td className="py-1 pr-3">
                      {i.name} <span className="text-xs text-muted-foreground">({i.category})</span>
                    </td>
                    <td className="w-32 py-1 text-right">{formatDate(i.completedDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
