"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useSortableRows } from "@/lib/use-sortable-rows";
import { severityTone, incidentStatusTone } from "@/features/incidents/ui";
import { formatDate, humanize } from "@/lib/utils";

export type IncidentRowView = {
  id: string;
  refNo: string;
  title: string;
  vesselName: string | null;
  typeLabels: string[]; // pre-resolved "Type — Sub-category" labels
  severity: string | null;
  occurredAt: string; // ISO
  status: string;
};

export function IncidentsTable({ rows }: { rows: IncidentRowView[] }) {
  const { sorted, sortKey, sortDir, toggleSort } = useSortableRows<IncidentRowView>(
    rows,
    (r, key) => {
      switch (key) {
        case "vessel":
          return r.vesselName ?? "";
        case "ref":
          return r.refNo;
        case "type":
          return r.typeLabels[0] ?? "";
        case "title":
          return r.title;
        case "severity":
          return r.severity ?? "";
        case "occurred":
          return new Date(r.occurredAt);
        case "status":
          return r.status;
        default:
          return "";
      }
    },
  );

  return (
    <table className="w-full text-sm">
      <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <SortableHeader label="Vessel" sortKey="vessel" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
          <SortableHeader label="Ref" sortKey="ref" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
          <SortableHeader label="Type" sortKey="type" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
          <SortableHeader label="Title" sortKey="title" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
          <SortableHeader label="Severity" sortKey="severity" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
          <SortableHeader label="Occurred" sortKey="occurred" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
          <SortableHeader label="Status" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
        </tr>
      </thead>
      <tbody>
        {sorted.map((inc) => (
          <tr key={inc.id} className="border-b border-border last:border-0 hover:bg-muted/30">
            <td className="px-4 py-2.5 text-muted-foreground">{inc.vesselName ?? "—"}</td>
            <td className="px-4 py-2.5 font-mono text-xs">
              <Link href={`/incidents/${inc.id}`} className="text-accent hover:underline">
                {inc.refNo}
              </Link>
            </td>
            <td className="px-4 py-2.5 text-muted-foreground">
              {inc.typeLabels.length === 0
                ? "—"
                : inc.typeLabels[0] +
                  (inc.typeLabels.length > 1 ? ` +${inc.typeLabels.length - 1}` : "")}
            </td>
            <td className="px-4 py-2.5">
              <Link href={`/incidents/${inc.id}`} className="hover:underline">{inc.title}</Link>
            </td>
            <td className="px-4 py-2.5">
              {inc.severity ? (
                <Badge tone={severityTone(inc.severity)}>{humanize(inc.severity)}</Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>
            <td className="px-4 py-2.5 text-muted-foreground">{formatDate(inc.occurredAt)}</td>
            <td className="px-4 py-2.5">
              <Badge tone={incidentStatusTone(inc.status)}>{humanize(inc.status)}</Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
