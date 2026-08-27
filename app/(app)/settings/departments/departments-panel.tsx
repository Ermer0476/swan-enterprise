"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import {
  saveDepartmentAction,
  toggleDepartmentActiveAction,
  type ActionResult,
} from "@/features/departments/actions";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const INITIAL: ActionResult = { ok: false, error: null };

export type DepartmentRowView = {
  id: string;
  name: string;
  side: "SHIP" | "SHORE";
  description: string | null;
  isSystem: boolean;
  active: boolean;
  userCount: number;
};

function sideLabel(side: "SHIP" | "SHORE"): string {
  return side === "SHIP" ? "Ship" : "Shore";
}

function DepartmentRow({ dept }: { dept: DepartmentRowView }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(saveDepartmentAction, INITIAL);
  const [togglePending, startToggle] = useTransition();
  const [toggleError, setToggleError] = useState<string | null>(null);

  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state.ok]);

  function toggleActive() {
    setToggleError(null);
    const fd = new FormData();
    fd.set("departmentId", dept.id);
    startToggle(async () => {
      const res = await toggleDepartmentActiveAction(fd);
      if (!res.ok) setToggleError(res.error);
    });
  }

  if (editing) {
    return (
      <tr className="border-b border-border last:border-0 bg-primary/[0.03]">
        <td colSpan={6} className="px-4 py-3">
          <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-start">
            <input type="hidden" name="departmentId" value={dept.id} />
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input name="name" defaultValue={dept.name} className="h-8" />
              {state.fieldErrors?.name && <p className="text-xs text-danger">{state.fieldErrors.name}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Side</Label>
              <Select name="side" defaultValue={dept.side} className="h-8">
                <option value="SHIP">Ship</option>
                <option value="SHORE">Shore</option>
              </Select>
              {state.fieldErrors?.side && <p className="text-xs text-danger">{state.fieldErrors.side}</p>}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Description</Label>
              <Input name="description" defaultValue={dept.description ?? ""} className="h-8" />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-4">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
            {state.error && <p className="text-sm text-danger sm:col-span-4" role="alert">{state.error}</p>}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30">
      <td className="px-4 py-2.5">
        <Badge tone={dept.side === "SHIP" ? "accent" : "neutral"}>{sideLabel(dept.side)}</Badge>
      </td>
      <td className="px-4 py-2.5">
        <span className="font-medium">{dept.name}</span>
        {dept.isSystem && <Badge tone="neutral" className="ml-2 align-middle">System</Badge>}
      </td>
      <td className="px-4 py-2.5 text-muted-foreground">{dept.description || "—"}</td>
      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{dept.userCount}</td>
      <td className="px-4 py-2.5">
        <Badge tone={dept.active ? "success" : "neutral"}>{dept.active ? "Active" : "Deactivated"}</Badge>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-3 text-xs">
          {dept.active && (
            <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-accent hover:underline">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )}
          {(!dept.active || !dept.isSystem) && (
            <button
              type="button"
              onClick={toggleActive}
              disabled={togglePending}
              className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {dept.active ? "Deactivate" : "Reactivate"}
            </button>
          )}
        </div>
        {toggleError && <p className="mt-1 text-xs text-danger" role="alert">{toggleError}</p>}
      </td>
    </tr>
  );
}

function AddDepartmentForm() {
  const [expanded, setExpanded] = useState(false);
  const [state, action, pending] = useActionState(saveDepartmentAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  if (!expanded) {
    return (
      <button type="button" onClick={() => setExpanded(true)} className="mb-4 inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
        <Plus className="h-4 w-4" /> Add department
      </button>
    );
  }

  return (
    <form ref={formRef} action={action} className="mb-4 space-y-2 rounded-md border border-dashed border-border p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">Name</Label>
          <Input name="name" placeholder="e.g. Catering" autoComplete="off" className="h-8" />
          {state.fieldErrors?.name && <p className="text-xs text-danger">{state.fieldErrors.name}</p>}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Side</Label>
          <Select name="side" defaultValue="SHIP" className="h-8">
            <option value="SHIP">Ship</option>
            <option value="SHORE">Shore</option>
          </Select>
          {state.fieldErrors?.side && <p className="text-xs text-danger">{state.fieldErrors.side}</p>}
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Description</Label>
          <Input name="description" placeholder="What this department covers" autoComplete="off" className="h-8" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Side (ship vs shore) is the one fixed axis; the name is free text so the office can add its own departments.</p>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add department"}
        </Button>
        <button type="button" onClick={() => setExpanded(false)} className="text-xs text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}

export function DepartmentsPanel({ rows }: { rows: DepartmentRowView[] }) {
  return (
    <div>
      <AddDepartmentForm />
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Side</th>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Description</th>
              <th className="px-4 py-2.5 font-medium">Users</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No departments yet.
                </td>
              </tr>
            ) : (
              rows.map((d) => <DepartmentRow key={d.id} dept={d} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
