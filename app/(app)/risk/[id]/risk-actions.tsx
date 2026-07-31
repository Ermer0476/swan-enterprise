"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import {
  closeRiskAssessmentAction,
  deleteRiskAssessmentAction,
  type ActionResult,
} from "@/features/risk/actions";
import { Button } from "@/components/ui/button";

export function RiskActions({
  riskId,
  isActive,
  canClose,
  canDelete,
}: {
  riskId: string;
  isActive: boolean;
  canClose: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (fd: FormData) => Promise<ActionResult>) {
    setError(null);
    const fd = new FormData();
    fd.set("riskId", riskId);
    startTransition(async () => {
      const res = await action(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {isActive ? (
          canClose && (
            <Button onClick={() => run(closeRiskAssessmentAction)} disabled={pending}>
              <CheckCircle2 className="h-4 w-4" /> Close Assessment
            </Button>
          )
        ) : (
          <span className="text-sm text-muted-foreground">This assessment is no longer active.</span>
        )}
        {canDelete && (
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Delete this risk assessment?")) run(deleteRiskAssessmentAction);
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
