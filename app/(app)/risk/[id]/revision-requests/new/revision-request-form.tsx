"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestRevisionAction, type ActionResult } from "@/features/risk/actions";
import { REVIEW_TRIGGERS, REVIEW_TRIGGER_LABELS } from "@/features/risk/schema";
import { AutoGrowInput, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Submitting…" : "Submit revision request"}
    </Button>
  );
}

export function RevisionRequestForm({ documentId }: { documentId: string }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    requestRevisionAction,
    { ok: false, error: null },
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="documentId" value={documentId} />

      <div className="space-y-1.5">
        <Label htmlFor="reviewTrigger">Reason category</Label>
        <Select id="reviewTrigger" name="reviewTrigger" defaultValue="REVISION_REQUESTED_BY_VESSEL">
          {REVIEW_TRIGGERS.map((t) => (
            <option key={t} value={t}>{REVIEW_TRIGGER_LABELS[t]}</option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reason">What should change, and why</Label>
        <AutoGrowInput
          id="reason"
          name="reason"
          placeholder="Describe the condition, hazard, or control that needs updating…"
          className="max-h-none"
          required
        />
      </div>

      <p className="text-xs text-muted-foreground">
        This submits a proposal to the office. The master Risk Assessment is not changed until
        the office approves — approval automatically creates a new draft revision for review.
      </p>

      {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
