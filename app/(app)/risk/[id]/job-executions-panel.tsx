"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, humanize } from "@/lib/utils";

export type ExecutionView = {
  id: string;
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
};

// Multiple vessels can execute the same fleet-wide RA over time, but only one
// job's details ever matter at a glance — clicking a date swaps the detail
// panel to that execution instead of listing every job's full write-up at
// once (which is exactly what made this section unreadable before).
export function JobExecutionsPanel({
  documentId,
  executions,
}: {
  documentId: string;
  executions: ExecutionView[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(executions[0]?.id ?? null);
  const selected = executions.find((e) => e.id === selectedId) ?? null;

  if (executions.length === 0) {
    return <p className="text-sm text-muted-foreground">No executions recorded yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
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
            <div className="text-sm font-semibold">{selected.jobName}</div>
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
