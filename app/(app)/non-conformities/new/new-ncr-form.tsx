"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createNcrAction,
  type ActionResult,
} from "@/features/non-conformities/actions";
import { SEVERITIES, NCR_SOURCES, PERSON_IN_CHARGE_OPTIONS } from "@/features/non-conformities/schema";
import { humanize } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Textarea, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Raising…" : "Raise NCR"}
    </Button>
  );
}

type Prefill = {
  vesselId: string;
  source: string;
  sourceEntityId: string;
  requirement: string;
  description: string;
  raisedAt: string;
};

export function NewNcrForm({
  vessels,
  suggestedRefNo,
  prefill,
}: {
  vessels: { id: string; name: string }[];
  suggestedRefNo: string;
  prefill: Prefill;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    createNcrAction,
    { ok: false, error: null },
  );

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="sourceEntityId" value={prefill.sourceEntityId} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="refNo">NCR number</Label>
              <Input id="refNo" name="refNo" defaultValue={suggestedRefNo} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <AutoGrowInput id="title" name="title" placeholder="Brief summary of the finding" required />
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
            <div className="space-y-1.5">
              <Label htmlFor="vesselId">Vessel</Label>
              <Select id="vesselId" name="vesselId" defaultValue={prefill.vesselId}>
                <option value="">— Shore / N/A —</option>
                {vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </Select>
            </div>
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
            <Textarea id="description" name="description" rows={4} required
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
            <Link href="/non-conformities"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
