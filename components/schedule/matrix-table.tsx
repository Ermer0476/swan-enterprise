import { Fragment } from "react";
import Link from "next/link";
import type { MatrixRow } from "@/features/schedule/queries";
import { formatDate } from "@/lib/utils";
import { NaToggle } from "./na-toggle";
import { FrequencyEditor } from "./frequency-editor";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function StatusDot({ status }: { status: MatrixRow["status"] }) {
  const color = status === "green" ? "bg-success" : status === "red" ? "bg-danger" : "bg-muted-foreground/30";
  const label = status === "green" ? "On schedule" : status === "red" ? "Overdue" : "Not tracked";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} title={label} aria-label={label} />;
}

/** Renders one Ship's-Particulars-style compliance matrix — grouped by
 * category (drills only; familiarization has none), with Last/Next-due and
 * a Jan–Dec day-of-month grid for `year`, mirroring SMS A-EMP-01 / CK-047(b).
 * `vesselId` + `canEditApplicability` enable the office-only N/A checkbox
 * column so items that don't apply to a vessel (e.g. Free Fall Lifeboat on a
 * conventional-lifeboat ship) don't false-alarm as overdue. */
export function MatrixTable({
  rows,
  year,
  vesselId,
  canEditApplicability = false,
  canEditFrequency = false,
  recordHref,
}: {
  rows: MatrixRow[];
  year: number;
  vesselId?: string;
  canEditApplicability?: boolean;
  /** Administrator-only — stricter than canEditApplicability, since the
   * frequency schedule is a fixed fleet-wide SMS fact. */
  canEditFrequency?: boolean;
  /** Builds the URL for a completion record's day-of-month badge, e.g.
   * `(id) => \`/drills/${id}\``. Omit to render the days as plain text
   * (familiarization records have no detail page yet). */
  recordHref?: (id: string) => string;
}) {
  const groups = new Map<string, MatrixRow[]>();
  for (const row of rows) {
    const key = row.category ?? "";
    const arr = groups.get(key) ?? [];
    arr.push(row);
    groups.set(key, arr);
  }

  const colCount = 5 + 12 + (canEditApplicability ? 1 : 0);

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="border-b-2 border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr className="divide-x divide-border">
            <th className="sticky left-0 z-10 min-w-64 bg-muted/40 px-3 py-2 font-medium">Item</th>
            <th className="min-w-28 px-3 py-2 font-medium">Frequency</th>
            <th className="min-w-24 px-3 py-2 font-medium">Last</th>
            <th className="min-w-24 px-3 py-2 font-medium">Next</th>
            <th className="w-10 px-2 py-2 text-center font-medium">•</th>
            {canEditApplicability && <th className="w-14 px-2 py-2 text-center font-medium">N/A</th>}
            {MONTH_LABELS.map((m) => (
              <th key={m} className="w-11 px-1.5 py-2 text-center font-medium">{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from(groups.entries()).map(([category, groupRows]) => (
            <Fragment key={category || "ungrouped"}>
              {category && (
                <tr key={`${category}-header`} className="border-t border-border bg-muted/20">
                  <td colSpan={colCount} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {category}
                  </td>
                </tr>
              )}
              {groupRows.map((row) => (
                <tr
                  key={row.id}
                  className={`divide-x divide-border border-t border-border hover:bg-muted/20 ${row.notApplicable ? "opacity-50" : ""}`}
                >
                  <td className="sticky left-0 z-10 bg-background px-3 py-2 align-top">
                    <div className="font-medium">
                      {row.itemNo && <span className="mr-1.5 text-muted-foreground">{row.itemNo}</span>}
                      {row.name}
                    </div>
                    {row.smsReference && (
                      <div className="mt-0.5 text-xs text-muted-foreground">{row.smsReference}</div>
                    )}
                    {row.notApplicable && (
                      <div className="mt-0.5 text-xs italic text-muted-foreground">Not applicable to this vessel</div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                    {canEditFrequency ? (
                      <FrequencyEditor
                        scheduleItemId={row.id}
                        frequencyLabel={row.frequencyLabel}
                        frequencyDays={row.frequencyDays}
                      />
                    ) : (
                      row.frequencyLabel ?? "—"
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                    {row.lastDate ? formatDate(row.lastDate) : "—"}
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                    {row.nextDue ? formatDate(row.nextDue) : "—"}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div className="flex justify-center pt-1"><StatusDot status={row.status} /></div>
                  </td>
                  {canEditApplicability && (
                    <td className="px-2 py-2 align-top">
                      <div className="flex justify-center pt-1">
                        {vesselId && (
                          <NaToggle vesselId={vesselId} scheduleItemId={row.id} checked={row.notApplicable} />
                        )}
                      </div>
                    </td>
                  )}
                  {row.monthEntries.map((entries, i) => (
                    <td key={i} className="px-1 py-2 text-center align-top tabular-nums text-muted-foreground">
                      {/* One date per line — side-by-side numbers (e.g. "2" next to "6")
                          read as a single merged value, so each completion gets its own row. */}
                      <div className="flex flex-col items-center divide-y divide-border/60">
                        {entries.map((e) =>
                          recordHref ? (
                            <Link
                              key={e.id}
                              href={recordHref(e.id)}
                              className="w-full py-0.5 font-medium text-accent hover:underline"
                            >
                              {String(e.day).padStart(2, "0")}
                            </Link>
                          ) : (
                            <span key={e.id} className="w-full py-0.5">{String(e.day).padStart(2, "0")}</span>
                          ),
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
        Day-of-month shown is when that item was completed in {year}. Last/Next due reflect the most recent completion on record, regardless of year.
        {canEditApplicability && " Check N/A for items that don't apply to this vessel — they won't be flagged overdue."}
      </p>
    </div>
  );
}
