"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addStoresItemAction, type ActionResult } from "@/features/procurement/actions";
import {
  STORES_CATEGORIES_BY_DEPARTMENT,
  STORES_CATEGORY_LABELS,
  REQUISITION_DEPARTMENTS,
  REQUISITION_DEPARTMENT_LABELS,
  type RequisitionDepartmentValue,
} from "@/features/procurement/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initial: ActionResult = { ok: false, error: null };

export function AddStoresItemForm({ vesselId }: { vesselId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(addStoresItemAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [department, setDepartment] = useState<RequisitionDepartmentValue>("DECK");
  const [category, setCategory] = useState<string>("DECK");

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state.ok]);

  // Category is department-scoped (Engine only ever deals in its own
  // store/chemicals/tools) — jump to a valid one whenever Department changes
  // out from under the currently-picked Category.
  useEffect(() => {
    const available = STORES_CATEGORIES_BY_DEPARTMENT[department];
    if (!available.includes(category as (typeof available)[number])) {
      setCategory(available[0] ?? "DECK");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department]);

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)} className="mb-4">
        + Add Stores Item
      </Button>
    );
  }

  return (
    <Card className="mb-5">
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">New Stores catalogue item</h2>
          <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>
        <form ref={formRef} action={action} className="space-y-4">
          <input type="hidden" name="vesselId" value={vesselId} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">Description</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" name="unit" required placeholder="pc, ltr, kg…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="impaCode">IMPA Code (optional)</Label>
              <Input id="impaCode" name="impaCode" placeholder="e.g. 671801" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Select id="category" name="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                {STORES_CATEGORIES_BY_DEPARTMENT[department].map((c) => (
                  <option key={c} value={c}>
                    {STORES_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subGroup">Sub Category</Label>
              <Input id="subGroup" name="subGroup" placeholder="e.g. Fire Control Symbols (150mmx150mm)" />
            </div>
          </div>
          <div className="space-y-1.5 sm:max-w-xs">
            <Label htmlFor="department">Department</Label>
            <Select id="department" name="department" value={department} onChange={(e) => setDepartment(e.target.value as RequisitionDepartmentValue)}>
              {REQUISITION_DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {REQUISITION_DEPARTMENT_LABELS[d]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="remarks">Remarks</Label>
            <Input id="remarks" name="remarks" placeholder="Part numbers, specs, cross-references…" />
          </div>

          {category === "MEDICINE" && (
            <div className="flex flex-wrap items-center gap-4 rounded-md border border-border bg-muted/30 p-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="requiresExpiryTracking" />
                Requires expiry tracking
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="medicalChestCompliance" />
                Medical chest compliance item
              </label>
            </div>
          )}
          {category === "CHEMICALS" && (
            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="imoHazardClass">IMO Hazard Class</Label>
              <Input id="imoHazardClass" name="imoHazardClass" placeholder="e.g. 8" />
            </div>
          )}
          {category === "PAINTS" && (
            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="shelfLifeMonths">Shelf Life (months)</Label>
              <Input id="shelfLifeMonths" name="shelfLifeMonths" type="number" min={1} />
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add item"}
            </Button>
            {state.error && <p className="text-sm text-danger">{state.error}</p>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
