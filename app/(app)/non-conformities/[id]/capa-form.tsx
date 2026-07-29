"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  saveCapaAction,
  type ActionResult,
} from "@/features/non-conformities/actions";
import { Textarea, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save CAPA"}
    </Button>
  );
}

export function CapaForm({
  ncrId,
  rootCause,
  correctiveAction,
  verification,
}: {
  ncrId: string;
  rootCause: string;
  correctiveAction: string;
  verification: string;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    saveCapaAction,
    { ok: false, error: null },
  );
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="ncrId" value={ncrId} />
      <div className="space-y-1.5">
        <Label htmlFor="rootCause">Root cause</Label>
        <Textarea id="rootCause" name="rootCause" rows={3} defaultValue={rootCause}
          placeholder="Underlying cause of the non-conformity…" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="correctiveAction">Corrective action</Label>
        <Textarea id="correctiveAction" name="correctiveAction" rows={3} defaultValue={correctiveAction}
          placeholder="Action to correct and prevent recurrence…" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="verification">Verification of effectiveness</Label>
        <Textarea id="verification" name="verification" rows={2} defaultValue={verification}
          placeholder="How was the corrective action verified as effective?" />
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-success">Saved.</p>}
      <SaveButton />
    </form>
  );
}
