"use client";

import { useActionState } from "react";
import { createRequisitionAction, type ActionResult } from "@/features/procurement/actions";
import {
  REQUISITION_CATEGORIES,
  REQUISITION_CATEGORY_LABELS,
  REQUISITION_DEPARTMENTS,
  REQUISITION_DEPARTMENT_LABELS,
} from "@/features/procurement/schema";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initial: ActionResult = { ok: false, error: null };

export function NewRequisitionForm({ vesselId }: { vesselId: string }) {
  const [state, action, pending] = useActionState(createRequisitionAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="vesselId" value={vesselId} />
      <div className="space-y-1.5">
        <Label htmlFor="department">Department</Label>
        <Select id="department" name="department" required defaultValue="">
          <option value="" disabled>
            Select…
          </option>
          {REQUISITION_DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {REQUISITION_DEPARTMENT_LABELS[d]}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="category">Category</Label>
        <Select id="category" name="category" required defaultValue="">
          <option value="" disabled>
            Select…
          </option>
          {REQUISITION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {REQUISITION_CATEGORY_LABELS[c]}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="requestedBy">Requested By</Label>
        <Input id="requestedBy" name="requestedBy" placeholder="e.g. Bosun, Cook, C/Off" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Starting…" : "Start Draft"}
      </Button>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
