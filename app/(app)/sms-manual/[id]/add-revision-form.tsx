"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import {
  addRevisionAction,
  type ActionResult,
} from "@/features/sms-manual/actions";
import { AutoGrowInput, Textarea, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Add revision"}
    </Button>
  );
}

export function AddRevisionForm({ documentId }: { documentId: string }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    addRevisionAction,
    { ok: false, error: null },
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="documentId" value={documentId} />
      <div className="space-y-1.5">
        <Label htmlFor="changeSummary">Change summary</Label>
        <AutoGrowInput
          id="changeSummary"
          name="changeSummary"
          placeholder="What changed in this revision?"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="revContent">Content</Label>
        <Textarea
          id="revContent"
          name="content"
          rows={6}
          placeholder="Updated procedure text (Markdown supported)…"
        />
      </div>
      {state.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
