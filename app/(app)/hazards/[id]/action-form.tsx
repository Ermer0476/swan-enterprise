"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  actionHazardAction,
  type ActionResult,
} from "@/features/hazards/actions";
import { Textarea, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save corrective action"}
    </Button>
  );
}

export function ActionForm({
  hazardId,
  correctiveAction,
}: {
  hazardId: string;
  correctiveAction: string;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    actionHazardAction,
    { ok: false, error: null },
  );
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="hazardId" value={hazardId} />
      <div className="space-y-1.5">
        <Label htmlFor="correctiveAction">Corrective action</Label>
        <Textarea id="correctiveAction" name="correctiveAction" rows={3}
          defaultValue={correctiveAction}
          placeholder="Action taken to eliminate or control the hazard…" />
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-success">Saved.</p>}
      <SaveButton />
    </form>
  );
}
