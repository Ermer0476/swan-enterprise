"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { decideRevisionRequestAction, type ActionResult } from "@/features/risk/actions";
import { DISPOSITIONS, DISPOSITION_LABELS } from "@/features/risk/schema";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

export function DecideRevisionRequestForm({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Blank = auto (Approved -> Added to Template, Rejected -> Not Added, per
  // decideRevisionRequestAction's defaults) — override only when the actual
  // outcome differs from the decision itself (e.g. approved but already
  // covered by an existing control elsewhere).
  const [disposition, setDisposition] = useState("");

  function decide(decision: "APPROVED" | "REJECTED") {
    setError(null);
    const fd = new FormData();
    fd.set("requestId", requestId);
    fd.set("decision", decision);
    if (disposition) fd.set("disposition", disposition);
    startTransition(async () => {
      const res: ActionResult = await decideRevisionRequestAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Select
        value={disposition}
        onChange={(e) => setDisposition(e.target.value)}
        className="h-8 w-56 text-xs"
        aria-label="Disposition (optional override)"
      >
        <option value="">Auto disposition</option>
        {DISPOSITIONS.map((d) => (
          <option key={d} value={d}>{DISPOSITION_LABELS[d]}</option>
        ))}
      </Select>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="success" onClick={() => decide("APPROVED")} disabled={pending}>
          <Check className="h-3.5 w-3.5" /> Approve
        </Button>
        <Button size="sm" variant="danger" onClick={() => decide("REJECTED")} disabled={pending}>
          <X className="h-3.5 w-3.5" /> Reject
        </Button>
      </div>
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}
