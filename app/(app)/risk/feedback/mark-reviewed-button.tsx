"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { markControlReviewedAction, type ActionResult } from "@/features/risk/actions";
import { DISPOSITIONS, DISPOSITION_LABELS } from "@/features/risk/schema";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

export function MarkReviewedButton({ controlId }: { controlId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [disposition, setDisposition] = useState("");

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set("controlId", controlId);
    if (disposition) fd.set("disposition", disposition);
    startTransition(async () => {
      const res: ActionResult = await markControlReviewedAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-1">
      <Select
        value={disposition}
        onChange={(e) => setDisposition(e.target.value)}
        className="h-8 w-56 text-xs"
        aria-label="Disposition (optional)"
      >
        <option value="">No disposition yet</option>
        {DISPOSITIONS.map((d) => (
          <option key={d} value={d}>{DISPOSITION_LABELS[d]}</option>
        ))}
      </Select>
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={submit}>
        <CheckCircle2 className="h-3.5 w-3.5" /> {pending ? "Marking…" : "Mark Reviewed"}
      </Button>
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}
