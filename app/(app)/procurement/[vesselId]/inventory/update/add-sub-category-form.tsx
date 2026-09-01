"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addInventoryStoresItemAction, type ActionResult } from "@/features/procurement/actions";
import {
  STORES_CATEGORIES_BY_DEPARTMENT,
  STORES_CATEGORY_LABELS,
  type StoresCategoryValue,
  type RequisitionDepartmentValue,
} from "@/features/procurement/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initial: ActionResult = { ok: false, error: null };

// There's no standalone Sub Category entity — `subGroup` only exists as a
// field on StoresCatalogueItem, so "adding a sub category" really means
// naming the group and creating its first item in one step; the group then
// shows up on its own as a card (see update-inventory-form.tsx) and further
// items go in from that card's own "+ Add Item" control, not from here.
export function AddSubCategoryForm({
  vesselId,
  department,
  category,
}: {
  vesselId: string;
  department: RequisitionDepartmentValue;
  category: StoresCategoryValue | null;
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
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="mb-4">
        + Add Sub Category
      </Button>
    );
  }

  return (
    <Card className="mb-4">
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">New Sub Category</h2>
          <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>
        <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="vesselId" value={vesselId} />
          <input type="hidden" name="department" value={department} />
          <div className="space-y-1.5">
            <Label htmlFor="subGroup">Sub Category</Label>
            <Input id="subGroup" name="subGroup" required autoFocus placeholder="e.g. Fire Control Symbols (150mmx150mm)" className="w-64" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">First Item — Description</Label>
            <Input id="name" name="name" required className="w-64" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="unit">Unit</Label>
            <Input id="unit" name="unit" required placeholder="pc, ltr, kg…" className="w-28" />
          </div>
          {category ? (
            <input type="hidden" name="category" value={category} />
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Select id="category" name="category" defaultValue={STORES_CATEGORIES_BY_DEPARTMENT[department][0]} className="w-48">
                {STORES_CATEGORIES_BY_DEPARTMENT[department].map((c) => (
                  <option key={c} value={c}>
                    {STORES_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add"}
          </Button>
        </form>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
      </CardContent>
    </Card>
  );
}
