"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteCrewFamiliarizationAction, type ActionResult } from "@/features/crew-familiarization/actions";
import { Button } from "@/components/ui/button";

export function CrewFamiliarizationActions({ crewFamiliarizationId }: { crewFamiliarizationId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function remove() {
    const fd = new FormData();
    fd.set("crewFamiliarizationId", crewFamiliarizationId);
    startTransition(async () => {
      const res: ActionResult = await deleteCrewFamiliarizationAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {confirming ? (
        <>
          <span className="text-sm text-muted-foreground">Delete this induction record?</span>
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
