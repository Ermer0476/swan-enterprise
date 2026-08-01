"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  ROOT_CAUSE_CATEGORIES,
  ROOT_CAUSE_LABELS,
  ROOT_CAUSE_SUBCATEGORIES,
  ROOT_CAUSE_SUBCATEGORY_LABELS,
} from "@/lib/root-cause";
import { AutoGrowInput, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { AuditActionResult } from "./types";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save root cause"}
    </Button>
  );
}

// Generic root-cause picker for a single audit finding — Internal and
// External Audit each pass in their own saveRootCauseAction (different
// permission/table underneath), matching how AuditFindingsPanel already
// injects addAction/updateAction/deleteAction per module.
export function FindingRootCauseForm({
  findingId,
  rootCauseCategory,
  rootCauseSubCategory,
  rootCause,
  saveAction,
}: {
  findingId: string;
  rootCauseCategory: string;
  rootCauseSubCategory: string;
  rootCause: string;
  saveAction: (prev: AuditActionResult, fd: FormData) => Promise<AuditActionResult>;
}) {
  const [state, formAction] = useActionState<AuditActionResult, FormData>(
    saveAction,
    { ok: false, error: null },
  );
  const [category, setCategory] = useState(rootCauseCategory);
  const [subCategory, setSubCategory] = useState(rootCauseSubCategory);

  function handleCategoryChange(next: string) {
    setCategory(next);
    setSubCategory("");
  }

  const subOptions =
    category && (ROOT_CAUSE_SUBCATEGORIES as Record<string, readonly string[]>)[category];

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="findingId" value={findingId} />
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

      <div className="space-y-1">
        <Label className="text-xs">Root cause description</Label>
        <AutoGrowInput
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
