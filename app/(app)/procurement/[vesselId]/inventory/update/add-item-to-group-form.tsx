"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addInventoryStoresItemAction, type ActionResult } from "@/features/procurement/actions";
import type { StoresCategoryValue, RequisitionDepartmentValue } from "@/features/procurement/schema";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initial: ActionResult = { ok: false, error: null };

// Sibling of AddSubCategoryForm, scoped to one already-existing group — the
// Sub Category (and Category/Department) are fixed via hidden inputs, so
// adding a second, third, etc. item under a group never requires retyping
// its name.
export function AddItemToGroupForm({
  vesselId,
  department,
  category,
  subGroup,
}: {
  vesselId: string;
  department: RequisitionDepartmentValue;
  category: StoresCategoryValue;
  subGroup: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addInventoryStoresItemAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
    // Depend on the whole state object, not state.ok — a second successful
    // submit in the same session leaves `ok` at `true` (no change to key
    // off), so this would only fire once if it depended on state.ok alone.
  }, [state]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 text-xs text-muted-foreground hover:text-foreground">
        + Add Item
      </button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="mt-2 flex flex-wrap items-end gap-3 border-t border-border pt-3">
      <input type="hidden" name="vesselId" value={vesselId} />
      <input type="hidden" name="department" value={department} />
      <input type="hidden" name="category" value={category} />
      {subGroup && <input type="hidden" name="subGroup" value={subGroup} />}
      <div className="space-y-1.5">
        <Label htmlFor={`name-${subGroup ?? "none"}`}>Description</Label>
        <Input id={`name-${subGroup ?? "none"}`} name="name" required autoFocus className="h-8 w-56 px-1.5" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`unit-${subGroup ?? "none"}`}>Unit</Label>
        <Input id={`unit-${subGroup ?? "none"}`} name="unit" required placeholder="pc, ltr, kg…" className="h-8 w-24 px-1.5" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
        Cancel
      </button>
      {state.error && <p className="w-full text-xs text-danger">{state.error}</p>}
    </form>
  );
}
