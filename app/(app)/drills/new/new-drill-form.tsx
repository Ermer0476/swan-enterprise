"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createDrillAction,
  type ActionResult,
} from "@/features/drills/actions";
import { DRILL_TYPES } from "@/features/drills/schema";
import { humanize } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Textarea, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Record Drill"}
    </Button>
  );
}

export function NewDrillForm({
  vessels,
}: {
  vessels: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    createDrillAction,
    { ok: false, error: null },
  );

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="drillType">Drill type</Label>
              <Select id="drillType" name="drillType" defaultValue="FIRE">
                {DRILL_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vesselId">Vessel</Label>
              <Select id="vesselId" name="vesselId" defaultValue="" required>
                <option value="" disabled>Select vessel…</option>
                {vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="drillDate">Date</Label>
              <Input id="drillDate" name="drillDate" type="date" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scenario">Scenario</Label>
            <AutoGrowInput id="scenario" name="scenario" placeholder="Brief scenario description" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="conductedBy">Conducted by</Label>
            <AutoGrowInput id="conductedBy" name="conductedBy" placeholder="Name / rank" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="participants">Participants</Label>
            <Textarea id="participants" name="participants" rows={2} placeholder="Names / ranks / count of participants…" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observations">Observations / follow-up</Label>
            <Textarea id="observations" name="observations" rows={4} placeholder="Deficiencies noted, lessons learned…" />
          </div>

          {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
          <div className="flex items-center gap-2">
            <SubmitButton />
            <Link href="/drills"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
