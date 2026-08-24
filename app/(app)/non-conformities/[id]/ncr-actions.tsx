"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import {
  advanceNcrAction,
  deleteNcrAction,
  deleteDraftNcrAction,
  reportDraftNcrAction,
  type ActionResult,
} from "@/features/non-conformities/actions";
import { humanize } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function NcrActions({
  ncrId,
  nextStatus,
  canAdvance,
  canDelete,
}: {
  ncrId: string;
  nextStatus: string | null;
  canAdvance: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (fd: FormData) => Promise<ActionResult>) {
    setError(null);
    const fd = new FormData();
    fd.set("ncrId", ncrId);
    startTransition(async () => {
      const res = await action(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {canAdvance && nextStatus && (
          <Button onClick={() => run(advanceNcrAction)} disabled={pending}>
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
            variant="outline"
            onClick={() => {
              if (confirm("Delete this NCR?")) run(deleteNcrAction);
            }}
            disabled={pending}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}

/** Deletes its own Draft — a permanent action, so it's confirmed first. */
export function DeleteDraftNcrButton({ ncrId }: { ncrId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!confirm("Delete this draft? This can't be undone.")) return;
    setError(null);
    const fd = new FormData();
    fd.set("ncrId", ncrId);
    startTransition(async () => {
      const res = await deleteDraftNcrAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" onClick={submit} disabled={pending}>
        <Trash2 className="h-4 w-4" /> Delete Draft
      </Button>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}

/** Submits a Draft — assigns its NCR number (status DRAFT → OPEN). */
export function ReportDraftNcrButton({ ncrId }: { ncrId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set("ncrId", ncrId);
    startTransition(async () => {
      const res = await reportDraftNcrAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" onClick={submit} disabled={pending}>
        Raise NCR <ArrowRight className="h-4 w-4" />
      </Button>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
