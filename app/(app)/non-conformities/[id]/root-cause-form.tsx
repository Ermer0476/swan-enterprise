"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  saveRootCauseAction,
  type ActionResult,
} from "@/features/non-conformities/actions";
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

export function RootCauseForm({
  ncrId,
  rootCauseCategory,
  rootCauseSubCategory,
  rootCause,
  subcategoryOptions,
}: {
  ncrId: string;
  rootCauseCategory: string;
  rootCauseSubCategory: string;
  rootCause: string;
  subcategoryOptions: RootCauseSubcategoryOptions;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    saveRootCauseAction,
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
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="ncrId" value={ncrId} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      </div>

      <div className="space-y-1.5">
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
