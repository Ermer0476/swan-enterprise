"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  createDrillAction,
  type ActionResult,
} from "@/features/drills/actions";
import { DRILL_TYPES } from "@/features/drills/schema";
import { humanize } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { VesselField } from "@/components/ui/vessel-field";
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

  async function guardedCreateDrillAction(
    prev: ActionResult,
    formData: FormData,
  ): Promise<ActionResult> {
    lastSubmittedFormData.current = formData;
    return createDrillAction(prev, formData);
  }

  const [state, formAction] = useActionState<ActionResult, FormData>(
    guardedCreateDrillAction,
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
    ["drillType", "vesselId", "drillDate", "scenario", "conductedBy",
      "participants", "observations",
    ].forEach(restore);
  }, [state]);

  return (
    <Card>
      <CardContent className="pt-5">
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="drillType">Drill type</Label>
              <Select id="drillType" name="drillType" defaultValue="FIRE">
                {DRILL_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
              </Select>
            </div>
            <VesselField
              vessels={vessels}
              isShipboard={isShipboard}
              ownVesselId={ownVesselId}
              ownVesselName={ownVesselName}
              blankLabel="Select vessel…"
              required
            />
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
            <AutoGrowInput id="participants" name="participants" placeholder="Names / ranks / count of participants…" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observations">Observations / follow-up</Label>
            <AutoGrowInput id="observations" name="observations" placeholder="Deficiencies noted, lessons learned…" />
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
