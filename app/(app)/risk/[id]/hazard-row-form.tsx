"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import {
  addHazardRowAction,
  type ActionResult,
} from "@/features/risk/actions";
import {
  RA_LEVELS,
  computeRF,
  riskBand,
  type RiskScaleLabels,
} from "@/features/risk/schema";
import { bandTone } from "@/features/risk/ui";
import { Badge } from "@/components/ui/badge";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { humanize } from "@/lib/utils";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Adding…" : "Add hazard row"}
    </Button>
  );
}

export function HazardRowForm({ revisionId, scaleLabels }: { revisionId: string; scaleLabels: RiskScaleLabels }) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction] = useActionState<ActionResult, FormData>(
    addHazardRowAction,
    { ok: false, error: null },
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [severity, setSeverity] = useState(4);
  const [likelihood, setLikelihood] = useState(2);
  const [resLikelihood, setResLikelihood] = useState(1);
  const [isNew, setIsNew] = useState(true);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setShowForm(false);
    }
  }, [state.ok]);

  const rf = computeRF(severity, likelihood);
  const band = riskBand(rf);
  const resRf = computeRF(severity, resLikelihood);
  const resBand = riskBand(resRf);

  if (!showForm) {
    return (
      <Button variant="outline" onClick={() => setShowForm(true)}>
        <Plus className="h-4 w-4" /> Add hazard row
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 rounded-md border border-border bg-card p-4"
    >
      <div className="text-sm font-medium">Add hazard row</div>
      <input type="hidden" name="revisionId" value={revisionId} />

      <div className="space-y-1.5">
        <Label htmlFor="phase">Phase</Label>
        <Input id="phase" name="phase" placeholder="e.g. PHASE 1 — PRE-WORK PREPARATION" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="consequence">Unwanted Consequence</Label>
        <AutoGrowInput id="consequence" name="consequence" placeholder="e.g. Fire / Explosion" className="max-h-none" required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="causes">Possible Causes / Hazard Factors</Label>
        <AutoGrowInput id="causes" name="causes" className="max-h-none" required />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="severity">Severity</Label>
          <Select id="severity" name="severity" value={severity} onChange={(e) => setSeverity(Number(e.target.value))}>
            {RA_LEVELS.map((l) => <option key={l} value={l}>{scaleLabels.severity[l]}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="likelihood">Likelihood</Label>
          <Select id="likelihood" name="likelihood" value={likelihood} onChange={(e) => setLikelihood(Number(e.target.value))}>
            {RA_LEVELS.map((l) => <option key={l} value={l}>{scaleLabels.likelihood[l]}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Initial RF</Label>
          <div className="flex h-9 items-center gap-2">
            <span className="text-sm font-medium tabular-nums">{rf}</span>
            <Badge tone={bandTone(band)}>{humanize(band)}</Badge>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="existingControls">Existing Controls</Label>
        <AutoGrowInput id="existingControls" name="existingControls" placeholder="Standing SMS controls always in place" className="max-h-none" required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="additionalControls">Additional Controls (this operation)</Label>
        <AutoGrowInput id="additionalControls" name="additionalControls" placeholder="Specific measures for this operation" className="max-h-none" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5 col-span-2 sm:col-span-1">
          <Label htmlFor="resLikelihood">Residual Likelihood</Label>
          <Select
            id="resLikelihood"
            name="resLikelihood"
            value={resLikelihood}
            onChange={(e) => setResLikelihood(Number(e.target.value))}
          >
            {RA_LEVELS.map((l) => <option key={l} value={l}>{scaleLabels.likelihood[l]}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Residual RF</Label>
          <div className="flex h-9 items-center gap-2">
            <span className="text-sm font-medium tabular-nums">{resRf}</span>
            <Badge tone={bandTone(resBand)}>{humanize(resBand)}</Badge>
          </div>
        </div>
        <p className="col-span-2 self-center text-xs text-muted-foreground sm:col-span-1">
          Severity stays fixed at {severity} for the residual rating (SSP-13 Sec. 5.7).
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="responsible">Responsible</Label>
        <Input id="responsible" name="responsible" placeholder="e.g. Chief Engineer, 3/E" />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isNew"
          value="true"
          checked={isNew}
          onChange={(e) => setIsNew(e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        ★ New hazard added in this revision
      </label>

      <div className="space-y-1.5">
        <Label htmlFor="ratingChangeNote">Rating change note (optional)</Label>
        <AutoGrowInput
          id="ratingChangeNote"
          name="ratingChangeNote"
          placeholder="e.g. Severity reduced 4→3 — rationale..."
          className="max-h-none"
        />
      </div>

      {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
      <div className="flex items-center gap-2">
        <SubmitButton />
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
