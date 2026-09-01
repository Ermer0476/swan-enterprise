"use client";

import { useEffect, useState, useTransition } from "react";
import { updateStoresItemDepartmentAction } from "@/features/procurement/actions";
import { REQUISITION_DEPARTMENTS, REQUISITION_DEPARTMENT_LABELS, type RequisitionDepartmentValue } from "@/features/procurement/schema";
import { Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// Click-to-edit, same pattern as EditableImpaCell — a catalogue item's
// department can be mis-tagged on entry and needs correcting later, not
// just set once at creation time.
export function EditableDepartmentCell({ itemId, department }: { itemId: string; department: RequisitionDepartmentValue }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState(department);

  useEffect(() => {
    setValue(department);
  }, [department]);

  function save(next: RequisitionDepartmentValue) {
    setValue(next);
    setError(null);
    const fd = new FormData();
    fd.set("itemId", itemId);
    fd.set("department", next);
    startTransition(async () => {
      const res = await updateStoresItemDepartmentAction({ ok: false, error: null }, fd);
      if (res.ok) setEditing(false);
      else setError(res.error);
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded hover:opacity-80"
        title="Click to edit department"
      >
        <Badge tone={department === "ENGINE" ? "accent" : "neutral"}>{REQUISITION_DEPARTMENT_LABELS[department]}</Badge>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Select
        value={value}
        onChange={(e) => save(e.target.value as RequisitionDepartmentValue)}
        onBlur={() => setEditing(false)}
        autoFocus
        disabled={pending}
        className="h-7 w-28 text-xs"
      >
        {REQUISITION_DEPARTMENTS.map((d) => (
          <option key={d} value={d}>
            {REQUISITION_DEPARTMENT_LABELS[d]}
          </option>
        ))}
      </Select>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
