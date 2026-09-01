"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  closeNcrAction,
  type ActionResult,
} from "@/features/non-conformities/actions";
import { AutoGrowInput, Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function CloseOutButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Closing out…" : "Close Out"}
    </Button>
  );
}

/**
 * R-AS-001 section 7 — Designated Person Ashore close-out, only ever
 * rendered while status = VERIFIED (gates VERIFIED → CLOSED). A record can
 * still flag its own follow-up here, separate from anything noted at
 * Verification.
 */
export function CloseOutForm({ ncrId }: { ncrId: string }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    closeNcrAction,
    { ok: false, error: null },
  );
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [closedOutDate, setClosedOutDate] = useState("");

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="ncrId" value={ncrId} />

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="closeOutChoice"
            checked={!followUpRequired}
            onChange={() => setFollowUpRequired(false)}
            className="h-4 w-4"
          />
          Completed and closed out.
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="closeOutChoice"
            checked={followUpRequired}
            onChange={() => setFollowUpRequired(true)}
            className="h-4 w-4"
          />
          Follow-up is required as per SMS.
        </label>
        <input type="hidden" name="closeOutFollowUpRequired" value={followUpRequired ? "on" : ""} />
      </div>

      {followUpRequired && (
        <div className="space-y-1.5 pl-6">
          <Label htmlFor="closeOutFollowUpNature">Nature of follow-up</Label>
          <AutoGrowInput id="closeOutFollowUpNature" name="closeOutFollowUpNature" placeholder="Describe what still needs to happen…" />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="closedOutDate">Closed out date</Label>
        <Input
          id="closedOutDate"
          name="closedOutDate"
          type="date"
          value={closedOutDate}
          onChange={(e) => setClosedOutDate(e.target.value)}
          required
          className="w-40"
        />
      </div>

      {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
      <CloseOutButton />
    </form>
  );
}

/** Read-only view once the NCR has been closed. */
export function CloseOutSummary({
  followUpRequired,
  followUpNature,
  closedBy,
  closedAt,
}: {
  followUpRequired: boolean;
  followUpNature: string | null;
  closedBy: { fullName: string; rank: string | null } | null;
  closedAt: string | null;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Outcome</div>
        <p className="mt-1 text-sm">
          {followUpRequired ? "Follow-up is required as per SMS." : "Completed and closed out."}
        </p>
      </div>
      {followUpRequired && followUpNature && (
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Nature of follow-up</div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{followUpNature}</p>
        </div>
      )}
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Designated Person Ashore</div>
        <p className="mt-1 text-sm">
          {closedBy ? `${closedBy.fullName}${closedBy.rank ? `, ${closedBy.rank}` : ""}` : "—"}
          {closedAt ? ` · ${closedAt}` : ""}
        </p>
      </div>
    </div>
  );
}
