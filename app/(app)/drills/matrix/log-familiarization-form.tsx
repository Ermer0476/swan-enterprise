"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { createFamiliarizationRecordAction, type ActionResult } from "@/features/familiarization/actions";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ScheduleItemOption = { id: string; itemNo: string | null; name: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Plus className="h-4 w-4" /> {pending ? "Saving…" : "Log completion"}
    </Button>
  );
}

export function LogFamiliarizationForm({
  vesselId,
  scheduleItems,
}: {
  vesselId: string;
  scheduleItems: ScheduleItemOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionResult, FormData>(createFamiliarizationRecordAction, {
    ok: false,
    error: null,
  });

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Log Familiarization
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3"
    >
      <input type="hidden" name="vesselId" value={vesselId} />
      <div className="min-w-56 space-y-1">
        <Label className="text-xs">Topic</Label>
        <Select name="scheduleItemId" defaultValue="" required>
          <option value="" disabled>— Select topic —</option>
          {scheduleItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.itemNo ? `${item.itemNo} — ` : ""}{item.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Date</Label>
        <Input name="completedDate" type="date" required />
      </div>
      <div className="min-w-40 space-y-1">
        <Label className="text-xs">Noted by</Label>
        <AutoGrowInput name="notedBy" placeholder="Name / rank" />
      </div>
      <div className="min-w-48 flex-1 space-y-1">
        <Label className="text-xs">Remarks</Label>
        <AutoGrowInput name="remarks" placeholder="Optional" />
      </div>
      <div className="flex items-center gap-2">
        <SubmitButton />
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      {state.error && <p className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
