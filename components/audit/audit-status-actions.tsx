"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AuditActionResult } from "./types";

type StatusAction = (fd: FormData) => Promise<AuditActionResult>;

export function AuditStatusActions({
  auditId,
  status,
  canClose,
  canDelete,
  closeAction,
  deleteAction,
}: {
  auditId: string;
  status: string;
  canClose: boolean;
  canDelete: boolean;
  closeAction: StatusAction;
  deleteAction: StatusAction;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: StatusAction) {
    setError(null);
    const fd = new FormData();
    fd.set("auditId", auditId);
    startTransition(async () => {
      const res = await action(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {status !== "CLOSED" && canClose && (
          <Button onClick={() => run(closeAction)} disabled={pending}>
            <CheckCircle2 className="h-4 w-4" /> Close audit
          </Button>
        )}
        {status === "CLOSED" && (
          <span className="text-sm text-muted-foreground">
            Closed — this audit is read-only.
          </span>
        )}
        {canDelete && (
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Delete this audit and all its findings?"))
                run(deleteAction);
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
