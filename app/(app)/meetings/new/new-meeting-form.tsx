"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createMeetingAction,
  type ActionResult,
} from "@/features/safety-meetings/actions";
import { MEETING_TYPES } from "@/features/safety-meetings/schema";
import { humanize } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Textarea, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Record Meeting"}
    </Button>
  );
}

export function NewMeetingForm({
  vessels,
}: {
  vessels: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    createMeetingAction,
    { ok: false, error: null },
  );

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="meetingType">Type</Label>
              <Select id="meetingType" name="meetingType" defaultValue="SAFETY_COMMITTEE">
                {MEETING_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vesselId">Vessel</Label>
              <Select id="vesselId" name="vesselId" defaultValue="">
                <option value="">— Office / Shore —</option>
                {vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meetingDate">Date</Label>
              <Input id="meetingDate" name="meetingDate" type="date" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="chairedBy">Chaired by</Label>
            <AutoGrowInput id="chairedBy" name="chairedBy" placeholder="Name / rank" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="attendees">Attendees</Label>
            <Textarea id="attendees" name="attendees" rows={2} placeholder="Names / ranks of those present…" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agenda">Agenda / topics discussed</Label>
            <Textarea id="agenda" name="agenda" rows={3} placeholder="Topics covered…" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="minutes">Minutes</Label>
            <Textarea id="minutes" name="minutes" rows={5} placeholder="Discussion, decisions, action points…" />
          </div>

          {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
          <div className="flex items-center gap-2">
            <SubmitButton />
            <Link href="/meetings"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
