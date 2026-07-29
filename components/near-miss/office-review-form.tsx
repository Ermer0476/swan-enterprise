"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  saveOfficeReviewAction,
  type ActionResult,
} from "@/features/near-miss/actions";
import { Textarea, Label, Input } from "@/components/ui/input";
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
}: {
  nearMissId: string;
  companyComments: string;
  reviewedAt?: string | null;
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    saveOfficeReviewAction,
    { ok: false, error: null },
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="nearMissId" value={nearMissId} />
      <div className="space-y-1.5">
        <Label htmlFor="companyComments">Company comments</Label>
        <Textarea
          id="companyComments"
          name="companyComments"
          rows={3}
          defaultValue={companyComments}
          placeholder="Office oversight / comments…"
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5 sm:w-48">
        <Label htmlFor="reviewedAt">Date reviewed</Label>
        <Input
          id="reviewedAt"
          name="reviewedAt"
          type="date"
          defaultValue={toDateInput(reviewedAt)}
          disabled={disabled}
        />
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-success">Saved.</p>}
      {!disabled && <SaveButton disabled={disabled} />}
    </form>
  );
}
