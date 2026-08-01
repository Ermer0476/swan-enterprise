"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import {
  advanceNearMissAction,
  deleteNearMissAction,
  type ActionResult,
} from "@/features/near-miss/actions";
import { humanize } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
            onClick={() => {
              if (confirm("Delete this near miss?")) run(deleteNearMissAction);
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
