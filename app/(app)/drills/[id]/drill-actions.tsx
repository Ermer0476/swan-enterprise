"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import {
  closeDrillAction,
  deleteDrillAction,
  type ActionResult,
} from "@/features/drills/actions";
import { Button } from "@/components/ui/button";

export function DrillActions({
  drillId,
  isOpen,
  canClose,
  canDelete,
}: {
  drillId: string;
  isOpen: boolean;
  canClose: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (fd: FormData) => Promise<ActionResult>) {
    setError(null);
    const fd = new FormData();
    fd.set("drillId", drillId);
    startTransition(async () => {
      const res = await action(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {isOpen ? (
          canClose && (
            <Button onClick={() => run(closeDrillAction)} disabled={pending}>
              <CheckCircle2 className="h-4 w-4" /> Close Drill
            </Button>
          )
        ) : (
          <span className="text-sm text-muted-foreground">Closed — this record is now read-only.</span>
        )}
        {canDelete && (
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Delete this drill record?")) run(deleteDrillAction);
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
