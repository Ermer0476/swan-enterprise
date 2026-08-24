"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, ShieldCheck, ArrowRight, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

type ScheduleAlertRow = { vesselId: string; vesselName: string; scheduledDue: Date | null; urgency: string };

/** Collapsed-by-default SIRE/Internal Audit "due this month" alerts — the
 * Dashboard got crowded with both lists always expanded, so this hides them
 * behind two toggle buttons instead; clicking one shows just that list. */
export function ScheduleAlertsPanel({
  sireAlerts,
  iAuditAlerts,
}: {
  sireAlerts: ScheduleAlertRow[];
  iAuditAlerts: ScheduleAlertRow[];
}) {
  const [open, setOpen] = useState<"sire" | "iaudit" | null>(null);

  if (sireAlerts.length === 0 && iAuditAlerts.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <CalendarClock className="h-4 w-4 text-accent" /> Schedule
      </div>
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-2 pt-5">
          {sireAlerts.length > 0 && (
            <Button
              type="button"
              variant={open === "sire" ? "warning" : "outline"}
              size="sm"
              onClick={() => setOpen(open === "sire" ? null : "sire")}
            >
              <CalendarClock className="h-4 w-4" /> SIRE ({sireAlerts.length})
            </Button>
          )}
          {iAuditAlerts.length > 0 && (
            <Button
              type="button"
              variant={open === "iaudit" ? "warning" : "outline"}
              size="sm"
              onClick={() => setOpen(open === "iaudit" ? null : "iaudit")}
            >
              <ShieldCheck className="h-4 w-4" /> Internal Audit ({iAuditAlerts.length})
            </Button>
          )}
        </CardContent>
      </Card>

      {open === "sire" && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/15">
                  <CalendarClock className="h-4.5 w-4.5 text-warning" />
                </div>
                <h2 className="font-semibold">
                  SIRE due this month — {sireAlerts.length} vessel{sireAlerts.length === 1 ? "" : "s"}
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link href="/sire/schedule">
                  <Button variant="warning" size="sm">
                    View SIRE Schedule <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(null)} aria-label="Hide">
                  <X className="h-4 w-4" /> Hide
                </Button>
              </div>
            </div>

            <ul className="mt-3 divide-y divide-warning/15 border-t border-warning/15 text-sm">
              {sireAlerts.map((a) => (
                <li key={a.vesselId} className="flex items-center justify-between gap-4 py-1.5">
                  <span className="font-medium text-foreground">{a.vesselName}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {a.scheduledDue
                      ? a.urgency === "OVERDUE"
                        ? `Overdue since ${formatDate(a.scheduledDue)}`
                        : `Due ${formatDate(a.scheduledDue)}`
                      : "No SIRE on record yet"}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {open === "iaudit" && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/15">
                  <ShieldCheck className="h-4.5 w-4.5 text-warning" />
                </div>
                <h2 className="font-semibold">
                  Internal Audit due this month — {iAuditAlerts.length} vessel{iAuditAlerts.length === 1 ? "" : "s"}
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link href="/internal-audits/schedule">
                  <Button variant="warning" size="sm">
                    View Internal Audit Schedule <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(null)} aria-label="Hide">
                  <X className="h-4 w-4" /> Hide
                </Button>
              </div>
            </div>

            <ul className="mt-3 divide-y divide-warning/15 border-t border-warning/15 text-sm">
              {iAuditAlerts.map((a) => (
                <li key={a.vesselId} className="flex items-center justify-between gap-4 py-1.5">
                  <span className="font-medium text-foreground">{a.vesselName}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {a.scheduledDue
                      ? a.urgency === "OVERDUE"
                        ? `Overdue since ${formatDate(a.scheduledDue)}`
                        : `Due ${formatDate(a.scheduledDue)}`
                      : "No internal audit on record yet"}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
