"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { decideRevisionRequestAction, type ActionResult } from "@/features/risk/actions";
import { Button } from "@/components/ui/button";

export function DecideRevisionRequestForm({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(decision: "APPROVED" | "REJECTED") {
    setError(null);
    const fd = new FormData();
    fd.set("requestId", requestId);
    fd.set("decision", decision);
    startTransition(async () => {
      const res: ActionResult = await decideRevisionRequestAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
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
