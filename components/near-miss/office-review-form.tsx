"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  saveOfficeReviewAction,
  type ActionResult,
} from "@/features/near-miss/actions";
import { AutoGrowInput, Label, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={disabled || pending}>
      {pending ? "Saving…" : "Save comments"}
    </Button>
  );
}

/** yyyy-mm-dd for <input type="date">, or "" when unset. */
function toDateInput(v: string | null): string {
  if (!v) return "";
  return v.slice(0, 10);
}

export function OfficeReviewForm({
  nearMissId,
  companyComments,
  reviewedAt = null,
  disabled = false,
  lifecycleActions,
}: {
  nearMissId: string;
  companyComments: string;
  reviewedAt?: string | null;
  disabled?: boolean;
  // Lifecycle (advance/delete) sits at the bottom of this card, to the left
  // of Date reviewed — a separate action set from the office-review save,
  // just placed alongside it rather than in its own card.
  lifecycleActions?: React.ReactNode;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    saveOfficeReviewAction,
    { ok: false, error: null },
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="nearMissId" value={nearMissId} />

      {/* Comments, Date reviewed and Save together in one row — same shape
          (and same dashed-box treatment) as the CAPA tracker's add-row:
          main field, a narrow date field, button at the end. */}
      <div className="grid grid-cols-1 items-end gap-2 rounded-md border border-dashed border-border p-3 sm:grid-cols-[1fr_9rem_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="companyComments">Company comments</Label>
          <AutoGrowInput
            id="companyComments"
            name="companyComments"
            defaultValue={companyComments}
            placeholder="Office oversight / comments…"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reviewedAt">Date reviewed</Label>
          <Input
            id="reviewedAt"
            name="reviewedAt"
            type="date"
            defaultValue={toDateInput(reviewedAt)}
            disabled={disabled}
          />
        </div>
        {!disabled && <SaveButton disabled={disabled} />}
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-success">Saved.</p>}

      {lifecycleActions && (
        <div className="border-t border-border pt-4">{lifecycleActions}</div>
      )}
    </form>
  );
}
