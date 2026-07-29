"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import {
  advanceStatusAction,
  deleteIncidentAction,
  type ActionResult,
} from "@/features/incidents/actions";
import { humanize } from "@/features/incidents/schema";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function IncidentActions({
  incidentId,
  nextStatus,
  canAdvance,
  canDelete,
}: {
  incidentId: string;
  nextStatus: string | null;
  canAdvance: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [verifiedAt, setVerifiedAt] = useState(() => new Date().toISOString().slice(0, 10));

  function run(action: (fd: FormData) => Promise<ActionResult>, extra?: Record<string, string>) {
    setError(null);
    const fd = new FormData();
    fd.set("incidentId", incidentId);
    if (extra) {
      for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    }
    startTransition(async () => {
      const res = await action(fd);
      if (!res.ok) setError(res.error);
    });
  }

  const isClosingStep = nextStatus === "CLOSED";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {canAdvance && nextStatus && !isClosingStep && (
          <Button onClick={() => run(advanceStatusAction)} disabled={pending}>
            Advance to {humanize(nextStatus)} <ArrowRight className="h-4 w-4" />
          </Button>
        )}

        {/* Closing = Management verification — the date is entered manually
            (the actual sign-off may not be "today"), unlike verifiedById/
            verifiedByName which are always the closing user's session. */}
        {canAdvance && isClosingStep && (
          <>
            <div className="space-y-1">
              <Label htmlFor="verifiedAt" className="text-xs font-normal text-muted-foreground">
                Verified date
              </Label>
              <Input
                id="verifiedAt"
                type="date"
                value={verifiedAt}
                onChange={(e) => setVerifiedAt(e.target.value)}
                className="w-40"
              />
            </div>
            <Button
              onClick={() => run(advanceStatusAction, { verifiedAt })}
              disabled={pending || !verifiedAt}
            >
              Close &amp; Verify <ArrowRight className="h-4 w-4" />
            </Button>
          </>
        )}

        {!nextStatus && (
          <span className="text-sm text-muted-foreground">
            Investigation closed — this record is now read-only.
          </span>
        )}
        {canDelete && (
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Delete this incident? This can't be undone from the UI."))
                run(deleteIncidentAction);
            }}
            disabled={pending}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        )}
      </div>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
