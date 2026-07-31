"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createDefectAction,
  type ActionResult,
} from "@/features/defects/actions";
import { DEFECT_SEVERITIES } from "@/features/defects/schema";
import { humanize } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Textarea, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Report Defect"}
    </Button>
  );
}

export function NewDefectForm({
  vessels,
}: {
  vessels: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    createDefectAction,
    { ok: false, error: null },
  );

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="equipment">Equipment / system</Label>
              <AutoGrowInput id="equipment" name="equipment" placeholder="e.g. No.2 generator" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vesselId">Vessel</Label>
              <Select id="vesselId" name="vesselId" defaultValue="" required>
                <option value="" disabled>Select vessel…</option>
                {vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="severity">Severity</Label>
              <Select id="severity" name="severity" defaultValue="MINOR">
                {DEFECT_SEVERITIES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={4} placeholder="What's wrong, and how it was found…" required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dateRaised">Date raised</Label>
              <Input id="dateRaised" name="dateRaised" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="targetRectificationDate">Target rectification date</Label>
              <Input id="targetRectificationDate" name="targetRectificationDate" type="date" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="raisedBy">Raised by</Label>
            <AutoGrowInput id="raisedBy" name="raisedBy" placeholder="Name / rank" />
          </div>

          {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
          <div className="flex items-center gap-2">
            <SubmitButton />
            <Link href="/defects"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
