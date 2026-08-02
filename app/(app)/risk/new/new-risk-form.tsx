"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  createRiskAssessmentAction,
  type ActionResult,
} from "@/features/risk/actions";
import { RISK_RATINGS } from "@/features/risk/schema";
import { humanize } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { VesselField } from "@/components/ui/vessel-field";
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
  isShipboard,
  ownVesselId,
  ownVesselName,
}: {
  vessels: { id: string; name: string }[];
  isShipboard: boolean;
  ownVesselId: string | null;
  ownVesselName: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  // The browser resets every field in the <form> the moment a form action
  // resolves — even on a rejected (fail()) result. Capture what was
  // submitted so a failed submission only has to point at what's missing,
  // not force the user to retype everything else. Same pattern as
  // near-miss/new/new-near-miss-form.tsx.
  const lastSubmittedFormData = useRef<FormData | null>(null);

  async function guardedCreateRiskAssessmentAction(
    prev: ActionResult,
    formData: FormData,
  ): Promise<ActionResult> {
    lastSubmittedFormData.current = formData;
    return createRiskAssessmentAction(prev, formData);
  }

  const [state, formAction] = useActionState<ActionResult, FormData>(
    guardedCreateRiskAssessmentAction,
    { ok: false, error: null },
  );

  useEffect(() => {
    if (state.ok || !state.error) return;
    const fd = lastSubmittedFormData.current;
    const form = formRef.current;
    if (!fd || !form) return;

    const restore = (name: string) => {
      const el = form.elements.namedItem(name) as
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLTextAreaElement
        | null;
      if (!el) return;
      el.value = String(fd.get(name) ?? "");
      // AutoGrowInput only re-measures its height on an "input" event; a
      // direct .value write doesn't fire one, so it'd render collapsed.
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    ["activity", "vesselId", "assessmentDate", "hazards", "existingControls",
      "likelihood", "severity", "additionalControls", "assessedBy", "reviewDate",
    ].forEach(restore);
  }, [state]);

  return (
    <Card>
      <CardContent className="pt-5">
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="activity">Activity / task</Label>
            <AutoGrowInput id="activity" name="activity" placeholder="e.g. Enclosed space entry for tank cleaning" required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <VesselField
              vessels={vessels}
              isShipboard={isShipboard}
              ownVesselId={ownVesselId}
              ownVesselName={ownVesselName}
            />
            <div className="space-y-1.5">
              <Label htmlFor="assessmentDate">Assessment date</Label>
              <Input id="assessmentDate" name="assessmentDate" type="date" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hazards">Hazards identified</Label>
            <AutoGrowInput id="hazards" name="hazards" placeholder="What could go wrong…" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="existingControls">Existing controls</Label>
            <AutoGrowInput id="existingControls" name="existingControls" placeholder="Controls already in place…" />
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
            <AutoGrowInput id="additionalControls" name="additionalControls" placeholder="Further mitigation before proceeding…" />
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
