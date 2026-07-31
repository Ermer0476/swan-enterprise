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
  ROOT_CAUSE_SUBCATEGORIES,
  ROOT_CAUSE_SUBCATEGORY_LABELS,
} from "@/lib/root-cause";
import { Label, Select } from "@/components/ui/input";
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
}: {
  deficiencyId: string;
  rootCauseCategory: string;
  rootCauseSubCategory: string;
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

  const subOptions =
    category && (ROOT_CAUSE_SUBCATEGORIES as Record<string, readonly string[]>)[category];

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
              {subOptions.map((s) => (
                <option key={s} value={s}>
                  {ROOT_CAUSE_SUBCATEGORY_LABELS[category as keyof typeof ROOT_CAUSE_SUBCATEGORY_LABELS][s]}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-success">Saved.</p>}
      <SaveButton />
    </form>
  );
}
