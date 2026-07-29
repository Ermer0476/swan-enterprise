"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  saveInvestigationAction,
  type ActionResult,
} from "@/features/incidents/actions";
import {
  ROOT_CAUSE_CATEGORIES,
  ROOT_CAUSE_LABELS,
  INCIDENT_SEVERITIES,
  humanize,
} from "@/features/incidents/schema";
import { Textarea, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HumanFactorsPicker } from "@/components/incidents/human-factors-picker";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save investigation"}
    </Button>
  );
}

export function InvestigationForm({
  incidentId,
  investigationDetails,
  severity,
  rootCauseCategory,
  rootCause,
  humanFactorPrimary,
  humanFactorContributing,
}: {
  incidentId: string;
  investigationDetails: string;
  severity: string;
  rootCauseCategory: string;
  rootCause: string;
  humanFactorPrimary: string;
  humanFactorContributing: string[];
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    saveInvestigationAction,
    { ok: false, error: null },
  );
  const [category, setCategory] = useState(rootCauseCategory);
  const isHumanFactors = category === "HUMAN_FACTORS";

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="incidentId" value={incidentId} />
      <div className="space-y-1.5">
        <Label htmlFor="investigationDetails">Details</Label>
        <Textarea
          id="investigationDetails"
          name="investigationDetails"
          rows={4}
          required
          defaultValue={investigationDetails}
          placeholder="What happened, based on the investigation — the office's own account…"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="severity">Severity</Label>
        <Select id="severity" name="severity" required defaultValue={severity}>
          <option value="" disabled>— Select severity —</option>
          {INCIDENT_SEVERITIES.map((s) => (
            <option key={s} value={s}>{humanize(s)}</option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rootCauseCategory">Root cause category</Label>
        <Select
          id="rootCauseCategory"
          name="rootCauseCategory"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="" disabled>— Select root cause —</option>
          {ROOT_CAUSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {ROOT_CAUSE_LABELS[c]}
            </option>
          ))}
        </Select>
      </div>
      {/* Human factors (shown only for the Human Factors category) */}
      {isHumanFactors && (
        <HumanFactorsPicker
          initialPrimary={humanFactorPrimary}
          initialContributing={humanFactorContributing}
        />
      )}

      <div className="space-y-1.5">
        <Label htmlFor="rootCause">Root cause description</Label>
        <Textarea
          id="rootCause"
          name="rootCause"
          rows={3}
          defaultValue={rootCause}
          placeholder="Underlying cause identified during investigation…"
        />
      </div>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-success">Saved.</p>}
      <SaveButton />
    </form>
  );
}
