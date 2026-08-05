"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { recordExecutionAction, type ActionResult } from "@/features/risk/actions";
import { AutoGrowInput, Label, Select } from "@/components/ui/input";
import { VesselField } from "@/components/ui/vessel-field";
import { Button } from "@/components/ui/button";

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
}: {
  documentId: string;
  vessels: { id: string; name: string }[];
  isShipboard: boolean;
  ownVesselId: string | null;
  ownVesselName: string | null;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    recordExecutionAction,
    { ok: false, error: null },
  );
  const [condition, setCondition] = useState<"UNCHANGED" | "CHANGED">("UNCHANGED");

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="documentId" value={documentId} />

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
