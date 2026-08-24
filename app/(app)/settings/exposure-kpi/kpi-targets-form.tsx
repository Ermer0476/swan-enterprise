"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateKpiTargetsAction, type ActionResult } from "@/features/exposure-hours/actions";

export function KpiTargetsForm({ ltifTarget, trcfTarget }: { ltifTarget: number; trcfTarget: number }) {
  const [ltif, setLtif] = useState(String(ltifTarget));
  const [trcf, setTrcf] = useState(String(trcfTarget));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save() {
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set("ltifTarget", ltif);
    fd.set("trcfTarget", trcf);
    startTransition(async () => {
      const res: ActionResult = await updateKpiTargetsAction({ ok: false, error: null }, fd);
      if (!res.ok) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="ltifTarget">LTIF Target</Label>
          <Input
            id="ltifTarget"
            type="number"
            step="0.01"
            min="0.01"
            value={ltif}
            onChange={(e) => {
              setLtif(e.target.value);
              setSaved(false);
            }}
          />
          <p className="text-xs text-muted-foreground">Lost Time Injury Frequency, per 1,000,000 exposure hours.</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="trcfTarget">TRCF Target</Label>
          <Input
            id="trcfTarget"
            type="number"
            step="0.01"
            min="0.01"
            value={trcf}
            onChange={(e) => {
              setTrcf(e.target.value);
              setSaved(false);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Total Recordable Case Frequency, per 1,000,000 exposure hours.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && !error && (
        <p className="flex items-center gap-1.5 text-sm text-success">
          <Check className="h-4 w-4" /> Targets saved.
        </p>
      )}

      <Button type="button" onClick={save} disabled={pending}>
        {pending ? "Saving…" : "Save Targets"}
      </Button>
    </div>
  );
}
