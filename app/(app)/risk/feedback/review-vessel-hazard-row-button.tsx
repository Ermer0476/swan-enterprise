"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { reviewVesselHazardRowAction, type ActionResult } from "@/features/risk/actions";
import { DISPOSITIONS, DISPOSITION_LABELS } from "@/features/risk/schema";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

/** Decision control for a vessel-authored hazard row addendum
 * (RiskHazardRow with vesselId set) — the one feedback surface that had no
 * review tracking before this module's redesign. Unlike execution controls,
 * a disposition here is required: there's no separate approve/reject action
 * to fall back on, so "reviewed with no stated outcome" isn't a useful state. */
export function ReviewVesselHazardRowButton({ rowId }: { rowId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [disposition, setDisposition] = useState("");

  function submit() {
    if (!disposition) {
      setError("Choose a disposition first");
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("rowId", rowId);
    fd.set("disposition", disposition);
    startTransition(async () => {
      const res: ActionResult = await reviewVesselHazardRowAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <Select
          value={disposition}
          onChange={(e) => setDisposition(e.target.value)}
          className="h-8 w-56 text-xs"
          aria-label="Disposition"
        >
          <option value="">Choose disposition…</option>
          {DISPOSITIONS.map((d) => (
            <option key={d} value={d}>{DISPOSITION_LABELS[d]}</option>
          ))}
        </Select>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={submit}>
          <CheckCircle2 className="h-3.5 w-3.5" /> {pending ? "Saving…" : "Review"}
        </Button>
      </div>
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}
