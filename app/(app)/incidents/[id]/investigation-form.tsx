"use client";

import { useState, useActionState } from "react";
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
import type { RootCauseCategoryValue } from "@/lib/root-cause";
import type { RootCauseSubcategoryOptions } from "@/lib/reference-registry";
import { AutoGrowInput, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function InvestigationForm({
  incidentId,
  investigationDetails,
  severity,
  rootCauseCategory,
  rootCauseSubCategory,
  rootCause,
  subcategoryOptions,
}: {
  incidentId: string;
  investigationDetails: string;
  severity: string;
  rootCauseCategory: string;
  rootCauseSubCategory: string;
  rootCause: string;
  subcategoryOptions: RootCauseSubcategoryOptions;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    saveInvestigationAction,
    { ok: false, error: null },
  );
  // Controlled (not defaultValue) so a validation error never silently
  // discards what the user typed — a re-render only ever reflects this
  // component's own state, never a stale/refetched prop.
  const [details, setDetails] = useState(investigationDetails);
  const [severityValue, setSeverityValue] = useState(severity);
  const [rootCauseDescription, setRootCauseDescription] = useState(rootCause);
  const [category, setCategory] = useState(rootCauseCategory);
  const [subCategory, setSubCategory] = useState(rootCauseSubCategory);

  function handleCategoryChange(next: string) {
    setCategory(next);
    setSubCategory(""); // sub-category list differs per category — reset on change
  }

  const subOptions = category ? subcategoryOptions[category as RootCauseCategoryValue] : undefined;

  // Submitting via a plain FormData built from this component's own state —
  // not the browser's native form-submission collection — because a native
  // <form action={formAction}> apparently resets <select> elements' live DOM
  // value (though not <textarea>s') partway through an Actions round trip.
  // That's a DOM/React-internals quirk, not a state bug: this component's
  // own React state was never wrong, only what the browser handed to the
  // server on submit was. Building FormData straight from state sidesteps
  // that entirely — the server now always gets exactly what's on screen.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("incidentId", incidentId);
    fd.set("investigationDetails", details);
    fd.set("severity", severityValue);
    fd.set("rootCauseCategory", category);
    fd.set("rootCauseSubCategory", subCategory);
    fd.set("rootCause", rootCauseDescription);
    formAction(fd);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="investigationDetails">Details</Label>
        <AutoGrowInput
          id="investigationDetails"
          name="investigationDetails"
          required
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="What happened, based on the investigation — the office's own account…"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="severity">Severity</Label>
        <Select
          id="severity"
          name="severity"
          required
          value={severityValue}
          onChange={(e) => setSeverityValue(e.target.value)}
        >
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
            {/* Keep a persisted-but-now-hidden sub-category selectable. */}
            {subCategory && !subOptions.some((o) => o.value === subCategory) && (
              <option value={subCategory}>{subCategory} (hidden)</option>
            )}
            {subOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
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
          value={rootCauseDescription}
          onChange={(e) => setRootCauseDescription(e.target.value)}
          placeholder="Underlying cause identified during investigation…"
        />
      </div>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-success">Saved.</p>}
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Saving…" : "Save investigation"}
      </Button>
    </form>
  );
}
