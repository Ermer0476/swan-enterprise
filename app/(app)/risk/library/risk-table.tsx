"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useSortableRows } from "@/lib/use-sortable-rows";
import { riskDocStatusTone, bandTone, reviewStatusTone } from "@/features/risk/ui";
import type { RiskBand } from "@/features/risk/schema";
import { formatDate, humanize } from "@/lib/utils";

export type RiskDocRowView = {
  id: string;
  refNo: string;
  title: string;
  category: string;
  status: string;
  riskLevel: RiskBand | null; // overall band from currentRevision's hazard rows
  nextReviewDate: string | null; // ISO
  executionCount: number;
};

export function RiskDocTable({ rows }: { rows: RiskDocRowView[] }) {
  const { sorted, sortKey, sortDir, toggleSort } = useSortableRows<RiskDocRowView>(
    rows,
    (r, key) => {
      switch (key) {
        case "ref":
          return r.refNo;
        case "title":
          return r.title;
        case "category":
          return r.category;
        case "level":
          return r.riskLevel ?? "";
        case "review":
          return r.nextReviewDate ? new Date(r.nextReviewDate) : new Date(8640000000000000);
        case "status":
          return r.status;
        case "uses":
          return r.executionCount;
        default:
          return "";
      }
    },
  );

  return (
    <table className="w-full text-sm">
      <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <SortableHeader label="Ref" sortKey="ref" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
          <SortableHeader label="Title" sortKey="title" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
          <SortableHeader label="Category" sortKey="category" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
          <SortableHeader label="Risk Level" sortKey="level" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
          <SortableHeader label="Next Review" sortKey="review" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
          <SortableHeader label="Uses" sortKey="uses" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
          <SortableHeader label="Status" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => {
          const review = reviewStatusTone(r.nextReviewDate ? new Date(r.nextReviewDate) : null);
          return (
            <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
              <td className="px-4 py-2.5 font-mono text-xs">
                <Link href={`/risk/${r.id}`} className="text-accent hover:underline">{r.refNo}</Link>
              </td>
              <td className="px-4 py-2.5">
                <Link href={`/risk/${r.id}`} className="hover:underline">{r.title}</Link>
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{r.category}</td>
              <td className="px-4 py-2.5">
                {r.riskLevel ? (
                  <Badge tone={bandTone(r.riskLevel)}>{humanize(r.riskLevel)}</Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-4 py-2.5">
                {r.nextReviewDate ? (
                  <span className="inline-flex items-center gap-1.5">
                    {formatDate(r.nextReviewDate)}
                    <Badge tone={review.tone}>{review.label}</Badge>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not scheduled</span>
                )}
              </td>
              <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{r.executionCount}</td>
              <td className="px-4 py-2.5">
                <Badge tone={riskDocStatusTone(r.status)}>{humanize(r.status)}</Badge>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
