"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  saveDeficiencyRootCauseAction,
  type ActionResult,
} from "@/features/psc/actions";
import {
  ROOT_CAUSE_CATEGORIES,
  ROOT_CAUSE_LABELS,
  type RootCauseCategoryValue,
} from "@/lib/root-cause";
import type { RootCauseSubcategoryOptions } from "@/lib/reference-registry";
import { AutoGrowInput, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save root cause"}
    </Button>
  );
}

export function DeficiencyRootCauseForm({
  deficiencyId,
  rootCauseCategory,
  rootCauseSubCategory,
  rootCause,
  subcategoryOptions,
}: {
  deficiencyId: string;
  rootCauseCategory: string;
  rootCauseSubCategory: string;
  rootCause: string;
  subcategoryOptions: RootCauseSubcategoryOptions;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    saveDeficiencyRootCauseAction,
    { ok: false, error: null },
  );
  const [category, setCategory] = useState(rootCauseCategory);
  const [subCategory, setSubCategory] = useState(rootCauseSubCategory);

  function handleCategoryChange(next: string) {
    setCategory(next);
    setSubCategory(""); // sub-category list differs per category — reset on change
  }

  const subOptions = category ? subcategoryOptions[category as RootCauseCategoryValue] : undefined;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="deficiencyId" value={deficiencyId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Root cause category</Label>
          <Select
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
          <div className="space-y-1">
            <Label className="text-xs">Sub-category</Label>
            <Select
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
      </div>

      <div className="space-y-1">
        <Label htmlFor="rootCause">Root cause description</Label>
        <AutoGrowInput
          id="rootCause"
          name="rootCause"
          defaultValue={rootCause}
          placeholder="Explain the underlying cause identified during investigation…"
        />
      </div>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-success">Saved.</p>}
      <SaveButton />
    </form>
  );
}
