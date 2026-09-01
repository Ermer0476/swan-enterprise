"use client";

import { useState, useTransition } from "react";
import { updateFindingResponsibleAction } from "@/features/tmsa/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Inline-editable "Responsible" person for a CAP finding. */
export function ResponsibleEdit({ id, value }: { id: string; value: string }) {
  const [saved, setSaved] = useState(value ?? "");
  const [draft, setDraft] = useState(value ?? "");
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  const save = () => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("responsible", draft);
    start(async () => {
      await updateFindingResponsibleAction(fd);
      setSaved(draft.trim());
      setEditing(false);
    });
  };

  if (editing) {
    return (
      <div className="min-w-[9rem]">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus placeholder="e.g. Marine Superintendent" className="h-8 text-sm" />
        <div className="mt-1 flex items-center gap-2">
          <Button type="button" size="sm" onClick={save} disabled={pending} className="h-6 px-2 text-xs">
            {pending ? "…" : "Save"}
          </Button>
          <button
            type="button"
            onClick={() => {
              setDraft(saved);
              setEditing(false);
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-1">
      <span className="text-muted-foreground">{saved || <span className="italic">—</span>}</span>
      <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-accent hover:underline">
        Edit
      </button>
    </div>
  );
}
