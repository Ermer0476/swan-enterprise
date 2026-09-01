"use client";

import Link from "next/link";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useSortableRows } from "@/lib/use-sortable-rows";
import { Card } from "@/components/ui/card";

export type SummaryRow = {
  vesselId: string;
  vesselName: string;
  fat: number;
  ptd: number;
  ppd: number;
  lwc: number;
  rwc: number;
  mtc: number;
  lti: number;
  trc: number;
  totalHours: number;
  ltif: number;
  trcf: number;
};

function fmtFreq(n: number): string {
  return n.toFixed(2);
}

export function SummaryTable({ rows }: { rows: SummaryRow[] }) {
  const { sorted, sortKey, sortDir, toggleSort } = useSortableRows<SummaryRow>(rows, (r, key) => {
    switch (key) {
      case "vesselName": return r.vesselName;
      case "fat": return r.fat;
      case "ptd": return r.ptd;
      case "ppd": return r.ppd;
      case "lwc": return r.lwc;
      case "rwc": return r.rwc;
      case "mtc": return r.mtc;
      case "lti": return r.lti;
      case "trc": return r.trc;
      case "totalHours": return r.totalHours;
      case "ltif": return r.ltif;
      case "trcf": return r.trcf;
      default: return "";
    }
  });

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <SortableHeader label="Vessels" sortKey="vesselName" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="px-4 py-2.5" />
              <SortableHeader label="FAT" sortKey="fat" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="px-4 py-2.5" />
              <SortableHeader label="PTD" sortKey="ptd" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="px-4 py-2.5" />
              <SortableHeader label="PPD" sortKey="ppd" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="px-4 py-2.5" />
              <SortableHeader label="LWC" sortKey="lwc" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="px-4 py-2.5" />
              <SortableHeader label="RWC" sortKey="rwc" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="px-4 py-2.5" />
              <SortableHeader label="MTC" sortKey="mtc" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="px-4 py-2.5" />
              <SortableHeader label="LTI" sortKey="lti" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="px-4 py-2.5" />
              <SortableHeader label="TRC" sortKey="trc" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="px-4 py-2.5" />
              <SortableHeader label="Total Hours" sortKey="totalHours" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="px-4 py-2.5" />
              <SortableHeader label="LTIF" sortKey="ltif" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="px-4 py-2.5" />
              <SortableHeader label="TRCF" sortKey="trcf" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.vesselId} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <Link href={`/exposure-hours/${r.vesselId}`} className="font-medium text-accent hover:underline">
                    {r.vesselName}
                  </Link>
                </td>
                <td className="px-4 py-2.5 tabular-nums font-medium text-danger">{r.fat}</td>
                <td className="px-4 py-2.5 tabular-nums font-medium text-warning">{r.ptd}</td>
                <td className="px-4 py-2.5 tabular-nums font-medium text-amber-600 dark:text-amber-400">{r.ppd}</td>
                <td className="px-4 py-2.5 tabular-nums font-medium text-purple-600 dark:text-purple-400">{r.lwc}</td>
                <td className="px-4 py-2.5 tabular-nums font-medium text-success">{r.rwc}</td>
                <td className="px-4 py-2.5 tabular-nums font-medium text-accent">{r.mtc}</td>
                <td className="px-4 py-2.5 tabular-nums font-semibold">{r.lti}</td>
                <td className="px-4 py-2.5 tabular-nums font-semibold">{r.trc}</td>
                <td className="px-4 py-2.5 tabular-nums">{r.totalHours.toLocaleString()}</td>
                <td className="px-4 py-2.5 tabular-nums">{fmtFreq(r.ltif)}</td>
                <td className="px-4 py-2.5 tabular-nums">{fmtFreq(r.trcf)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
