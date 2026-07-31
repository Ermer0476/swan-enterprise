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
      <Button
        variant="outline"
        onClick={() => {
          if (confirm("Delete this circular?")) remove();
        }}
        disabled={pending}
      >
        <Trash2 className="h-4 w-4" /> Delete
      </Button>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
