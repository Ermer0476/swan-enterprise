"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, humanize } from "@/lib/utils";
import { computeRF, riskBand } from "@/features/risk/schema";
import { bandTone, dispositionTone } from "@/features/risk/ui";
import { AddControlButton } from "./add-control-button";

export type ExecutionHazardControl = {
  id: string;
  controlText: string;
  addedByName: string | null;
  createdAt: string; // ISO
  reviewed: boolean;
  /** Office's decision on this control, and (once ADDED_TO_TEMPLATE) the
   * final reworded text — surfaced here so the vessel that submitted it can
   * see the outcome, not just a bare "Reviewed" status. */
  disposition: string | null;
  officeWording: string | null;
};

export type ExecutionHazard = {
  hazardRowId: string;
  rowNo: number;
  consequence: string;
  causes: string;
  existingControls: string;
  additionalControls: string | null;
  responsible: string | null;
  /** Vessel's actual rating for this job — null on executions recorded
   * before per-job rating existed ("not recorded", never backfilled). */
  severity: number | null;
  likelihood: number | null;
  resLikelihood: number | null;
  addedControls: ExecutionHazardControl[];
};

export type ExecutionView = {
  id: string;
  execNo: string | null;
  vesselId: string;
  executedAt: string; // ISO
  vesselName: string;
  jobName: string;
  revisionNo: number;
  conditionStatus: "CHANGED" | "UNCHANGED";
  changedConditionsNote: string | null;
  temporaryHazards: string | null;
  temporaryControls: string | null;
  toolboxSignedAt: string | null; // ISO or null
  toolboxAttendees: string | null;
  performedByName: string | null;
  hazards: ExecutionHazard[];
};

// Multiple vessels can execute the same fleet-wide RA over time, but only one
// job's details ever matter at a glance — clicking a date swaps the detail
// panel to that execution instead of listing every job's full write-up at
// once (which is exactly what made this section unreadable before).
export function JobExecutionsPanel({
  documentId,
  executions,
  canAddControl = false,
  ownVesselId = null,
}: {
  documentId: string;
  executions: ExecutionView[];
  /** Holds risk-doc:execute at all — gated again server-side, this only
   * hides the button for viewers who could never use it. */
  canAddControl?: boolean;
  /** SHIPBOARD caller's own vessel id — restricts the button to executions
   * their own vessel performed. Office (null) can add to any execution. */
  ownVesselId?: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(executions[0]?.id ?? null);
  const selected = executions.find((e) => e.id === selectedId) ?? null;
  const canAddToSelected = canAddControl && (!ownVesselId || selected?.vesselId === ownVesselId);

  if (executions.length === 0) {
    return <p className="text-sm text-muted-foreground">No executions recorded yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Exec No</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Vessel</th>
              <th className="px-3 py-2 font-medium">Job</th>
            </tr>
          </thead>
          <tbody>
            {executions.map((e) => (
              <tr
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                className={`cursor-pointer border-b border-border last:border-0 hover:bg-muted/40 ${
                  selectedId === e.id ? "bg-accent/10" : ""
                }`}
              >
                <td className={`px-3 py-2 tabular-nums ${selectedId === e.id ? "font-semibold text-accent" : "text-muted-foreground"}`}>
                  {e.execNo ?? "—"}
                </td>
                <td className={`px-3 py-2 ${selectedId === e.id ? "font-semibold text-accent" : "text-muted-foreground"}`}>
                  {formatDate(e.executedAt)}
                </td>
                <td className="px-3 py-2">{e.vesselName}</td>
                <td className="px-3 py-2 text-muted-foreground">{e.jobName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="rounded-md border border-border p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">{selected.jobName}</div>
              {selected.execNo && <Badge tone="accent">{selected.execNo}</Badge>}
            </div>
            <Link href={`/risk/${documentId}/report?executionId=${selected.id}`} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="outline" size="sm">
                <FileText className="h-4 w-4" /> Show Report
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Vessel</div>
              <div className="mt-0.5 text-sm font-medium">{selected.vesselName}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Date</div>
              <div className="mt-0.5 text-sm font-medium">{formatDate(selected.executedAt)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Performed by</div>
              <div className="mt-0.5 text-sm font-medium">{selected.performedByName ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Conditions</div>
              <div className="mt-0.5">
                <Badge tone={selected.conditionStatus === "CHANGED" ? "warning" : "success"}>
                  {humanize(selected.conditionStatus)}
                </Badge>
              </div>
            </div>
          </div>
          {selected.changedConditionsNote && (
            <div className="mt-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Changed Conditions</div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{selected.changedConditionsNote}</p>
            </div>
          )}
          {selected.temporaryHazards && (
            <div className="mt-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Temporary Hazards (this job only)</div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{selected.temporaryHazards}</p>
            </div>
          )}
          {selected.temporaryControls && (
            <div className="mt-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Temporary Controls (this job only)</div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{selected.temporaryControls}</p>
            </div>
          )}
          {selected.hazards.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                Hazards Applicable to This Job
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
                    {[...selected.hazards].sort((a, b) => a.rowNo - b.rowNo).map((h) => {
                      const hasRating = h.severity != null && h.likelihood != null;
                      const rf = hasRating ? computeRF(h.severity!, h.likelihood!) : null;
                      const band = rf != null ? riskBand(rf) : null;
                      const hasResRating = hasRating && h.resLikelihood != null;
                      const resRf = hasResRating ? computeRF(h.severity!, h.resLikelihood!) : null;
                      const resBand = resRf != null ? riskBand(resRf) : null;
                      return (
                        <tr key={h.hazardRowId} className="border-b border-border align-top last:border-0">
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">{h.rowNo}</td>
                          <td className="px-3 py-2 font-medium">{h.consequence}</td>
                          <td className="px-3 py-2 max-w-xs whitespace-pre-wrap text-muted-foreground">{h.causes}</td>
                          <td className="px-3 py-2 tabular-nums">{h.severity ?? "—"}</td>
                          <td className="px-3 py-2 tabular-nums">{h.likelihood ?? "—"}</td>
                          <td className="px-3 py-2">
                            {band ? (
                              <Badge tone={bandTone(band)}>{rf}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">not recorded</span>
                            )}
                          </td>
                          <td className="px-3 py-2 max-w-xs whitespace-pre-wrap">{h.existingControls}</td>
                          <td className="px-3 py-2 max-w-xs align-top">
                            <div className="whitespace-pre-wrap">{h.additionalControls || "—"}</div>
                            {h.addedControls.map((c) => (
                              <div
                                key={c.id}
                                className="mt-1.5 rounded-md border border-warning/30 bg-warning/5 px-2 py-1.5 text-xs"
                              >
                                <p className="whitespace-pre-wrap text-foreground">{c.controlText}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-muted-foreground">
                                  <span>Added by {c.addedByName ?? "vessel"} · {formatDate(c.createdAt)}</span>
                                  {c.reviewed ? (
                                    c.disposition ? (
                                      <Badge tone={dispositionTone(c.disposition)}>{humanize(c.disposition)}</Badge>
                                    ) : (
                                      <Badge tone="success">Reviewed</Badge>
                                    )
                                  ) : (
                                    <Badge tone="warning">Pending office review</Badge>
                                  )}
                                </div>
                                {c.reviewed && c.disposition === "ADDED_TO_TEMPLATE" && c.officeWording && (
                                  <div className="mt-1.5 rounded-md border border-success/30 bg-success/5 p-1.5">
                                    <div className="text-[10px] font-medium uppercase tracking-wide text-success">
                                      Final wording added to template
                                    </div>
                                    <p className="mt-0.5 whitespace-pre-wrap text-foreground">{c.officeWording}</p>
                                  </div>
                                )}
                              </div>
                            ))}
                            {canAddToSelected && (
                              <div className="mt-1.5">
                                <AddControlButton executionId={selected.id} hazardRowId={h.hazardRowId} />
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 tabular-nums">{hasResRating ? h.resLikelihood : "—"}</td>
                          <td className="px-3 py-2">
                            {resBand ? (
                              <Badge tone={bandTone(resBand)}>{resRf}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">not recorded</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{h.responsible || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Toolbox Meeting</div>
              <div className="mt-0.5 text-sm font-medium">
                {selected.toolboxSignedAt ? `Signed ${formatDate(selected.toolboxSignedAt)}` : "—"}
              </div>
            </div>
            {selected.toolboxAttendees && (
              <div className="col-span-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Attendees</div>
                <div className="mt-0.5 text-sm font-medium">{selected.toolboxAttendees}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
