"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import {
  deleteDraftDrillAction,
  reportDraftDrillAction,
  type ActionResult,
} from "@/features/drills/actions";
import { Button } from "@/components/ui/button";

/** Deletes its own Draft — a permanent action, so it's confirmed first. */
export function DeleteDraftDrillButton({ drillId }: { drillId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!confirm("Delete this draft? This can't be undone.")) return;
    setError(null);
    const fd = new FormData();
    fd.set("drillId", drillId);
    startTransition(async () => {
      const res = await deleteDraftDrillAction(fd);
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

/** Submits a Draft — assigns its refNo (status DRAFT → OPEN). */
export function ReportDraftDrillButton({ drillId }: { drillId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set("drillId", drillId);
    startTransition(async () => {
      const res: ActionResult = await reportDraftDrillAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" onClick={submit} disabled={pending}>
        Record Drill <ArrowRight className="h-4 w-4" />
      </Button>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
