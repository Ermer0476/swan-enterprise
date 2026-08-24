"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateSireTargetAction, type ActionResult } from "@/features/sire/actions";

export function SireTargetForm({ avgObservationTarget }: { avgObservationTarget: number }) {
  const [target, setTarget] = useState(String(avgObservationTarget));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save() {
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set("avgObservationTarget", target);
    startTransition(async () => {
      const res: ActionResult = await updateSireTargetAction({ ok: false, error: null }, fd);
      if (!res.ok) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="max-w-xs space-y-1">
        <Label htmlFor="avgObservationTarget">Average Observations Target</Label>
        <Input
          id="avgObservationTarget"
          type="number"
          step="0.1"
          min="0.1"
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
            setSaved(false);
          }}
        />
        <p className="text-xs text-muted-foreground">Average number of observations per SIRE inspection, fleet-wide.</p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && !error && (
        <p className="flex items-center gap-1.5 text-sm text-success">
          <Check className="h-4 w-4" /> Target saved.
        </p>
      )}

      <Button type="button" onClick={save} disabled={pending}>
        {pending ? "Saving…" : "Save Target"}
      </Button>
    </div>
  );
}
