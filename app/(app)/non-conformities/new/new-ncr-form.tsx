"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createNcrAction,
  type ActionResult,
} from "@/features/non-conformities/actions";
import { SEVERITIES, NCR_SOURCES, PERSON_IN_CHARGE_OPTIONS } from "@/features/non-conformities/schema";
import { humanize } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="intent" value="report" disabled={pending}>
      {pending ? "Raising…" : "Raise NCR"}
    </Button>
  );
}

function DraftSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="intent" value="draft" variant="outline" disabled={pending}>
      {pending ? "Saving…" : "Save as Draft"}
    </Button>
  );
}

type Prefill = {
  title: string;
  vesselId: string;
  source: string;
  sourceEntityId: string;
  requirement: string;
  description: string;
  raisedAt: string;
};

export function NewNcrForm({
  vessels,
  suggestedRefNoByVessel,
  prefill,
  isShipboard,
  ownVesselId,
  ownVesselName,
}: {
  vessels: { id: string; name: string; code: string | null }[];
  suggestedRefNoByVessel: Record<string, string>;
  prefill: Prefill;
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

  async function guardedCreateNcrAction(
    prev: ActionResult,
    formData: FormData,
  ): Promise<ActionResult> {
    lastSubmittedFormData.current = formData;
    return createNcrAction(prev, formData);
  }

  const [state, formAction] = useActionState<ActionResult, FormData>(
    guardedCreateNcrAction,
    { ok: false, error: null },
  );
  // Each vessel has its own NCR sequence (see suggestNextRefNo) — re-derive
  // the preview instantly as the user switches vessels, no round trip needed
  // since the server already computed every vessel's next number up front.
  // Shipboard is locked to its own vessel regardless of any prefill.
  const [vesselId, setVesselId] = useState(isShipboard ? (ownVesselId ?? "") : prefill.vesselId);
  const suggestedRefNo = suggestedRefNoByVessel[vesselId] ?? suggestedRefNoByVessel[""] ?? "";

  // Runs after every rejected submission — repairs the fields the browser
  // just wiped (plain inputs directly on the DOM; the vessel select via its
  // own React state) using exactly what was typed.
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
    ["title", "source", "severity", "requirement", "raisedAt", "targetDate",
      "description", "personInCharge",
    ].forEach(restore);

    if (!isShipboard) setVesselId(String(fd.get("vesselId") ?? ""));
  }, [state, isShipboard]);

  return (
    <Card>
      <CardContent className="pt-5">
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="sourceEntityId" value={prefill.sourceEntityId} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="refNo">NCR number</Label>
              <Input id="refNo" value={suggestedRefNo} disabled />
              <p className="text-xs text-muted-foreground">Assigned automatically — each vessel keeps its own sequence.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <AutoGrowInput id="title" name="title" defaultValue={prefill.title} placeholder="Brief summary of the finding" required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="source">Source</Label>
              <Select id="source" name="source" defaultValue={prefill.source || "INTERNAL_AUDIT"}>
                {NCR_SOURCES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="severity">Severity</Label>
              <Select id="severity" name="severity" defaultValue="MEDIUM">
                {SEVERITIES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
              </Select>
            </div>
            {isShipboard ? (
              <div className="space-y-1.5">
                <Label>Vessel</Label>
                <input type="hidden" name="vesselId" value={vesselId} />
                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                  {ownVesselName ?? "— No vessel assigned —"}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="vesselId">Vessel</Label>
                <Select id="vesselId" name="vesselId" value={vesselId} onChange={(e) => setVesselId(e.target.value)}>
                  <option value="">— Shore / N/A —</option>
                  {vessels.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}{v.code ? ` (${v.code})` : ""}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="requirement">Requirement / clause breached</Label>
            <AutoGrowInput id="requirement" name="requirement" defaultValue={prefill.requirement}
              placeholder="e.g. ISM Code 10.3 / SMS ADM-05 §4.2" required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="raisedAt">Raised on</Label>
              <Input id="raisedAt" name="raisedAt" type="date" defaultValue={prefill.raisedAt} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="targetDate">Target close date</Label>
              <Input id="targetDate" name="targetDate" type="date" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description of non-conformity</Label>
            <AutoGrowInput id="description" name="description" required
              defaultValue={prefill.description}
              placeholder="What was found, and how it fails the requirement…" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="personInCharge">Person in charge</Label>
            <Select id="personInCharge" name="personInCharge" defaultValue={PERSON_IN_CHARGE_OPTIONS[0]}>
              {PERSON_IN_CHARGE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </div>

          {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
          <div className="flex items-center gap-2">
            <SubmitButton />
            <DraftSubmitButton />
            <Link href="/non-conformities"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
