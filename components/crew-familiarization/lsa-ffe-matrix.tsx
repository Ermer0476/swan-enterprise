import { cn, formatDate } from "@/lib/utils";
import type { LsaFfeChecklistRow } from "@/features/crew-familiarization/queries";

const WEEKS = [1, 2, 3, 4, 5, 6, 7, 8];

/** The CK-047(a) matrix, read-only: one row per item, WK1–WK8 across the top.
 * Each item sits under its scheduled week. For a vessel, a covered item shows
 * the latest date it was familiarized (green); a still-outstanding item shows a
 * red marker. For the blank reference (no vessel), every item shows a neutral
 * WK marker — just the schedule. */
export function LsaFfeMatrix({ items }: { items: LsaFfeChecklistRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="border-b-2 border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr className="divide-x divide-border">
            <th className="sticky left-0 z-10 min-w-56 bg-muted/40 px-3 py-2 text-left font-medium">
              Description
            </th>
            {WEEKS.map((w) => (
              <th key={w} className="w-24 px-1.5 py-2 text-center font-medium">
                WK{w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="divide-x divide-border border-t border-border">
              <td className="sticky left-0 z-10 bg-background px-3 py-1.5 align-middle text-sm">
                <span className="mr-1.5 text-muted-foreground">{item.itemNo}.</span>
                {item.name}
              </td>
              {WEEKS.map((w) =>
                w === item.suggestedWeek ? (
                  <td key={w} className="p-1 align-middle">
                    {item.completedDate ? (
                      <div className="flex h-7 items-center justify-center rounded bg-success/10 px-1 text-center text-[11px] font-medium text-success ring-1 ring-inset ring-success/40">
                        {formatDate(item.completedDate)}
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "flex h-7 items-center justify-center rounded text-[11px] font-medium",
                          item.dueStatus === "overdue"
                            ? "bg-danger/10 text-danger ring-1 ring-inset ring-danger/40"
                            : "bg-accent/10 text-accent ring-1 ring-inset ring-accent/30",
                        )}
                      >
                        WK{w}
                      </div>
                    )}
                  </td>
                ) : (
                  <td key={w} className="p-1 align-middle">
                    <div className="h-7 rounded bg-muted/70" />
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
