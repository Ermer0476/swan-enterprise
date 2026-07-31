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

export function RootCauseForm({
  ncrId,
  rootCauseCategory,
  rootCauseSubCategory,
}: {
  ncrId: string;
  rootCauseCategory: string;
  rootCauseSubCategory: string;
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

  const subOptions =
    category && (ROOT_CAUSE_SUBCATEGORIES as Record<string, readonly string[]>)[category];

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
