"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteFamiliarizationSessionAction, type ActionResult } from "@/features/familiarization/actions";
import { Button } from "@/components/ui/button";

export function FamiliarizationActions({ sessionId }: { sessionId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function remove() {
    const fd = new FormData();
    fd.set("sessionId", sessionId);
    startTransition(async () => {
      const res: ActionResult = await deleteFamiliarizationSessionAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {confirming ? (
        <>
          <span className="text-sm text-muted-foreground">Delete this familiarization record?</span>
          <Button variant="outline" size="sm" onClick={remove} disabled={pending}>
            {pending ? "Deleting…" : "Yes, delete"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>Cancel</Button>
        </>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
