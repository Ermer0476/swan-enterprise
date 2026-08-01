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
  ROOT_CAUSE_SUBCATEGORIES,
  ROOT_CAUSE_SUBCATEGORY_LABELS,
  INCIDENT_SEVERITIES,
  humanize,
} from "@/features/incidents/schema";
import { AutoGrowInput, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  rootCauseSubCategory,
  rootCause,
}: {
  incidentId: string;
  investigationDetails: string;
  severity: string;
  rootCauseCategory: string;
  rootCauseSubCategory: string;
  rootCause: string;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    saveInvestigationAction,
    { ok: false, error: null },
  );
  const [category, setCategory] = useState(rootCauseCategory);
  const [subCategory, setSubCategory] = useState(rootCauseSubCategory);

  function handleCategoryChange(next: string) {
    setCategory(next);
    setSubCategory(""); // sub-category list differs per category — reset on change
  }

  const subOptions =
    category && (ROOT_CAUSE_SUBCATEGORIES as Record<string, readonly string[]>)[category];

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="incidentId" value={incidentId} />
      <div className="space-y-1.5">
        <Label htmlFor="investigationDetails">Details</Label>
        <AutoGrowInput
          id="investigationDetails"
          name="investigationDetails"
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
          onChange={(e) => handleCategoryChange(e.target.value)}
        >
          <option value="" disabled>— Select root cause —</option>
          {ROOT_CAUSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {ROOT_CAUSE_LABELS[c]}
            </option>
          ))}
        </Select>
      </div>
      {subOptions && (
        <div className="space-y-1.5">
          <Label htmlFor="rootCauseSubCategory">Sub-category</Label>
          <Select
            id="rootCauseSubCategory"
            name="rootCauseSubCategory"
            required
            value={subCategory}
            onChange={(e) => setSubCategory(e.target.value)}
          >
            <option value="" disabled>— Select sub-category —</option>
            {subOptions.map((s) => (
              <option key={s} value={s}>
                {ROOT_CAUSE_SUBCATEGORY_LABELS[category as keyof typeof ROOT_CAUSE_SUBCATEGORY_LABELS][s]}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="rootCause">Root cause description</Label>
        <AutoGrowInput
          id="rootCause"
          name="rootCause"
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
