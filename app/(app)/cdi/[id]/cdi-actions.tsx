"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import {
  closeCdiAction,
  deleteCdiAction,
  type ActionResult,
} from "@/features/cdi/actions";
import { Button } from "@/components/ui/button";

export function CdiActions({
  inspectionId,
  status,
  canClose,
  canDelete,
}: {
  inspectionId: string;
  status: string;
  canClose: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (fd: FormData) => Promise<ActionResult>) {
    setError(null);
    const fd = new FormData();
    fd.set("inspectionId", inspectionId);
    startTransition(async () => {
      const res = await action(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {status !== "CLOSED" && canClose && (
          <Button onClick={() => run(closeCdiAction)} disabled={pending}>
            <CheckCircle2 className="h-4 w-4" /> Close inspection
          </Button>
        )}
        {status === "CLOSED" && (
          <span className="text-sm text-muted-foreground">Closed — this inspection is read-only.</span>
        )}
        {canDelete && (
          <Button variant="outline"
            onClick={() => { if (confirm("Delete this inspection and all its observations?")) run(deleteCdiAction); }}
            disabled={pending}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
