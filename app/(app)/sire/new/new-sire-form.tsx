"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { createSireAction, type ActionResult } from "@/features/sire/actions";
import {
  SIRE_INSPECTION_TYPES,
  SIRE_INSPECTION_TYPE_LABELS,
  SIRE_OVERALL_RESULTS,
  SIRE_OVERALL_RESULT_LABELS,
} from "@/features/sire/schema";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { VesselField } from "@/components/ui/vessel-field";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Create inspection"}
    </Button>
  );
}

export function NewSireForm({
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

  async function guardedCreateSireAction(
    prev: ActionResult,
    formData: FormData,
  ): Promise<ActionResult> {
    lastSubmittedFormData.current = formData;
    return createSireAction(prev, formData);
  }

  const [state, formAction] = useActionState<ActionResult, FormData>(
    guardedCreateSireAction,
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
    ["inspectorName", "inspectingCompany", "inspectionDate", "port",
      "inspectionType", "vesselId", "overallResult", "sireVersion", "summary",
    ].forEach(restore);
  }, [state]);

  return (
    <Card>
      <CardContent className="pt-5">
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inspectorName">Inspector name</Label>
              <AutoGrowInput id="inspectorName" name="inspectorName" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inspectingCompany">Inspecting company (Oil Major / Charterer)</Label>
              <AutoGrowInput id="inspectingCompany" name="inspectingCompany" placeholder="e.g. Shell, BP, Chevron" required />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="inspectionDate">Inspection date</Label>
              <Input id="inspectionDate" name="inspectionDate" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="port">Port of inspection</Label>
              <AutoGrowInput id="port" name="port" placeholder="e.g. Singapore" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inspectionType">Type of inspection</Label>
              <Select id="inspectionType" name="inspectionType" defaultValue="">
                <option value="">— Select —</option>
                {SIRE_INSPECTION_TYPES.map((t) => (
                  <option key={t} value={t}>{SIRE_INSPECTION_TYPE_LABELS[t]}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <VesselField
              label="Vessel name"
              vessels={vessels}
              isShipboard={isShipboard}
              ownVesselId={ownVesselId}
              ownVesselName={ownVesselName}
              blankLabel="— Select —"
            />
            <div className="space-y-1.5">
              <Label htmlFor="overallResult">Overall result</Label>
              <Select id="overallResult" name="overallResult" defaultValue="">
                <option value="">— Not yet assessed —</option>
                {SIRE_OVERALL_RESULTS.map((r) => (
                  <option key={r} value={r}>{SIRE_OVERALL_RESULT_LABELS[r]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sireVersion">SIRE version</Label>
              <AutoGrowInput id="sireVersion" name="sireVersion" defaultValue="2.0" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="summary">Remarks</Label>
            <AutoGrowInput id="summary" name="summary" placeholder="Overall remarks…" />
          </div>
          {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
          <div className="flex items-center gap-2">
            <SubmitButton />
            <Link href="/sire"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
