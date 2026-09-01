"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { updateExecutionControlWordingAction, type ActionResult } from "@/features/risk/actions";
import { AutoGrowInput, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Lets office draft its own reworded version of a vessel-added execution
 * control before deciding a disposition. The vessel's own submission is
 * shown read-only and is never overwritten — office's draft is saved to a
 * separate field, and only becomes the text actually meant for the master
 * template once the item is marked Added to Template. */
export function EditExecutionControlForm({
  controlId,
  vesselText,
  initialOfficeWording,
}: {
  controlId: string;
  vesselText: string;
  initialOfficeWording: string;
}) {
  const [text, setText] = useState(initialOfficeWording);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = text.trim() !== initialOfficeWording.trim();

  function save() {
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set("controlId", controlId);
    fd.set("officeWording", text);
    startTransition(async () => {
      const res: ActionResult = await updateExecutionControlWordingAction(fd);
      if (!res.ok) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-2">
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Vessel submitted</div>
        <p className="mt-0.5 whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-sm text-muted-foreground">
          {vesselText}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Office wording (final text to insert, once added to template)</Label>
        <AutoGrowInput
          value={text}
          placeholder="Draft the cleaned-up wording here before deciding…"
          onChange={(e) => {
            setText(e.target.value);
            setSaved(false);
          }}
          className="max-h-none text-sm"
        />
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={!dirty || pending} onClick={save}>
            <Check className="h-3.5 w-3.5" /> {pending ? "Saving…" : "Save wording"}
          </Button>
          {saved && !dirty && <span className="text-xs text-success">Saved</span>}
        </div>
        {error && <p className="text-xs text-danger" role="alert">{error}</p>}
      </div>
    </div>
  );
}
