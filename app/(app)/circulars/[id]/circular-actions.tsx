"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import {
  deleteCircularAction,
  type ActionResult,
} from "@/features/circulars/actions";
import { Button } from "@/components/ui/button";

export function CircularActions({
  circularId,
  canDelete,
}: {
  circularId: string;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function remove() {
    setError(null);
    const fd = new FormData();
    fd.set("circularId", circularId);
    startTransition(async () => {
      const res: ActionResult = await deleteCircularAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  if (!canDelete) return null;

  return (
    <div className="space-y-2">
      {confirming ? (
        <div className="flex items-center gap-2 text-sm">
          <span>Delete this circular?</span>
          <Button variant="danger" size="sm" onClick={remove} disabled={pending}>
            {pending ? "Deleting…" : "Yes, delete"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setConfirming(true)}>
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      )}
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
