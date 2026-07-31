"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createRiskAssessmentAction,
  type ActionResult,
} from "@/features/risk/actions";
import { RISK_RATINGS } from "@/features/risk/schema";
import { humanize } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Textarea, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save Assessment"}
    </Button>
  );
}

export function NewRiskAssessmentForm({
  vessels,
}: {
  vessels: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    createRiskAssessmentAction,
    { ok: false, error: null },
  );

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="activity">Activity / task</Label>
            <AutoGrowInput id="activity" name="activity" placeholder="e.g. Enclosed space entry for tank cleaning" required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vesselId">Vessel</Label>
              <Select id="vesselId" name="vesselId" defaultValue="">
                <option value="">— Shore / N/A —</option>
                {vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assessmentDate">Assessment date</Label>
              <Input id="assessmentDate" name="assessmentDate" type="date" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hazards">Hazards identified</Label>
            <Textarea id="hazards" name="hazards" rows={3} placeholder="What could go wrong…" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="existingControls">Existing controls</Label>
            <Textarea id="existingControls" name="existingControls" rows={2} placeholder="Controls already in place…" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="likelihood">Likelihood</Label>
              <Select id="likelihood" name="likelihood" defaultValue="MEDIUM">
                {RISK_RATINGS.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="severity">Severity</Label>
              <Select id="severity" name="severity" defaultValue="MEDIUM">
                {RISK_RATINGS.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="additionalControls">Additional controls required</Label>
            <Textarea id="additionalControls" name="additionalControls" rows={2} placeholder="Further mitigation before proceeding…" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="assessedBy">Assessed by</Label>
              <AutoGrowInput id="assessedBy" name="assessedBy" placeholder="Name / rank" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reviewDate">Review date</Label>
              <Input id="reviewDate" name="reviewDate" type="date" />
            </div>
          </div>

          {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
          <div className="flex items-center gap-2">
            <SubmitButton />
            <Link href="/risk"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
