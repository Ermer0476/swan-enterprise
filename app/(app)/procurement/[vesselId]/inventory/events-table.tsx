"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";

export type EventRow = {
  id: string;
  occurredAtMs: number;
  dateLabel: string;
  itemLabel: string;
  categoryLabel: string;
  subGroupLabel: string;
  locationLabel: string;
  remarksLabel: string;
  eventType: string;
  eventTone: "success" | "danger" | "warning" | "accent" | "neutral";
  conditionLabel: string;
  qtyLabel: string;
  robLabel: string;
  reasonLabel: string;
};

type SortKey = "date" | "item";
type SortDir = "asc" | "desc";

function SortableHeader({
  label,
  active,
  dir,
  onClick,
  align,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "right";
}) {
  return (
    <th className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""}`}
      >
        {label}
        <span className="text-[10px] leading-none">{active ? (dir === "asc" ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );
}

export function InventoryEventsTable({ rows }: { rows: EventRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    }
  }

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const sorted = [...rows].sort((a, b) => {
      if (sortKey === "date") return a.occurredAtMs - b.occurredAtMs;
      return a.itemLabel.localeCompare(b.itemLabel);
    });
    if (sortDir === "desc") sorted.reverse();
    return sorted;
  }, [rows, sortKey, sortDir]);

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <SortableHeader label="Date" active={sortKey === "date"} dir={sortDir} onClick={() => toggleSort("date")} />
            <SortableHeader label="Item" active={sortKey === "item"} dir={sortDir} onClick={() => toggleSort("item")} />
            <th className="px-3 py-2 font-medium">Category</th>
            <th className="px-3 py-2 font-medium">Sub Category</th>
            <th className="px-3 py-2 font-medium">Location</th>
            <th className="px-3 py-2 font-medium">Remarks</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Condition</th>
            <th className="px-3 py-2 font-medium text-right">Qty</th>
            <th className="px-3 py-2 font-medium text-right">Running ROB</th>
            <th className="px-3 py-2 font-medium">Reason</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((e) => (
            <tr key={e.id} className="border-b border-border last:border-0">
              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{e.dateLabel}</td>
              <td className="px-3 py-2">{e.itemLabel}</td>
              <td className="px-3 py-2 text-muted-foreground">{e.categoryLabel}</td>
              <td className="px-3 py-2 text-muted-foreground">{e.subGroupLabel}</td>
              <td className="px-3 py-2 text-muted-foreground">{e.locationLabel}</td>
              <td className="px-3 py-2 text-muted-foreground">{e.remarksLabel}</td>
              <td className="px-3 py-2">
                <Badge tone={e.eventTone}>{e.eventType}</Badge>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{e.conditionLabel}</td>
              <td className="px-3 py-2 text-right tabular-nums">{e.qtyLabel}</td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">{e.robLabel}</td>
              <td className="px-3 py-2 text-muted-foreground">{e.reasonLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
