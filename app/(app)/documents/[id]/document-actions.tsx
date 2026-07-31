"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import {
  advanceDocumentAction,
  deleteDocumentAction,
  type ActionResult,
} from "@/features/documents/actions";
import { humanize } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function DocumentActions({
  docId,
  nextStatus,
  canAdvance,
  canDelete,
}: {
  docId: string;
  nextStatus: string | null;
  canAdvance: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (fd: FormData) => Promise<ActionResult>) {
    setError(null);
    const fd = new FormData();
    fd.set("docId", docId);
    startTransition(async () => {
      const res = await action(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {canAdvance && nextStatus && (
          <Button onClick={() => run(advanceDocumentAction)} disabled={pending}>
            Advance to {humanize(nextStatus)} <ArrowRight className="h-4 w-4" />
          </Button>
        )}
        {!nextStatus && (
          <span className="text-sm text-muted-foreground">Superseded — this record is now read-only.</span>
        )}
        {canDelete && (
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Delete this document?")) run(deleteDocumentAction);
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
