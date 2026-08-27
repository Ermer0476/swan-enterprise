"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateOperationalWindowsAction, type ActionResult } from "@/features/operational-windows/actions";

export function WindowsForm({
  incidentOverdueDays,
  sireDueSoonDays,
  internalAuditDueSoonDays,
}: {
  incidentOverdueDays: number;
  sireDueSoonDays: number;
  internalAuditDueSoonDays: number;
}) {
  const [incident, setIncident] = useState(String(incidentOverdueDays));
  const [sire, setSire] = useState(String(sireDueSoonDays));
  const [audit, setAudit] = useState(String(internalAuditDueSoonDays));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save() {
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set("incidentOverdueDays", incident);
    fd.set("sireDueSoonDays", sire);
    fd.set("internalAuditDueSoonDays", audit);
    startTransition(async () => {
      const res: ActionResult = await updateOperationalWindowsAction({ ok: false, error: null }, fd);
      if (!res.ok) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="incidentOverdueDays">Incident Overdue</Label>
          <Input
            id="incidentOverdueDays"
            type="number"
            step="1"
            min="1"
            value={incident}
            onChange={(e) => {
              setIncident(e.target.value);
              setSaved(false);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Days after which an open investigation is flagged &ldquo;overdue&rdquo; on the Incidents KPI.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="sireDueSoonDays">SIRE Due Soon</Label>
          <Input
            id="sireDueSoonDays"
            type="number"
            step="1"
            min="1"
            value={sire}
            onChange={(e) => {
              setSire(e.target.value);
              setSaved(false);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Days before its due date a SIRE inspection is flagged &ldquo;due soon&rdquo; on the schedule.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="internalAuditDueSoonDays">Internal Audit Due Soon</Label>
          <Input
            id="internalAuditDueSoonDays"
            type="number"
            step="1"
            min="1"
            value={audit}
            onChange={(e) => {
              setAudit(e.target.value);
              setSaved(false);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Days before its due date an internal audit is flagged &ldquo;due soon&rdquo; on the schedule.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && !error && (
        <p className="flex items-center gap-1.5 text-sm text-success">
          <Check className="h-4 w-4" /> Windows saved.
        </p>
      )}

      <Button type="button" onClick={save} disabled={pending}>
        {pending ? "Saving…" : "Save Windows"}
      </Button>
    </div>
  );
}
