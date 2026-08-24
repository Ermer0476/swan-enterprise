"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import {
  advanceNearMissAction,
  deleteDraftNearMissAction,
  deleteNearMissAction,
  reportDraftNearMissAction,
  type ActionResult,
} from "@/features/near-miss/actions";
import { humanize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function NearMissActions({
  nearMissId,
  nextStatus,
  canAdvance,
  canDelete,
}: {
  nearMissId: string;
  nextStatus: string | null;
  canAdvance: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function run(action: (fd: FormData) => Promise<ActionResult>) {
    setError(null);
    const fd = new FormData();
    fd.set("nearMissId", nearMissId);
    startTransition(async () => {
      const res = await action(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        {canAdvance && nextStatus && (
          <Button type="button" onClick={() => run(advanceNearMissAction)} disabled={pending}>
            Advance to {humanize(nextStatus)} <ArrowRight className="h-4 w-4" />
          </Button>
        )}
        {!nextStatus && (
          <span className="text-sm text-muted-foreground">
            Closed — this record is now read-only.
          </span>
        )}
        {canDelete && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmingDelete(true)}
            disabled={pending}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this near miss?"
        confirming={pending}
        onConfirm={() => {
          setConfirmingDelete(false);
          run(deleteNearMissAction);
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}

/** Vessel-only: deletes its own Draft — a permanent action, so it's confirmed first. */
export function DeleteDraftButton({ nearMissId }: { nearMissId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function submit() {
    setConfirming(false);
    setError(null);
    const fd = new FormData();
    fd.set("nearMissId", nearMissId);
    startTransition(async () => {
      const res = await deleteDraftNearMissAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" onClick={() => setConfirming(true)} disabled={pending}>
        <Trash2 className="h-4 w-4" /> Delete Draft
      </Button>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <ConfirmDialog
        open={confirming}
        title="Delete this draft?"
        description="This can't be undone."
        confirming={pending}
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

/**
 * Vessel-only: submits a Draft for office review (status DRAFT → REPORTED).
 * `blocked` mirrors the same rule enforced server-side in
 * reportDraftNearMissAction — every corrective action must be Closed first.
 */
export function ReportDraftButton({ nearMissId, blocked }: { nearMissId: string; blocked: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set("nearMissId", nearMissId);
    startTransition(async () => {
      const res = await reportDraftNearMissAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        onClick={submit}
        disabled={pending || blocked}
        title={blocked ? "Close every corrective action in the All CAPA Items table before reporting to the office" : undefined}
      >
        {pending ? "Submitting…" : "Report Near Miss"} <ArrowRight className="h-4 w-4" />
      </Button>
      {blocked && (
        <p className="text-xs text-muted-foreground">
          Close all corrective actions first.
        </p>
      )}
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
