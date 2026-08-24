"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createFamiliarizationBatchAction, type ActionResult } from "@/features/familiarization/actions";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ScheduleItemOption = { id: string; itemNo: string | null; name: string };

function SubmitButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || count === 0}>
      {pending ? "Saving…" : `Log ${count || ""} Completion${count === 1 ? "" : "s"}`.trim()}
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
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [state, formAction] = useActionState<ActionResult, FormData>(createFamiliarizationBatchAction, {
    ok: false,
    error: null,
  });

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="vesselId" value={vesselId} />

          <div className="space-y-1.5">
            <Label>Topics covered this session</Label>
            <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 rounded-md border border-border p-3 sm:grid-cols-2">
              {scheduleItems.map((item) => (
                <label key={item.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="scheduleItemIds"
                    value={item.id}
                    checked={checked.has(item.id)}
                    onChange={() => toggle(item.id)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  />
                  <span>
                    {item.itemNo && <span className="mr-1 text-muted-foreground">{item.itemNo}.</span>}
                    {item.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="remarks">Details of Familiarization</Label>
            <AutoGrowInput
              id="remarks"
              name="remarks"
              className="max-h-none"
              placeholder="Narrative of what was covered / discussed this session…"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="completedDate">Date</Label>
              <Input id="completedDate" name="completedDate" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notedBy">Noted by</Label>
              <AutoGrowInput id="notedBy" name="notedBy" placeholder="Name / rank" />
            </div>
          </div>

          {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
          <div className="flex items-center gap-2">
            <SubmitButton count={checked.size} />
            <Link href={`/drills/matrix?vesselId=${vesselId}&tab=familiarization`}>
              <Button type="button" variant="ghost">Cancel</Button>
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
