"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { recordExecutionAction, type ActionResult } from "@/features/risk/actions";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { VesselField } from "@/components/ui/vessel-field";
import { Button } from "@/components/ui/button";
import { HazardRatingRow, defaultRating, type HazardRating, type HazardRowOption } from "./hazard-rating-row";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Recording…" : "Record execution"}
    </Button>
  );
}

export function ExecutionForm({
  documentId,
  vessels,
  isShipboard,
  ownVesselId,
  ownVesselName,
  hazardRows,
}: {
  documentId: string;
  vessels: { id: string; name: string }[];
  isShipboard: boolean;
  ownVesselId: string | null;
  ownVesselName: string | null;
  hazardRows: HazardRowOption[];
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    recordExecutionAction,
    { ok: false, error: null },
  );
  const [condition, setCondition] = useState<"UNCHANGED" | "CHANGED">("UNCHANGED");
  // All hazards start checked — the vessel unchecks whichever don't apply
  // to this specific job, per RC-012's job-execution selection step.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(hazardRows.map((r) => r.id)));
  const toggleHazard = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Vessel's actual Severity/Likelihood re-rating for this job, per hazard —
  // seeded from the template's own values, editable, submitted alongside
  // selectedHazardRowIds as hazardRatings.
  const [ratings, setRatings] = useState<Record<string, HazardRating>>(() =>
    Object.fromEntries(hazardRows.map((r) => [r.id, defaultRating(r)])),
  );
  const setRating = (id: string, next: HazardRating) =>
    setRatings((prev) => ({ ...prev, [id]: next }));

  const hazardRatingsPayload = Array.from(selected).map((id) => ({
    hazardRowId: id,
    ...(ratings[id] ?? { severity: null, likelihood: null, resLikelihood: null }),
  }));

  // Default to today (local date) but fully editable so the crew can back-date
  // to the real day the job was conducted.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="selectedHazardRowIds" value={JSON.stringify(Array.from(selected))} />
      <input type="hidden" name="hazardRatings" value={JSON.stringify(hazardRatingsPayload)} />

      <div className="space-y-1.5">
        <Label htmlFor="jobName">Job / task</Label>
        <AutoGrowInput id="jobName" name="jobName" placeholder="Specific job this execution covers" className="max-h-none" required />
      </div>

      <VesselField
        vessels={vessels}
        isShipboard={isShipboard}
        ownVesselId={ownVesselId}
        ownVesselName={ownVesselName}
        required
      />

      {hazardRows.length > 0 && (
        <div className="space-y-1.5">
          <Label>Hazards applicable to this job</Label>
          <p className="text-xs text-muted-foreground">
            Unchecked hazards were assessed but don&apos;t apply to this specific job — leave them out.
            Check a hazard to re-rate Severity/Likelihood for the actual conditions on this job.
          </p>
          <div className="max-h-[32rem] space-y-1 overflow-y-auto rounded-md border border-input p-2">
            {hazardRows.map((r) => (
              <HazardRatingRow
                key={r.id}
                hazard={r}
                checked={selected.has(r.id)}
                onToggle={() => toggleHazard(r.id)}
                rating={ratings[r.id] ?? defaultRating(r)}
                onRatingChange={(next) => setRating(r.id, next)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5 sm:max-w-xs">
        <Label htmlFor="executedAt">Date conducted</Label>
        <Input id="executedAt" name="executedAt" type="date" defaultValue={today} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="conditionStatus">Conditions vs. this Risk Assessment</Label>
        <Select
          id="conditionStatus"
          name="conditionStatus"
          value={condition}
          onChange={(e) => setCondition(e.target.value as "UNCHANGED" | "CHANGED")}
        >
          <option value="UNCHANGED">Unchanged — conditions match as assessed</option>
          <option value="CHANGED">Changed — conditions differ from what's assessed</option>
        </Select>
      </div>

      {condition === "CHANGED" && (
        <div className="space-y-1.5">
          <Label htmlFor="changedConditionsNote">What's changed</Label>
          <AutoGrowInput id="changedConditionsNote" name="changedConditionsNote" className="max-h-none" />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="temporaryHazards">Temporary additional hazards (this job only)</Label>
        <AutoGrowInput id="temporaryHazards" name="temporaryHazards" className="max-h-none" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="temporaryControls">Temporary additional controls (this job only)</Label>
        <AutoGrowInput id="temporaryControls" name="temporaryControls" className="max-h-none" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="toolboxAttendees">Toolbox talk attendees</Label>
        <AutoGrowInput id="toolboxAttendees" name="toolboxAttendees" placeholder="Names / ranks" className="max-h-none" />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="toolboxSigned" value="true" className="h-4 w-4 rounded border-input" />
        Toolbox talk conducted and confirmed (e-signature)
      </label>

      {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
