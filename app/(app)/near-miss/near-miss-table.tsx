"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useSortableRows } from "@/lib/use-sortable-rows";
import { formatDate, humanize, severityTone } from "@/lib/utils";
import { NEARMISS_KIND_LABELS } from "@/features/near-miss/schema";

export type NearMissRowView = {
  id: string;
  refNo: string;
  title: string;
  vesselName: string | null;
  kind: keyof typeof NEARMISS_KIND_LABELS;
  potentialSeverity: string;
  occurredAt: string; // ISO
  status: string;
};

function statusTone(s: string) {
  return s === "CLOSED" ? "success" : s === "UNDER_REVIEW" ? "warning" : "accent";
}
function kindTone(k: string) {
  return k === "HOR" ? "warning" : "accent";
}

export function NearMissTable({ rows }: { rows: NearMissRowView[] }) {
  const { sorted, sortKey, sortDir, toggleSort } = useSortableRows<NearMissRowView>(
    rows,
    (r, key) => {
      switch (key) {
        case "vessel":
          return r.vesselName ?? "";
        case "ref":
          return r.refNo;
        case "kind":
          return NEARMISS_KIND_LABELS[r.kind];
        case "title":
          return r.title;
        case "potential":
          return r.potentialSeverity;
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
          <SortableHeader label="Kind" sortKey="kind" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
          <SortableHeader label="Title" sortKey="title" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
          <SortableHeader label="Potential" sortKey="potential" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
          <SortableHeader label="Occurred" sortKey="occurred" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
          <SortableHeader label="Status" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
          <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
            <td className="px-4 py-2.5 text-muted-foreground">{r.vesselName ?? "—"}</td>
            <td className="px-4 py-2.5 font-mono text-xs">
              <Link href={`/near-miss/${r.id}`} className="text-accent hover:underline">
                {r.refNo}
              </Link>
            </td>
            <td className="px-4 py-2.5">
              <Badge tone={kindTone(r.kind)}>{NEARMISS_KIND_LABELS[r.kind]}</Badge>
            </td>
            <td className="px-4 py-2.5">
              <Link href={`/near-miss/${r.id}`} className="hover:underline">{r.title}</Link>
            </td>
            <td className="px-4 py-2.5">
              <Badge tone={severityTone(r.potentialSeverity)}>{humanize(r.potentialSeverity)}</Badge>
            </td>
            <td className="px-4 py-2.5 text-muted-foreground">{formatDate(r.occurredAt)}</td>
            <td className="px-4 py-2.5">
              <Badge tone={statusTone(r.status)}>{humanize(r.status)}</Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
