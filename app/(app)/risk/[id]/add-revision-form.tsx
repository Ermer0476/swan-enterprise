"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil } from "lucide-react";
import {
  addRevisionAction,
  type ActionResult,
} from "@/features/risk/actions";
import { REVIEW_TRIGGERS, REVIEW_TRIGGER_LABELS, APPROVAL_LEVELS, APPROVAL_LEVEL_LABELS } from "@/features/risk/schema";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Opening…" : "Start editing"}
    </Button>
  );
}

export function AddRevisionForm({
  documentId,
  defaults,
}: {
  documentId: string;
  defaults: {
    smsProcedureRefs: string | null;
    riskMatrixRef: string | null;
    checklistsRequired: string | null;
    approvalLevel: string;
  } | null;
}) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction] = useActionState<ActionResult, FormData>(
    addRevisionAction,
    { ok: false, error: null },
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setShowForm(false);
    }
  }, [state.ok]);

  if (!showForm) {
    return (
      <Button onClick={() => setShowForm(true)}>
        <Pencil className="h-4 w-4" /> Edit Risk Assessment
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 rounded-md border border-border bg-card p-4"
    >
      <div className="text-sm font-medium">Edit Risk Assessment — this opens a new draft revision</div>
      <input type="hidden" name="documentId" value={documentId} />

      <div className="space-y-1.5">
        <Label htmlFor="changeSummary">Change summary</Label>
        <AutoGrowInput
          id="changeSummary"
          name="changeSummary"
          placeholder="What changed in this revision?"
          className="max-h-none"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reviewTrigger">Review trigger</Label>
        <Select id="reviewTrigger" name="reviewTrigger" defaultValue="">
          <option value="">— Not specified —</option>
          {REVIEW_TRIGGERS.map((t) => (
            <option key={t} value={t}>{REVIEW_TRIGGER_LABELS[t]}</option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="smsProcedureRefs">SMS Procedure</Label>
        <Input id="smsProcedureRefs" name="smsProcedureRefs" defaultValue={defaults?.smsProcedureRefs ?? ""} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="riskMatrixRef">Risk Matrix</Label>
          <Input id="riskMatrixRef" name="riskMatrixRef" defaultValue={defaults?.riskMatrixRef ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="checklistsRequired">Checklists Required</Label>
          <Input id="checklistsRequired" name="checklistsRequired" defaultValue={defaults?.checklistsRequired ?? ""} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="approvalLevel">Approval Level</Label>
        <Select id="approvalLevel" name="approvalLevel" defaultValue={defaults?.approvalLevel ?? "LOCAL"}>
          {APPROVAL_LEVELS.map((a) => <option key={a} value={a}>{APPROVAL_LEVEL_LABELS[a]}</option>)}
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        Hazard rows from the current revision will be copied forward automatically — edit or remove them below after creating.
      </p>

      {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
      <div className="flex items-center gap-2">
        <SubmitButton />
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
