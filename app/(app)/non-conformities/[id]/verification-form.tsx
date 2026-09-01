"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  verifyNcrAction,
  type ActionResult,
} from "@/features/non-conformities/actions";
import { NCR_VERIFICATION_OUTCOMES, NCR_VERIFICATION_OUTCOME_LABELS } from "@/features/non-conformities/schema";
import { AutoGrowInput, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function VerifyButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Verifying…" : "Verify"}
    </Button>
  );
}

/**
 * R-AS-001 section 6 — DPA / Safety Mgt. Committee sign-off, only ever
 * rendered while status = SUBMITTED_TO_OFFICE (gates SUBMITTED_TO_OFFICE →
 * VERIFIED). "Assistance required" is a separate, non-exclusive checkbox on
 * the same form — not part of the Completed/Follow-up either-or choice.
 */
export function VerificationForm({ ncrId }: { ncrId: string }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    verifyNcrAction,
    { ok: false, error: null },
  );
  const [outcome, setOutcome] = useState<string>("COMPLETED");
  const [assistanceRequired, setAssistanceRequired] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="ncrId" value={ncrId} />

      <div className="space-y-2">
        {NCR_VERIFICATION_OUTCOMES.map((o) => (
          <label key={o} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="verificationOutcome"
              value={o}
              checked={outcome === o}
              onChange={() => setOutcome(o)}
              className="h-4 w-4"
            />
            {NCR_VERIFICATION_OUTCOME_LABELS[o]}
          </label>
        ))}
      </div>

      {outcome === "FOLLOWUP_REQUIRED" && (
        <div className="space-y-1.5 pl-6">
          <Label htmlFor="verificationFollowUpNature">Nature of follow-up</Label>
          <AutoGrowInput id="verificationFollowUpNature" name="verificationFollowUpNature" placeholder="Describe what still needs to happen…" />
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="assistanceRequired"
          checked={assistanceRequired}
          onChange={(e) => setAssistanceRequired(e.target.checked)}
          className="h-4 w-4"
        />
        Assistance is required.
      </label>

      {assistanceRequired && (
        <div className="space-y-1.5 pl-6">
          <Label htmlFor="assistanceNature">Nature of required assistance</Label>
          <AutoGrowInput id="assistanceNature" name="assistanceNature" placeholder="What assistance is needed, and from whom…" />
        </div>
      )}

      {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
      <VerifyButton />
    </form>
  );
}

/** Read-only view once verification has already happened (status VERIFIED or CLOSED). */
export function VerificationSummary({
  outcome,
  followUpNature,
  assistanceRequired,
  assistanceNature,
  verifiedBy,
  verifiedAt,
}: {
  outcome: string | null;
  followUpNature: string | null;
  assistanceRequired: boolean;
  assistanceNature: string | null;
  verifiedBy: { fullName: string; rank: string | null } | null;
  verifiedAt: string | null;
}) {
  if (!outcome) return <p className="text-sm text-muted-foreground">Not yet verified.</p>;
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Outcome</div>
        <p className="mt-1 text-sm">
          {NCR_VERIFICATION_OUTCOME_LABELS[outcome as (typeof NCR_VERIFICATION_OUTCOMES)[number]] ?? outcome}
        </p>
      </div>
      {followUpNature && (
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Nature of follow-up</div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{followUpNature}</p>
        </div>
      )}
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Assistance required</div>
        <p className="mt-1 text-sm">{assistanceRequired ? "Yes" : "No"}</p>
      </div>
      {assistanceRequired && assistanceNature && (
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Nature of required assistance</div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{assistanceNature}</p>
        </div>
      )}
      {verifiedBy && (
        <p className="text-xs text-muted-foreground">
          — {verifiedBy.fullName}{verifiedBy.rank ? `, ${verifiedBy.rank}` : ""}
          {verifiedAt ? ` · ${verifiedAt}` : ""}
        </p>
      )}
    </div>
  );
}
