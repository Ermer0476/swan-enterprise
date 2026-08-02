"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  saveShoreRemarksAction,
  type ActionResult,
} from "@/features/non-conformities/actions";
import { AutoGrowInput, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save Shore Remarks"}
    </Button>
  );
}

export function ShoreRemarksForm({
  ncrId,
  shoreRemarks,
}: {
  ncrId: string;
  shoreRemarks: string;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    saveShoreRemarksAction,
    { ok: false, error: null },
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="ncrId" value={ncrId} />
      <div className="space-y-1.5">
        <Label htmlFor="shoreRemarks">Shore Remarks</Label>
        <AutoGrowInput
          id="shoreRemarks"
          name="shoreRemarks"
          defaultValue={shoreRemarks}
          placeholder="Office oversight / remarks…"
        />
      </div>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-success">Saved.</p>}
      <SaveButton />
    </form>
  );
}
