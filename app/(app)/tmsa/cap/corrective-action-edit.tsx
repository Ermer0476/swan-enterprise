"use client";

import { useState, useTransition } from "react";
import { updateFindingCorrectiveActionAction } from "@/features/tmsa/actions";
import { AutoGrowInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Inline-editable corrective action for a CAP finding. */
export function CorrectiveActionEdit({ id, value }: { id: string; value: string }) {
  const [saved, setSaved] = useState(value ?? "");
  const [draft, setDraft] = useState(value ?? "");
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  const save = () => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("correctiveAction", draft);
    start(async () => {
      await updateFindingCorrectiveActionAction(fd);
      setSaved(draft.trim());
      setEditing(false);
    });
  };

  if (editing) {
    return (
      <div>
        <AutoGrowInput value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus placeholder="Enter the corrective action…" />
        <div className="mt-2 flex items-center gap-2">
          <Button type="button" size="sm" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setDraft(saved);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {saved ? <p className="whitespace-pre-line text-muted-foreground">{saved}</p> : <p className="text-sm italic text-muted-foreground">No corrective action yet.</p>}
      <button type="button" onClick={() => setEditing(true)} className="mt-1 text-xs font-medium text-accent hover:underline">
        Edit
      </button>
    </div>
  );
}
