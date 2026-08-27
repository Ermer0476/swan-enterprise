"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  ROOT_CAUSE_CATEGORIES,
  ROOT_CAUSE_LABELS,
  type RootCauseCategoryValue,
} from "@/lib/root-cause";
import type { RootCauseSubcategoryOptions } from "@/lib/reference-registry";
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
  subcategoryOptions,
}: {
  findingId: string;
  rootCauseCategory: string;
  rootCauseSubCategory: string;
  rootCause: string;
  saveAction: (prev: AuditActionResult, fd: FormData) => Promise<AuditActionResult>;
  subcategoryOptions: RootCauseSubcategoryOptions;
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

  const subOptions = category ? subcategoryOptions[category as RootCauseCategoryValue] : undefined;

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
