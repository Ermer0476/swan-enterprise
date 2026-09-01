"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { addExecutionControlAction, type ActionResult } from "@/features/risk/actions";
import { AutoGrowInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function AddControlButton({
  executionId,
  hazardRowId,
}: {
  executionId: string;
  hazardRowId: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Add Control
      </Button>
    );
  }

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set("executionId", executionId);
    fd.set("hazardRowId", hazardRowId);
    fd.set("controlText", text);
    startTransition(async () => {
      const res: ActionResult = await addExecutionControlAction(fd);
      if (!res.ok) setError(res.error);
      else {
        setText("");
        setOpen(false);
      }
    });
  }

  return (
    <div className="mt-1.5 space-y-1.5 rounded-md border border-warning/30 bg-warning/5 p-2">
      <AutoGrowInput
        autoFocus
        placeholder="Additional control for this job"
        className="max-h-none bg-background"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-1.5">
        <Button type="button" size="sm" disabled={pending || text.trim().length < 3} onClick={submit}>
          {pending ? "Adding…" : "Save"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => { setOpen(false); setError(null); }}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
