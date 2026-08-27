"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deactivateSeafarerAction, deleteSeafarerAction } from "@/features/crewing/actions";
import type { ActionResult } from "@/features/shared/action-result";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * The two state changes on a seafarer's record, kept apart on the page because
 * they are not the same act (§3.5):
 *
 *  - leaving the manning pool is EMPLOYMENT. Reversible, and the normal thing
 *    to do with a man who has stopped sailing for the company.
 *  - deleting is "this row was a mistake". The action refuses outright if he
 *    has any service history, because that is a record with a retention
 *    obligation.
 *
 * Neither is erasure. Erasing a man's personal data under the Data Privacy Act
 * is redaction, which is a later batch and is stated on the page rather than
 * implied by a delete button that does not do it.
 */

function PendingButton({
  label,
  pendingLabel,
  variant,
}: {
  label: string;
  pendingLabel: string;
  variant?: "outline" | "ghost" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function SeafarerRowActions({
  seafarerId,
  active,
  updatedAt,
  canEdit,
  canDelete,
}: {
  seafarerId: string;
  active: boolean;
  updatedAt: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function runDeactivate(formData: FormData) {
    const result: ActionResult = await deactivateSeafarerAction(formData);
    setError(result.ok ? null : result.error);
  }

  async function runDelete(formData: FormData) {
    const result: ActionResult = await deleteSeafarerAction(formData);
    // A successful delete redirects and never returns.
    setError(result.ok ? null : result.error);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit && (
          <form action={runDeactivate} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="seafarerId" value={seafarerId} />
            <input type="hidden" name="updatedAt" value={updatedAt} />
            <input type="hidden" name="active" value={active ? "false" : "true"} />
            <PendingButton
              variant="outline"
              label={active ? "Mark as left the pool" : "Return to the manning pool"}
              pendingLabel="Saving…"
            />
            <p className="max-w-prose text-xs text-muted-foreground">
              He stops appearing in the pool but his record and his service history are kept — the
              MLC record of service.
            </p>
          </form>
        )}

        {canDelete && (
          <div className="border-t border-border pt-4">
            {confirming ? (
              <form action={runDelete} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="seafarerId" value={seafarerId} />
                <PendingButton variant="danger" label="Yes, delete this record" pendingLabel="Deleting…" />
                <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </form>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
                  Delete record
                </Button>
                <p className="max-w-prose text-xs text-muted-foreground">
                  For a record created in error only. Refused once he has any service history, and it
                  does not erase his personal data — that is a separate act.
                </p>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
