"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateDraftNcrAction,
  type ActionResult,
} from "@/features/non-conformities/actions";
import { SEVERITIES, NCR_SOURCES, PERSON_IN_CHARGE_OPTIONS } from "@/features/non-conformities/schema";
import { humanize } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

export type EditableNcr = {
  id: string;
  title: string;
  vesselId: string | null;
  source: string;
  sourceEntityId: string | null;
  requirement: string;
  severity: string;
  raisedAt: string; // yyyy-mm-dd
  targetDate: string; // yyyy-mm-dd or ""
  description: string;
  personInCharge: string;
};

/**
 * Full edit of a Draft's own report fields. Only ever rendered for the
 * draft's own creator — any shipboard user, or the specific office user
 * who created it (see [id]/page.tsx's isOwnDraft gate).
 */
export function EditDraftNcrForm({
  ncr,
  vessels,
  isShipboard,
  ownVesselName,
}: {
  ncr: EditableNcr;
  vessels: { id: string; name: string; code: string | null }[];
  isShipboard: boolean;
  ownVesselName: string | null;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    (prev, formData) => updateDraftNcrAction(ncr.id, prev, formData),
    { ok: false, error: null },
  );
  const [vesselId, setVesselId] = useState(ncr.vesselId ?? "");

  return (
    <Card className="mb-6">
      <CardHeader><CardTitle>Edit Draft</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="sourceEntityId" value={ncr.sourceEntityId ?? ""} />

          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <AutoGrowInput id="title" name="title" defaultValue={ncr.title} placeholder="Brief summary of the finding" required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="source">Source</Label>
              <Select id="source" name="source" defaultValue={ncr.source}>
                {NCR_SOURCES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="severity">Severity</Label>
              <Select id="severity" name="severity" defaultValue={ncr.severity}>
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
            <AutoGrowInput id="requirement" name="requirement" defaultValue={ncr.requirement}
              placeholder="e.g. ISM Code 10.3 / SMS ADM-05 §4.2" required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="raisedAt">Raised on</Label>
              <Input id="raisedAt" name="raisedAt" type="date" defaultValue={ncr.raisedAt} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="targetDate">Target close date</Label>
              <Input id="targetDate" name="targetDate" type="date" defaultValue={ncr.targetDate} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description of non-conformity</Label>
            <AutoGrowInput id="description" name="description" required
              defaultValue={ncr.description}
              placeholder="What was found, and how it fails the requirement…" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="personInCharge">Person in charge</Label>
            <Select id="personInCharge" name="personInCharge" defaultValue={ncr.personInCharge}>
              {PERSON_IN_CHARGE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </div>

          {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
          <div className="flex items-center gap-2">
            <SaveButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
