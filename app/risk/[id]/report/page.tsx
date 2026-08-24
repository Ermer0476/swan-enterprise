import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { getRiskDocument, userNameMap, overallRiskBand } from "@/features/risk/queries";
import { computeRF, riskBand, APPROVAL_LEVEL_LABELS } from "@/features/risk/schema";
import { bandTone, riskDocStatusTone } from "@/features/risk/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/utils";
import { PrintButton } from "@/components/ui/print-button";

// Clean, fully read-only view of a Risk Assessment's in-force revision — for
// handing to terminals/third parties who ask to see the RA, and for the
// browser's print output when Print IS used. Lives outside the (app) route
// group on purpose: no Sidebar/Topbar, so there's nothing to hide either on
// screen or on paper.
export default async function RiskDocumentReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ executionId?: string }>;
}) {
  const user = await requirePermission("risk-doc:read");
  const { id } = await params;
  const { executionId } = await searchParams;
  const doc = await getRiskDocument(user.companyId, id);
  if (!doc) notFound();

  const names = await userNameMap(user.companyId);
  const displayed = doc.currentRevision ?? doc.revisions[0] ?? null;
  const band = displayed ? overallRiskBand(displayed.hazardRows) : null;

  // A report sent out for one specific job should show only that job — not
  // the whole execution history of every vessel that has ever used this RA
  // — so a call from a terminal about e.g. a bunkering job clearly shows
  // which job it's for, not a confusing list of unrelated ones.
  const execution = executionId ? doc.executions.find((e) => e.id === executionId) ?? null : null;

  const phases = new Map<string, NonNullable<typeof displayed>["hazardRows"]>();
  for (const row of displayed?.hazardRows ?? []) {
    const key = row.phase || "General";
    if (!phases.has(key)) phases.set(key, []);
    phases.get(key)!.push(row);
  }

  const meta = [
    { label: "Category", value: doc.category },
    { label: "Applicable vessel type", value: doc.applicableVesselType ?? "All types" },
    { label: "Owner", value: doc.ownerId ? names[doc.ownerId] ?? "—" : "—" },
    { label: "Review frequency", value: `${doc.reviewFrequencyMonths} months` },
    { label: "Last review", value: formatDate(doc.lastReviewDate) },
    { label: "Next review", value: formatDate(doc.nextReviewDate) },
    { label: "Revision", value: displayed ? `Rev ${displayed.revisionNo}` : "—" },
  ];

  const formMeta = [
    { label: "SMS Procedure", value: displayed?.smsProcedureRefs },
    { label: "Risk Matrix", value: displayed?.riskMatrixRef },
    { label: "Checklists Required", value: displayed?.checklistsRequired },
    {
      label: "Approval Level",
      value: displayed ? APPROVAL_LEVEL_LABELS[displayed.approvalLevel] : null,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6 print:max-w-none print:p-3">
      {/* The hazard table has 11 columns of substantial text (causes,
          controls) — portrait bond paper crops it. Landscape gives it the
          width to actually fit when printed or saved as PDF. */}
      <style>{`
        @media print {
          @page { size: landscape; }
        }
      `}</style>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/risk/${doc.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to record
        </Link>
        <PrintButton />
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{doc.refNo} — {doc.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {band && <Badge tone={bandTone(band)}>Overall: {humanize(band)}</Badge>}
          <Badge tone={riskDocStatusTone(doc.status)}>{humanize(doc.status)}</Badge>
        </div>
      </div>

      {doc.description && <p className="mb-6 text-sm text-muted-foreground">{doc.description}</p>}

      {execution && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Job Execution</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Vessel</div>
                <div className="mt-0.5 text-sm font-medium">{execution.vessel.name}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Date</div>
                <div className="mt-0.5 text-sm font-medium">{formatDate(execution.executedAt)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Performed by</div>
                <div className="mt-0.5 text-sm font-medium">
                  {execution.performedById ? names[execution.performedById] ?? "—" : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Conditions</div>
                <div className="mt-0.5">
                  <Badge tone={execution.conditionStatus === "CHANGED" ? "warning" : "success"}>
                    {humanize(execution.conditionStatus)}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="mb-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Job Description</div>
              <div className="mt-0.5 text-sm font-medium">{execution.jobName}</div>
            </div>
            {execution.changedConditionsNote && (
              <div className="mb-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Changed Conditions</div>
                <p className="mt-0.5 text-sm whitespace-pre-wrap">{execution.changedConditionsNote}</p>
              </div>
            )}
            {execution.temporaryHazards && (
              <div className="mb-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Temporary Hazards (this job only)</div>
                <p className="mt-0.5 text-sm whitespace-pre-wrap">{execution.temporaryHazards}</p>
              </div>
            )}
            {execution.temporaryControls && (
              <div className="mb-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Temporary Controls (this job only)</div>
                <p className="mt-0.5 text-sm whitespace-pre-wrap">{execution.temporaryControls}</p>
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Toolbox Meeting</div>
                <div className="mt-0.5 text-sm font-medium">
                  {execution.toolboxSignedAt ? `Signed ${formatDate(execution.toolboxSignedAt)}` : "—"}
                </div>
              </div>
              {execution.toolboxAttendees && (
                <div className="col-span-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Attendees</div>
                  <div className="mt-0.5 text-sm font-medium">{execution.toolboxAttendees}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {meta.map((m) => (
          <div key={m.label}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</div>
            <div className="mt-0.5 text-sm font-medium">{m.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {formMeta.map((m) => (
          <div key={m.label}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</div>
            <div className="mt-0.5 text-sm font-medium">{m.value || "—"}</div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{displayed ? `Hazard table · Rev ${displayed.revisionNo}` : "Hazard table"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!displayed || displayed.hazardRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hazard rows recorded.</p>
          ) : (
            Array.from(phases.entries()).map(([phase, rows]) => (
              <div key={phase}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {phase}
                </div>
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">#</th>
                        <th className="px-3 py-2 font-medium">Consequence</th>
                        <th className="px-3 py-2 font-medium">Causes</th>
                        <th className="px-3 py-2 font-medium">S</th>
                        <th className="px-3 py-2 font-medium">L</th>
                        <th className="px-3 py-2 font-medium">RF</th>
                        <th className="px-3 py-2 font-medium">Existing Controls</th>
                        <th className="px-3 py-2 font-medium">Additional Controls</th>
                        <th className="px-3 py-2 font-medium">Res. L</th>
                        <th className="px-3 py-2 font-medium">Res. RF</th>
                        <th className="px-3 py-2 font-medium">Responsible</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const rf = computeRF(r.severity, r.likelihood);
                        const rBand = riskBand(rf);
                        const resL = r.resLikelihood ?? r.likelihood;
                        const resRf = computeRF(r.severity, resL);
                        const resBand = riskBand(resRf);
                        return (
                          <tr key={r.id} className="border-b border-border align-top last:border-0">
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.rowNo}</td>
                            <td className="px-3 py-2 font-medium">{r.consequence}</td>
                            <td className="px-3 py-2 max-w-xs whitespace-pre-wrap text-muted-foreground">{r.causes}</td>
                            <td className="px-3 py-2 tabular-nums">{r.severity}</td>
                            <td className="px-3 py-2 tabular-nums">{r.likelihood}</td>
                            <td className="px-3 py-2"><Badge tone={bandTone(rBand)}>{rf}</Badge></td>
                            <td className="px-3 py-2 max-w-xs whitespace-pre-wrap">{r.existingControls}</td>
                            <td className="px-3 py-2 max-w-xs whitespace-pre-wrap">{r.additionalControls || "—"}</td>
                            <td className="px-3 py-2 tabular-nums">{resL}</td>
                            <td className="px-3 py-2"><Badge tone={bandTone(resBand)}>{resRf}</Badge></td>
                            <td className="px-3 py-2 text-muted-foreground">{r.responsible || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
